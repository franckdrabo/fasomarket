import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';

/**
 * Module global de chiffrement.
 * Rendu disponible dans toute l'application sans import explicite.
 * Fournit EncryptionService pour le chiffrement AES-256-GCM des PII.
 */
@Global()
@Module({
  providers: [EncryptionService],
  exports: [EncryptionService],
})
export class EncryptionModule {}
