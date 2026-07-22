# Tests de Performance — Bazario Backend

Tests de charge pour les endpoints critiques : **recherche d'articles** (API REST) et **chat en temps réel** (WebSocket Socket.IO).

## Prérequis

- **Docker** (recommandé) — utilise l'image `grafana/k6`
- Ou **k6 CLI** installé localement : https://k6.io/docs/getting-started/installation/

## Installation rapide de k6

```bash
# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# macOS
brew install k6

# Docker (toujours disponible)
docker pull grafana/k6
```

## Structure des tests

```
load-tests/
├── articles-search.test.js   # Test de charge API recherche d'articles
├── chat.test.js               # Test de charge WebSocket chat temps réel
├── docker-compose.yml         # Exécution via Docker Compose
├── reports/                   # Rapports générés (JSON)
└── README.md                  # Ce fichier
```

## Scénarios de test

### Recherche d'articles (`articles-search.test.js`)

| Scénario | Description | Charge |
|---|---|---|
| `steady_browsing` | Navigation normale | ~50 req/s pendant 2 min |
| `spike_search` | Pic de trafic (ex: nouvelle annonce populaire) | Jusqu'à 200 req/s |
| `heavy_filters` | Utilisateurs avec filtres complexes | 20 utilisateurs, 100 itérations |

**Parcours simulés :**
- Navigation par catégorie (Électronique, Maison, Mode, etc.)
- Recherche textuelle (iPhone, canapé, voiture, etc.)
- Filtrage par prix (bas, moyen, élevé)
- Recherche par localisation (Abidjan, Dakar)
- Filtres combinés (catégorie + prix + ville + texte)

### Chat temps réel (`chat.test.js`)

| Scénario | Description | Charge |
|---|---|---|
| `normal_chat` | Conversations normales | 30 utilisateurs simultanés, 3 min |
| `heavy_chat` | Pic de messages (ex: négociation groupée) | Jusqu'à 200 utilisateurs simultanés |
| `connection_storm` | Nouveaux utilisateurs se connectant en masse | Jusqu'à 100 connexions/s |

**Comportement simulé :**
- Connexion WebSocket via Socket.IO
- Authentification par token
- Rejoindre une salle de conversation
- Envoi de messages à intervalle humain (1-3s)
- Réception des messages en temps réel

## Exécution

### 1. Démarrer le backend

```bash
# Depuis la racine du projet
cd backend && npm run start:dev
```

### 2. Lancer les tests

#### Avec Docker Compose

```bash
# Test rapide (smoke test : 1 utilisateur, 10 requêtes)
docker compose --profile smoke up

# Test de recherche uniquement
docker compose --profile load-test up k6-articles-search

# Test de chat uniquement
docker compose --profile load-test up k6-chat

# Tous les tests (séquentiel)
docker compose --profile load-test-all up k6-all
```

#### Avec k6 en local

```bash
# Test de recherche (durée par défaut dans le script)
k6 run articles-search.test.js

# Test de recherche avec durée personnalisée
k6 run articles-search.test.js --duration 30s

# Test de chat (attention : nécessite un backend fonctionnel)
k6 run chat.test.js

# Test avec sortie détaillée
k6 run articles-search.test.js --verbose --out json=results.json

# Test avec rapport résumé seulement
k6 run articles-search.test.js --summary-trend-stats="avg,min,med,max,p(90),p(95),p(99)"
```

### 3. Personnaliser l'URL de l'API

```bash
# API locale
k6 run articles-search.test.js -e API_URL=http://localhost:3000/api/v1

# API de production
k6 run articles-search.test.js -e API_URL=https://api.bazario.com/api/v1

# WebSocket pour production
k6 run chat.test.js -e WS_URL=wss://api.bazario.com

# Mode smoke test (1 VU, 10 itérations)
k6 run articles-search.test.js -e K6_SMOKE=true -u 1 -i 10 --duration 10s
```

## Interprétation des résultats

### Métriques clés

| Métrique | Seuil | Signification |
|---|---|---|
| `search_duration_ms p(95)` | < 500ms | 95% des recherches répondent en moins de 500ms |
| `search_duration_ms p(99)` | < 1000ms | 99% des recherches répondent en moins de 1s |
| `search_errors` | < 1% | Moins de 1% d'erreurs de recherche |
| `ws_connection_duration p(95)` | < 1000ms | 95% des connexions WebSocket établies en < 1s |
| `ws_message_latency_ms p(95)` | < 300ms | 95% des messages livrés en < 300ms |
| `ws_connection_errors` | < 5% | Moins de 5% d'échecs de connexion |
| `http_req_duration p(95)` | < 2000ms | 95% des requêtes HTTP en < 2s |

### Exemple de sortie

```
     ✓ search_iphone: status 200
     ✓ search_iphone: response time < 2s

     ✓ WebSocket connection established

     checks.........................: 99.17% ✓ 5842   ✗ 49
     data_received..................: 48 MB  2.4 MB/s
     data_sent......................: 12 MB  612 kB/s
     search_duration_ms.............: avg=124.3  min=12  med=98  p(90)=245  p(95)=389  p(99)=812
     ws_connection_duration_ms......: avg=215.7  min=45  med=180  p(90)=420  p(95)=580  p(99)=920
     ws_message_latency_ms..........: avg=85.2   min=12  med=72   p(90)=180  p(95)=250  p(99)=410
     http_req_blocked...............: avg=1.2ms  p(95)=4ms
     http_req_connecting............: avg=0.8ms  p(95)=3ms
     ✗ search_errors................: 0.83%  ✓ 49    ✗ 5842
     ✓ ws_connection_errors.........: 0.00%  ✓ 0     ✗ 1200
```

## Bonnes pratiques

1. **Toujours commencer par un smoke test** pour valider la configuration
2. **Exécuter les tests sur un environnement de staging** avant la production
3. **Surveiller les ressources serveur** (CPU, RAM, connexions DB) pendant les tests
4. **Analyser les p(99)** — si le p(99) est bien plus élevé que la moyenne, chercher les goulots d'étranglement
5. **Tester avec des données réalistes** — le cache PostgreSQL peut fausser les résultats initiaux

## Résolution de problèmes

| Problème | Solution |
|---|---|
| `ECONNREFUSED` | Le backend n'est pas démarré |
| `websocket: close 1006` | Token JWT invalide ou expiré — l'authentification `setup()` a échoué |
| Taux d'erreur > 5% | Vérifier les logs backend avec `docker compose logs backend` |
| Latence élevée | Vérifier l'utilisation CPU/DB, les index manquants |
| Résultats vides | Aucune donnée en base — insérer des articles de test d'abord |
| Chat : 100% d'échecs | Les tokens JWT n'ont pas pu être obtenus. Vérifier que : (1) le backend est en mode développement (OTP prévisible), (2) les routes `/api/v1/auth/send-otp` et `/verify-otp` sont accessibles, (3) fournir des tokens via `JWT_TOKEN` ou `TOKEN_XX` en variable d'env |
| `setup()` timeout | L'obtention des tokens (40 requêtes) peut dépasser 30s. Passer `--setup-timeout 60s` en CLI |

## Préparation des données de test

Avant de lancer les tests de performance, assurez-vous d'avoir des données réalistes en base :

### Articles
```sql
-- Insérer des articles de test via l'API ou direct SQL
INSERT INTO "Article" (id, "vendeurId", titre, description, categorie, etat, prix, statut, ville)
SELECT 
  gen_random_uuid(),
  (SELECT id FROM "User" LIMIT 1),
  'iPhone 15 Pro - Test ' || i,
  'Smartphone Apple en excellent état, toutes les fonctionnalités.' || i,
  'ELECTRONIQUE', 'COMME_NEUF', 500000 + (i * 1000), 'EN_LIGNE',
  CASE WHEN i % 2 = 0 THEN 'Abidjan' ELSE 'Dakar' END
FROM generate_series(1, 1000) i;
```

### Utilisateurs pour le chat
Les tests de chat utilisent les numéros `+22501000001` à `+22501000020` et tentent de s'authentifier via l'API. En mode développement :
1. Le backend accepte l'envoi d'OTP (`sendOtp`) qui crée automatiquement l'utilisateur
2. Le code OTP de développement est `123456` (ou `000000`, `111111`, `999999`)
3. Les utilisateurs doivent avoir des conversations existantes pour pouvoir envoyer des messages

Pour pré-générer des tokens et les passer directement :
```bash
# Obtenir un token
curl -X POST http://localhost:3000/api/v1/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+22501000001"}'

curl -X POST http://localhost:3000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+22501000001", "code": "123456"}'

# Passer le token au test
k6 run chat.test.js -e JWT_TOKEN="<votre_token>"
```
