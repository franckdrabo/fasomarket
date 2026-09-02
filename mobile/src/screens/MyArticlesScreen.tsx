import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import ArticleCard, { ArticleCardData } from '../components/ArticleCard';
import EmptyState from '../components/EmptyState';
import { api } from '../services/api';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

interface Props {
  onBack: () => void;
  onArticlePress?: (article: ArticleCardData) => void;
}

type StatutArticle = 'EN_LIGNE' | 'VENDU';

export default function MyArticlesScreen({ onBack, onArticlePress }: Props) {
  const [articles, setArticles] = useState<(ArticleCardData & { statut?: StatutArticle })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'EN_LIGNE' | 'VENDU'>('all');

  const fetchArticles = useCallback(async () => {
    try {
      const data = await api.articles.mine() as any;
      const items = Array.isArray(data) ? data : data.data || [];
      setArticles(items);
    } catch (error) {
      console.error('Erreur chargement articles:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  function handleRefresh() {
    setIsRefreshing(true);
    fetchArticles();
  }

  const filteredArticles = filter === 'all'
    ? articles
    : articles.filter((a) => a.statut === filter);

  const enLigneCount = articles.filter((a) => a.statut === 'EN_LIGNE' || !a.statut).length;
  const venduCount = articles.filter((a) => a.statut === 'VENDU').length;

  async function handleMarkAsSold(article: ArticleCardData) {
    Alert.alert(
      'Marquer comme vendu',
      `Confirmer que "${article.titre}" a été vendu ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Marquer vendu',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.articles.markAsSold(article.id);
              setArticles((prev) =>
                prev.map((a) =>
                  a.id === article.id ? { ...a, statut: 'VENDU' as StatutArticle } : a,
                ),
              );
            } catch (error: any) {
              Alert.alert('Erreur', error?.message || 'Impossible de marquer comme vendu');
            }
          },
        },
      ],
    );
  }

  async function handleDelete(article: ArticleCardData) {
    Alert.alert(
      'Supprimer l\'annonce',
      `Êtes-vous sûr de vouloir supprimer "${article.titre}" ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.articles.delete(article.id);
              setArticles((prev) => prev.filter((a) => a.id !== article.id));
            } catch (error: any) {
              Alert.alert('Erreur', error?.message || 'Impossible de supprimer l\'article');
            }
          },
        },
      ],
    );
  }

  function renderArticleActions(article: ArticleCardData & { statut?: string }) {
    const isVendu = article.statut === 'VENDU';

    return (
      <View style={styles.actionsRow}>
        {isVendu ? (
          <View style={styles.soldBadge}>
            <Ionicons name="checkmark-circle" size={16} color={colors.textOnPrimary} />
            <Text style={styles.soldBadgeText}>Vendu</Text>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleMarkAsSold(article)}
              activeOpacity={0.7}
            >
              <Ionicons name="pricetag-outline" size={16} color={colors.success} />
              <Text style={[styles.actionText, { color: colors.success }]}>Vendu</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDelete(article)}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={16} color={colors.error} />
              <Text style={[styles.actionText, { color: colors.error }]}>Supprimer</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#FDDCB5', '#FFF0E0', '#FFF8F0']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            <Ionicons name="storefront-outline" size={22} color={colors.primary} />
            <Text style={styles.screenTitle}>Mes articles</Text>
          </View>
          <View style={styles.backButton} />
        </View>

        {/* Filtres */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
            onPress={() => setFilter('all')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
              Tous ({articles.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, filter === 'EN_LIGNE' && styles.filterChipActive]}
            onPress={() => setFilter('EN_LIGNE')}
            activeOpacity={0.7}
          >
            <Ionicons name="eye-outline" size={14} color={filter === 'EN_LIGNE' ? colors.textOnPrimary : colors.textSecondary} />
            <Text style={[styles.filterText, filter === 'EN_LIGNE' && styles.filterTextActive]}>
              En ligne ({enLigneCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, filter === 'VENDU' && styles.filterChipActive]}
            onPress={() => setFilter('VENDU')}
            activeOpacity={0.7}
          >
            <Ionicons name="checkmark-circle-outline" size={14} color={filter === 'VENDU' ? colors.textOnPrimary : colors.textSecondary} />
            <Text style={[styles.filterText, filter === 'VENDU' && styles.filterTextActive]}>
              Vendus ({venduCount})
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Chargement de vos annonces...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredArticles}
            renderItem={({ item }) => (
              <Animated.View entering={FadeIn.duration(400)}>
                <ArticleCard
                  article={item}
                  onPress={(article) => onArticlePress?.(article)}
                />
                {renderArticleActions(item)}
              </Animated.View>
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.listContent,
              filteredArticles.length === 0 && styles.listEmpty,
            ]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <EmptyState
                icon={filter === 'VENDU' ? 'checkmark-circle-outline' : 'storefront-outline'}
                title={
                  filter === 'VENDU'
                    ? 'Aucun article vendu'
                    : filter === 'EN_LIGNE'
                    ? 'Aucune annonce en ligne'
                    : 'Aucune annonce'
                }
                description={
                  filter === 'all'
                    ? 'Créez votre première annonce en appuyant sur Vendre dans la barre du bas.'
                    : 'Essayez de changer de filtre pour voir plus d\'articles.'
                }
              />
            }
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  decorCircle1: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FF6B35',
    opacity: 0.08,
  },
  decorCircle2: {
    position: 'absolute',
    bottom: 150,
    left: -15,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2ECC71',
    opacity: 0.05,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  screenTitle: {
    ...typography.h2,
  },

  // Filtres
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.textOnPrimary,
    fontWeight: '600',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.bodySmall,
  },

  // List
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  listEmpty: {
    flex: 1,
    justifyContent: 'center',
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  soldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.success + '30',
  },
  soldBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textOnPrimary,
  },
});
