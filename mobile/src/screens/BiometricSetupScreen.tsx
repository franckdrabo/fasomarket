import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuthStore } from '../stores/authStore';
import {
  checkBiometricAvailability,
  authenticateWithBiometric,
  getBiometricTypeName,
  BiometricStatus,
} from '../services/biometric';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

interface Props {
  onComplete: () => void;
  onSkip: () => void;
}

export default function BiometricSetupScreen({ onComplete, onSkip }: Props) {
  const [status, setStatus] = useState<BiometricStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const { enableBiometric } = useAuthStore();

  useEffect(() => {
    checkBiometricAvailability().then(setStatus);
  }, []);

  async function handleEnable() {
    setLoading(true);

    try {
      const authenticated = await authenticateWithBiometric(
        'Activez la connexion rapide',
      );

      if (authenticated) {
        await enableBiometric();
        Alert.alert(
          '✅ Activé !',
          `Vous pouvez maintenant vous connecter avec ${getBiometricTypeName(status?.biometryType || null)}`,
          [{ text: 'Continuer', onPress: onComplete }],
        );
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  }

  if (!status) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!status.isAvailable) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconWrapper}>
            <Ionicons name="alert-circle" size={64} color={colors.warning} />
          </View>
          <Text style={styles.title}>Non disponible</Text>
          <Text style={styles.subtitle}>{status.errorMessage}</Text>
          <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
            <Text style={styles.skipButtonText}>Continuer sans biométrie</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const biometricName = getBiometricTypeName(status.biometryType);
  const biometricIcon =
    status.biometryType === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
      ? 'scan'
      : 'finger-print';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <Ionicons name={biometricIcon} size={64} color={colors.primary} />
        </View>

        <Text style={styles.title}>Connexion rapide</Text>
        <Text style={styles.subtitle}>
          Activez {biometricName} pour vous connecter{'\n'}sans saisir de code à chaque fois
        </Text>

        <View style={styles.benefits}>
          <BenefitItem icon="flash" text="Connexion en 1 seconde" />
          <BenefitItem icon="shield-checkmark" text={`Sécurisé par ${biometricName}`} />
          <BenefitItem icon="happy" text="Plus besoin de retenir un code" />
        </View>

        <TouchableOpacity
          style={[styles.enableButton, loading && styles.buttonDisabled]}
          onPress={handleEnable}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <>
              <Ionicons name="lock-open" size={22} color={colors.textOnPrimary} />
              <Text style={styles.enableButtonText}>Activer {biometricName}</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
          <Text style={styles.skipButtonText}>Passer pour l'instant</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function BenefitItem({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.benefitItem}>
      <Ionicons name={icon as any} size={22} color={colors.secondary} />
      <Text style={styles.benefitText}>{text}</Text>
    </View>
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
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },

  // Benefits
  benefits: {
    width: '100%',
    marginBottom: spacing.xxl,
    gap: spacing.md,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  benefitText: {
    ...typography.body,
    color: colors.text,
  },

  // Buttons
  enableButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    width: '100%',
    ...shadows.md,
  },
  enableButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  skipButton: {
    padding: spacing.md,
    marginTop: spacing.md,
  },
  skipButtonText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
