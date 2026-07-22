import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';

// Mock Cloudinary v2
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
      destroy: jest.fn().mockResolvedValue(undefined),
    },
  },
}));

import { v2 as cloudinary } from 'cloudinary';

describe('CloudinaryService', () => {
  let service: CloudinaryService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [CloudinaryService],
    }).compile();

    service = module.get<CloudinaryService>(CloudinaryService);
  });

  const createMockFile = (
    overrides: Partial<Express.Multer.File> = {},
  ): Express.Multer.File => ({
    fieldname: 'file',
    originalname: 'photo.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('fake-image-data'),
    size: 1024 * 50, // 50 KB
    stream: undefined as any,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  });

  // ─── uploadFile ─────────────────────────────────────────────────────────

  describe('uploadFile', () => {
    it('devrait uploader un fichier valide avec succès', async () => {
      const mockResult = { secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/bazario/abc123', public_id: 'bazario/abc123' };

      (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
        (_options: any, callback: any) => {
          callback(null, mockResult);
          return { write: jest.fn(), end: jest.fn(), on: jest.fn() };
        },
      );

      const file = createMockFile();
      const result = await service.uploadFile(file, 'bazario');

      expect(result).toEqual({
        url: mockResult.secure_url,
        publicId: mockResult.public_id,
      });
    });

    it('devrait lever une erreur si aucun fichier', async () => {
      await expect(service.uploadFile(null as any)).rejects.toThrow(BadRequestException);
    });

    it('devrait rejeter un type MIME non autorisé', async () => {
      const file = createMockFile({ mimetype: 'application/pdf' });

      await expect(service.uploadFile(file)).rejects.toThrow(BadRequestException);
    });

    it('devrait rejeter un fichier trop volumineux (> 10 MB)', async () => {
      const file = createMockFile({ size: 15 * 1024 * 1024 }); // 15 MB

      await expect(service.uploadFile(file)).rejects.toThrow(BadRequestException);
    });

    it('devrait gérer une erreur Cloudinary', async () => {
      (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
        (_options: any, callback: any) => {
          callback(new Error('Upload failed'), null);
          return { write: jest.fn(), end: jest.fn(), on: jest.fn() };
        },
      );

      const file = createMockFile();
      await expect(service.uploadFile(file)).rejects.toThrow(BadRequestException);
    });

    it('devrait accepter plusieurs formats d\'image', async () => {
      (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
        (_options: any, callback: any) => {
          callback(null, { secure_url: 'https://example.com/img.jpg', public_id: 'img' });
          return { write: jest.fn(), end: jest.fn(), on: jest.fn() };
        },
      );

      const formats = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      for (const mime of formats) {
        const file = createMockFile({ mimetype: mime });
        await expect(service.uploadFile(file)).resolves.toHaveProperty('url');
      }
    });
  });

  // ─── uploadFiles ────────────────────────────────────────────────────────

  describe('uploadFiles', () => {
    it('devrait uploader plusieurs fichiers', async () => {
      (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
        (_options: any, callback: any) => {
          callback(null, { secure_url: 'https://example.com/img.jpg', public_id: 'img' });
          return { write: jest.fn(), end: jest.fn(), on: jest.fn() };
        },
      );

      const files = [createMockFile(), createMockFile(), createMockFile()];
      const results = await service.uploadFiles(files);

      expect(results).toHaveLength(3);
      results.forEach((r) => {
        expect(r).toHaveProperty('url');
        expect(r).toHaveProperty('publicId');
      });
    });

    it('devrait retourner un tableau vide si aucun fichier', async () => {
      const results = await service.uploadFiles([]);
      expect(results).toHaveLength(0);
    });
  });

  // ─── deleteFile ─────────────────────────────────────────────────────────

  describe('deleteFile', () => {
    it('devrait supprimer un fichier par son publicId', async () => {
      await service.deleteFile('bazario/abc123');

      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('bazario/abc123');
    });

    it('devrait gérer la suppression sans erreur', async () => {
      (cloudinary.uploader.destroy as jest.Mock).mockResolvedValue(undefined);

      await expect(service.deleteFile('test/id')).resolves.toBeUndefined();
    });
  });
});
