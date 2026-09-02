import { Controller, Post, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SendOtpDto, VerifyOtpDto, UpdateProfileDto, RegisterEmailDto, LoginEmailDto, ActivateSellerDto, ConfirmSellerActivationDto, EnableBiometricDto, BiometricLoginDto } from './auth.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('send-otp')
  @ApiOperation({ summary: 'Envoyer un code OTP', description: 'Envoie un code de vérification à 6 chiffres par email (gratuit). En développement uniquement, le code est aussi retourné dans la réponse (devCode).' })
  @ApiCreatedResponse({ description: 'Code OTP envoyé', schema: { example: { message: 'Code envoyé', expiresIn: 300 } } })
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('verify-otp')
  @ApiOperation({ summary: 'Vérifier le code OTP', description: 'Valide le code OTP reçu et retourne les tokens JWT (access + refresh).' })
  @ApiCreatedResponse({ description: 'Authentification réussie', schema: { example: { accessToken: 'eyJ...', refreshToken: 'eyJ...', user: { id: 'abc123', phone: '+2250102030405', nom: 'Alice', avatar: null, ville: 'Abidjan' } } } })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.email, dto.code, dto.fcmToken);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  @ApiOperation({ summary: 'Rafraîchir le token JWT', description: 'Utilise le refresh token pour obtenir de nouveaux tokens sans se reconnecter.' })
  @ApiOkResponse({ description: 'Tokens rafraîchis', schema: { example: { accessToken: 'eyJ...', refreshToken: 'eyJ...' } } })
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshTokens(refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Obtenir le profil', description: 'Retourne les informations du profil de l\'utilisateur connecté.' })
  @ApiOkResponse({ description: 'Profil utilisateur', schema: { example: { id: 'abc123', phone: '+2250102030405', nom: 'Alice', ville: 'Abidjan', bio: 'Vendeuse passionnée', noteMoyenne: 4.8, nbVentes: 12, nbAchats: 3 } } })
  async getProfile(@CurrentUser('sub') userId: string) {
    return this.authService.getProfile(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Modifier le profil', description: 'Met à jour le nom, la ville et/ou la biographie.' })
  @ApiOkResponse({ description: 'Profil mis à jour' })
  async updateProfile(@CurrentUser('sub') userId: string, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(userId, dto);
  }

  // ─── Email / Password ────────────────────────────────────────────────────────

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('email/register')
  @ApiOperation({ summary: 'Inscription par email', description: 'Crée un compte avec email et mot de passe.' })
  @ApiCreatedResponse({ description: 'Compte créé avec tokens JWT' })
  async registerEmail(@Body() dto: RegisterEmailDto) {
    return this.authService.registerWithEmail(dto.email, dto.password, dto.nom, dto.ville, dto.role);
  }

  @UseGuards(JwtAuthGuard)
  @Post('activate-seller')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Activer compte vendeur', description: 'Initie le paiement de 1000 FCFA via Mobile Money. L\'activation est confirmée après paiement (endpoint /activate-seller/confirm ou webhook provider).' })
  @ApiCreatedResponse({ description: 'Paiement initié, en attente de confirmation', schema: { example: { status: 'PENDING', providerReference: 'OR-1690000000-ABC123', message: '💰 Paiement ORANGE_MONEY initié. Confirmez sur votre téléphone.' } } })
  async activateSeller(@CurrentUser('sub') userId: string, @Body() dto: ActivateSellerDto) {
    return this.authService.activateSeller(userId, dto.telephone, dto.operateur);
  }

  @UseGuards(JwtAuthGuard)
  @Post('activate-seller/confirm')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Confirmer le paiement d\'activation vendeur', description: 'Vérifie le paiement auprès du provider Mobile Money puis active le compte vendeur.' })
  @ApiOkResponse({ description: 'Compte vendeur activé', schema: { example: { message: 'Paiement confirmé. Compte vendeur activé !', sellerFeePaid: true } } })
  async confirmSellerActivation(@CurrentUser('sub') userId: string, @Body() dto: ConfirmSellerActivationDto) {
    return this.authService.confirmSellerActivation(userId, dto.reference);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('email/login')
  @ApiOperation({ summary: 'Connexion par email', description: 'Connecte un utilisateur avec email et mot de passe.' })
  @ApiCreatedResponse({ description: 'Connexion réussie avec tokens JWT' })
  async loginEmail(@Body() dto: LoginEmailDto) {
    return this.authService.loginWithEmail(dto.email, dto.password, dto.fcmToken);
  }

  // ─── Biométrie ──────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('enable-biometric')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Activer la biométrie', description: 'Active la connexion par empreinte/Face ID pour cet utilisateur.' })
  @ApiOkResponse({ description: 'Biométrie activée', schema: { example: { biometricEnabled: true, message: 'Authentification biométrique activée' } } })
  async enableBiometric(
    @CurrentUser('sub') userId: string,
    @Body() dto: EnableBiometricDto,
  ) {
    return this.authService.enableBiometric(userId, dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('disable-biometric')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Désactiver la biométrie', description: 'Désactive la connexion biométrique.' })
  @ApiOkResponse({ description: 'Biométrie désactivée' })
  async disableBiometric(@CurrentUser('sub') userId: string) {
    return this.authService.disableBiometric(userId);
  }

  @Public()
  @Post('biometric-login')
  @ApiOperation({ summary: 'Connexion biométrique', description: 'Connecte l\'utilisateur via un refresh token biométrique (Face ID / empreinte).' })
  @ApiCreatedResponse({ description: 'Connexion biométrique réussie' })
  async biometricLogin(@Body() dto: BiometricLoginDto) {
    return this.authService.biometricLogin(dto.refreshToken);
  }
}
