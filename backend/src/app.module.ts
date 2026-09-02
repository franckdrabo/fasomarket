import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './common/prisma/prisma.module';
import { EncryptionModule } from './common/encryption/encryption.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ArticlesModule } from './articles/articles.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ReviewsModule } from './reviews/reviews.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { FavorisModule } from './favoris/favoris.module';
import { TasksModule } from './tasks/tasks.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),

    // Modules globaux
    EncryptionModule,

    // Feature modules
    PrismaModule,
    AuthModule,
    UsersModule,
    ArticlesModule,
    ConversationsModule,
    MessagesModule,
    TransactionsModule,
    ReviewsModule,
    CloudinaryModule,
    NotificationsModule,
    PaymentsModule,
    FavorisModule,
    TasksModule,
  ],
  controllers: [AppController],
  providers: [
    // Rate limiting global
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // NOTE : l'AntiReplayGuard (nonce + timestamp + HMAC) n'est PLUS enregistré
    // globalement : il exigeait des headers (X-Nonce, X-Signature…) que le client
    // mobile n'envoie pas, ce qui bloquait toutes les requêtes POST de l'app et
    // les webhooks des providers. Il reste disponible en opt-in via @UseGuards().
  ],
})
export class AppModule {}
