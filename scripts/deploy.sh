#!/bin/bash
# ─── Bazario — Script de déploiement production ─────────────────────────────
set -euo pipefail

# ─── Couleurs ───────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Bazario — Déploiement Production${NC}"
echo ""

# ─── Détection de Docker Compose ────────────────────────────────────────────
if docker compose version &>/dev/null; then
    DOCKER_COMPOSE="docker compose"
elif docker-compose --version &>/dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    echo -e "${RED}❌ Docker Compose n'est pas installé${NC}"
    exit 1
fi

# ─── Vérifications ─────────────────────────────────────────────────────────
echo -e "${YELLOW}📋 Vérifications pré-déploiement...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker n'est pas installé${NC}"
    exit 1
fi

if [ ! -f .env ]; then
    echo -e "${RED}❌ Fichier .env manquant à la racine${NC}"
    echo -e "   Copier depuis backend/.env.production.example et configurer"
    exit 1
fi

# Vérifier que les migrations Prisma existent
if [ ! -d backend/prisma/migrations ] || [ -z "$(ls -A backend/prisma/migrations 2>/dev/null)" ]; then
    echo -e "${YELLOW}⚠️  Aucune migration Prisma trouvée. Création de la migration initiale...${NC}"
    echo -e "   Assurez-vous que PostgreSQL est accessible et exécutez :"
    echo -e "   cd backend && npx prisma migrate dev --name init"
    echo -e "   Puis relancez ce script."
    exit 1
fi

echo -e "${GREEN}✅ Vérifications OK${NC}"
echo ""

# ─── Build ──────────────────────────────────────────────────────────────────
echo -e "${YELLOW}🔨 Build des images Docker...${NC}"

$DOCKER_COMPOSE build backend

echo -e "${GREEN}✅ Build terminé${NC}"
echo ""

# ─── Démarrage des services de données ──────────────────────────────────────
echo -e "${YELLOW}🗄️  Démarrage PostgreSQL et Redis...${NC}"

$DOCKER_COMPOSE up -d postgres redis

echo -e "${GREEN}✅ Base de données prête${NC}"
echo ""

# ─── Migration Prisma ───────────────────────────────────────────────────────
echo -e "${YELLOW}🗄️  Migration base de données...${NC}"

sleep 5  # Attendre que PostgreSQL soit complètement prêt
$DOCKER_COMPOSE run --rm backend npx prisma migrate deploy

echo -e "${GREEN}✅ Migration terminée${NC}"
echo ""

# ─── Démarrage du backend ───────────────────────────────────────────────────
echo -e "${YELLOW}🚀 Démarrage du backend...${NC}"

$DOCKER_COMPOSE up -d backend

echo -e "${GREEN}✅ Backend démarré${NC}"
echo ""

# ─── Vérification ───────────────────────────────────────────────────────────
echo -e "${YELLOW}⏳ Vérification de l'API...${NC}"
sleep 5

HEALTH_URL="${BACKEND_URL:-http://localhost:3000}/api/v1/health"
for i in {1..6}; do
    if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ API opérationnelle : $HEALTH_URL${NC}"
        break
    fi
    if [ $i -eq 6 ]; then
        echo -e "${RED}❌ L'API ne répond pas après 30s. Vérifier les logs :${NC}"
        echo -e "   $DOCKER_COMPOSE logs backend"
    fi
    sleep 5
done

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Déploiement terminé${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "📊 Logs:     ${YELLOW}$DOCKER_COMPOSE logs -f backend${NC}"
echo -e "🛑 Arrêt:    ${YELLOW}$DOCKER_COMPOSE down${NC}"
echo -e "📱 Mobile:   ${YELLOW}cd mobile && npx eas build --platform android --profile production${NC}"
echo -e ""
echo -e "📋 Prochaines étapes :"
echo -e "   1. Configurer les certificats SSL dans ${YELLOW}nginx/ssl/${NC}"
echo -e "   2. Ajouter le fichier ${YELLOW}firebase-credentials.json${NC} pour les notifications push"
echo -e "   3. Déployer le mobile via ${YELLOW}npx eas build --platform android --profile production${NC}"
