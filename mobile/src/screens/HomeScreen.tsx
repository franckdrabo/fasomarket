import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInRight, BounceIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import ArticleCard, { ArticleCardData } from '../components/ArticleCard';
import CategoryFilter from '../components/CategoryFilter';
import SearchBar from '../components/SearchBar';
import SectionHeader from '../components/SectionHeader';
import SkeletonCard, { SkeletonGrid, SkeletonCardCompact } from '../components/SkeletonCard';
import { FadeInView } from '../components/animations';
import { api } from '../services/api';
import { getCurrentLocation, calculateDistance, LocationCoords } from '../services/locationService';
import { useAuthStore } from '../stores/authStore';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

export interface ArticleWithDistance extends ArticleCardData {
  distance?: number;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const FEATURED_CARD_WIDTH = SCREEN_WIDTH * 0.7;

// ─── Données mock enrichies ─────────────────────────────────────────────────

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
  {
    id: '7',
    titre: 'Nike Air Max 90 - Taille 42 - Neuf en boîte',
    prix: 35000,
    photos: [],
    ville: 'Lomé',
    categorie: 'CHAUSSURES',
    etat: 'NEUF',
    dateCreation: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    vendeur: { id: 'v7', nom: 'Kofi A.', noteMoyenne: 4.7 },
  },
  {
    id: '8',
    titre: 'PS5 + 2 manettes + 3 jeux - Complet',
    prix: 280000,
    photos: [],
    ville: 'Abidjan',
    categorie: 'ELECTRONIQUE',
    etat: 'COMME_NEUF',
    dateCreation: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    vendeur: { id: 'v8', nom: 'Yao S.', noteMoyenne: 4.6 },
  },
];

// Catégories enrichies avec emojis et couleurs
const ENRICHED_CATEGORIES = [
  { key: 'TOUS', emoji: '✨', label: 'Tout', bg: colors.surface, activeBg: colors.primary },
  { key: 'ELECTRONIQUE', emoji: '📱', label: 'Électro', bg: '#EBF5FB', activeBg: '#2196F3' },
  { key: 'VETEMENTS', emoji: '👗', label: 'Mode', bg: '#FDEDEC', activeBg: '#E91E63' },
  { key: 'CHAUSSURES', emoji: '👟', label: 'Chaussures', bg: '#F4ECF7', activeBg: '#9C27B0' },
  { key: 'MAISON', emoji: '🏠', label: 'Maison', bg: '#EAFAF1', activeBg: '#27AE60' },
  { key: 'AUTRES', emoji: '📦', label: 'Autres', bg: '#FEF9E7', activeBg: '#F39C12' },
];

interface Props {
  onArticlePress?: (article: ArticleCardData) => void;
  onNotificationPress?: () => void;
}

export default function HomeScreen({ onArticlePress, onNotificationPress }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TOUS');
  const [sortBy, setSortBy] = useState<'recent' | 'distance'>('recent');
  const [userLocation, setUserLocation] = useState<LocationCoords | null>(null);
  const { user } = useAuthStore();

  const {
    data: articles = [],
    isLoading: loading,
    refetch,
    isRefetching: refreshing,
  } = useQuery({
    queryKey: ['articles', selectedCategory, searchQuery, sortBy, userLocation],
    queryFn: async () => {
      let loaded: ArticleCardData[];
      try {
        const params: Record<string, any> = {};
        if (selectedCategory !== 'TOUS') params.categorie = selectedCategory;
        if (searchQuery.trim()) params.q = searchQuery.trim();
        const data = await api.articles.list(params) as any;
        loaded = Array.isArray(data) ? data : data.data || [];
      } catch (apiError) {
        let fallback = [...MOCK_ARTICLES];
        if (selectedCategory !== 'TOUS') {
          fallback = fallback.filter((a) => a.categorie === selectedCategory);
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          fallback = fallback.filter(
            (a) =>
              a.titre.toLowerCase().includes(q) ||
              a.ville?.toLowerCase().includes(q),
          );
        }
        loaded = fallback;
      }

      // Tri par distance
      if (sortBy === 'distance' && userLocation) {
        loaded = loaded.map(art => {
          if (art.coords) {
            const dist = calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              art.coords.latitude,
              art.coords.longitude
            );
            return { ...art, distance: dist };
          }
          return art;
        }).sort((a: any, b: any) => {
          if (a.distance != null && b.distance != null) return a.distance - b.distance;
          if (a.distance != null) return -1;
          if (b.distance != null) return 1;
          return 0;
        });
      }
      return loaded;
    },
  });

  const showSkeleton = loading && !articles.length;

  useEffect(() => {
    async function fetchLocation() {
      const loc = await getCurrentLocation();
      if (loc) {
        setUserLocation(loc);
        setSortBy('distance');
      }
    }
    fetchLocation();
  }, []);

  const onRefresh = useCallback(async () => {
    refetch();
  }, [refetch]);

  function handleSearch() {
    refetch();
  }

  function handleArticlePress(article: ArticleCardData) {
    onArticlePress?.(article);
  }

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 17) return 'Bon après-midi';
    return 'Bonsoir';
  }

  // Sépare les articles par catégorie pour les sections
  const recentArticles = articles.slice(0, 4);
  const featuredArticles = articles.filter((a) => a.etat === 'NEUF' || a.etat === 'COMME_NEUF').slice(0, 6);
  const trendingArticles = articles.filter((a) => a.prix > 20000);

  // ─── Enriched category chips ──────────────────────────────────────────────

  function renderEnrichedCategories() {
    return (
      <FadeInView delay={200} duration={400}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.enrichedCatScroll}
        >
          {ENRICHED_CATEGORIES.map((cat, index) => {
            const isActive = selectedCategory === cat.key;
            return (
              <FadeInView key={cat.key} delay={250 + index * 50} duration={300}>
                <TouchableOpacity
                  onPress={() => setSelectedCategory(cat.key)}
                  activeOpacity={0.7}
                  style={[
                    styles.enrichedChip,
                    {
                      backgroundColor: isActive ? cat.activeBg : cat.bg,
                    },
                    isActive && styles.enrichedChipActive,
                  ]}
                >
                  <Text style={styles.enrichedChipEmoji}>{cat.emoji}</Text>
                  <Text
                    style={[
                      styles.enrichedChipLabel,
                      { color: isActive ? '#FFFFFF' : colors.text },
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              </FadeInView>
            );
          })}
        </ScrollView>
      </FadeInView>
    );
  }

  // ─── Featured horizontal scroll ───────────────────────────────────────────

  function renderFeaturedSection() {
    if (showSkeleton) {
      return (
        <View>
          <SectionHeader emoji="🔥" title="À la une" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredScroll}
          >
            {[1, 2, 3].map((i) => (
              <SkeletonCardCompact key={i} />
            ))}
          </ScrollView>
        </View>
      );
    }

    if (featuredArticles.length === 0) return null;

    return (
      <View>
        <SectionHeader
          emoji="🔥"
          title="À la une"
          subtitle="Articles en excellent état"
          action="Voir tout"
        />
        <FlatList
          horizontal
          data={featuredArticles}
          keyExtractor={(item) => `featured-${item.id}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.featuredScroll}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInRight.delay(index * 100).springify()}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handleArticlePress(item)}
                style={styles.featuredCard}
              >
                <LinearGradient
                  colors={[colors.surfaceVariant, colors.surface]}
                  style={styles.featuredCardInner}
                >
                  <View style={styles.featuredBadge}>
                    <Ionicons name="star" size={12} color={colors.accent} />
                    <Text style={styles.featuredBadgeText}>{item.etat === 'NEUF' ? 'Neuf' : 'Comme neuf'}</Text>
                  </View>
                  <Text style={styles.featuredPrice}>
                    {item.prix.toLocaleString('fr-FR')} FCFA
                  </Text>
                  <Text style={styles.featuredTitle} numberOfLines={2}>
                    {item.titre}
                  </Text>
                  <View style={styles.featuredMeta}>
                    <Ionicons name="location-outline" size={11} color={colors.textSecondary} />
                    <Text style={styles.featuredMetaText}>{item.ville}</Text>
                    <Text style={styles.featuredMetaDot}>·</Text>
                    <Text style={styles.featuredMetaText}>{item.vendeur.nom}</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}
        />
      </View>
    );
  }

  // ─── Section "Catégories populaires" ──────────────────────────────────────

  function renderPopularCategories() {
    const catStats = [
      { key: 'ELECTRONIQUE', emoji: '📱', label: 'Électronique', count: articles.filter((a) => a.categorie === 'ELECTRONIQUE').length, bg: '#EBF5FB', iconColor: '#2196F3' },
      { key: 'VETEMENTS', emoji: '👗', label: 'Vêtements', count: articles.filter((a) => a.categorie === 'VETEMENTS').length, bg: '#FDEDEC', iconColor: '#E91E63' },
      { key: 'MAISON', emoji: '🏠', label: 'Maison', count: articles.filter((a) => a.categorie === 'MAISON').length, bg: '#EAFAF1', iconColor: '#27AE60' },
      { key: 'CHAUSSURES', emoji: '👟', label: 'Chaussures', count: articles.filter((a) => a.categorie === 'CHAUSSURES').length, bg: '#F4ECF7', iconColor: '#9C27B0' },
    ];

    return (
      <View>
        <SectionHeader emoji="📂" title="Catégories" />
        <View style={styles.catGrid}>
          {catStats.map((cat, index) => (
            <Animated.View
              key={cat.key}
              entering={FadeInDown.delay(300 + index * 80).springify()}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setSelectedCategory(cat.key)}
                style={[styles.catCard, { backgroundColor: cat.bg }]}
              >
                <Text style={styles.catEmoji}>{cat.emoji}</Text>
                <Text style={styles.catLabel}>{cat.label}</Text>
                <Text style={[styles.catCount, { color: cat.iconColor }]}>
                  {cat.count} article{cat.count > 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
      </View>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  function renderHeader() {
    return (
      <Animated.View entering={FadeIn.duration(600)}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.greetingSection}>
            <Text style={styles.greetingLabel}>{getGreeting()} 👋</Text>
            <Text style={styles.greetingName}>{user?.nom || 'Invité'}</Text>
            <Text style={styles.subtitle}>
              {articles.length} article{articles.length > 1 ? 's' : ''} disponible{articles.length > 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity style={styles.notificationBadge} onPress={onNotificationPress} activeOpacity={0.7}>
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            <View style={styles.badgeDot} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmit={handleSearch}
        />

        {/* Enriched categories */}
        {renderEnrichedCategories()}

        {/* Sort Toggle */}
        <View style={styles.sortToggleRow}>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'recent' && styles.sortButtonActive]}
            onPress={() => setSortBy('recent')}
          >
            <Text style={[styles.sortButtonText, sortBy === 'recent' && styles.sortButtonTextActive]}>Plus récents</Text>
          </TouchableOpacity>
          {userLocation && (
            <TouchableOpacity
              style={[styles.sortButton, sortBy === 'distance' && styles.sortButtonActive]}
              onPress={() => setSortBy('distance')}
            >
              <Text style={[styles.sortButtonText, sortBy === 'distance' && styles.sortButtonTextActive]}>À proximité</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Featured section */}
        {renderFeaturedSection()}

        {/* Popular categories grid */}
        {renderPopularCategories()}

        {/* Section header for main list */}
        <SectionHeader
          emoji="🆕"
          title="Nouveautés"
          subtitle={`${articles.length} articles récents`}
        />
      </Animated.View>
    );
  }

  function renderLoadingSkeleton() {
    return (
      <View style={styles.skeletonContainer}>
        {/* Fake header */}
        <View style={styles.skeletonHeader}>
          <View>
            <SkeletonBar width={100} height={14} />
            <SkeletonBar width={140} height={24} style={{ marginTop: 6 }} />
          </View>
          <SkeletonBar width={40} height={40} borderRadius={20} />
        </View>

        {/* Fake search */}
        <SkeletonBar width={SCREEN_WIDTH - 32} height={48} borderRadius={12} />

        {/* Fake categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.md }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonBar key={i} width={80} height={36} borderRadius={18} style={{ marginRight: 8 }} />
          ))}
        </ScrollView>

        {/* Fake section */}
        <SectionHeader emoji="🔥" title="À la une" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          {[1, 2, 3].map((i) => (
            <SkeletonCardCompact key={i} />
          ))}
        </ScrollView>

        {/* Fake grid */}
        <SectionHeader emoji="📂" title="Catégories" />
        <SkeletonGrid count={2} />
      </View>
    );
  }

  // Small helper used only in skeleton header
  function SkeletonBar({
    width,
    height,
    borderRadius: br,
    style,
  }: {
    width: number;
    height: number;
    borderRadius?: number;
    style?: any;
  }) {
    return (
      <View
        style={[
          {
            width,
            height,
            borderRadius: br ?? 6,
            backgroundColor: '#E8D5C4',
            opacity: 0.5,
          },
          style,
        ]}
      />
    );
  }

  function renderEmpty() {
    if (loading) return null;
    return (
      <Animated.View entering={FadeIn.duration(400)} style={styles.emptyContainer}>
        <Ionicons name="search-outline" size={64} color="#D4C5B5" />
        <Text style={styles.emptyTitle}>Aucun article trouvé</Text>
        <Text style={styles.emptySubtitle}>
          Essayez de modifier vos filtres ou revenez plus tard
        </Text>
      </Animated.View>
    );
  }

  function renderItem({ item, index }: { item: ArticleCardData; index: number }) {
    return (
      <Animated.View entering={FadeIn.duration(400).delay(index * 80)}>
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
      </Animated.View>
    );
  }

  if (showSkeleton) {
    return (
      <LinearGradient
        colors={['#FDDCB5', '#FFF0E0', '#FFF8F0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.container}
      >
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {renderLoadingSkeleton()}
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#FDDCB5', '#FFF0E0', '#FFF8F0']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      {/* Decorative circles */}
      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />

      <SafeAreaView edges={['top']} style={styles.safeArea}>
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
          onEndReachedThreshold={0.5}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  list: {
    paddingBottom: spacing.xxl,
  },

  // ─── Decorative ─────────────────────────────────────────────────────
  decorCircle1: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#FF6B35',
    opacity: 0.10,
  },
  decorCircle2: {
    position: 'absolute',
    top: 120,
    left: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2ECC71',
    opacity: 0.06,
  },

  // ─── Header ─────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  greetingSection: {
    flex: 1,
  },
  greetingLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.textSecondary,
    marginBottom: -2,
  },
  greetingName: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    ...typography.bodySmall,
    marginTop: 2,
    color: '#9E9488',
  },
  notificationBadge: {
    position: 'relative',
    marginTop: 6,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
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

  // ─── Enriched categories ────────────────────────────────────────────
  enrichedCatScroll: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  enrichedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
    gap: 6,
    ...shadows.sm,
  },
  enrichedChipActive: {
    ...shadows.md,
  },
  enrichedChipEmoji: {
    fontSize: 16,
  },
  enrichedChipLabel: {
    fontSize: 13,
    fontWeight: '600',
  },

  // ─── Sort Toggle ────────────────────────────────────────────────────
  sortToggleRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sortButtonText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  sortButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },

  // ─── Featured section ───────────────────────────────────────────────
  featuredScroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  featuredCard: {
    width: FEATURED_CARD_WIDTH,
    marginRight: spacing.md,
  },
  featuredCardInner: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(241, 196, 15, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  featuredBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D4A017',
  },
  featuredPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 8,
  },
  featuredTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginTop: 4,
  },
  featuredMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  featuredMetaText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  featuredMetaDot: {
    fontSize: 11,
    color: colors.disabled,
  },

  // ─── Category grid ──────────────────────────────────────────────────
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  catCard: {
    width: (SCREEN_WIDTH - spacing.md * 2 - spacing.sm) / 2 - 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  catEmoji: {
    fontSize: 28,
    marginBottom: spacing.sm,
  },
  catLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  catCount: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },

  // ─── Skeleton ───────────────────────────────────────────────────────
  skeletonContainer: {
    paddingHorizontal: spacing.md,
  },
  skeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },

  // ─── Empty ──────────────────────────────────────────────────────────
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
    color: '#9E9488',
  },
});
