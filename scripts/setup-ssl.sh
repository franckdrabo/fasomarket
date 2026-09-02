#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Bazario — Script de configuration SSL Let's Encrypt
# ═══════════════════════════════════════════════════════════════════════════════
# Usage:
#   ./scripts/setup-ssl.sh              # Interactive : guide pas à pas
#   ./scripts/setup-ssl.sh --domain api.bazario.com --email admin@bazario.com
#   ./scripts/setup-ssl.sh --renew      # Renouvellement manuel
#   ./scripts/setup-ssl.sh --auto-renew # Installation du cron de renouvellement
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Couleurs ───────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ─── Configuration ───────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SSL_DIR="${PROJECT_DIR}/nginx/ssl"
DOMAIN="${DOMAIN:-api.bazario.com}"
EMAIL="${EMAIL:-admin@bazario.com}"

# ─── Fonctions utilitaires ──────────────────────────────────────────────────

info()  { echo -e "${CYAN}ℹ️  $1${NC}"; }
ok()    { echo -e "${GREEN}✅ $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }
step()  { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }

show_help() {
    cat <<EOF
╔════════════════════════════════════════════════════════════════════╗
║          Bazario — Configuration SSL Let's Encrypt                ║
╚════════════════════════════════════════════════════════════════════╝

Usage:
  $(basename "$0") [options]

Options:
  --domain DOMAIN    Nom de domaine (défaut: ${DOMAIN})
  --email EMAIL      Email pour les notifications Let's Encrypt (défaut: ${EMAIL})
  --renew            Renouvellement manuel des certificats
  --auto-renew       Installer le cron de renouvellement automatique
  --staging          Utiliser l'environnement de staging Let's Encrypt (test)
  --force            Forcer la recréation des certificats
  --help             Afficher cette aide

Exemples:
  # Configuration interactive
  ./scripts/setup-ssl.sh

  # Configuration automatique
  ./scripts/setup-ssl.sh --domain api.monsite.com --email contact@monsite.com

  # Test avec l'environnement staging (pas de limite de taux)
  ./scripts/setup-ssl.sh --staging

  # Renouvellement manuel
  ./scripts/setup-ssl.sh --renew

  # Installation du cron de renouvellement automatique
  ./scripts/setup-ssl.sh --auto-renew
EOF
    exit 0
}

# ─── Parse des arguments ────────────────────────────────────────────────────

MODE="setup"
STAGING=""
FORCE=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --domain)    DOMAIN="$2";     shift 2 ;;
        --email)     EMAIL="$2";      shift 2 ;;
        --renew)     MODE="renew";    shift ;;
        --auto-renew) MODE="auto-renew"; shift ;;
        --staging)   STAGING="--staging"; shift ;;
        --force)     FORCE=true;      shift ;;
        --help|-h)   show_help ;;
        *)           error "Option inconnue: $1"; show_help ;;
    esac
done

# ─── Vérifications ──────────────────────────────────────────────────────────

check_prerequisites() {
    step "Vérification des prérequis"

    local missing=()

    if ! command -v certbot &> /dev/null; then
        missing+=("certbot (Let's Encrypt client)")
    fi

    if ! command -v openssl &> /dev/null; then
        missing+=("openssl")
    fi

    if ! command -v curl &> /dev/null; then
        missing+=("curl")
    fi

    if [ ${#missing[@]} -gt 0 ]; then
        error "Outils manquants :"
        for tool in "${missing[@]}"; do echo "   - $tool"; done
        echo ""
        echo "Pour installer certbot :"
        echo "   Ubuntu/Debian : sudo apt-get install certbot"
        echo "   macOS         : brew install certbot"
        echo "   Docker        : docker run -it --rm -v /etc/letsencrypt:/etc/letsencrypt certbot/certbot ..."
        exit 1
    fi

    ok "Tous les prérequis sont installés"
}

check_dns() {
    step "Vérification DNS"

    info "Résolution de $DOMAIN..."
    local ip
    ip=$(dig +short "$DOMAIN" 2>/dev/null || host "$DOMAIN" 2>/dev/null | grep "has address" | awk '{print $NF}' || curl -s "https://dns.google/resolve?name=$DOMAIN&type=A" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['Answer'][0]['data'])" 2>/dev/null)

    if [ -z "$ip" ]; then
        warn "Impossible de résoudre $DOMAIN"
        warn "Assurez-vous que le DNS pointe vers le serveur avant de continuer."
        echo ""
        read -rp "Continuer quand même ? (o/N) " confirm
        if [[ ! "$confirm" =~ ^[oOyY]$ ]]; then
            error "Configuration annulée"
            exit 1
        fi
    else
        ok "$DOMAIN → $ip"
    fi

    # Vérifier que le port 80 est accessible (nécessaire pour l'ACME challenge)
    info "Vérification que le port 80 est ouvert..."
    if curl -s -o /dev/null -w "%{http_code}" "http://$DOMAIN" --connect-timeout 5 2>/dev/null | grep -q "200\|301\|302"; then
        ok "Port 80 accessible"
    else
        warn "Impossible de joindre $DOMAIN sur le port 80"
        warn "Assurez-vous que le serveur est démarré et que le firewall autorise le port 80."
        echo ""
        read -rp "Continuer quand même ? (o/N) " confirm
        if [[ ! "$confirm" =~ ^[oOyY]$ ]]; then
            error "Configuration annulée"
            exit 1
        fi
    fi
}

# ─── Génération des certificats ─────────────────────────────────────────────

generate_self_signed() {
    step "Génération d'un certificat auto-signé (développement)"

    mkdir -p "$SSL_DIR"

    if [ -f "$SSL_DIR/cert.pem" ] && [ -f "$SSL_DIR/key.pem" ] && [ "$FORCE" = false ]; then
        warn "Des certificats existent déjà dans $SSL_DIR"
        read -rp "Les remplacer ? (o/N) " confirm
        if [[ ! "$confirm" =~ ^[oOyY]$ ]]; then
            info "Génération annulée"
            return
        fi
    fi

    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$SSL_DIR/key.pem" \
        -out "$SSL_DIR/cert.pem" \
        -subj "/C=CI/ST=Abidjan/L=Abidjan/O=Bazario/CN=${DOMAIN}" \
        2>/dev/null

    ok "Certificat auto-signé généré :"
    echo "   📜 Certificat : ${SSL_DIR}/cert.pem"
    echo "   🔑 Clé       : ${SSL_DIR}/key.pem"
    warn "⚠️  Les certificats auto-signés ne sont pas adaptés à la production !"
    warn "   Exécutez ce script sans --self-signed pour Let's Encrypt."
}

generate_letsencrypt() {
    step "Génération des certificats Let's Encrypt"

    mkdir -p "$SSL_DIR"

    if [ -f "$SSL_DIR/cert.pem" ] && [ -f "$SSL_DIR/key.pem" ] && [ "$FORCE" = false ]; then
        warn "Des certificats existent déjà dans $SSL_DIR"
        warn "Utilisez --force pour les remplacer ou --renew pour les renouveler."
        echo ""
        read -rp "Voulez-vous les remplacer ? (o/N) " confirm
        if [[ ! "$confirm" =~ ^[oOyY]$ ]]; then
            info "Génération annulée"
            return
        fi
    fi

    info "Arrêt temporaire de Nginx (si en cours d'exécution) pour le mode standalone..."
    sudo systemctl stop nginx 2>/dev/null || true
    sudo docker stop bazario-nginx 2>/dev/null || true

    info "Génération des certificats via Let's Encrypt (mode standalone)..."
    echo ""

    local extra_args=""
    if [ -n "$STAGING" ]; then
        info "🔬 Mode STAGING — les certificats ne seront pas reconnus par les navigateurs"
        extra_args="--staging"
    fi

    sudo certbot certonly --standalone \
        --preferred-challenges http \
        -d "$DOMAIN" \
        -m "$EMAIL" \
        --agree-tos \
        --non-interactive \
        $extra_args

    if [ $? -ne 0 ]; then
        error "Échec de la génération des certificats"
        warn "Vérifiez que :"
        warn "   - Le nom de domaine pointe vers ce serveur"
        warn "   - Le port 80 est accessible (pas de firewall bloquant)"
        warn "   - Vous n'avez pas dépassé les limites de taux (5 certificats/domaine/semaine)"
        warn ""
        warn "Utilisez --staging pour tester sans affecter les limites de taux."
        exit 1
    fi

    # Copier les certificats dans le dossier Nginx
    info "Copie des certificats vers $SSL_DIR..."
    sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$SSL_DIR/cert.pem"
    sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$SSL_DIR/key.pem"
    sudo chown -R "$(whoami):$(id -gn)" "$SSL_DIR"
    chmod 644 "$SSL_DIR/cert.pem"
    chmod 600 "$SSL_DIR/key.pem"

    ok "Certificats Let's Encrypt générés avec succès !"
    echo ""
    echo "   📜 Certificat : ${SSL_DIR}/cert.pem"
    echo "   🔑 Clé       : ${SSL_DIR}/key.pem"
    echo "   📅 Expire    : $(sudo openssl x509 -in "$SSL_DIR/cert.pem" -noout -enddate 2>/dev/null | cut -d= -f2-)"

    # Redémarrer Nginx
    info "Redémarrage de Nginx..."
    sudo systemctl start nginx 2>/dev/null || true
    cd "$PROJECT_DIR" && docker compose --profile with-proxy up -d nginx 2>/dev/null || true

    ok "Nginx redémarré avec les nouveaux certificats"
}

# ─── Renouvellement ─────────────────────────────────────────────────────────

renew_certificates() {
    step "Renouvellement des certificats Let's Encrypt"

    if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
        error "Aucun certificat Let's Encrypt trouvé pour $DOMAIN"
        error "Exécutez d'abord le script sans --renew pour générer les certificats."
        exit 1
    fi

    info "Renouvellement des certificats via webroot (sans interruption)..."
    sudo certbot renew --webroot -w /var/www/certbot --non-interactive

    if [ $? -ne 0 ]; then
        error "Échec du renouvellement"
        exit 1
    fi

    # Copier les certificats mis à jour
    if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
        info "Mise à jour des certificats dans $SSL_DIR..."
        sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$SSL_DIR/cert.pem"
        sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$SSL_DIR/key.pem"
        sudo chown -R "$(whoami):$(id -gn)" "$SSL_DIR"

        # Recharger Nginx pour prendre en compte les nouveaux certificats (sans downtime)
        info "Rechargement de Nginx..."
        sudo systemctl reload nginx 2>/dev/null || true
        cd "$PROJECT_DIR" && docker compose --profile with-proxy exec nginx nginx -s reload 2>/dev/null || true

        DATE_EXPIRY=$(openssl x509 -in "$SSL_DIR/cert.pem" -noout -enddate 2>/dev/null | cut -d= -f2-)
        ok "Certificats renouvelés avec succès ! (expire le $DATE_EXPIRY)"
    else
        warn "Aucun certificat renouvelé (pas encore expiré)"
    fi
}

# ─── Renouvellement automatique (cron) ──────────────────────────────────────

install_auto_renew() {
    step "Installation du renouvellement automatique (cron)"

    local cron_job="0 3 * * * cd ${PROJECT_DIR} && ./scripts/setup-ssl.sh --renew >> /var/log/bazario-ssl-renew.log 2>&1"
    local cron_file="/etc/cron.d/bazario-ssl-renew"

    info "Ajout du cron de renouvellement dans ${cron_file}..."

    if [ -f "$cron_file" ]; then
        warn "Un cron existe déjà pour le renouvellement SSL"
        read -rp "Le remplacer ? (o/N) " confirm
        if [[ ! "$confirm" =~ ^[oOyY]$ ]]; then
            info "Installation annulée"
            return
        fi
    fi

    echo "# Bazario — Renouvellement automatique des certificats SSL Let's Encrypt
# Exécuté tous les jours à 3h du matin
# Les certificats ne sont réellement renouvelés que si < 30 jours avant expiration
${cron_job}
" | sudo tee "$cron_file" > /dev/null

    sudo chmod 644 "$cron_file"

    ok "Cron installé : renouvellement tous les jours à 3h"
    echo ""
    echo "   🔄 Vérification : sudo certbot renew --dry-run"
    echo "   📋 Logs        : /var/log/bazario-ssl-renew.log"

    # Test rapide du renouvellement
    info "Test du renouvellement (dry-run)..."
    sudo certbot renew --dry-run 2>/dev/null && {
        ok "Test de renouvellement réussi"
    } || {
        warn "Le test de renouvellement a échoué. Vérifiez la configuration."
    }
}

# ─── Vérification finale ────────────────────────────────────────────────────

final_check() {
    step "Vérification finale"

    if [ ! -f "$SSL_DIR/cert.pem" ] || [ ! -f "$SSL_DIR/key.pem" ]; then
        error "Aucun certificat trouvé dans $SSL_DIR"
        exit 1
    fi

    echo ""
    echo "   📜 Certificat : $(openssl x509 -in "$SSL_DIR/cert.pem" -noout -subject 2>/dev/null | head -c 60)..."
    echo "   🏢 Émetteur   : $(openssl x509 -in "$SSL_DIR/cert.pem" -noout -issuer 2>/dev/null | head -c 60)..."
    echo "   📅 Valide du  : $(openssl x509 -in "$SSL_DIR/cert.pem" -noout -startdate 2>/dev/null | cut -d= -f2-)"
    echo "   📅 Expire le  : $(openssl x509 -in "$SSL_DIR/cert.pem" -noout -enddate 2>/dev/null | cut -d= -f2-)"

    # Vérifier la chaîne de confiance
    echo ""
    if openssl verify -CApath /etc/ssl/certs "$SSL_DIR/cert.pem" > /dev/null 2>&1; then
        ok "Chaîne de confiance valide"
    else
        warn "Impossible de vérifier la chaîne de confiance (peut être normal pour un auto-signé)"
    fi

    # Générer les paramètres Diffie-Hellman pour une meilleure sécurité
    if [ ! -f "$SSL_DIR/dhparam.pem" ]; then
        echo ""
        info "Génération des paramètres Diffie-Hellman (cela peut prendre quelques minutes)..."
        openssl dhparam -out "$SSL_DIR/dhparam.pem" 2048 2>/dev/null
        chmod 644 "$SSL_DIR/dhparam.pem"
        ok "Paramètres Diffie-Hellman générés"
    fi

    echo ""
    ok "Configuration SSL terminée !"
    echo ""
    echo "Prochaines étapes :"
    echo "   1. Démarrez le proxy : docker compose --profile with-proxy up -d nginx"
    echo "   2. Vérifiez : curl -I https://${DOMAIN}/api/v1/health"
    echo "   3. Testez SSL   : https://www.ssllabs.com/ssltest/analyze.html?d=${DOMAIN}"
}

# ─── Mode interactif ────────────────────────────────────────────────────────

interactive_mode() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║      🔐 Configuration SSL — Bazario ${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
    echo ""

    # Demander le domaine
    read -rp "🌐 Nom de domaine (défaut: ${DOMAIN}) : " input_domain
    DOMAIN="${input_domain:-$DOMAIN}"

    # Demander l'email
    read -rp "📧 Email pour Let's Encrypt (défaut: ${EMAIL}) : " input_email
    EMAIL="${input_email:-$EMAIL}"

    echo ""
    echo "Options disponibles :"
    echo "   1) Let's Encrypt (production) — certificat valide"
    echo "   2) Let's Encrypt (staging)    — pour tester sans limites de taux"
    echo "   3) Auto-signé                 — pour le développement uniquement"
    echo ""
    read -rp "Choix [1/2/3] (défaut: 1) : " choice

    case "${choice:-1}" in
        1) STAGING="";    generate_letsencrypt ;;
        2) STAGING="--staging"; generate_letsencrypt ;;
        3) generate_self_signed ;;
        *) error "Choix invalide" ; exit 1 ;;
    esac

    final_check

    echo ""
    info "Voulez-vous installer le renouvellement automatique ? (cron quotidien)"
    read -rp "Installer ? (o/N) " install_cron
    if [[ "$install_cron" =~ ^[oOyY]$ ]]; then
        install_auto_renew
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# ─── Main ─────────────────────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${BLUE}┌──────────────────────────────────────────────────────────┐${NC}"
echo -e "${BLUE}│  🔐 Bazario — Configuration SSL/TLS Let's Encrypt         │${NC}"
echo -e "${BLUE}└──────────────────────────────────────────────────────────┘${NC}"
echo ""

case "$MODE" in
    setup)
        if [ "$DOMAIN" = "api.bazario.com" ] && [ -t 0 ]; then
            # Mode interactif si le domaine est celui par défaut et qu'on est dans un terminal
            interactive_mode
        else
            # Mode automatique
            check_prerequisites
            check_dns
            # Demander le type de certificat
            echo ""
            info "Détection du mode d'exécution..."
            if [ -n "$STAGING" ]; then
                generate_letsencrypt
            else
                echo "Choix du type de certificat :"
                echo "   1) Let's Encrypt (production)"
                echo "   2) Auto-signé (développement)"
                read -rp "Choix [1/2] (défaut: 1) : " cert_type
                case "${cert_type:-1}" in
                    1) generate_letsencrypt ;;
                    2) generate_self_signed ;;
                esac
            fi
            final_check
        fi
        ;;
    renew)
        check_prerequisites
        renew_certificates
        final_check
        ;;
    auto-renew)
        install_auto_renew
        ;;
esac

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Configuration SSL terminée pour ${DOMAIN}${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
