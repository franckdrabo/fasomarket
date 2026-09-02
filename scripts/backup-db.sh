#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# FasoMarket — Script de sauvegarde automatisée PostgreSQL
# ═══════════════════════════════════════════════════════════════════════════════
# Usage:
#   ./scripts/backup-db.sh                # Sauvegarde immédiate
#   ./scripts/backup-db.sh --list         # Lister les sauvegardes existantes
#   ./scripts/backup-db.sh --restore latest  # Restaurer la dernière sauvegarde
#   ./scripts/backup-db.sh --restore ./backups/fasomarket_2026-01-15_030002.sql.gz
#   ./scripts/backup-db.sh --install-cron # Installer le cron de backup quotidien
#   ./scripts/backup-db.sh --status       # État du répertoire de backups
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

# Répertoire des backups (hors du volume Docker pour persistance)
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_DIR}/backups}"

# Nom du conteneur PostgreSQL dans Docker Compose
DB_CONTAINER="${DB_CONTAINER:-fasomarket-db}"

# Nom de la base de données (lu depuis .env ou docker-compose par défaut)
DB_NAME="${DB_NAME:-fasomarket}"
DB_USER="${DB_USER:-fasomarket}"

# Rétention : nombre de sauvegardes à conserver
RETENTION_COUNT="${RETENTION_COUNT:-14}"

# Notification Slack (optionnel) — Webhook URL
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

# Upload S3 (optionnel) — via AWS CLI ou rclone
S3_BUCKET="${S3_BUCKET:-}"

# ─── Helper : charger les variables depuis .env ─────────────────────────────

load_env() {
    local env_file="${PROJECT_DIR}/.env"
    if [ -f "$env_file" ]; then
        local val
        val=$(grep -s '^BACKUP_DIR=' "$env_file" | head -1 | cut -d= -f2- || true); [ -n "$val" ] && BACKUP_DIR="$val"
        val=$(grep -s '^DB_CONTAINER=' "$env_file" | head -1 | cut -d= -f2- || true); [ -n "$val" ] && DB_CONTAINER="$val"
        val=$(grep -s '^DB_NAME=' "$env_file" | head -1 | cut -d= -f2- || true); [ -n "$val" ] && DB_NAME="$val"
        val=$(grep -s '^DB_USER=' "$env_file" | head -1 | cut -d= -f2- || true); [ -n "$val" ] && DB_USER="$val"
        val=$(grep -s '^RETENTION_COUNT=' "$env_file" | head -1 | cut -d= -f2- || true); [ -n "$val" ] && RETENTION_COUNT="$val"
        val=$(grep -s '^SLACK_WEBHOOK_URL=' "$env_file" | head -1 | cut -d= -f2- || true); [ -n "$val" ] && SLACK_WEBHOOK_URL="$val"
        val=$(grep -s '^S3_BUCKET=' "$env_file" | head -1 | cut -d= -f2- || true); [ -n "$val" ] && S3_BUCKET="$val"
    fi
}

# ─── Notification Slack ──────────────────────────────────────────────────────

notify_slack() {
    local status="$1"  # success | failure
    local message="$2"
    local color
    [ "$status" = "success" ] && color="#2ECC71" || color="#E74C3C"

    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -s -X POST "$SLACK_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"🗄️ Backup FasoMarket — $message\",
                    \"fields\": [
                        {\"title\": \"Base\", \"value\": \"$DB_NAME\", \"short\": true},
                        {\"title\": \"Date\", \"value\": \"$(date '+%Y-%m-%d %H:%M:%S')\", \"short\": true},
                        {\"title\": \"Taille\", \"value\": \"$3\", \"short\": true},
                        {\"title\": \"Serveur\", \"value\": \"$(hostname)\", \"short\": true}
                    ],
                    \"footer\": \"FasoMarket Backup Script\"
                }]
            }" > /dev/null 2>&1 || true
    fi
}

# ─── Vérifications ───────────────────────────────────────────────────────────

check_prerequisites() {
    local missing=()

    if ! command -v docker &> /dev/null; then
        missing+=("docker")
    fi

    if [ ${#missing[@]} -gt 0 ]; then
        error "Outils manquants :"
        for tool in "${missing[@]}"; do echo "   - $tool"; done
        exit 1
    fi

    # Vérifier que le conteneur PostgreSQL tourne
    if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
        error "Conteneur PostgreSQL introuvable : ${DB_CONTAINER}"
        info "Assurez-vous que Docker Compose est démarré : docker compose up -d postgres"
        exit 1
    fi

    # Vérifier que pg_dump est disponible dans le conteneur
    if ! docker exec "$DB_CONTAINER" pg_dump --version &>/dev/null; then
        error "pg_dump n'est pas disponible dans le conteneur ${DB_CONTAINER}"
        exit 1
    fi

    ok "Prérequis OK — conteneur ${DB_CONTAINER} prêt"
}

# ─── Sauvegarde ──────────────────────────────────────────────────────────────

perform_backup() {
    step "Sauvegarde de la base de données"

    mkdir -p "$BACKUP_DIR"

    local timestamp
    timestamp=$(date '+%Y-%m-%d_%H%M%S')
    local backup_file="${BACKUP_DIR}/${DB_NAME}_${timestamp}.sql.gz"
    local backup_size

    info "Base    : ${DB_NAME}"
    info "Conteneur : ${DB_CONTAINER}"
    info "Fichier : ${backup_file}"

    # Dump via Docker exec (évite d'exposer le port 5432)
    info "Dump en cours... (cela peut prendre quelques secondes)"
    if docker exec "$DB_CONTAINER" pg_dump \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --clean \
        --if-exists \
        --no-owner \
        --no-acl \
        --verbose \
        2>/tmp/fasomarket-db-dump.log \
        | gzip > "$backup_file"; then
        ok "Dump terminé avec succès"
    else
        error "Échec du dump"
        warn "Dernières lignes du log :"
        tail -5 /tmp/fasomarket-db-dump.log 2>/dev/null || true
        notify_slack "failure" "Échec du dump PostgreSQL" "0"
        return 1
    fi

    # Taille
    if [ -f "$backup_file" ]; then
        backup_size=$(du -h "$backup_file" | cut -f1)
        ok "Sauvegarde créée : ${backup_size}"
        echo "   📁 ${backup_file}"
    else
        error "Fichier de sauvegarde introuvable après dump"
        return 1
    fi

    # Rotation
    apply_rotation

    # Upload S3 (optionnel)
    if [ -n "$S3_BUCKET" ]; then
        upload_to_s3 "$backup_file"
    fi

    # Notification
    local relative_path="${backup_file#"${PROJECT_DIR}/"}"
    notify_slack "success" "Sauvegarde réussie" "${backup_size}"

    # Log dans le fichier de backup
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Backup: ${relative_path} (${backup_size})" >> "${BACKUP_DIR}/backup-history.log"

    return 0
}

# ─── Rotation (conserver N dernières sauvegardes) ────────────────────────────

apply_rotation() {
    step "Rotation des sauvegardes (rétention : ${RETENTION_COUNT})"

    local count
    count=$(ls -1 "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | wc -l)

    if [ "$count" -le "$RETENTION_COUNT" ]; then
        ok "Aucune rotation nécessaire (${count} fichiers, max ${RETENTION_COUNT})"
        return
    fi

    local to_delete=$((count - RETENTION_COUNT))
    info "Suppression de ${to_delete} ancienne(s) sauvegarde(s)..."

    ls -1t "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | tail -n "$to_delete" | while read -r old_file; do
        rm -f "$old_file"
        local old_name="${old_file#"${PROJECT_DIR}/"}"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🗑️  Rotation: ${old_name}" >> "${BACKUP_DIR}/backup-history.log"
        info "   🗑️  Supprimé : ${old_name}"
    done

    ok "Rotation terminée"
}

# ─── Upload S3 (optionnel) ───────────────────────────────────────────────────

upload_to_s3() {
    local file="$1"
    local filename
    filename=$(basename "$file")

    info "Upload vers S3 : ${S3_BUCKET}/${filename}"

    if command -v aws &> /dev/null; then
        aws s3 cp "$file" "${S3_BUCKET}/${filename}" --storage-class STANDARD_IA 2>/dev/null && {
            ok "Upload S3 réussi"
        } || {
            warn "Upload S3 échoué — la sauvegarde reste disponible localement"
        }
    elif command -v rclone &> /dev/null; then
        rclone copy "$file" "${S3_BUCKET}/" 2>/dev/null && {
            ok "Upload rclone réussi"
        } || {
            warn "Upload rclone échoué — la sauvegarde reste disponible localement"
        }
    else
        warn "aws CLI ou rclone non installé — upload S3 ignoré"
        info "   Installez aws CLI : sudo apt-get install awscli && aws configure"
    fi
}

# ─── Restauration ─────────────────────────────────────────────────────────────

restore_backup() {
    local source="$1"

    step "Restauration de la base de données"

    if [ "$source" = "latest" ]; then
        source=$(ls -1t "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | head -1)
        if [ -z "$source" ]; then
            error "Aucune sauvegarde trouvée dans ${BACKUP_DIR}"
            exit 1
        fi
    fi

    if [ ! -f "$source" ]; then
        error "Fichier introuvable : ${source}"
        exit 1
    fi

    local file_size
    file_size=$(du -h "$source" | cut -f1)

    warn "⚠️  Vous êtes sur le point de RESTAURER la base de données !"
    warn "   Fichier : ${source} (${file_size})"
    warn "   Base    : ${DB_NAME} (conteneur: ${DB_CONTAINER})"
    warn "   Toutes les données actuelles seront ÉCRASÉES."
    echo ""
    read -rp "Taper 'RESTORE' pour confirmer : " confirm
    if [ "$confirm" != "RESTORE" ]; then
        error "Restauration annulée"
        exit 1
    fi

    info "Restauration en cours..."

    # Décompresser et restaurer via psql dans le conteneur
    if gunzip -c "$source" | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" 2>/tmp/fasomarket-db-restore.log; then
        ok "Restauration terminée avec succès"
    else
        error "Échec de la restauration"
        warn "Dernières lignes du log :"
        tail -10 /tmp/fasomarket-db-restore.log 2>/dev/null || true
        exit 1
    fi

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔄 Restauration: ${source}" >> "${BACKUP_DIR}/backup-history.log"
}

# ─── Lister les sauvegardes ──────────────────────────────────────────────────

list_backups() {
    step "Sauvegardes disponibles dans ${BACKUP_DIR}"

    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]; then
        info "Aucune sauvegarde trouvée"
        return
    fi

    echo ""
    printf "%-30s %12s  %s\n" "FICHIER" "TAILLE" "DATE"
    printf "%s\n" "$(printf '─%.0s' {1..60})"

    ls -1t "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | while read -r file; do
        local filename size date_str
        filename=$(basename "$file")
        size=$(du -h "$file" | cut -f1)
        date_str=$(date -r "$file" '+%Y-%m-%d %H:%M' 2>/dev/null || stat -f '%Sm' "$file" 2>/dev/null || echo "")
        printf "%-30s %12s  %s\n" "$filename" "$size" "$date_str"
    done

    echo ""
    local total total_size
    total=$(ls -1 "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | wc -l)
    total_size=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
    info "Total : ${total} sauvegarde(s), ${total_size}"
}

show_status() {
    step "État du système de backup"

    # Répertoire
    if [ -d "$BACKUP_DIR" ]; then
        local total_size
        total_size=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
        ok "Répertoire : ${BACKUP_DIR} (${total_size})"
    else
        warn "Répertoire : ${BACKUP_DIR} (n'existe pas encore)"
    fi

    # Conteneur PostgreSQL
    if docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
        ok "Conteneur   : ${DB_CONTAINER} (en cours d'exécution)"
    else
        warn "Conteneur   : ${DB_CONTAINER} (ARRÊTÉ)"
    fi

    # Dernière sauvegarde
    local last_backup
    last_backup=$(ls -1t "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | head -1)
    if [ -n "$last_backup" ]; then
        local last_size last_date
        last_size=$(du -h "$last_backup" | cut -f1)
        last_date=$(date -r "$last_backup" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || stat -f '%Sm' "$last_backup" 2>/dev/null || echo "")
        ok "Dernier backup : $(basename "$last_backup") (${last_size}, ${last_date})"
    else
        warn "Aucun backup effectué"
    fi

    # Rétention
    ok "Rétention : ${RETENTION_COUNT} sauvegardes"

    # S3
    if [ -n "$S3_BUCKET" ]; then
        ok "S3        : ${S3_BUCKET}"
    else
        info "S3        : non configuré (optionnel)"
    fi

    # Slack
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        ok "Slack     : configuré"
    else
        info "Slack     : non configuré (optionnel)"
    fi

    # Cron
    if crontab -l 2>/dev/null | grep -q 'backup-db.sh'; then
        ok "Cron      : installé"
    else
        info "Cron      : non installé (./scripts/backup-db.sh --install-cron)"
    fi
}

# ─── Installation du cron ────────────────────────────────────────────────────

install_cron() {
    step "Installation du cron de sauvegarde automatique"

    local cron_schedule="${BACKUP_CRON_SCHEDULE:-0 3 * * *}"
    local cron_cmd="cd ${PROJECT_DIR} && ./scripts/backup-db.sh >> ${BACKUP_DIR}/cron.log 2>&1"
    local cron_logrotate="0 5 * * 0 find ${BACKUP_DIR} -name 'cron.log' -size +10M -exec mv {} ${BACKUP_DIR}/cron.log.old \\;"

    # Ajouter au crontab de l'utilisateur courant
    (
        crontab -l 2>/dev/null | grep -v 'backup-db.sh' || true
        echo "# ─── FasoMarket — Backup quotidien PostgreSQL ─────────────────────"
        echo "${cron_schedule} ${cron_cmd}"
        echo "${cron_logrotate}"
    ) | crontab -

    ok "Cron installé : ${cron_schedule}"
    echo ""
    echo "   📅 Horaire  : ${cron_schedule} (tous les jours à 3h du matin)"
    echo "   📁 Backup   : ${BACKUP_DIR}"
    echo "   🔄 Rétention : ${RETENTION_COUNT} jours"
    echo "   📋 Logs     : ${BACKUP_DIR}/cron.log"
    echo ""
    echo "   Vérifier avec : crontab -l"
    echo "   Tester avec   : ./scripts/backup-db.sh"
    echo ""
    info "Voulez-vous effectuer un backup de test maintenant ?"
    read -rp "Effectuer un test ? (o/N) " do_test
    if [[ "$do_test" =~ ^[oOyY]$ ]]; then
        perform_backup
    fi
}

# ─── Pre-deploy backup (appelé par deploy.sh) ───────────────────────────────

pre_deploy_backup() {
    step "Sauvegarde pré-déploiement"

    warn "⏸️  Un backup automatique est effectué avant le déploiement."

    # Backup rapide avec rotation forcée à 7 jours minimum
    local old_retention="$RETENTION_COUNT"
    RETENTION_COUNT=7

    if perform_backup; then
        ok "Backup pré-déploiement terminé"
    else
        warn "Le backup pré-déploiement a échoué. Déploiement annulé."
        exit 1
    fi

    RETENTION_COUNT="$old_retention"
}

# ─── Aide ─────────────────────────────────────────────────────────────────────

show_help() {
    cat <<EOF
╔════════════════════════════════════════════════════════════════════╗
║        FasoMarket — Sauvegarde automatisée PostgreSQL                ║
╚════════════════════════════════════════════════════════════════════╝

Usage:
  $(basename "$0") [command]

Commandes:
  (aucune)         Effectuer une sauvegarde immédiate
  --list, -l       Lister les sauvegardes disponibles
  --restore <file> Restaurer une sauvegarde (ou "latest")
  --install-cron   Installer le cron de sauvegarde quotidienne
  --status         Afficher l'état du système de sauvegarde
  --pre-deploy     Backup automatique avant déploiement
  --help           Afficher cette aide

Variables d'environnement (ou dans .env racine):
  BACKUP_DIR       Répertoire de destination (défaut: ./backups/)
  DB_CONTAINER     Nom du conteneur PostgreSQL (défaut: fasomarket-db)
  DB_NAME          Nom de la base (défaut: fasomarket)
  DB_USER          Utilisateur PostgreSQL (défaut: fasomarket)
  RETENTION_COUNT  Nombre de backups à garder (défaut: 14)
  SLACK_WEBHOOK_URL  Webhook Slack pour notifications (optionnel)
  S3_BUCKET        URI du bucket S3 pour upload (optionnel)
  BACKUP_CRON_SCHEDULE  Expression cron (défaut: 0 3 * * *)

Exemples:
  # Backup immédiat
  ./scripts/backup-db.sh

  # Lister les backups
  ./scripts/backup-db.sh --list

  # Restaurer le dernier backup (⚠️ écrase les données)
  ./scripts/backup-db.sh --restore latest

  # Restaurer un fichier spécifique
  ./scripts/backup-db.sh --restore ./backups/fasomarket_2026-01-15_030002.sql.gz

  # Installer le cron (tous les jours à 3h du matin)
  ./scripts/backup-db.sh --install-cron

  # Voir le statut
  ./scripts/backup-db.sh --status

  # Backup pré-déploiement (utilisé par deploy.sh)
  ./scripts/backup-db.sh --pre-deploy
EOF
    exit 0
}

# ═══════════════════════════════════════════════════════════════════════════════
# ─── Main ─────────────────────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════════════

# Charger la config depuis .env
load_env

echo ""
echo -e "${BLUE}┌──────────────────────────────────────────────────────────┐${NC}"
echo -e "${BLUE}│  🗄️  FasoMarket — Sauvegarde PostgreSQL                       │${NC}"
echo -e "${BLUE}└──────────────────────────────────────────────────────────┘${NC}"
echo ""

case "${1:-backup}" in
    --list|-l)
        list_backups
        ;;
    --restore|-r)
        if [ $# -lt 2 ]; then
            error "Argument manquant : fichier ou 'latest'"
            echo "   Usage: $0 --restore <fichier|latest>"
            exit 1
        fi
        check_prerequisites
        restore_backup "$2"
        ;;
    --install-cron)
        install_cron
        ;;
    --status)
        show_status
        ;;
    --pre-deploy)
        load_env
        check_prerequisites
        pre_deploy_backup
        ;;
    --help|-h)
        show_help
        ;;
    backup)
        check_prerequisites
        perform_backup
        ;;
    *)
        error "Commande inconnue : $1"
        echo "   Utilisez --help pour voir les commandes disponibles."
        exit 1
        ;;
esac

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Terminé${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
