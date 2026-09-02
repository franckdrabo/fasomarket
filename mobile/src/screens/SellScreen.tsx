import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, BounceIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

interface Props {
  onStartCreating?: () => void;
}

export default function SellScreen({ onStartCreating }: Props) {
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
      <View style={styles.decorCircle3} />

      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.content}>
          <Animated.View entering={FadeIn.duration(600)} style={styles.iconWrapper}>
            <Ionicons name="camera-outline" size={48} color={colors.primary} />
          </Animated.View>

          <Animated.Text entering={FadeIn.duration(600).delay(100)} style={styles.title}>
            Vendre un article
          </Animated.Text>

          <Animated.Text entering={FadeIn.duration(600).delay(200)} style={styles.subtitle}>
            Prenez une photo, ajoutez une description{'\n'}et fixez votre prix en toute simplicité
          </Animated.Text>

          <Animated.View entering={BounceIn.duration(600).delay(300)}>
            <TouchableOpacity
              style={styles.createButton}
              onPress={onStartCreating}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientButton}
              >
                <Ionicons name="add-circle" size={22} color={colors.textOnPrimary} />
                <Text style={styles.createButtonText}>Créer une annonce</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Quick tips */}
          <Animated.View entering={FadeIn.duration(600).delay(400)} style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>Conseils pour bien vendre</Text>
            <View style={styles.tipRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.tipText}>Photos claires et lumineuses</Text>
            </View>
            <View style={styles.tipRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.tipText}>Description détaillée</Text>
            </View>
            <View style={styles.tipRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.tipText}>Prix juste et compétitif</Text>
            </View>
          </Animated.View>
        </View>
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

  // Decorative
  decorCircle1: {
    position: 'absolute',
    top: -50,
    right: -20,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#FF6B35',
    opacity: 0.10,
  },
  decorCircle2: {
    position: 'absolute',
    bottom: 80,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#2ECC71',
    opacity: 0.06,
  },
  decorCircle3: {
    position: 'absolute',
    top: '40%',
    right: -10,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F1C40F',
    opacity: 0.08,
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },

  iconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
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
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  createButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },

  // Tips
  tipsCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.xl,
    ...shadows.sm,
  },
  tipsTitle: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  tipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
