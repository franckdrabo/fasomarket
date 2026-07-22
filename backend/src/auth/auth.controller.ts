import { Controller, Post, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SendOtpDto, VerifyOtpDto, UpdateProfileDto, EnableBiometricDto, BiometricLoginDto } from './auth.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('send-otp')
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.phone);
  }

  @Public()
  @Post('verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.phone, dto.code, dto.fcmToken);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshTokens(refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@CurrentUser('sub') userId: string) {
    return this.authService.getProfile(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(@CurrentUser('sub') userId: string, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(userId, dto);
  }

  // ─── Biométrie ──────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('enable-biometric')
  async enableBiometric(
    @CurrentUser('sub') userId: string,
    @Body() dto: EnableBiometricDto,
  ) {
    return this.authService.enableBiometric(userId, dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('disable-biometric')
  async disableBiometric(@CurrentUser('sub') userId: string) {
    return this.authService.disableBiometric(userId);
  }

  @Public()
  @Post('biometric-login')
  async biometricLogin(@Body() dto: BiometricLoginDto) {
    return this.authService.biometricLogin(dto.refreshToken);
  }
}
