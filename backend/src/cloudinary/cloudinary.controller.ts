import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiCreatedResponse, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from './cloudinary.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('upload')
@Controller({ path: 'upload', version: '1' })
export class CloudinaryController {
  constructor(private cloudinaryService: CloudinaryService) {}

  @UseGuards(JwtAuthGuard)
  @Post('image')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Uploader une image', description: 'Upload une image vers Cloudinary (max 10 MB, formats: JPEG, PNG, WebP, GIF).' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiCreatedResponse({ description: 'URL de l\'image uploadée', schema: { example: { url: 'https://res.cloudinary.com/...', publicId: 'fasomarket/abc123' } } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Fichier requis');
    }
    const result = await this.cloudinaryService.uploadFile(file);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('images')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Uploader plusieurs images', description: 'Upload jusqu\'à 6 images vers Cloudinary.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } } } } })
  @ApiCreatedResponse({ description: 'URLs des images uploadées' })
  @UseInterceptors(
    FilesInterceptor('files', 6, {
      // Max 6 photos (comme dans le cahier des charges)
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadImages(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Fichiers requis');
    }
    const results = await this.cloudinaryService.uploadFiles(files);
    return results;
  }
}
