import { Injectable, UnauthorizedException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as argon2 from 'argon2';
import { PrismaService } from '../common/prisma/prisma.service';
import { EncryptionService } from '../common/encryption/encryption.service';
import { MobileMoneyFactory } from '../payments/mobile-money.service';
import { EmailService } from '../common/email/email.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /** Frais d'activation du compte vendeur (FCFA) */
  private readonly SELLER_ACTIVATION_FEE = 1000;

  /** Durée de validité d'une tentative de paiement avant expiration (15 min) */
  private readonly SELLER_FEE_PENDING_TTL_MS = 15 * 60 * 1000;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private encryption: EncryptionService,
    private mobileMoneyFactory: MobileMoneyFactory,
    private emailService: EmailService,
  ) {}

  // ─── Email / Password Auth ───────────────────────────────────────────────

  async registerWithEmail(email: string, password: string, nom: string, ville?: string, role: 'BUYER' | 'SELLER' = 'BUYER') {
    const normalizedEmail = email.toLowerCase().trim();

    // Vérifier si l'email existe déjà via le hash de recherche
    const emailHash = this.encryption.hashForSearch(normalizedEmail);
    const existing = await this.prisma.encrypted.user.findUnique({ where: { emailHash } });
    if (existing) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    // Hasher le mot de passe
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Créer l'utilisateur (l'extension chiffre automatiquement emailEncrypted)
    // nom reste en clair (affichage public)
    const user = await this.prisma.encrypted.user.create({
      data: {
        emailEncrypted: normalizedEmail as any,
        password: hashedPassword,
        nom,
        ville,
        role,
        phone: `_email_${normalizedEmail.replace(/[^a-z0-9]/g, '_')}`, // pseudo-phone unique
      } as any,
    });

    // Générer les tokens JWT
    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'super-secret-key',
      expiresIn: '7d',
    });

    // Stocker le refresh token chiffré
    await this.prisma.encrypted.user.update({
      where: { id: user.id },
      data: { refreshTokenEncrypted: refreshToken as any } as any,
    });

    // emailEncrypted est déchiffré par l'extension, nom est en clair
    const userJson = user as any;
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: userJson.emailEncrypted || null,
        nom: user.nom || '',
        avatar: user.avatar,
        ville: user.ville,
        role: user.role,
        sellerFeePaid: false,
      },
    };
  }

  /**
   * Initie le paiement des frais d'activation vendeur (1000 FCFA)
   * via Mobile Money. L'activation ne devient effective qu'après
   * confirmation du paiement (webhook provider ou confirmSellerActivation).
   */
  async activateSeller(userId: string, telephone: string, operateur: string) {
    // ─── Verrou atomique DB ────────────────────────────────────────────
    // Évite la race condition : deux requêtes simultanées pourraient toutes
    // deux passer le check "sellerFeePending = false" avant que l'une ne
    // mette à jour le champ.  On utilise une UPDATE atomique avec WHERE
    // pour "réclamer" le slot de paiement au niveau PostgreSQL :
    //   - sellerFeePaid = false (pas encore payé)
    //   - sellerFeePending = false OU expiré (>15 min)
    // Si 0 ligne affectée → un autre processus a déjà initié le paiement.
    const claimed = await this.prisma.$executeRaw`
      UPDATE "users"
      SET "sellerFeePending" = true,
          "sellerFeePendingAt" = NOW()
      WHERE "id" = ${userId}
        AND "sellerFeePaid" = false
        AND (
          "sellerFeePending" = false
          OR "sellerFeePendingAt" < NOW() - INTERVAL '15 minutes'
        )
    `;

    if (claimed === 0) {
      throw new BadRequestException(
        'Un paiement est déjà en cours ou les frais ont déjà été payés.',
      );
    }

    // Le verrou DB est acquis : on peut maintenant initier le paiement
    // sans risque de double initiation.
    const provider = this.mobileMoneyFactory.getProvider(operateur);

    // Initier un vrai paiement de 1000 FCFA via le provider
    const reference = `BAZ-SELLER-${userId}-${Date.now()}`;
    const result = await provider.initiatePayment({
      montant: this.SELLER_ACTIVATION_FEE,
      telephone,
      reference,
      description: 'Frais activation compte vendeur FasoMarket',
      operateur,
    });

    if (!result.success) {
      throw new BadRequestException(`Échec du paiement ${provider.name}: ${result.message}`);
    }

    // Marquer le paiement comme en attente de confirmation
    await this.prisma.encrypted.user.update({
      where: { id: userId },
      data: {
        sellerFeePending: true,
        sellerFeePendingAt: new Date(),
        sellerFeeRef: result.providerReference || reference,
        sellerFeeProvider: provider.name,
      } as any,
    });

    return {
      status: 'PENDING',
      providerReference: result.providerReference || reference,
      message: `💰 Paiement ${provider.name} initié. Confirmez sur votre téléphone.`,
      ...(result.paymentUrl ? { paymentUrl: result.paymentUrl } : {}),
    };
  }

  /**
   * Confirme l'activation vendeur après vérification du paiement
   * auprès du provider (ou en mode simulation si pas de clé API).
   */
  async confirmSellerActivation(userId: string, reference: string) {
    const user = await this.prisma.encrypted.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Session invalide');

    // Déjà activé (ex: confirmé par le webhook provider avant l'app) → succès
    if (user.sellerFeePaid) {
      // Rattraper un rôle manquant (ex: données créées avant l'upgrade)
      if (user.role !== 'SELLER') {
        await this.prisma.encrypted.user.update({
          where: { id: userId },
          data: { role: 'SELLER' } as any,
        });
      }
      return { message: 'Paiement confirmé. Compte vendeur activé !', sellerFeePaid: true };
    }

    if (!user.sellerFeePending) throw new BadRequestException('Aucun paiement en attente');

    const userJson = user as any;
    if (userJson.sellerFeeRef !== reference) {
      throw new BadRequestException('Référence de paiement invalide');
    }

    // Vérifier le statut réel du paiement auprès du provider
    const provider = this.mobileMoneyFactory.getProvider(userJson.sellerFeeProvider || 'ORANGE_MONEY');
    const status = await provider.checkStatus(reference);

    if (status.status !== 'SUCCESS') {
      // Paiement encore en cours de traitement côté provider (statut PENDING)
      // : on ne clôt PAS la tentative, l'utilisateur peut
      // confirmer à nouveau dans quelques instants (ou attendre le webhook).
      if (status.status === 'PENDING') {
        throw new BadRequestException(
          'Paiement encore en cours de traitement. Veuillez réessayer dans quelques instants.',
        );
      }
      // Message explicite si le provider a une raison (ex: clé API manquante)
      const message =
        status.message || 'Paiement non confirmé. Veuillez réessayer.';
      throw new BadRequestException(message);
    }

    // Paiement confirmé → activer le compte vendeur (upgrade BUYER → SELLER)
    await this.prisma.encrypted.user.update({
      where: { id: userId },
      data: {
        role: 'SELLER',
        sellerFeePaid: true,
        sellerFeePending: false,
        sellerFeePendingAt: null,
        sellerFeeRef: null,
        sellerFeeProvider: null,
      } as any,
    });

    // Log sécurisé : pas de PII, juste un événement
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`Activation vendeur ${userId.slice(0,8)}... confirmée`);
    }

    return {
      message: 'Paiement confirmé. Compte vendeur activé !',
      sellerFeePaid: true,
    };
  }

  async loginWithEmail(email: string, password: string, fcmToken?: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const emailHash = this.encryption.hashForSearch(normalizedEmail);
    const user = await this.prisma.encrypted.user.findUnique({ where: { emailHash } });

    if (!user || !user.password) {
      throw new UnauthorizedException('Identifiants incorrects');
    }

    // Vérifier le mot de passe
    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Identifiants incorrects');
    }

    // Mettre à jour le FCM token si fourni
    const updateData: any = {};
    if (fcmToken) {
      updateData.fcmTokens = user.fcmTokens || [];
      if (!updateData.fcmTokens.includes(fcmToken)) {
        updateData.fcmTokens.push(fcmToken);
      }
    }

    // Générer les tokens
    const userJson = user as any;
    const payload = { sub: user.id };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'super-secret-key',
      expiresIn: '7d',
    });

    updateData.refreshTokenEncrypted = refreshToken;

    await this.prisma.encrypted.user.update({
      where: { id: user.id },
      data: updateData as any,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: userJson.emailEncrypted || null,
        nom: userJson.nom || '',
        avatar: user.avatar,
        ville: user.ville,
        role: user.role,
        sellerFeePaid: user.sellerFeePaid,
      },
    };
  }

  // Envoie un code OTP par email (gratuit, pas de coût SMS)
  async sendOtp(email: string) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Stocker le code OTP hashé avec argon2
    const hashedCode = await argon2.hash(code, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,  // 64 MB
      timeCost: 3,           // 3 itérations
      parallelism: 1,        // 1 thread (serveur séquentiel)
    });

    // Chercher ou créer l'utilisateur par email (via le hash de lookup)
    const emailHash = this.encryption.hashForSearch(email.toLowerCase().trim());
    const existing = await this.prisma.encrypted.user.findUnique({ where: { emailHash } });

    if (existing) {
      await this.prisma.encrypted.user.update({
        where: { id: existing.id },
        data: {
          otpSecret: hashedCode,
          otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min
        } as any,
      });
    } else {
      // Créer un compte pré-inscription (sera finalisé à la vérification OTP)
      const normalizedEmail = email.toLowerCase().trim();
      const phone = `_email_${normalizedEmail.replace(/[^a-z0-9]/g, '_')}`;
      await this.prisma.encrypted.user.create({
        data: {
          emailEncrypted: normalizedEmail as any,
          emailHash: this.encryption.hashForSearch(normalizedEmail),
          phone,
          nom: 'Utilisateur',
          otpSecret: hashedCode,
          otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        } as any,
      });
    }

    // Envoyer le code par email (gratuit via SMTP). En production, on échoue
    // explicitement si l'envoi a échoué.
    const emailSent = await this.emailService.sendOtpCode(email, code);
    if (!emailSent && process.env.NODE_ENV === 'production') {
      throw new BadRequestException(
        'Impossible d\'envoyer le code par email. Veuillez réessayer.',
      );
    }

    // Log sécurisé : pas de PII (email masqué, code en clair)
    if (process.env.NODE_ENV !== 'production') {
      const maskedEmail = email.slice(0, 3) + '***' + email.slice(email.indexOf('@'));
      this.logger.log(`OTP généré → ${maskedEmail} (email simulé en dev, envoyé via SMTP en prod)`);
    }

    // En développement, on retourne le code pour que l'app puisse l'afficher
    const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

    return {
      message: 'Code envoyé par email',
      expiresIn: 300,
      ...(isDev ? { devCode: code } : {}),
    };
  }

  async verifyOtp(email: string, code: string, fcmToken?: string) {
    const emailHash = this.encryption.hashForSearch(email.toLowerCase().trim());
    const user = await this.prisma.encrypted.user.findUnique({ where: { emailHash } });

    if (!user || !user.otpSecret || !user.otpExpiresAt) {
      throw new UnauthorizedException('Code invalide ou expiré');
    }

    const codeValid = await argon2.verify(user.otpSecret, code);
    if (!codeValid) {
      throw new UnauthorizedException('Code invalide ou expiré');
    }

    if (new Date() > user.otpExpiresAt) {
      throw new UnauthorizedException('Code invalide ou expiré');
    }

    // Nettoyer l'OTP
    const updateData: any = {
      otpSecret: null,
      otpExpiresAt: null,
    };

    // Stocker le FCM token si fourni
    if (fcmToken) {
      updateData.fcmTokens = user.fcmTokens || [];
      if (!updateData.fcmTokens.includes(fcmToken)) {
        updateData.fcmTokens.push(fcmToken);
      }
    }

    await this.prisma.encrypted.user.update({
      where: { id: user.id },
      data: updateData,
    });

    // Générer les tokens
    const payload = { sub: user.id, phone: user.phone };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'super-secret-key',
      expiresIn: '7d',
    });

    // Stocker le refresh token chiffré
    await this.prisma.encrypted.user.update({
      where: { id: user.id },
      data: { refreshTokenEncrypted: refreshToken as any } as any,
    });

    const userJson = user as any;
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        email: userJson.emailEncrypted || null,
        nom: user.nom || '',
        avatar: user.avatar,
        ville: user.ville,
        role: user.role,
        sellerFeePaid: user.sellerFeePaid,
      },
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'super-secret-key',
      });

      const user = await this.prisma.encrypted.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('Session expirée');
      }

      const userJson = user as any;

      // Vérifier que le refresh token correspond
      if (userJson.refreshTokenEncrypted !== refreshToken) {
        throw new UnauthorizedException('Session expirée');
      }

      // Rotation : invalider l'ancien token en générant un nouveau
      const newPayload = { sub: user.id };
      const newAccessToken = this.jwtService.sign(newPayload, {
        expiresIn: '15m',
      });
      const newRefreshToken = this.jwtService.sign(newPayload, {
        secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'super-secret-key',
        expiresIn: '7d',
      });

      await this.prisma.encrypted.user.update({
        where: { id: user.id },
        data: { refreshTokenEncrypted: newRefreshToken as any } as any,
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch {
      throw new UnauthorizedException('Session expirée');
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.encrypted.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        nom: true,
        emailEncrypted: true,
        avatar: true,
        ville: true,
        bio: true,
        role: true,
        sellerFeePaid: true,
        noteMoyenne: true,
        nbVentes: true,
        nbAchats: true,
        badgeVerifie: true,
        dateCreation: true,
      },
    });

    if (!user) return user;

    // Le champ emailEncrypted est automatiquement déchiffré par l'extension
    // Mais on le renomme en 'email' pour l'API
    const userJson = user as any;
    return {
      id: user.id,
      phone: user.phone,
      nom: user.nom,
      email: userJson.emailEncrypted || null,
      avatar: user.avatar,
      ville: user.ville,
      bio: user.bio,
      role: user.role,
      sellerFeePaid: user.sellerFeePaid,
      noteMoyenne: user.noteMoyenne,
      nbVentes: user.nbVentes,
      nbAchats: user.nbAchats,
      badgeVerifie: user.badgeVerifie,
      dateCreation: user.dateCreation,
    };
  }

  async updateProfile(userId: string, data: { nom?: string; ville?: string; bio?: string; role?: 'BUYER' | 'SELLER' }) {
    const user = await this.prisma.encrypted.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        nom: true,
        avatar: true,
        ville: true,
        bio: true,
        role: true,
        sellerFeePaid: true,
      },
    });

    return user;
  }

  // ─── Biométrie ──────────────────────────────────────────────────────────────

  async enableBiometric(userId: string, refreshToken: string) {
    // Vérifier que le refresh token correspond à l'utilisateur
    const user = await this.prisma.encrypted.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Session invalide');
    }
    const userJson = user as any;
    if (userJson.refreshTokenEncrypted !== refreshToken) {
      throw new UnauthorizedException('Session invalide');
    }

    await this.prisma.encrypted.user.update({
      where: { id: userId },
      data: { biometricEnabled: true },
    });

    return {
      biometricEnabled: true,
      message: 'Authentification biométrique activée',
    };
  }

  async disableBiometric(userId: string) {
    await this.prisma.encrypted.user.update({
      where: { id: userId },
      data: { biometricEnabled: false },
    });

    return {
      biometricEnabled: false,
      message: 'Authentification biométrique désactivée',
    };
  }

  async biometricLogin(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'super-secret-key',
      });

      const user = await this.prisma.encrypted.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('Session invalide');
      }

      const userJson = user as any;

      // Vérifier que le refresh token correspond
      if (userJson.refreshTokenEncrypted !== refreshToken) {
        throw new UnauthorizedException('Session invalide');
      }

      if (!user.biometricEnabled) {
        throw new UnauthorizedException('Authentification biométrique non activée');
      }

      // Rotation des tokens
      const newPayload = { sub: user.id };
      const newAccessToken = this.jwtService.sign(newPayload, {
        expiresIn: '15m',
      });
      const newRefreshToken = this.jwtService.sign(newPayload, {
        secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'super-secret-key',
        expiresIn: '7d',
      });

      await this.prisma.encrypted.user.update({
        where: { id: user.id },
        data: { refreshTokenEncrypted: newRefreshToken as any } as any,
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: {
          id: user.id,
          phone: user.phone,
          email: userJson.emailEncrypted || null,
          nom: user.nom || '',
          avatar: user.avatar,
          ville: user.ville,
          role: user.role,
          sellerFeePaid: user.sellerFeePaid,
        },
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Session expirée');
    }
  }
}
