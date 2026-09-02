# 🔑 Guide de configuration des clés API — FasoMarket

## Vue d'ensemble

| Service | Usage | Coût | Lien d'inscription |
|---------|-------|------|---------------------|
| **CinetPay** | Paiements Mobile Money | 2.8% par transaction | https://www.cinetpay.com |
| **Africastalking** | SMS OTP | ~0.01$ par SMS | https://africastalking.com |
| **Firebase** | Notifications push | Gratuit (jusqu'à 50K/jour) | https://console.firebase.google.com |
| **Cloudinary** | Upload d'images | Gratuit (25K transforms/mois) | https://www.cloudinary.com |

---

## 1️⃣ CinetPay (Paiements Mobile Money)

### Étapes

1. **Créer un compte** → https://www.cinetpay.com/signup
2. **Valider votre compte** (pièce d'identité + RIB)
3. **Créer un projet** dans le Dashboard
4. **Copier les clés** :
   - Dashboard → **Paramètres** → **Général** → `Site ID`
   - Dashboard → **Paramètres** → **Développeur** → `API Key`
5. **Configurer le webhook** :
   - Dashboard → **Paramètres** → **Notifications**
   - URL : `https://api.fasomarket.com/api/v1/payments/webhook/cinetpay`
   - Méthode : POST

### Variables à remplir dans `.env.prod`

```env
CINETPAY_API_KEY=votre_api_key_ici
CINETPAY_SITE_ID=votre_site_id_ici
```

### Tester

```bash
# En dev, sans clé → simulation automatique
# En prod, le paiement redirige vers la page CinetPay
curl -X POST https://api.fasomarket.com/api/v1/auth/activate-seller \
  -H "Authorization: Bearer VOTRE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"telephone": "+2250708091011", "operateur": "ORANGE_MONEY"}'
```

---

## 2️⃣ Africastalking (SMS OTP)

### Étapes

1. **Créer un compte** → https://africastalking.com/signup
2. **Activer le compte** (email de vérification)
3. **Obtenir les clés API** :
   - Dashboard → **API Keys** → copier `Username` et `API Key`
4. **Optionnel — Sender ID** :
   - Dashboard → **SMS** → **Sender IDs** → demander un Sender ID personnalisé (ex: `FASOMARKET`)
   - ⚠️ Le Sender ID alphanumérique nécessite une approbation (24-48h)
5. **Tester en sandbox** :
   - URL sandbox : `https://api.sandbox.africastalking.com/version1/messaging`
   - En prod : `https://api.africastalking.com/version1/messaging`

### Variables à remplir dans `.env.prod`

```env
AT_USERNAME=votre_username
AT_API_KEY=votre_api_key
AT_SENDER_ID=FASOMARKET  # optionnel
AT_API_URL=https://api.africastalking.com/version1/messaging
```

### Tester

```bash
# Envoyer un OTP de test
curl -X POST https://api.fasomarket.com/api/v1/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+2250708091011"}'
```

---

## 3️⃣ Firebase (Notifications push)

### Étapes

1. **Créer un projet** → https://console.firebase.google.com → Nouveau projet
   - Nom : `fasomarket-production`
2. **Activer Cloud Messaging** :
   - Project Settings → Cloud Messaging → activer Firebase Cloud Messaging API (V1)
3. **Ajouter l'app mobile** :
   - Project Settings → Général → Ajouter une app → iOS (+Android)
   - Bundle ID iOS : `com.fasomarket.app`
   - Package Android : `com.fasomarket.app`
4. **Générer les credentials** :
   - Project Settings → **Service accounts** → **Generate new private key**
   - Sauvegarder le fichier JSON en `firebase-credentials.json` à la racine du projet
5. **Configurer Expo** :
   - Le `projectId` est déjà dans `app.json` : `aa3fb2ee-7a71-4ba1-b41a-07ae2f7e433f`
   - Vérifier qu'il correspond à votre projet Firebase

### Variables à remplir dans `.env.prod`

Pas de variables d'env — le fichier `firebase-credentials.json` est monté dans le conteneur Docker.

### Tester

```bash
# Les notifications push sont envoyées automatiquement
# Vérifier dans Firebase Console → Cloud Messaging
```

---

## 4️⃣ Cloudinary (Upload d'images)

### Étapes

1. **Créer un compte gratuit** → https://cloudinary.com/signup
2. **Obtenir les credentials** :
   - Dashboard → **Settings** → **API Keys**
   - Copier : `Cloud name`, `API Key`, `API Secret`
3. **Configurer le folder** :
   - Par défaut, les images seront dans `fasomarket/`
   - Optionnel : activer les transformations automatiques (redimensionnement)

### Variables à remplir dans `.env.prod`

```env
CLOUDINARY_CLOUD_NAME=votre_cloud_name
CLOUDINARY_API_KEY=votre_api_key
CLOUDINARY_API_SECRET=votre_api_secret
```

### Tester

```bash
# Upload une image de test
curl -X POST https://api.fasomarket.com/api/v1/upload/image \
  -H "Authorization: Bearer VOTRE_TOKEN" \
  -F "file=@test-image.jpg"
```

---

## 5️⃣ Supabase ou Scaleway (PostgreSQL + Redis)

### Option A : Supabase (recommandé, gratuit jusqu'à 500MB)

1. **Créer un compte** → https://supabase.com/signup
2. **Créer un projet** → Région : Europe (Paris)
3. **Copier la connection string** :
   - Settings → Database → Connection string → URI
   - Format : `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`

### Option B : Scaleway

1. **Créer un compte** → https://www.scaleway.com
2. **Activer les DBaaS** → PostgreSQL-managed + Redis-managed
3. **Copier les credentials**

### Variables à remplir dans `.env.prod`

```env
DB_USER=postgres
DB_PASSWORD=votre_mot_de_passe_fort
DB_NAME=fasomarket
# DATABASE_URL est construit dans docker-compose.prod.yml
```

---

## ✅ Checklist finale

```bash
# 1. Créer les comptes
#    ☐ CinetPay (paiements)
#    ☐ Africastalking (SMS)
#    ☐ Firebase (notifications)
#    ☐ Cloudinary (images)
#    ☐ Supabase ou Scaleway (BDD)

# 2. Remplir .env.prod
nano .env.prod

# 3. Vérifier que .env.prod est dans .gitignore
git check-ignore .env.prod  # devrait afficher ".env.prod"

# 4. Lancer le serveur
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# 5. Appliquer les migrations
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# 6. Tester chaque service
curl https://api.fasomarket.com/api/v1/health
```
