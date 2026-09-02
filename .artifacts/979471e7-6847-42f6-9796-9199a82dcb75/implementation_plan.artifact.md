# Plan d'Amélioration UX & Performance (Bazario)

Ce plan vise à rendre l'application plus compétitive sur le marché P2P, en facilitant le contact vendeur et en optimisant les performances pour les connexions instables.

## User Review Required

> [!IMPORTANT]
> L'intégration WhatsApp nécessite que le numéro du vendeur soit exposé dans l'API. Je vais mettre à jour les interfaces TypeScript en conséquence.
> Le tri par distance demande l'autorisation de localisation dès l'écran d'accueil pour être efficace.

## Proposed Changes

### 1. Intégration WhatsApp (Trust & Conversion)
Faciliter la vente en permettant de basculer instantanément sur WhatsApp, usage très courant en Afrique de l'Ouest.

#### [MODIFY] [ArticleCard.tsx](file:///home/cartman/Bureau/bzr/mobile/src/components/ArticleCard.tsx)
- Ajout du champ `telephone` dans l'interface `ArticleCardData`.

#### [MODIFY] [ArticleDetailScreen.tsx](file:///home/cartman/Bureau/bzr/mobile/src/screens/ArticleDetailScreen.tsx)
- Ajout d'un bouton WhatsApp secondaire à côté du bouton de messagerie interne.
- Implémentation de la fonction `handleWhatsApp` utilisant `Linking.openURL`.

### 2. Tri par Proximité (Pertinence)
Utiliser le service de localisation pour afficher en priorité les articles proches de l'utilisateur.

#### [MODIFY] [HomeScreen.tsx](file:///home/cartman/Bureau/bzr/mobile/src/screens/HomeScreen.tsx)
- Intégration du `locationService.ts` pour récupérer la position au montage.
- Ajout d'une option de tri "À proximité" qui utilise la formule de Haversine pour réordonner la liste.

### 3. Performance Image (Vitesse Perçue)
Transition vers `expo-image` pour un rendu plus fluide, une mise en cache agressive et le support des blurhash.

#### [MODIFY] [ArticleCard.tsx](file:///home/cartman/Bureau/bzr/mobile/src/components/ArticleCard.tsx) & [ArticleDetailScreen.tsx](file:///home/cartman/Bureau/bzr/mobile/src/screens/ArticleDetailScreen.tsx)
- Remplacement des `Image` standards par `Image` de `expo-image`.
- Ajout d'un effet de fondu et de placeholders.

### 4. Persistance du Cache (Offline-first)
Assurer que l'application reste utilisable (lecture des derniers articles vus) même sans réseau.

#### [MODIFY] [App.tsx](file:///home/cartman/Bureau/bzr/mobile/App.tsx)
- Configuration de `PersistQueryClientProvider` avec `AsyncStorage`.

## Verification Plan

### Automated Tests
- Vérification du calcul de distance dans `locationService.ts`.
- Mock des appels `Linking` pour valider les URLs WhatsApp générées.

### Manual Verification
- Tester le clic WhatsApp : vérification que l'app s'ouvre avec le bon numéro.
- Simuler une position GPS différente pour voir le tri des articles se mettre à jour.
- Mode avion : vérifier que les articles précédemment chargés restent visibles (cache persistant).
