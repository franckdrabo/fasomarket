import { IsString, IsOptional } from 'class-validator';

export class SendOtpDto {
  @IsString()
  phone: string;
}

export class VerifyOtpDto {
  @IsString()
  phone: string;

  @IsString()
  code: string;

  @IsString()
  @IsOptional()
  fcmToken?: string;
}

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  nom?: string;

  @IsString()
  @IsOptional()
  ville?: string;

  @IsString()
  @IsOptional()
  bio?: string;
}

export class EnableBiometricDto {
  @IsString()
  refreshToken: string;
}

export class BiometricLoginDto {
  @IsString()
  refreshToken: string;
}
