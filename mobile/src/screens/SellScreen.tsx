import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

interface Props {
  onStartCreating?: () => void;
}

export default function SellScreen({ onStartCreating }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <Ionicons name="camera-outline" size={80} color={colors.primary} />
        </View>
        <Text style={styles.title}>Vendre un article</Text>
        <Text style={styles.subtitle}>
          Prenez une photo, ajoutez une description{'\n'}et fixez votre prix
        </Text>

        <TouchableOpacity style={styles.createButton} onPress={onStartCreating}>
          <Ionicons name="add-circle" size={24} color={colors.textOnPrimary} />
          <Text style={styles.createButtonText}>Créer une annonce</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconWrapper: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    ...shadows.md,
  },
  createButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
});
