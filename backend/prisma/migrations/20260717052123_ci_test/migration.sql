-- CreateEnum
CREATE TYPE "Categorie" AS ENUM ('VETEMENTS', 'CHAUSSURES', 'ELECTRONIQUE', 'MAISON', 'AUTRES');

-- CreateEnum
CREATE TYPE "EtatArticle" AS ENUM ('NEUF', 'COMME_NEUF', 'BON_ETAT', 'SATISFAISANT');

-- CreateEnum
CREATE TYPE "StatutArticle" AS ENUM ('EN_LIGNE', 'VENDU', 'RESERVE', 'BROUILLON');

-- CreateEnum
CREATE TYPE "TypeMessage" AS ENUM ('TEXTE', 'OFFRE', 'SYSTEME');

-- CreateEnum
CREATE TYPE "StatutEscrow" AS ENUM ('EN_ATTENTE', 'BLOQUE', 'LIBERE', 'LITIGE', 'REMBOURSE');

-- CreateEnum
CREATE TYPE "MoyenPaiement" AS ENUM ('ORANGE_MONEY', 'MOOV_MONEY', 'WAVE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "avatar" TEXT,
    "ville" TEXT,
    "bio" TEXT,
    "noteMoyenne" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nbVentes" INTEGER NOT NULL DEFAULT 0,
    "nbAchats" INTEGER NOT NULL DEFAULT 0,
    "badgeVerifie" BOOLEAN NOT NULL DEFAULT false,
    "otpSecret" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "refreshToken" TEXT,
    "fcmTokens" TEXT[],
    "biometricEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "vendeurId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categorie" "Categorie" NOT NULL,
    "etat" "EtatArticle" NOT NULL,
    "prix" DOUBLE PRECISION NOT NULL,
    "ville" TEXT,
    "photos" TEXT[],
    "statut" "StatutArticle" NOT NULL DEFAULT 'EN_LIGNE',
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "acheteurId" TEXT NOT NULL,
    "vendeurId" TEXT NOT NULL,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "expediteurId" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "type" "TypeMessage" NOT NULL DEFAULT 'TEXTE',
    "offrePrix" DOUBLE PRECISION,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "acheteurId" TEXT NOT NULL,
    "vendeurId" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "fraisService" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "statutEscrow" "StatutEscrow" NOT NULL DEFAULT 'EN_ATTENTE',
    "moyenPaiement" "MoyenPaiement" NOT NULL,
    "referencePaiement" TEXT,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateValidation" TIMESTAMP(3),
    "dateLimite" TIMESTAMP(3),
    "motifLitige" TEXT,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favoris" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favoris_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT,
    "data" JSONB,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "fcmToken" TEXT,
    "errorMessage" TEXT,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avis" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "auteurId" TEXT NOT NULL,
    "cibleId" TEXT NOT NULL,
    "note" INTEGER NOT NULL,
    "commentaire" TEXT,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "favoris_userId_articleId_key" ON "favoris"("userId", "articleId");

-- CreateIndex
CREATE UNIQUE INDEX "avis_transactionId_key" ON "avis"("transactionId");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_vendeurId_fkey" FOREIGN KEY ("vendeurId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_acheteurId_fkey" FOREIGN KEY ("acheteurId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_vendeurId_fkey" FOREIGN KEY ("vendeurId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_expediteurId_fkey" FOREIGN KEY ("expediteurId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_acheteurId_fkey" FOREIGN KEY ("acheteurId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_vendeurId_fkey" FOREIGN KEY ("vendeurId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favoris" ADD CONSTRAINT "favoris_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favoris" ADD CONSTRAINT "favoris_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_history" ADD CONSTRAINT "notification_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avis" ADD CONSTRAINT "avis_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avis" ADD CONSTRAINT "avis_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avis" ADD CONSTRAINT "avis_cibleId_fkey" FOREIGN KEY ("cibleId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
