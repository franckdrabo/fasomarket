import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { colors, spacing, borderRadius, shadows } from '../theme';

// Barre de base animée (pulse)
function SkeletonBar({
  width,
  height,
  borderRadius: br,
  style,
}: {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
}) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.8, {
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true, // reverse → pulse
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: br ?? 6,
          backgroundColor: '#E8D5C4',
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

// ─── SkeletonCard (format carte d'article) ──────────────────────────────────

export default function SkeletonCard() {
  return (
    <View style={styles.card}>
      {/* Image placeholder */}
      <SkeletonBar width="100%" height={180} borderRadius={0} style={styles.image} />

      {/* Badge prix fantôme */}
      <View style={styles.priceBadge}>
        <SkeletonBar width={80} height={18} borderRadius={6} />
      </View>

      {/* Texte placeholder */}
      <View style={styles.info}>
        <SkeletonBar width="85%" height={14} />
        <SkeletonBar width="60%" height={12} style={{ marginTop: 8 }} />
        <View style={styles.metaRow}>
          <SkeletonBar width={60} height={10} />
          <SkeletonBar width={50} height={10} />
        </View>
      </View>
    </View>
  );
}

// ─── SkeletonCardCompact (format petite carte horizontale) ──────────────────

export function SkeletonCardCompact() {
  return (
    <View style={styles.compactCard}>
      <SkeletonBar width={100} height={100} borderRadius={12} />
      <View style={styles.compactInfo}>
        <SkeletonBar width="80%" height={12} />
        <SkeletonBar width="50%" height={10} style={{ marginTop: 6 }} />
        <SkeletonBar width={65} height={14} borderRadius={6} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

// ─── SkeletonGrid (grille de skeletons) ─────────────────────────────────────

export function SkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
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
    ...shadows.sm,
  },
  image: {
    width: '100%' as any,
  },
  priceBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
  },
  info: {
    padding: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 8,
  },
  grid: {
    paddingHorizontal: spacing.md,
  },
  compactCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    width: 160,
    marginRight: spacing.sm,
  },
  compactInfo: {
    flex: 1,
    marginLeft: spacing.sm,
    justifyContent: 'center',
  },
});
