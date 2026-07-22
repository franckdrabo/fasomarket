import React from 'react';
import {
  ScrollView,
  Text,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable, FadeInView } from './animations';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

export interface Category {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const CATEGORIES: Category[] = [
  { id: 'TOUS', label: 'Tout', icon: 'grid-outline' },
  { id: 'VETEMENTS', label: 'Vêtements', icon: 'shirt-outline' },
  { id: 'CHAUSSURES', label: 'Chaussures', icon: 'footsteps-outline' },
  { id: 'ELECTRONIQUE', label: 'Électronique', icon: 'phone-portrait-outline' },
  { id: 'MAISON', label: 'Maison', icon: 'home-outline' },
  { id: 'AUTRES', label: 'Autres', icon: 'ellipsis-horizontal-outline' },
];

interface Props {
  selected: string;
  onSelect: (categoryId: string) => void;
}

export default function CategoryFilter({ selected, onSelect }: Props) {
  return (
    <FadeInView delay={200} duration={400}>
      <View style={styles.container}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {CATEGORIES.map((cat, index) => {
            const isActive = selected === cat.id;
            return (
              <FadeInView key={cat.id} delay={200 + index * 60} duration={300}>
                <AnimatedPressable
                  onPress={() => onSelect(cat.id)}
                  scaleTo={0.92}
                >
                  <View style={[styles.chip, isActive && styles.chipActive]}>
                    <Ionicons
                      name={cat.icon}
                      size={18}
                      color={isActive ? colors.textOnPrimary : colors.textSecondary}
                    />
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      {cat.label}
                    </Text>
                  </View>
                </AnimatedPressable>
              </FadeInView>
            );
          })}
        </ScrollView>
      </View>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.textOnPrimary,
  },
});
