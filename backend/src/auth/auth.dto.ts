import { IsString, IsOptional, MinLength, IsEmail, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({ description: 'Adresse email pour recevoir le code OTP', example: 'alice@example.com' })
  @IsEmail({}, { message: 'Adresse email invalide' })
  email: string;
}

export class VerifyOtpDto {
  @ApiProperty({ description: 'Adresse email', example: 'alice@example.com' })
  @IsEmail({}, { message: 'Adresse email invalide' })
  email: string;

  @ApiProperty({ description: 'Code OTP à 6 chiffres reçu par email', example: '123456' })
  @IsString()
  code: string;

  @ApiPropertyOptional({ description: 'Token FCM pour les notifications push (optionnel)' })
  @IsString()
  @IsOptional()
  fcmToken?: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Nouveau nom d\'affichage' })
  @IsString()
  @IsOptional()
  nom?: string;

  @ApiPropertyOptional({ description: 'Ville de résidence', example: 'Abidjan' })
  @IsString()
  @IsOptional()
  ville?: string;

  @ApiPropertyOptional({ description: 'Biographie / description' })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiPropertyOptional({ description: 'Rôle de l\'utilisateur', enum: ['BUYER', 'SELLER'] })
  @IsEnum(['BUYER', 'SELLER'] as const)
  @IsOptional()
  role?: 'BUYER' | 'SELLER';
}

export class RegisterEmailDto {
  @ApiProperty({ description: 'Adresse email', example: 'alice@example.com' })
  @IsEmail({}, { message: 'Adresse email invalide' })
  email: string;

  @ApiProperty({ description: 'Mot de passe (min 6 caractères)', example: 'monMotDePasse123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ description: 'Nom d\'affichage', example: 'Alice Kouamé' })
  @IsString()
  nom: string;

  @ApiPropertyOptional({ description: 'Ville', example: 'Abidjan' })
  @IsString()
  @IsOptional()
  ville?: string;

  @ApiPropertyOptional({ description: 'Rôle: BUYER (acheteur gratuit) ou SELLER (vendeur, 1000 FCFA requis)', enum: ['BUYER', 'SELLER'], example: 'BUYER' })
  @IsEnum(['BUYER', 'SELLER'] as any)
  @IsOptional()
  role?: 'BUYER' | 'SELLER';
}

export class ActivateSellerDto {
  @ApiProperty({ description: 'Numéro de téléphone Mobile Money', example: '+2250102030405' })
  @IsString()
  telephone: string;

  @ApiProperty({ description: 'Opérateur Mobile Money', enum: ['ORANGE_MONEY', 'MOOV_MONEY', 'WAVE'], example: 'ORANGE_MONEY' })
  @IsString()
  operateur: string;
}

export class ConfirmSellerActivationDto {
  @ApiProperty({ description: 'Référence du paiement initié (retournée par /activate-seller)', example: 'OR-1690000000-ABC123' })
  @IsString()
  reference: string;
}

export class LoginEmailDto {
  @ApiProperty({ description: 'Adresse email', example: 'alice@example.com' })
  @IsEmail({}, { message: 'Adresse email invalide' })
  email: string;

  @ApiProperty({ description: 'Mot de passe', example: 'monMotDePasse123' })
  @IsString()
  password: string;

  @ApiPropertyOptional({ description: 'Token FCM pour les notifications push (optionnel)' })
  @IsString()
  @IsOptional()
  fcmToken?: string;
}

export class EnableBiometricDto {
  @ApiProperty({ description: 'Refresh token JWT pour activer la biométrie' })
  @IsString()
  refreshToken: string;
}

export class BiometricLoginDto {
  @ApiProperty({ description: 'Refresh token JWT pour la connexion biométrique' })
  @IsString()
  refreshToken: string;
}
