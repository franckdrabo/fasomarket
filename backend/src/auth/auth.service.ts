import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // Simule l'envoi d'OTP (en prod, intégration SMS via Twilio/OVH/etc.)
  async sendOtp(phone: string) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Stocker le code OTP (hashé avec date d'expiration)
    // En dev, on le stocke en clair pour pouvoir le récupérer
    await this.prisma.user.upsert({
      where: { phone },
      update: {
        otpSecret: code, // En prod: hash avec argon2
        otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min
      },
      create: {
        phone,
        nom: 'Utilisateur',
        otpSecret: code,
        otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    // En dev, on log le code
    console.log(`📱 OTP for ${phone}: ${code}`);

    return { message: 'Code envoyé', expiresIn: 300 };
  }

  async verifyOtp(phone: string, code: string, fcmToken?: string) {
    const user = await this.prisma.user.findUnique({ where: { phone } });

    if (!user || !user.otpSecret || !user.otpExpiresAt) {
      throw new UnauthorizedException('Aucun code demandé');
    }

    if (user.otpSecret !== code) {
      throw new UnauthorizedException('Code invalide');
    }

    if (new Date() > user.otpExpiresAt) {
      throw new UnauthorizedException('Code expiré');
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

    await this.prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    // Générer les tokens
    const payload = { sub: user.id, phone: user.phone };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET || 'super-secret-key',
      expiresIn: '7d',
    });

    // Stocker le refresh token
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        nom: user.nom,
        avatar: user.avatar,
        ville: user.ville,
      },
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_SECRET || 'super-secret-key',
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Token invalide');
      }

      const newPayload = { sub: user.id, phone: user.phone };
      const newAccessToken = this.jwtService.sign(newPayload);
      const newRefreshToken = this.jwtService.sign(newPayload, {
        secret: process.env.JWT_SECRET || 'super-secret-key',
        expiresIn: '7d',
      });

      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: newRefreshToken },
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch {
      throw new UnauthorizedException('Token invalide ou expiré');
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        nom: true,
        avatar: true,
        ville: true,
        bio: true,
        noteMoyenne: true,
        nbVentes: true,
        nbAchats: true,
        badgeVerifie: true,
        dateCreation: true,
      },
    });

    return user;
  }

  async updateProfile(userId: string, data: { nom?: string; ville?: string; bio?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        nom: true,
        avatar: true,
        ville: true,
        bio: true,
      },
    });
  }

  // ─── Biométrie ──────────────────────────────────────────────────────────────

  async enableBiometric(userId: string, refreshToken: string) {
    // Vérifier que le refresh token correspond à l'utilisateur
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.refreshToken !== refreshToken) {
      throw new UnauthorizedException('Token invalide');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { biometricEnabled: true },
    });

    return {
      biometricEnabled: true,
      message: 'Authentification biométrique activée',
    };
  }

  async disableBiometric(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { biometricEnabled: false },
    });

    return {
      biometricEnabled: false,
      message: 'Authentification biométrique désactivée',
    };
  }

  async biometricLogin(refreshToken: string) {
    // Vérifier le refresh token
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_SECRET || 'super-secret-key',
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Token invalide');
      }

      // Vérifier que l'utilisateur a activé la biométrie
      if (!user.biometricEnabled) {
        throw new UnauthorizedException('Authentification biométrique non activée');
      }

      // Générer de nouveaux tokens
      const newPayload = { sub: user.id, phone: user.phone };
      const newAccessToken = this.jwtService.sign(newPayload);
      const newRefreshToken = this.jwtService.sign(newPayload, {
        secret: process.env.JWT_SECRET || 'super-secret-key',
        expiresIn: '7d',
      });

      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: newRefreshToken },
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: {
          id: user.id,
          phone: user.phone,
          nom: user.nom,
          avatar: user.avatar,
          ville: user.ville,
        },
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Token invalide ou expiré');
    }
  }
}
