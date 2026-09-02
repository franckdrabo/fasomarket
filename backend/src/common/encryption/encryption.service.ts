import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Service de chiffrement symétrique AES-256-GCM.
 *
 * Utilisé pour chiffrer les données personnelles (PII) au repos dans PostgreSQL.
 * Même si la base de données est compromise, les données sont illisibles sans la clé.
 *
 * Format de stockage (Buffer unique) :
 *   [0..11]    IV (12 bytes - nonce GCM recommandé)
 *   [12..27]   Auth Tag (16 bytes - authentification GCM)
 *   [28..]     Ciphertext (données chiffrées)
 *
 * La clé de chiffrement est lue depuis ENCRYPTION_KEY (env).
 * Doit être une chaîne hexadécimale de 64 caractères (32 bytes = 256 bits).
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);

  /** Algorithme : AES-256-GCM (authentifié + chiffré) */
  private readonly ALGORITHM = 'aes-256-gcm';

  /** Longueur du IV : 12 bytes (recommandé pour GCM) */
  private readonly IV_LENGTH = 12;

  /** Longueur du Auth Tag : 16 bytes (GCM standard) */
  private readonly TAG_LENGTH = 16;

  /** Clé de chiffrement dérivée (32 bytes) */
  private readonly key: Buffer;

  constructor() {
    const rawKey = process.env.ENCRYPTION_KEY;

    if (!rawKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          '❌ ENCRYPTION_KEY est obligatoire en production. ' +
          'Générez une clé avec : openssl rand -hex 32',
        );
      }

      // En développement : clé de démonstration dérivée
      this.logger.warn(
        '⚠️  ENCRYPTION_KEY non définie — utilisation d\'une clé de démonstration. ' +
        'NE JAMAIS UTILISER CETTE CLÉ EN PRODUCTION !',
      );
      // TODO: utiliser une clé dérivée via HKDF en production
      this.key = crypto.scryptSync('dev-demo-key-do-not-use', 'salt-dev', 32);
      return;
    }

    // La clé doit être hexadécimale : 64 caractères hex = 32 bytes
    if (/^[0-9a-fA-F]{64}$/.test(rawKey.trim())) {
      this.key = Buffer.from(rawKey.trim(), 'hex');
    } else {
      // TODO: utiliser un sel aléatoire stocké en env en production
      // Fallback : dériver avec scrypt pour accepter n'importe quelle phrase
      this.logger.warn(
        '⚠️  ENCRYPTION_KEY n\'est pas une clé hexadécimale valide (64 hex). ' +
        'Dérivation via scrypt — préférez openssl rand -hex 32',
      );
      this.key = crypto.scryptSync(rawKey, 'encryption-salt-bazario', 32);
    }
  }

  /**
   * Chiffre un texte clair en AES-256-GCM.
   * @param plainText Texte à chiffrer (ex: email, nom, phone)
   * @returns Buffer contenant IV + AuthTag + Ciphertext
   */
  encrypt(plainText: string): Buffer {
    if (!plainText) {
      throw new Error('Cannot encrypt empty value');
    }

    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.ALGORITHM, this.key, iv, {
      authTagLength: this.TAG_LENGTH,
    });

    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // Format : [IV (12)][AuthTag (16)][Ciphertext (N)]
    return Buffer.concat([iv, authTag, encrypted]);
  }

  /**
   * Déchiffre un buffer issu de encrypt().
   * @param encryptedData Buffer au format IV + AuthTag + Ciphertext
   * @returns Texte clair original
   */
  decrypt(encryptedData: Buffer): string {
    if (!encryptedData || encryptedData.length < this.IV_LENGTH + this.TAG_LENGTH) {
      throw new Error('Invalid encrypted data buffer');
    }

    const iv = encryptedData.subarray(0, this.IV_LENGTH);
    const authTag = encryptedData.subarray(
      this.IV_LENGTH,
      this.IV_LENGTH + this.TAG_LENGTH,
    );
    const ciphertext = encryptedData.subarray(this.IV_LENGTH + this.TAG_LENGTH);

    const decipher = crypto.createDecipheriv(this.ALGORITHM, this.key, iv, {
      authTagLength: this.TAG_LENGTH,
    });

    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * Génère un HMAC-SHA256 du texte pour permettre la recherche indexée.
   * Utilisé pour les colonnes comme email : on stocke emailHash (HMAC)
   * pour pouvoir faire WHERE emailHash = ? sans déchiffrer toutes les lignes.
   *
   * TODO: Idéalement, dériver une clé HMAC séparée via HKDF
   * (crypto.hkdfSync) pour ne pas partager la même clé que le chiffrement.
   *
   * ATTENTION : Ce n'est PAS un hash réversible, mais un attaquant
   * pourrait bruteforcer des emails connus. À utiliser uniquement comme
   * index de recherche, PAS comme unique mesure de sécurité.
   */
  hashForSearch(plainText: string): string {
    if (!plainText) return '';
    const normalized = plainText.toLowerCase().trim();
    return crypto
      .createHmac('sha256', this.key)
      .update(normalized)
      .digest('hex');
  }
}
