#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Bazario — SSL Let's Encrypt via Docker (SANS sudo)
# ═══════════════════════════════════════════════════════════════════════════════
# Alternative à scripts/setup-ssl.sh pour les machines où `sudo` n'est pas
# disponible. Utilise l'image officielle certbot/certbot avec le mode `webroot` :
# nginx sert le challenge ACME sur le port 80, aucun arrêt de service nécessaire.
#
# Usage:
#   ./scripts/ssl-docker.sh                # Générer le certificat (production)
#   ./scripts/ssl-docker.sh --staging      # Test staging (aucun quota consommé)
#   ./scripts/ssl-docker.sh --renew        # Renouvellement manuel
#   ./scripts/ssl-docker.sh --dry-run      # Test de renouvellement (sans effet)
#   ./scripts/ssl-docker.sh --auto-renew   # Installer le cron de renouvellement
#   ./scripts/ssl-docker.sh --check        # Pré-vérifications uniquement
#   ./scripts/ssl-docker.sh --help
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Couleurs ───────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

info()  { echo -e "${CYAN}ℹ️  $1${NC}"; }
ok()    { echo -e "${GREEN}✅ $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }
step()  { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }

# ─── Configuration ───────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DOMAIN="${DOMAIN:-api.bazario.com}"
EMAIL="${EMAIL:-admin@bazario.com}"

# Répertoires locaux (montés dans le conteneur certbot)
CERTBOT_DATA="${PROJECT_DIR}/nginx/certbot_data"   # webroot servi par nginx
CERTBOT_ETC="${PROJECT_DIR}/nginx/certbot_etc"     # /etc/letsencrypt (persistance)
CERTBOT_LIB="${PROJECT_DIR}/nginx/certbot_lib"     # /var/lib/letsencrypt
CERTBOT_LOGS="${PROJECT_DIR}/nginx/certbot_logs"   # /var/log/letsencrypt
SSL_DIR="${PROJECT_DIR}/nginx/ssl"
RENEW_LOG="${CERTBOT_ETC}/renew.log"

CERTBOT_IMAGE="certbot/certbot"

# ─── Aide ────────────────────────────────────────────────────────────────────

show_help() {
    cat <<EOF
╔════════════════════════════════════════════════════════════════════╗
║     Bazario — SSL Let's Encrypt via Docker (sans sudo)            ║
╚════════════════════════════════════════════════════════════════════╝

Usage:
  $(basename "$0") [options]

Options:
  --staging     Utiliser l'environnement de staging Let's Encrypt (test)
  --renew       Renouveler le certificat existant
  --dry-run     Simuler le renouvellement (aucun changement)
  --auto-renew  Installer le cron de renouvellement quotidien (utilisateur)
  --check       Pré-vérifications uniquement (DNS, nginx, image)
  --force       Ignorer l'avertissement DNS et tenter quand même
  --help        Afficher cette aide

Exemples:
  # Pré-vérifications
  ./scripts/ssl-docker.sh --check

  # Génération en staging (recommandé avant la production)
  ./scripts/ssl-docker.sh --staging

  # Génération production
  ./scripts/ssl-docker.sh

  # Test du renouvellement
  ./scripts/ssl-docker.sh --dry-run

  # Renouvellement manuel + cron automatique
  ./scripts/ssl-docker.sh --renew
  ./scripts/ssl-docker.sh --auto-renew
EOF
    exit 0
}

# ─── Pré-vérifications ───────────────────────────────────────────────────────

check_dns() {
    step "Vérification DNS"
    local public_ip
    public_ip=$(curl -s --max-time 8 https://api.ipify.org 2>/dev/null || true)
    if [ -z "$public_ip" ]; then
        warn "Impossible de déterminer l'IP publique de cette machine."
        public_ip="?"
    fi
    ok "IP publique de cette machine : ${public_ip}"

    local dns_ip
    dns_ip=$(dig +short "$DOMAIN" A 2>/dev/null | head -1 || true)
    if [ -z "$dns_ip" ]; then
        warn "$DOMAIN ne résout pas (aucun enregistrement A trouvé)."
        return 1
    fi

    ok "$DOMAIN → $dns_ip"
    if [ "$public_ip" != "?" ] && [ "$dns_ip" != "$public_ip" ]; then
        warn "⚠️  Le DNS pointe vers $dns_ip, mais cette machine est $public_ip."
        warn "Le challenge ACME serait résolu vers une autre machine → échec garanti."
        return 1
    fi
    return 0
}

check_nginx() {
    step "Vérification Nginx (port 80 pour le challenge ACME)"
    if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^bazario-nginx$'; then
        info "Démarrage de nginx (docker compose --no-deps)..."
        (cd "$PROJECT_DIR" && docker compose --profile with-proxy up -d --no-deps nginx 2>&1 | tail -2)
    fi

    local code
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1/.well-known/acme-challenge/health-check" 2>/dev/null || true)
    # 404 = nginx répond bien (le fichier n'existe pas encore) ; 000 = injoignable
    if [ "$code" = "404" ] || [ "$code" = "200" ]; then
        ok "Nginx répond sur le port 80 (HTTP $code sur le chemin ACME)"
        return 0
    fi
    warn "Nginx ne répond pas sur le port 80 (HTTP ${code:-000})."
    return 1
}

check_image() {
    step "Vérification de l'image certbot"
    if ! docker image inspect "$CERTBOT_IMAGE" >/dev/null 2>&1; then
        info "Téléchargement de ${CERTBOT_IMAGE} (une seule fois)..."
        docker pull "$CERTBOT_IMAGE"
    fi
    ok "Image ${CERTBOT_IMAGE} disponible"
}

ensure_dirs() {
    mkdir -p "$CERTBOT_DATA" "$CERTBOT_ETC" "$CERTBOT_LIB" "$CERTBOT_LOGS" "$SSL_DIR"
}

# ─── Commande Docker certbot ────────────────────────────────────────────────
# On exécute certbot avec l'UID/GID de l'utilisateur courant pour que tous les
# fichiers créés (certs inclus) restent possédés par cet utilisateur — aucun
# sudo nécessaire pour les lire/remplacer ensuite.

certbot_docker() {
    docker run --rm \
        --user "$(id -u):$(id -g)" \
        -e HOME=/tmp \
        -v "${CERTBOT_DATA}:/var/www/certbot" \
        -v "${CERTBOT_ETC}:/etc/letsencrypt" \
        -v "${CERTBOT_LIB}:/var/lib/letsencrypt" \
        -v "${CERTBOT_LOGS}:/var/log/letsencrypt" \
        "$CERTBOT_IMAGE" "$@"
}

# ─── Génération ─────────────────────────────────────────────────────────────

generate_cert() {
    local staging="${1:-}"

    step "Génération du certificat Let's Encrypt (webroot)"

    ensure_dirs
    local staging_args=""
    if [ -n "$staging" ]; then
        info "🔬 Mode STAGING — certificat non reconnu par les navigateurs (test uniquement)"
        staging_args="--staging"
    fi

    info "Challenge ACME servi par nginx (webroot : ${CERTBOT_DATA})"
    certbot_docker certonly \
        --webroot -w /var/www/certbot \
        -d "$DOMAIN" \
        -m "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --non-interactive \
        $staging_args

    deploy_certs
}

# ─── Renouvellement ─────────────────────────────────────────────────────────

renew_certs() {
    local dry_run="${1:-}"

    step "Renouvellement du certificat (webroot)"

    if [ ! -d "$CERTBOT_ETC/live/$DOMAIN" ]; then
        error "Aucun certificat existant pour $DOMAIN dans ${CERTBOT_ETC}"
        error "Générez d'abord le certificat : ./scripts/ssl-docker.sh"
        exit 1
    fi

    local dry_args=""
    if [ -n "$dry_run" ]; then
        info "🔍 Mode dry-run — aucun changement réel"
        dry_args="--dry-run"
    fi

    certbot_docker renew \
        --webroot -w /var/www/certbot \
        --non-interactive \
        $dry_args || {
        # certbot renew renvoie un code != 0 quand rien n'est à renouveler
        warn "Aucun renouvellement nécessaire (certificat valide > 30 jours)."
    }

    if [ -z "$dry_run" ]; then
        deploy_certs
    fi
}

# ─── Déploiement des certificats dans nginx/ssl ─────────────────────────────

deploy_certs() {
    step "Déploiement des certificats vers ${SSL_DIR}"
    ensure_dirs

    local fullchain="${CERTBOT_ETC}/live/${DOMAIN}/fullchain.pem"
    local privkey="${CERTBOT_ETC}/live/${DOMAIN}/privkey.pem"

    if [ ! -f "$fullchain" ] || [ ! -f "$privkey" ]; then
        error "Certificats introuvables dans ${CERTBOT_ETC}/live/${DOMAIN}"
        exit 1
    fi

    cp -L "$fullchain" "$SSL_DIR/cert.pem"
    cp -L "$privkey"   "$SSL_DIR/key.pem"
    chmod 644 "$SSL_DIR/cert.pem"
    chmod 600 "$SSL_DIR/key.pem"

    ok "Certificats copiés : cert.pem (644) + key.pem (600)"

    info "Rechargement de nginx..."
    docker exec bazario-nginx nginx -s reload >/dev/null 2>&1 && ok "Nginx rechargé" \
        || warn "Rechargez nginx manuellement : docker exec bazario-nginx nginx -s reload"

    local expiry
    expiry=$(openssl x509 -in "$SSL_DIR/cert.pem" -noout -enddate 2>/dev/null | cut -d= -f2-)
    ok "Certificat déployé — expire le ${expiry:-?}"
}

# ─── Renouvellement automatique (cron utilisateur, sans sudo) ───────────────

install_auto_renew() {
    step "Installation du renouvellement automatique (crontab utilisateur)"
    ensure_dirs

    local cron_line="0 3 * * * cd ${PROJECT_DIR} && ./scripts/ssl-docker.sh --renew >> ${RENEW_LOG} 2>&1"

    if crontab -l 2>/dev/null | grep -q 'ssl-docker.sh --renew'; then
        warn "Un cron Bazario existe déjà :"
        crontab -l 2>/dev/null | grep 'ssl-docker.sh --renew'
        return 0
    fi

    ( crontab -l 2>/dev/null; echo "$cron_line" ) | crontab -

    ok "Cron installé : tous les jours à 3h → ./scripts/ssl-docker.sh --renew"
    echo ""
    echo "   📋 Logs de renouvellement : ${RENEW_LOG}"
    echo "   🔍 Tester avec            : ./scripts/ssl-docker.sh --dry-run"
}

# ─── Pré-vérifications ──────────────────────────────────────────────────────

run_checks() {
    echo -e "${BLUE}🔍 Pré-vérifications SSL — ${DOMAIN}${NC}"
    check_dns || true
    check_nginx || true
    check_image
    ok "Pré-vérifications terminées"
}

# ─── Main ────────────────────────────────────────────────────────────────────

MODE="generate"
STAGING=""
DRY_RUN=""
FORCE=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --staging)   MODE="generate"; STAGING="1"; shift ;;
        --renew)     MODE="renew";    shift ;;
        --dry-run)   MODE="renew"; DRY_RUN="1"; shift ;;
        --auto-renew) MODE="auto-renew"; shift ;;
        --check)     MODE="check";    shift ;;
        --force)     FORCE=true;      shift ;;
        --help|-h)   show_help ;;
        *) error "Option inconnue: $1"; echo; show_help ;;
    esac
done

case "$MODE" in
    check)
        run_checks
        ;;
    generate)
        check_image
        if ! check_dns; then
            if [ "$FORCE" = true ]; then
                warn "DNS non conforme, mais --force : tentative quand même (risque d'échec + quota)."
            else
                error "DNS non conforme — abandon. Utilisez --check pour le diagnostic."
                error "Corrigez le record A chez votre registrar, puis relancez."
                exit 1
            fi
        fi
        check_nginx || { error "Nginx ne répond pas sur le port 80 — impossible de continuer."; exit 1; }
        generate_cert "$STAGING"
        ;;
    renew)
        check_image
        renew_certs "$DRY_RUN"
        ;;
    auto-renew)
        install_auto_renew
        ;;
esac

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ SSL Docker terminé pour ${DOMAIN}${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Prochaines étapes :"
echo "   1. Vérifier HTTPS : curl -I https://${DOMAIN}/api/v1/health"
echo "   2. Tester SSL     : https://www.ssllabs.com/ssltest/analyze.html?d=${DOMAIN}"
echo "   3. Automatiser    : ./scripts/ssl-docker.sh --auto-renew"
