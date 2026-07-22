import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import ArticleCard, { ArticleCardData } from '../components/ArticleCard';
import CategoryFilter from '../components/CategoryFilter';
import SearchBar from '../components/SearchBar';
import { FadeInView, StaggeredList } from '../components/animations';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

// Données de démo pour le développement (en attendant le backend)
const MOCK_ARTICLES: ArticleCardData[] = [
  {
    id: '1',
    titre: 'Robe africaine wax - Taille M - Couleurs vives, motif traditionnel',
    prix: 15000,
    photos: [],
    ville: 'Abidjan',
    categorie: 'VETEMENTS',
    etat: 'COMME_NEUF',
    dateCreation: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    vendeur: { id: 'v1', nom: 'Alice K.', noteMoyenne: 4.8 },
  },
  {
    id: '2',
    titre: 'iPhone 13 Pro 256Go - Gris Sidéral - Parfait état',
    prix: 450000,
    photos: [],
    ville: 'Dakar',
    categorie: 'ELECTRONIQUE',
    etat: 'BON_ETAT',
    dateCreation: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    vendeur: { id: 'v2', nom: 'Bob T.', noteMoyenne: 4.5 },
  },
  {
    id: '3',
    titre: 'Canapé 3 places en tissu beige - Confortable',
    prix: 85000,
    photos: [],
    ville: 'Abidjan',
    categorie: 'MAISON',
    etat: 'BON_ETAT',
    dateCreation: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    vendeur: { id: 'v3', nom: 'Alice K.', noteMoyenne: 4.8 },
  },
  {
    id: '4',
    titre: 'Sac à main en cuir véritable - Marron',
    prix: 25000,
    photos: [],
    ville: 'Ouagadougou',
    categorie: 'VETEMENTS',
    etat: 'NEUF',
    dateCreation: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    vendeur: { id: 'v4', nom: 'Mariam D.', noteMoyenne: 4.2 },
  },
  {
    id: '5',
    titre: 'Ventilateur sur pied - Très bon état',
    prix: 12000,
    photos: [],
    ville: 'Abidjan',
    categorie: 'MAISON',
    etat: 'BON_ETAT',
    dateCreation: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    vendeur: { id: 'v5', nom: 'Jean B.' },
  },
  {
    id: '6',
    titre: 'Smartwatch Samsung Galaxy Watch 4',
    prix: 65000,
    photos: [],
    ville: 'Dakar',
    categorie: 'ELECTRONIQUE',
    etat: 'COMME_NEUF',
    dateCreation: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    vendeur: { id: 'v6', nom: 'Fatou S.', noteMoyenne: 4.9 },
  },
];

interface Props {
  onArticlePress?: (article: ArticleCardData) => void;
  onNotificationPress?: () => void;
}

export default function HomeScreen({ onArticlePress, onNotificationPress }: Props) {
  const [articles, setArticles] = useState<ArticleCardData[]>(MOCK_ARTICLES);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TOUS');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();

  async function fetchArticles() {
    setLoading(true);
    try {
      // En prod: appeler l'API réelle
      // const data = await api.articles.list({ q: searchQuery, categorie: selectedCategory });
      // setArticles(data);

      // Filtrage local pour la démo
      let filtered = [...MOCK_ARTICLES];
      if (selectedCategory !== 'TOUS') {
        filtered = filtered.filter((a) => a.categorie === selectedCategory);
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (a) =>
            a.titre.toLowerCase().includes(q) ||
            a.ville?.toLowerCase().includes(q),
        );
      }
      setArticles(filtered);
    } catch (error) {
      console.error('Erreur chargement articles:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchArticles();
  }, [selectedCategory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchArticles();
    setRefreshing(false);
  }, [selectedCategory, searchQuery]);

  function handleSearch() {
    fetchArticles();
  }

  function handleArticlePress(article: ArticleCardData) {
    onArticlePress?.(article);
  }

  function renderHeader() {
    return (
      <View>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              Bonjour, {user?.nom || 'Invité'}
            </Text>
            <Text style={styles.subtitle}>
              {articles.length} articles disponibles
            </Text>
          </View>
          <TouchableOpacity style={styles.notificationBadge} onPress={onNotificationPress}>
            <Ionicons name="notifications-outline" size={24} color={colors.text} />
            <View style={styles.badgeDot} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmit={handleSearch}
        />

        {/* Categories */}
        <CategoryFilter
          selected={selectedCategory}
          onSelect={setSelectedCategory}
        />
      </View>
    );
  }

  function renderEmpty() {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="search-outline" size={64} color={colors.disabled} />
        <Text style={styles.emptyTitle}>Aucun article trouvé</Text>
        <Text style={styles.emptySubtitle}>
          Essayez de modifier vos filtres ou revenez plus tard
        </Text>
      </View>
    );
  }

  function renderItem({ item }: { item: ArticleCardData }) {
    return (
      <ArticleCard
        article={item}
        onPress={handleArticlePress}
        onFavorite={async (article) => {
          try {
            await api.favoris.toggle(article.id);
          } catch (e) {
            console.error('Erreur favori:', e);
          }
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={articles}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        onEndReached={() => {
          /* Pagination */
        }}
        onEndReachedThreshold={0.5}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    paddingBottom: spacing.xxl,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  greeting: {
    ...typography.h2,
    color: colors.text,
  },
  subtitle: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  notificationBadge: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  badgeDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
});
