import { Test, TestingModule } from '@nestjs/testing';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeAll(() => {
    // Simuler une ENCRYPTION_KEY pour les tests
    process.env.ENCRYPTION_KEY = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EncryptionService],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  afterAll(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  describe('encrypt / decrypt', () => {
    it('devrait chiffrer puis déchiffrer correctement une chaîne simple', () => {
      const original = 'alice@example.com';
      const encrypted = service.encrypt(original);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(original);
    });

    it('devrait produire des buffers différents à chaque chiffrement (IV aléatoire)', () => {
      const original = 'john.doe@email.com';
      const encrypted1 = service.encrypt(original);
      const encrypted2 = service.encrypt(original);

      // Même donnée → buffer différent grâce à l'IV aléatoire
      expect(encrypted1).not.toEqual(encrypted2);

      // Mais les deux déchiffrent correctement
      expect(service.decrypt(encrypted1)).toBe(original);
      expect(service.decrypt(encrypted2)).toBe(original);
    });

    it('devrait gérer les chaînes avec accents et caractères spéciaux', () => {
      const original = 'François Müller ñoño 東京 🔒 $£€ {|}';
      const encrypted = service.encrypt(original);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(original);
    });

    it('devrait gérer les chaînes très longues', () => {
      const original = 'a'.repeat(10000);
      const encrypted = service.encrypt(original);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(original);
    });

    it('devrait gérer les chaînes très courtes (1 caractère)', () => {
      const original = 'a';
      const encrypted = service.encrypt(original);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(original);
    });

    it('devrait rejeter un buffer vide ou trop court', () => {
      expect(() => service.decrypt(Buffer.alloc(0))).toThrow('Invalid encrypted data buffer');
      expect(() => service.decrypt(Buffer.alloc(10))).toThrow('Invalid encrypted data buffer');
    });

    it('devrait rejeter un appel encrypt avec chaîne vide', () => {
      expect(() => service.encrypt('')).toThrow('Cannot encrypt empty value');
    });
  });

  describe('hashForSearch', () => {
    it('devrait produire un HMAC cohérent pour la même entrée', () => {
      const hash1 = service.hashForSearch('alice@example.com');
      const hash2 = service.hashForSearch('alice@example.com');

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex
    });

    it('devrait normaliser la casse et les espaces', () => {
      const hash1 = service.hashForSearch('Alice@Example.com');
      const hash2 = service.hashForSearch('  alice@example.com  ');

      expect(hash1).toBe(hash2);
    });

    it('devrait retourner une chaîne vide pour une entrée vide', () => {
      expect(service.hashForSearch('')).toBe('');
    });
  });

  describe('format du buffer chiffré', () => {
    it('devrait avoir la bonne structure : IV(12) + AuthTag(16) + Ciphertext(N)', () => {
      const original = 'test@email.com';
      const encrypted = service.encrypt(original);

      // Minimum : 12 (IV) + 16 (AuthTag) + 1 (au moins 1 byte de ciphertext)
      expect(encrypted.length).toBeGreaterThanOrEqual(29);

      // IV : bytes [0..11]
      // AuthTag : bytes [12..27]
      // Ciphertext : bytes [28..]
    });

    it('devrait détecter un buffer corrompu (tag modifié)', () => {
      const original = 'sensitive@data.com';
      const encrypted = service.encrypt(original);

      // Corrompre un byte dans l'AuthTag (IV=12, AuthTag commence à 12)
      encrypted[14] ^= 0xff;

      expect(() => service.decrypt(encrypted)).toThrow();
    });
  });
});
