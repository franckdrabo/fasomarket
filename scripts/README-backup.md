# 🗄️ Sauvegarde PostgreSQL — Bazario

Script de sauvegarde automatisée pour la base de données PostgreSQL avec rotation, notifications Slack, et upload S3 optionnel.

---

## 📋 Prérequis

- **Docker** — le script se connecte au conteneur PostgreSQL via `docker exec`
- **Conteneur PostgreSQL** en cours d'exécution (`bazario-db` par défaut)
- **Espace disque** — prévoir au moins 2× la taille de la base pour les backups

## 🚀 Utilisation rapide

### 1. Backup immédiat

```bash
./scripts/backup-db.sh
```

Les sauvegardes sont créées dans `./backups/` avec le format :
```
bazario_2026-01-15_030002.sql.gz
```

### 2. Backup automatique quotidien

```bash
./scripts/backup-db.sh --install-cron
```

Installe un cron qui sauvegarde la base **tous les jours à 3h du matin**.

### 3. Voir l'état

```bash
./scripts/backup-db.sh --status
```

### 4. Lister les sauvegardes

```bash
./scripts/backup-db.sh --list
```

### 5. Restaurer

```bash
# Restaurer la dernière sauvegarde
./scripts/backup-db.sh --restore latest

# Restaurer un fichier spécifique
./scripts/backup-db.sh --restore ./backups/bazario_2026-01-15_030002.sql.gz
```

> ⚠️ La restauration **écrase toutes les données** existantes dans la base.

---

## ⚙️ Configuration

### Via `.env` (recommandé)

Ajoutez ces variables dans le fichier `.env` à la racine du projet :

```bash
# Répertoire des backups (défaut: ./backups/)
BACKUP_DIR=/home/bazario/backups

# Rétention : nombre de backups à conserver (défaut: 14)
RETENTION_COUNT=30

# Webhook Slack pour notifications (optionnel)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ

# Bucket S3 pour upload distant (optionnel)
S3_BUCKET=s3://bazario-backups-prod

# Expression cron pour le backup automatique (défaut: tous les jours à 3h)
BACKUP_CRON_SCHEDULE="0 3 * * *"
```

### Via variables d'environnement

```bash
BACKUP_DIR=/mnt/backups RETENTION_COUNT=7 ./scripts/backup-db.sh
```

---

## 🗑️ Rotation automatique

Le script conserve par défaut les **14 dernières sauvegardes** et supprime automatiquement les plus anciennes.

```
backups/
├── bazario_2026-01-15_030002.sql.gz
├── bazario_2026-01-14_030001.sql.gz
├── bazario_2026-01-13_030002.sql.gz
├── bazario_2026-01-12_030003.sql.gz
├── cron.log        ← Logs du cron
└── backup-history.log  ← Historique des opérations
```

---

## 📤 Upload S3 (optionnel)

Le script peut uploader les sauvegardes vers un bucket S3 après chaque backup.

### Avec AWS CLI

```bash
# Installer
sudo apt-get install awscli
aws configure

# Configurer dans .env
S3_BUCKET=s3://bazario-backups-prod

# Tester
./scripts/backup-db.sh
```

### Avec rclone

```bash
# Installer
sudo -v ; curl https://rclone.org/install.sh | sudo bash
rclone config

# Configurer dans .env
S3_BUCKET=bazario-s3:backups

# Tester
./scripts/backup-db.sh
```

Les fichiers sont uploadés avec le stockage `STANDARD_IA` (coût réduit pour les sauvegardes).

---

## 🔔 Notifications Slack (optionnel)

1. Créez un webhook Slack : https://api.slack.com/messaging/webhooks
2. Ajoutez-le dans `.env` :
   ```
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00/B00/xxxxx
   ```

⇒ Vous recevrez une notification ✅ ou ❌ après chaque backup automatique.

---

## 🚀 Intégration dans le déploiement

Le script `deploy.sh` inclut déjà un backup pré-déploiement automatique :

```bash
# backup-db.sh est appelé automatiquement avant chaque déploiement
./scripts/backup-db.sh --pre-deploy
```

Vous pouvez aussi l'appeler manuellement :

```bash
./scripts/deploy.sh  # Backup automatique avant mise à jour
```

---

## 📊 Surveillance

### Vérifier la santé

```bash
./scripts/backup-db.sh --status
```

Exemple de sortie :
```
━━━ État du système de backup ━━━
✅ Répertoire : /home/bazario/backups (2.3G)
✅ Conteneur  : bazario-db (en cours d'exécution)
✅ Dernier backup : bazario_2026-01-15_030002.sql.gz (158M, 2026-01-15 03:00:02)
✅ Rétention : 14 sauvegardes
✅ S3        : s3://bazario-backups-prod
✅ Slack     : configuré
✅ Cron      : installé
```

### Consulter l'historique

```bash
cat backups/backup-history.log
```

---

## 🛟 Procédure de restauration complète

```bash
# 1. Lister les backups disponibles
./scripts/backup-db.sh --list

# 2. Restaurer
./scripts/backup-db.sh --restore latest

# 3. Rejouer les migrations Prisma (si applicable)
docker compose run --rm backend npx prisma migrate deploy

# 4. Vérifier l'intégrité
docker compose run --rm backend npx prisma db seed
```

---

## 🔒 Sécurité

- Les fichiers de backup sont en `.gitignore` (via `backups/`)
- Les identifiants de connexion PostgreSQL sont lus depuis `.env` (jamais commité)
- L'upload S3 utilise les credentials AWS configurés séparément
- Les notifications Slack utilisent un webhook dédié

---

## 💡 Bonnes pratiques

1. ✅ **Backup automatisé** — Installer le cron dès la mise en production
2. ✅ **Rétention adaptée** — 14 jours minimum (30 jours recommandé)
3. ✅ **Upload distant** — S3 ou autre pour se prémunir d'une perte du serveur
4. ✅ **Test de restauration** — Tester régulièrement la restauration sur un serveur de staging
5. ✅ **Surveillance** — Vérifier les logs et les notifications Slack
6. ✅ **Rotation** — Ne pas conserver les backups trop longtemps (coût de stockage)
