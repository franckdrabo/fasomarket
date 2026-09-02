import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * AdminGuard — Restreint l'accès aux utilisateurs avec le rôle ADMIN.
 *
 * À utiliser APRÈS JwtAuthGuard sur les routes sensibles :
 *   @UseGuards(JwtAuthGuard, AdminGuard)
 *
 * Le rôle est lu depuis request.user (rempli par JwtStrategy.validate),
 * qui inclut désormais `role` (chargé depuis la base, pas seulement le token).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Accès non autorisé');
    }

    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Accès réservé aux administrateurs');
    }

    return true;
  }
}
