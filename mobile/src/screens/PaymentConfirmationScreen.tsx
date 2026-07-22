import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

interface Props {
  transactionId: string;
  montant: number;
  provider: string;
  onBack: () => void;
  onDone: () => void;
}

const PROVIDER_COLORS: Record<string, string> = {
  ORANGE_MONEY: '#FF7900',
  MOOV_MONEY: '#0033A0',
  WAVE: '#1A8CDB',
};

const PROVIDER_NAMES: Record<string, string> = {
  ORANGE_MONEY: 'Orange Money',
  MOOV_MONEY: 'Moov Money',
  WAVE: 'Wave',
};

export default function PaymentConfirmationScreen({
  transactionId,
  montant,
  provider,
  onBack,
  onDone,
}: Props) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const providerColor = PROVIDER_COLORS[provider] || colors.primary;
  const providerName = PROVIDER_NAMES[provider] || provider;

  // Animation de chargement (spinner)
  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spin.start();

    // Transition finale
    const timer = setTimeout(() => {
      spin.stop();
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start();
    }, 3000);

    return () => {
      spin.stop();
      clearTimeout(timer);
    };
  }, []);

  const spinInterpolation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirmation</Text>
        <View style={styles.headerRight} />
      </SafeAreaView>

      <View style={styles.content}>
        {/* Étape 1 : Traitement en cours */}
        <Animated.View
          style={[
            styles.stepContainer,
            { opacity: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0],
            })},
          ]}
          pointerEvents={fadeAnim.interpolate({
            inputRange: [0, 0.5],
            outputRange: ['auto' as any, 'none' as any],
          }) as any}
        >
          <Animated.View
            style={[
              styles.spinnerCircle,
              { transform: [{ rotate: spinInterpolation }] },
            ]}
          >
            <Ionicons name="phone-portrait" size={48} color={providerColor} />
          </Animated.View>

          <Text style={styles.statusTitle}>Demande de paiement envoyée</Text>
          <Text style={styles.statusText}>
            Confirmez le paiement de{' '}
            <Text style={styles.statusPrice}>
              {montant.toLocaleString('fr-FR')} FCFA
            </Text>{' '}
            sur votre application {providerName}
          </Text>

          <View style={styles.phoneMockup}>
            <Ionicons name="notifications" size={20} color={providerColor} />
            <Text style={styles.phoneMockupText}>
              Notification envoyée à votre téléphone
            </Text>
          </View>

          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: progressWidth as any, backgroundColor: providerColor },
              ]}
            />
          </View>
          <Text style={styles.progressText}>En attente de confirmation...</Text>
        </Animated.View>

        {/* Étape 2 : Succès */}
        <Animated.View
          style={[
            styles.stepContainer,
            styles.stepSuccess,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
          pointerEvents={fadeAnim.interpolate({
            inputRange: [0, 0.5],
            outputRange: ['none' as any, 'auto' as any],
          }) as any}
        >
          <View style={[styles.successCircle, { backgroundColor: providerColor + '15' }]}>
            <View style={[styles.successIcon, { backgroundColor: providerColor }]}>
              <Ionicons name="checkmark" size={36} color="#fff" />
            </View>
          </View>

          <Text style={styles.successTitle}>Paiement confirmé ! ✅</Text>
          <Text style={styles.successText}>
            Votre paiement de{' '}
            <Text style={styles.successPrice}>
              {montant.toLocaleString('fr-FR')} FCFA
            </Text>{' '}
            est sécurisé via Bazario Escrow.
          </Text>

          {/* Transaction info */}
          <View style={styles.transactionCard}>
            <View style={styles.transactionRow}>
              <Text style={styles.transactionLabel}>Référence</Text>
              <Text style={styles.transactionValue} selectable>
                #{transactionId.substring(0, 10).toUpperCase()}
              </Text>
            </View>
            <View style={styles.transactionRow}>
              <Text style={styles.transactionLabel}>Moyen de paiement</Text>
              <Text style={styles.transactionValue}>{providerName}</Text>
            </View>
            <View style={styles.transactionRow}>
              <Text style={styles.transactionLabel}>Statut</Text>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusBadgeText}>Sécurisé (Escrow)</Text>
              </View>
            </View>
          </View>

          {/* Info escrow */}
          <View style={styles.escrowInfo}>
            <Ionicons name="information-circle" size={20} color={colors.primary} />
            <Text style={styles.escrowText}>
              Le vendeur sera notifié. Les fonds seront libérés après votre
              confirmation de réception.
            </Text>
          </View>

          <TouchableOpacity style={styles.doneButton} onPress={onDone}>
            <Ionicons name="chatbubble-ellipses" size={20} color={colors.textOnPrimary} />
            <Text style={styles.doneButtonText}>Voir mes messages</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
  headerTitle: {
    ...typography.h3,
  },
  headerRight: {
    width: 40,
  },

  // Content
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },

  // Step container
  stepContainer: {
    position: 'absolute',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    width: '100%',
  },
  stepSuccess: {
    width: '100%',
  },

  // Spinner
  spinnerCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...shadows.lg,
  },
  statusTitle: {
    ...typography.h2,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  statusText: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
    lineHeight: 24,
  },
  statusPrice: {
    fontWeight: '700',
    color: colors.text,
  },

  // Phone mockup
  phoneMockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
    width: '100%',
    ...shadows.sm,
  },
  phoneMockupText: {
    ...typography.bodySmall,
    fontWeight: '500',
    flex: 1,
  },

  // Progress bar
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 2,
    marginTop: spacing.lg,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    ...typography.caption,
    marginTop: spacing.sm,
    color: colors.textSecondary,
  },

  // Success
  successCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  successTitle: {
    ...typography.h2,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  successText: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
    lineHeight: 24,
  },
  successPrice: {
    fontWeight: '700',
    color: colors.text,
  },

  // Transaction card
  transactionCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.lg,
    ...shadows.sm,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionLabel: {
    ...typography.bodySmall,
  },
  transactionValue: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.secondary + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.secondary,
  },
  statusBadgeText: {
    ...typography.caption,
    color: colors.secondary,
    fontWeight: '600',
  },

  // Escrow info
  escrowInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surfaceVariant,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  escrowText: {
    ...typography.bodySmall,
    flex: 1,
    lineHeight: 20,
  },

  // Done button
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
    ...shadows.md,
  },
  doneButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
});
