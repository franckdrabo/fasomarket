# 📦 Spécifications des assets — Bazario

Guide complet des assets graphiques requis pour le lancement sur les stores.

---

## 🍎 Apple App Store

### Icône

| Taille | Usage | Format |
|--------|-------|--------|
| **1024 × 1024** | App Store (unique requise) | PNG, RGB, **sans alpha** |

> ⚠️ L'icône App Store ne doit **PAS** avoir de transparence. Le fond doit être opaque.

### Screenshots

| Appareil | Taille | Ratio | Obligatoire |
|----------|--------|-------|-------------|
| iPhone 6.9" (16 Pro Max) | 1320 × 2868 | 9.33:19.92 | ✅ Oui |
| iPhone 6.7" (15 Pro Max, 14 Plus) | 1290 × 2796 | 9.33:19.96 | ✅ Oui (min) |
| iPhone 6.5" (11 Pro Max, XS Max) | 1242 × 2688 | 9.33:19.96 | ✅ Oui (min) |
| iPhone 5.5" (8 Plus, 7 Plus) | 1242 × 2208 | 9.33:16.67 | Recommandé |
| iPad Pro 12.9" (6th gen) | 2048 × 2732 | 9.33:12.5 | Optionnel |

**Règles :**
- Minimum 3 screenshots, maximum 10 par appareil
- Format PNG ou JPEG
- Pas de screenshots du mode paysage (l'App est portrait uniquement)
- Les screenshots doivent montrer l'app en conditions réelles

### Métadonnées

| Champ | Limite | Exemple |
|-------|--------|---------|
| Nom | 30 caractères | Bazario - Marketplace |
| Sous-titre | 30 caractères | Achetez et vendez facilement |
| Description | 4000 caractères | _(voir notes de version)_ |
| Keywords | 100 caractères | marketplace,vente,achat,mobile money,orange money,wave |
| Catégorie principale | — | Shopping |
| Catégorie secondaire | — | Lifestyle |
| URL de support | URL | https://bazario.com/support |
| URL de confidentialité | URL | https://bazario.com/privacy |

---

## 🤖 Google Play Store

### Icône

| Taille | Usage |
|--------|-------|
| **512 × 512** | Play Store (requise) |
| 192 × 192 | Android xxxhdpi |
| 144 × 192 | Android xxhdpi |
| 96 × 96 | Android xhdpi |
| 72 × 72 | Android hdpi |
| 48 × 48 | Android mdpi |
| 36 × 36 | Android ldpi |

> 💡 L'icône Play Store (512×512) est utilisée comme source pour générer toutes les autres tailles automatiquement.

### Feature Graphic

| Taille | Usage |
|--------|-------|
| **1024 × 500** | Bannière en haut de la fiche Play Store |

### Screenshots

| Appareil | Taille min | Taille max | Format |
|----------|-----------|-----------|--------|
| Phone | 320 × 320 | 3840 × 3840 | PNG/JPEG |
| Recommended | **1080 × 1920** | — | — |
| Tablet 7" | 320 × 320 | 3840 × 3840 | PNG/JPEG |
| Chromebook | 320 × 320 | 3840 × 3840 | PNG/JPEG |

**Règles :**
- Minimum 2 screenshots, maximum 8 par type d'appareil
- Ratio minimum : 16:9, maximum : 2:1
- Chaque screenshot doit faire au moins 320px dans chaque dimension

### Métadonnées

| Champ | Limite | Exemple |
|-------|--------|---------|
| Titre | 30 caractères | Bazario - Marketplace |
| Description courte | 80 caractères | Achetez et vendez en toute confiance avec Mobile Money |
| Description complète | 4000 caractères | _(voir notes de version)_ |
| Catégorie | — | Shopping |
| Politique de confidentialité | URL obligatoire | https://bazario.com/privacy |

---

## 🎨 Guide de création des screenshots

### Screenshots recommandés pour Bazario (ordre d'affichage)

1. **🏠 Accueil** — Page principale avec les annonces en grid
2. **🔍 Détail annonce** — Photo, prix FCFA, description, vendeur avec note
3. **💬 Messagerie** — Conversation entre acheteur et vendeur avec offre de prix
4. **📝 Créer une annonce** — Formulaire de publication (titre, photos, catégorie)
5. **👤 Profil vendeur** — Badge vendeur activé, note, nombre de ventes
6. **💳 Activation vendeur** — Sélection opérateur (Orange/Moov/Wave)

### Outils recommandés

| Outil | Usage | Prix |
|-------|-------|------|
| **Figma** | Design des screenshots avec mockups de téléphone | Gratuit |
| **[Screenshot Framer](https://screenshotframer.com)** | Templates de screenshots Apple/Google | Gratuit |
| **[Previewed](https://previewed.app)** | Mockups 3D de téléphone | Freemium |
| **[Smartmockups](https://smartmockups.com)** | Mockups photoréalistes | Freemium |
| **Expo CLI** | `npx expo export` pour capturer les écrans | Gratuit |

### Taille des screenshots (recommandée)

Pour une qualité optimale, créez les screenshots à **2x** de la taille d'affichage :

| Device | Taille screenshot |
|--------|------------------|
| iPhone 6.9" | 2640 × 5736 |
| iPhone 6.7" | 2580 × 5592 |
| iPhone 6.5" | 2484 × 5376 |
| Google Play Phone | 2160 × 3840 |

---

## 📁 Structure des fichiers

```
mobile/assets/
├── icon.png                    ← Icône master 1024×1024
├── adaptive-icon.png           ← Android adaptive icon foreground
├── splash.png                  ← Splash screen iOS (1284×2778)
├── notification-icon.png       ← Icône de notification (96×96)
└── icons/                      ← Généré par scripts/generate-icons.sh
    ├── bazario-icon-appstore-1024x1024.png
    ├── bazario-icon-play-store-512x512.png
    ├── bazario-icon-xxxhdpi-192x192.png
    ├── bazario-adaptive-fg-432x432.png
    ├── bazario-adaptive-bg-432x432.png
    └── ...

docs/
├── generate-assets.html        ← Outil HTML de génération
├── store-assets-specs.md       ← Ce document
├── privacy-policy.html         ← Politique de confidentialité (FR)
├── privacy-policy-en.html      ← Privacy Policy (EN)
├── terms-of-service.html       ← Conditions d'utilisation (FR)
└── terms-of-service-en.html    ← Terms of Service (EN)
```

---

## 🚀 Génération rapide

```bash
# 1. Générer toutes les tailles d'icônes
./scripts/generate-icons.sh mobile/assets/icon.png

# 2. Ouvrir l'outil HTML pour le feature graphic
open docs/generate-assets.html
```

---

## ✅ Checklist finale avant soumission

### Google Play Store
- [ ] Icône 512×512 PNG
- [ ] Feature graphic 1024×500
- [ ] 2-8 screenshots phone (1080×1920)
- [ ] Titre + description courte
- [ ] Description complète
- [ ] URL politique de confidentialité
- [ ] Catégorie: Shopping
- [ ] Compte développeur créé + frais de注册 payés ($25)

### Apple App Store
- [ ] Icône 1024×1024 (sans alpha)
- [ ] Screenshots iPhone 6.9" + 6.7" + 6.5"
- [ ] Titre + sous-titre
- [ ] Description + keywords
- [ ] URL politique de confidentialité
- [ ] URL support
- [ ] Catégorie: Shopping
- [ ] Compte développeur Apple ($99/an)
