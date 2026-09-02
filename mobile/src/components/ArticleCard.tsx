import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { AnimatedPressable } from './animations';
import { getTimeAgo } from '../utils/date';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

export interface ArticleCardData {
  id: string;
  titre: string;
  description?: string;
  prix: number;
  photos: string[];
  ville?: string;
  categorie: string;
  etat: string;
  dateCreation: string;
  vendeur: {
    id: string;
    nom: string;
    avatar?: string;
    ville?: string;
    noteMoyenne?: number;
    telephone?: string;
  };
  coords?: {
    latitude: number;
    longitude: number;
  };
  favoris?: boolean;
}

interface Props {
  article: ArticleCardData;
  onPress: (article: ArticleCardData) => void;
  onFavorite?: (article: ArticleCardData) => void;
}

const CATEGORY_STYLES: Record<string, { color: string; icon: string }> = {
  VETEMENTS: { color: '#E91E63', icon: 'shirt' },
  CHAUSSURES: { color: '#9C27B0', icon: 'footsteps' },
  ELECTRONIQUE: { color: '#2196F3', icon: 'laptop' },
  MAISON: { color: '#4CAF50', icon: 'home' },
  AUTRES: { color: '#FF9800', icon: 'apps' },
};

function getPlaceholderColor(categorie: string): string {
  return CATEGORY_STYLES[categorie]?.color || '#9E9E9E';
}

function getCategoryIcon(categorie: string): string {
  return CATEGORY_STYLES[categorie]?.icon || 'image-outline';
}

export default function ArticleCard({ article, onPress, onFavorite }: Props) {
  const [isFavorite, setIsFavorite] = useState(article.favoris || false);
  const heartScale = useSharedValue(1);

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  function handleFavorite() {
    const newState = !isFavorite;
    setIsFavorite(newState);

    if (newState) {
      // Like: big bounce
      heartScale.value = withSequence(
        withSpring(1.6, { damping: 8, stiffness: 300 }),
        withSpring(0.8, { damping: 15, stiffness: 200 }),
        withSpring(1.2, { damping: 10, stiffness: 400 }),
        withSpring(1, { damping: 12, stiffness: 200 }),
      );
    } else {
      // Unlike: petit pop
      heartScale.value = withSequence(
        withSpring(0.7, { damping: 10, stiffness: 300 }),
        withSpring(1, { damping: 12, stiffness: 200 }),
      );
    }

    onFavorite?.(article);
  }

  const photoUrl = article.photos?.[0];
  const formattedPrice = article.prix.toLocaleString('fr-FR');
  const timeAgo = getTimeAgo(article.dateCreation);

  return (
    <AnimatedPressable
      onPress={() => onPress(article)}
      scaleTo={0.97}
    >
      <View style={styles.card}>
        {/* Image */}
        <View style={styles.imageContainer}>
          {photoUrl ? (
            <Image
              source={photoUrl}
              style={styles.image}
              contentFit="cover"
              transition={300}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: getPlaceholderColor(article.categorie) }]}>
              <Ionicons name={getCategoryIcon(article.categorie) as any} size={48} color="rgba(255,255,255,0.6)" />
            </View>
          )}

          {/* Favoris animé */}
          {onFavorite && (
            <AnimatedPressable onPress={handleFavorite} style={styles.favoriteButton}>
              <Animated.View style={heartAnimatedStyle}>
                <Ionicons
                  name={isFavorite ? 'heart' : 'heart-outline'}
                  size={20}
                  color={isFavorite ? colors.error : colors.textOnPrimary}
                />
              </Animated.View>
            </AnimatedPressable>
          )}

          {/* Badge prix */}
          <View style={styles.priceBadge}>
            <Text style={styles.priceText}>{formattedPrice} FCFA</Text>
          </View>

          {/* Temps */}
          <View style={styles.timeBadge}>
            <Text style={styles.timeText}>{timeAgo}</Text>
          </View>
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>
            {article.titre}
          </Text>

          <View style={styles.meta}>
            {article.ville && (
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                <Text style={styles.metaText}>{article.ville}</Text>
              </View>
            )}

            <View style={styles.metaItem}>
              <Ionicons name="person-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.metaText}>{article.vendeur.nom}</Text>
              {article.vendeur.noteMoyenne != null && article.vendeur.noteMoyenne >= 4.5 && (
                <Ionicons name="shield-checkmark" size={12} color={colors.verified} />
              )}
            </View>
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  imageContainer: {
    position: 'relative',
    height: 200,
    backgroundColor: colors.surfaceVariant,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  priceText: {
    color: colors.textOnPrimary,
    fontWeight: '700',
    fontSize: 15,
  },
  timeBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  timeText: {
    color: '#fff',
    fontSize: 11,
  },
  info: {
    padding: spacing.md,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  meta: {
    gap: spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
