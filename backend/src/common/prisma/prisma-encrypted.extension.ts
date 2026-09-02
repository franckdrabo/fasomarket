import { PrismaClient } from '@prisma/client';
import { EncryptionService } from '../encryption/encryption.service';

/**
 * Extension Prisma Client qui chiffre/déchiffre automatiquement
 * les champs PII des modèles.
 *
 * Champs chiffrés (AES-256-GCM) :
 *   - User.nomEncrypted
 *   - User.emailEncrypted
 *   - User.refreshTokenEncrypted
 *
 * Champs de recherche (HMAC-SHA256) :
 *   - User.emailHash (dérivé de l'email pour les WHERE emailHash = ?)
 */
export function createEncryptedPrismaClient(
  prisma: PrismaClient,
  encryption: EncryptionService,
) {
  return prisma.$extends({
    name: 'encrypted-prisma-client',

    query: {
      user: {
        // Seuls les champs emailEncrypted et refreshTokenEncrypted sont chiffrés.
        // nom reste en clair car c'est un nom d'affichage public.
        // ─── Intercepter les créations ─────────────────────────────────────
        async create({ args, query }) {
          // Chiffrer nomEncrypted
          // Chiffrer emailEncrypted + générer emailHash
          if (args.data.emailEncrypted && typeof args.data.emailEncrypted === 'string') {
            const emailStr = args.data.emailEncrypted;
            args.data.emailEncrypted = encryption.encrypt(emailStr) as any;
            (args.data as any).emailHash = encryption.hashForSearch(emailStr);
          }

          // Chiffrer refreshTokenEncrypted
          if (args.data.refreshTokenEncrypted && typeof args.data.refreshTokenEncrypted === 'string') {
            args.data.refreshTokenEncrypted = encryption.encrypt(args.data.refreshTokenEncrypted) as any;
          }

          const result = await query(args);
          return decryptUser(result, encryption);
        },

        // ─── Intercepter les mises à jour ─────────────────────────────────
        async update({ args, query }) {
          if (args.data) {
            encryptUserFields(args.data as any, encryption);
          }
          const result = await query(args);
          return decryptUser(result, encryption);
        },

        async updateMany({ args, query }) {
          if (args.data) {
            encryptUserFields(args.data as any, encryption);
          }
          return query(args);
        },

        async upsert({ args, query }) {
          if (args.create) {
              if (typeof args.create.emailEncrypted === 'string') {
              const emailStr = args.create.emailEncrypted;
              args.create.emailEncrypted = encryption.encrypt(emailStr) as any;
              (args.create as any).emailHash = encryption.hashForSearch(emailStr);
            }
            if (typeof args.create.refreshTokenEncrypted === 'string') {
              args.create.refreshTokenEncrypted = encryption.encrypt(args.create.refreshTokenEncrypted) as any;
            }
          }
          if (args.update) {
            encryptUserFields(args.update as any, encryption);
          }
          const result = await query(args);
          return decryptUser(result, encryption);
        },

        // ─── Intercepter les lectures ─────────────────────────────────────
        async findUnique({ args, query }) {
          const result = await query(args);
          return decryptUser(result, encryption);
        },

        async findFirst({ args, query }) {
          const result = await query(args);
          return decryptUser(result, encryption);
        },

        async findMany({ args, query }) {
          const results = await query(args);
          if (Array.isArray(results)) {
            return results.map((r) => decryptUser(r, encryption));
          }
          return results;
        },

        async findUniqueOrThrow({ args, query }) {
          const result = await query(args);
          return decryptUser(result, encryption);
        },

        async findFirstOrThrow({ args, query }) {
          const result = await query(args);
          return decryptUser(result, encryption);
        },
      },
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function encryptUserFields(data: any, encryption: EncryptionService) {
  if (data.emailEncrypted && typeof data.emailEncrypted === 'string') {
    const emailStr = data.emailEncrypted;
    data.emailEncrypted = encryption.encrypt(emailStr) as any;
    data.emailHash = encryption.hashForSearch(emailStr);
  }
  if (data.refreshTokenEncrypted && typeof data.refreshTokenEncrypted === 'string') {
    data.refreshTokenEncrypted = encryption.encrypt(data.refreshTokenEncrypted) as any;
  }
}

function decryptUser(user: any | null, encryption: EncryptionService): any | null {
  if (!user) return user;

  const decrypted = { ...user };

  // Déchiffrer emailEncrypted
  // Note : Prisma peut retourner Bytes comme Uint8Array (pas Buffer) !
  if (isBytesLike(decrypted.emailEncrypted)) {
    try {
      const buffer = ensureBuffer(decrypted.emailEncrypted);
      decrypted.emailEncrypted = encryption.decrypt(buffer);
    } catch {
      // Échec déchiffrement → ne pas exposer les bytes bruts au client
      decrypted.emailEncrypted = null;
    }
  }

  // Déchiffrer refreshTokenEncrypted
  if (isBytesLike(decrypted.refreshTokenEncrypted)) {
    try {
      const buffer = ensureBuffer(decrypted.refreshTokenEncrypted);
      decrypted.refreshTokenEncrypted = encryption.decrypt(buffer);
    } catch {
      decrypted.refreshTokenEncrypted = null;
    }
  }

  return decrypted;
}

/** Vérifie si une valeur est un Uint8Array (Buffer ou pas) */
function isBytesLike(value: unknown): value is Uint8Array {
  return Buffer.isBuffer(value) || value instanceof Uint8Array;
}

/** Convertit un Uint8Array en Buffer si nécessaire */
function ensureBuffer(data: Uint8Array): Buffer {
  return Buffer.isBuffer(data) ? data : Buffer.from(data);
}

/**
 * Type du Prisma Client avec extension de chiffrement.
 * À utiliser dans les services pour avoir les bons types.
 */
export type EncryptedPrismaClient = ReturnType<typeof createEncryptedPrismaClient>;
