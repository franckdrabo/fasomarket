import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../stores/authStore';
import {
  checkBiometricAvailability,
  authenticateWithBiometric,
  getBiometricTypeName,
} from '../services/biometric';
import { api } from '../services/api';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

type Step = 'biometric' | 'phone' | 'otp';

export default function LoginScreen() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricTypeName, setBiometricTypeName] = useState('Biométrie');
  const [countdown, setCountdown] = useState(0);

  const { loginWithOtp, loginWithBiometric, biometricEnabled } = useAuthStore();

  useEffect(() => {
    checkBiometric();
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  async function checkBiometric() {
    const status = await checkBiometricAvailability();
    setBiometricAvailable(status.isAvailable);
    if (status.biometryType) {
      setBiometricTypeName(getBiometricTypeName(status.biometryType));
    }
  }

  async function handleBiometricLogin() {
    setLoading(true);
    const success = await authenticateWithBiometric();
    if (success) {
      const loggedIn = await loginWithBiometric();
      if (loggedIn) {
        setLoading(false);
        return;
      }
    }
    setLoading(false);
    // Si la biométrie échoue, on tombe sur l'écran phone
    setStep('phone');
  }

  async function handleSendOtp() {
    if (phone.length < 8) {
      Alert.alert('Erreur', 'Numéro de téléphone invalide');
      return;
    }

    setLoading(true);
    try {
      await api.auth.sendOtp(phone);
      setStep('otp');
      setCountdown(60);
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (otpCode.length < 4) {
      Alert.alert('Erreur', 'Code invalide');
      return;
    }

    setLoading(true);
    try {
      await loginWithOtp(phone, otpCode);
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  }

  // Écran biométrique (si disponible et déjà inscrit)
  if (step === 'biometric' && biometricAvailable && biometricEnabled) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.biometricContainer}>
          <View style={styles.biometricIconWrapper}>
            <Ionicons
              name="finger-print"
              size={80}
              color={colors.primary}
            />
          </View>

          <Text style={styles.biometricTitle}>Bienvenue sur Bazario</Text>
          <Text style={styles.biometricSubtitle}>
            Touchez le capteur {biometricTypeName.toLowerCase()} pour vous connecter
          </Text>

          <TouchableOpacity
            style={[styles.biometricButton, loading && styles.buttonDisabled]}
            onPress={handleBiometricLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <>
                <Ionicons name="lock-open" size={24} color={colors.textOnPrimary} />
                <Text style={styles.biometricButtonText}>
                  Connexion {biometricTypeName}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => setStep('phone')}
          >
            <Text style={styles.switchButtonText}>
              Utiliser le numéro de téléphone
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="basket" size={40} color={colors.primary} />
          </View>
          <Text style={styles.appName}>Bazario</Text>
          <Text style={styles.tagline}>Achète et vends en toute confiance</Text>
        </View>

        {/* Step indicator */}
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, step === 'phone' && styles.stepDotActive]} />
          <View style={styles.stepLine} />
          <View style={[styles.stepDot, step === 'otp' && styles.stepDotActive]} />
        </View>

        {/* Phone input */}
        {step === 'phone' && (
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>Connexion</Text>
            <Text style={styles.formSubtitle}>
              Entrez votre numéro de téléphone
            </Text>

            <View style={styles.phoneInputContainer}>
              <Text style={styles.phonePrefix}>+225</Text>
              <TextInput
                style={styles.phoneInput}
                placeholder="01 02 03 04 05"
                placeholderTextColor={colors.disabled}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                maxLength={10}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleSendOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>Envoyer le code</Text>
              )}
            </TouchableOpacity>

            {biometricAvailable && (
              <TouchableOpacity
                style={styles.switchButton}
                onPress={handleBiometricLogin}
              >
                <Ionicons name="finger-print" size={20} color={colors.primary} />
                <Text style={[styles.switchButtonText, { marginLeft: 8 }]}>
                  Connexion {biometricTypeName}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* OTP input */}
        {step === 'otp' && (
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>Code de vérification</Text>
            <Text style={styles.formSubtitle}>
              Un code à 6 chiffres a été envoyé au {phone}
            </Text>

            <View style={styles.otpContainer}>
              <TextInput
                style={styles.otpInput}
                placeholder="000000"
                placeholderTextColor={colors.disabled}
                keyboardType="number-pad"
                value={otpCode}
                onChangeText={setOtpCode}
                maxLength={6}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleVerifyOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>Se connecter</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resendButton}
              onPress={handleSendOtp}
              disabled={countdown > 0}
            >
              <Text style={[styles.resendText, countdown > 0 && styles.resendTextDisabled]}>
                {countdown > 0
                  ? `Renvoyer le code (${countdown}s)`
                  : 'Renvoyer le code'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
    marginTop: spacing.md,
  },
  tagline: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
  },

  // Step indicator
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.lg,
    gap: 8,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  stepDotActive: {
    backgroundColor: colors.primary,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: colors.border,
  },

  // Form
  formContainer: {
    paddingHorizontal: spacing.xl,
  },
  formTitle: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  formSubtitle: {
    ...typography.bodySmall,
    marginBottom: spacing.lg,
  },

  // Phone
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  phonePrefix: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    paddingRight: spacing.sm,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  phoneInput: {
    flex: 1,
    ...typography.body,
    padding: spacing.md,
    color: colors.text,
  },

  // OTP
  otpContainer: {
    marginBottom: spacing.lg,
  },
  otpInput: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.text,
    letterSpacing: 12,
    ...shadows.sm,
  },

  // Buttons
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.md,
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  resendButton: {
    alignItems: 'center',
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  resendText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  resendTextDisabled: {
    color: colors.disabled,
  },

  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  switchButtonText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '500',
  },

  // Biometric screen
  biometricContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  biometricIconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
    marginBottom: spacing.xl,
  },
  biometricTitle: {
    ...typography.h1,
    marginBottom: spacing.sm,
  },
  biometricSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  biometricButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.md,
  },
  biometricButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
});
