import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import ArticleCard, { ArticleCardData } from '../components/ArticleCard';
import EmptyState from '../components/EmptyState';
import { api } from '../services/api';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

interface Props {
  onBack: () => void;
  onArticlePress?: (article: ArticleCardData) => void;
}

export default function FavoritesScreen({ onBack, onArticlePress }: Props) {
  const [favorites, setFavorites] = useState<ArticleCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchFavorites = useCallback(async () => {
    try {
      const data = await api.favoris.list() as any;
      const articles = Array.isArray(data) ? data : data.data || [];
      setFavorites(articles.map((a: any) => ({ ...a, favoris: true })));
    } catch (error) {
      console.error('Erreur chargement favoris:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  function handleRefresh() {
    setIsRefreshing(true);
    fetchFavorites();
  }

  async function handleFavorite(article: ArticleCardData) {
    try {
      await api.favoris.toggle(article.id);
      setFavorites((prev) => prev.filter((a) => a.id !== article.id));
    } catch {}
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

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <Ionicons name="heart" size={22} color={colors.error} />
          <Text style={styles.screenTitle}>Mes favoris</Text>
        </View>
        <View style={styles.backButton} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement des favoris...</Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          renderItem={({ item }) => (
            <ArticleCard
              article={item}
              onPress={(article) => onArticlePress?.(article)}
              onFavorite={handleFavorite}
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            favorites.length === 0 && styles.listEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="heart-outline"
              title="Aucun favori"
              description="Ajoutez des articles à vos favoris en appuyant sur le cœur pour les retrouver facilement plus tard."
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

  // Decorative circles
  decorCircle1: {
    position: 'absolute',
    top: -30,
    left: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FF6B35',
    opacity: 0.08,
  },
  decorCircle2: {
    position: 'absolute',
    bottom: 100,
    right: -15,
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.bodySmall,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  listEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
});
