# ─── Bazario — Backend Dockerfile (npm workspaces) ──────────────────────────
# Build context: racine du projet (./) — nécessaire pour package-lock.json
#
# Stratégie multi-stage :
#   1. deps     → installe les dépendances de production uniquement
#   2. builder  → installe toutes les dépendances, génère Prisma, build NestJS
#   3. runner   → copie les node_modules de prod + client Prisma généré + dist

# ─── Stage 1 : Dépendances de production ─────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

# Copier uniquement les fichiers de dépendances (pour le cache Docker)
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json

# Installer les dépendances de production pour le workspace backend uniquement
RUN npm ci --omit=dev --workspace=backend

# ─── Stage 2 : Build ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copier les fichiers de dépendances
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json

# Installer TOUTES les dépendances (dev inclus pour le build)
RUN npm ci

# Copier le code source du backend seulement
COPY backend/ ./backend/

# Générer le client Prisma et builder NestJS
RUN cd backend && npx prisma generate && npm run build

# ─── Stage 3 : Image finale (production) ─────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Utilitaires pour le healthcheck
RUN apk add --no-cache curl

# Copier les dépendances de production (stage 1)
COPY --from=deps /app/node_modules ./node_modules

# Copier le client Prisma généré (depuis le builder, car il contient les engines)
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copier le build et les migrations Prisma
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/prisma ./prisma
COPY --from=builder /app/backend/package.json ./

# Exposer le port
EXPOSE 3000

# Santé du conteneur
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1

# Démarrer l'application
CMD ["node", "dist/main"]
