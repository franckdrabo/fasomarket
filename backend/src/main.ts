import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { SanitizeResponseInterceptor } from './common/interceptors/sanitize-response.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // ─── Vérifications de sécurité au démarrage ─────────────────────────────
  const nodeEnv = process.env.NODE_ENV || 'development';
  const jwtSecret = process.env.JWT_SECRET;

  if (nodeEnv === 'production') {
    if (!jwtSecret || jwtSecret === 'super-secret-key') {
      logger.error('❌ JWT_SECRET non configuré ou utilisant la valeur par défaut en production !');
      logger.error('   Définissez une variable d\'environnement JWT_SECRET forte.');
      process.exit(1);
    }

    if (!process.env.DATABASE_URL) {
      logger.error('❌ DATABASE_URL non configurée en production !');
      process.exit(1);
    }

    if (!process.env.ENCRYPTION_KEY) {
      logger.error('❌ ENCRYPTION_KEY non configurée en production (chiffrement des PII) !');
      logger.error('   Générez une clé : openssl rand -hex 32');
      process.exit(1);
    }

    logger.log('✅ Vérifications de sécurité OK');
  } else {
    if (!jwtSecret || jwtSecret === 'super-secret-key') {
      logger.warn('⚠️  JWT_SECRET utilise la valeur par défaut. À changer en production !');
    }
  }

  // rawBody: true → conserve le corps brut (utile pour d'éventuelles signatures futures)
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // ─── Sécurité : Helmet (en-têtes HTTP) ─────────────────────────────────
  app.use(helmet.default({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Nécessaire pour les images Cloudinary
    contentSecurityPolicy: false, // Désactivé pour Swagger UI en dev
  }));

  // ─── Cookie Parser (pour refresh token HttpOnly) ───────────────────────
  app.use(cookieParser());

  // ─── Filtre global d'exceptions (messages génériques) ──────────────────
  app.useGlobalFilters(new AllExceptionsFilter());

  // ─── Intercepteur de nettoyage des réponses (Buffer/Uint8Array → null) ─
  app.useGlobalInterceptors(new SanitizeResponseInterceptor());

  // Global prefix
  app.setGlobalPrefix('api');

  // API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  const corsOrigin = process.env.NODE_ENV === 'production'
    ? (process.env.CORS_ORIGIN || 'https://votre-domaine.com')
    : ['http://localhost:8080', 'http://localhost:3000', 'http://192.168.1.79:8080'];

  app.enableCors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Timestamp', 'X-Nonce', 'X-Signature', 'X-Correlation-Id'],
    credentials: true,
  });

  const port = process.env.PORT || 3000;

  // ─── Swagger / OpenAPI ─────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('FasoMarket API')
    .setDescription(
      'API de la marketplace FasoMarket — Achat et vente en toute confiance en Afrique de l\'Ouest.\n\n' +
      '### Authentification\n' +
      '1. Envoyez votre adresse email sur **POST /api/v1/auth/send-otp**\n' +
      '2. Validez le code OTP reçu par email sur **POST /api/v1/auth/verify-otp**\n' +
      '3. Utilisez le token JWT reçu comme **Bearer Token** (bouton "Authorize" ci-dessous)\n\n' +
      'Ou inscrivez-vous directement avec email + mot de passe via **POST /api/v1/auth/email/register**'
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT-auth',
    )
    .addTag('auth', 'Authentification OTP + JWT + biométrie')
    .addTag('articles', 'Annonces et recherche d\'articles')
    .addTag('conversations', 'Messagerie entre acheteurs et vendeurs')
    .addTag('transactions', 'Paiements sécurisés en escrow')
    .addTag('payments', 'Paiements Mobile Money (Orange, Moov, Wave)')
    .addTag('favoris', 'Gestion des favoris')
    .addTag('reviews', 'Avis et évaluations')
    .addTag('notifications', 'Notifications push FCM')
    .addTag('users', 'Profils utilisateurs')
    .addTag('upload', 'Upload d\'images (Cloudinary)')
    .addTag('health', 'Santé de l\'API')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'method',
    },
    customSiteTitle: 'FasoMarket API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  logger.log(`📖 API documentation: http://localhost:${port}/api/docs`);

  await app.listen(port);
  logger.log(`🚀 FasoMarket API running on http://localhost:${port}`);
}

bootstrap();
