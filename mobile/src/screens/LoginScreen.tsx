import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  BounceIn,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../stores/authStore';
import {
  checkBiometricAvailability,
  authenticateWithBiometric,
  getBiometricTypeName,
} from '../services/biometric';
import { api } from '../services/api';
import { AnimatedPressable } from '../components/animations';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';
import { isValidEmail } from '../utils/validation';

type AuthMode = 'otp' | 'email';
type Step = 'biometric' | 'email' | 'otp';

interface LoginScreenProps {
  onRegisterPress?: () => void;
  onComplete?: () => void;
  onSkip?: () => void;
}

export default function LoginScreen({ onRegisterPress, onComplete, onSkip }: LoginScreenProps) {
  const [step, setStep] = useState<Step>('email');
  const [authMode, setAuthMode] = useState<AuthMode>('otp');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricTypeName, setBiometricTypeName] = useState('Biométrie');
  const [countdown, setCountdown] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);

  const { loginWithOtp, loginWithEmail, loginWithBiometric, biometricEnabled } = useAuthStore();
  const passwordRef = useRef<TextInput>(null);

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
    setStep('email');
  }

  async function handleSendOtp() {
    const trimmedEmail = otpEmail.trim();
    if (!isValidEmail(trimmedEmail)) {
      Alert.alert('Erreur', 'Adresse email invalide');
      return;
    }

    setLoading(true);
    try {
      const response: any = await api.auth.sendOtp(trimmedEmail);
      setStep('otp');
      setCountdown(60);

      if (response?.devCode) {
        setDevCode(response.devCode);
        console.log('📱 Code OTP (dev) :', response.devCode);
      }
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
      await loginWithOtp(otpEmail.trim(), otpCode);
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  }

  // ─── Email Login ──────────────────────────────────────────────────

  async function handleEmailLogin() {
    const trimmedEmail = email.trim();
    if (!isValidEmail(trimmedEmail)) {
      Alert.alert('Erreur', 'Adresse email invalide');
      return;
    }
    if (password.length < 4) {
      Alert.alert('Erreur', 'Mot de passe invalide');
      return;
    }

    setLoading(true);
    try {
      await loginWithEmail(trimmedEmail, password);
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  }

  function switchToEmailMode() {
    setAuthMode('email');
    setStep('email');
  }

  function switchToOtpMode() {
    setAuthMode('otp');
    setStep('email');
  }

  // ─── Écran biométrique ──────────────────────────────────────────────
  if (step === 'biometric' && biometricAvailable && biometricEnabled) {
    return (
      <LinearGradient colors={['#FFF8F0', '#FFE8D6']} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <Animated.View
            entering={FadeIn.duration(600)}
            style={styles.biometricContainer}
          >
            <View style={styles.biometricIconWrapper}>
              <Ionicons name="finger-print" size={80} color={colors.primary} />
            </View>
            <Text style={styles.biometricTitle}>Bienvenue sur FasoMarket</Text>
            <Text style={styles.biometricSubtitle}>
              Touchez le capteur {biometricTypeName.toLowerCase()} pour vous connecter
            </Text>
            <AnimatedPressable
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleBiometricLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientButton}
                >
                  <Ionicons name="lock-open" size={22} color={colors.textOnPrimary} />
                  <Text style={styles.primaryButtonText}>
                    Connexion {biometricTypeName}
                  </Text>
                </LinearGradient>
              )}
            </AnimatedPressable>
            <TouchableOpacity onPress={() => setStep('email')} style={styles.switchButton}>
              <Text style={styles.switchButtonText}>
                Utiliser l&apos;email
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#FFF8F0', '#FFE8D6']} style={styles.container}>
      {/* Decorative circles */}
      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />
      <View style={styles.decorCircle3} />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header with gradient */}
            <Animated.View entering={FadeIn.duration(600)} style={styles.headerSection}>
              <LinearGradient
                colors={['#FF6B35', '#E55A2B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoGlow}
              >
                <View style={styles.logoInner}>
                  <Ionicons name="basket" size={36} color="#fff" />
                </View>
              </LinearGradient>
              <Text style={styles.appName}>FasoMarket</Text>
              <Text style={styles.tagline}>Achète et vends en toute confiance</Text>
            </Animated.View>

            {/* Auth Mode Toggle + Form Card */}
            <Animated.View
              entering={FadeIn.delay(200).duration(400)}
              style={styles.formCard}
            >
              {/* Mode toggle: OTP Email / Email+Mot de passe */}
              <View style={styles.authModeToggle}>
                <TouchableOpacity
                  style={[
                    styles.authModeTab,
                    authMode === 'otp' && styles.authModeTabActive,
                  ]}
                  onPress={switchToOtpMode}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="mail-open-outline"
                    size={16}
                    color={authMode === 'otp' ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.authModeLabel,
                      authMode === 'otp' && styles.authModeLabelActive,
                    ]}
                  >
                    Code par email
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.authModeTab,
                    authMode === 'email' && styles.authModeTabActive,
                  ]}
                  onPress={switchToEmailMode}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={16}
                    color={authMode === 'email' ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.authModeLabel,
                      authMode === 'email' && styles.authModeLabelActive,
                    ]}
                  >
                    Mot de passe
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ─── OTP mode (code par email) ──────────────────── */}
              {authMode === 'otp' && (
                <>
                  {/* Step indicator */}
                  <View style={styles.stepIndicator}>
                    <View
                      style={[
                        styles.stepDot,
                        step === 'email' && styles.stepDotActive,
                        step === 'email' && { transform: [{ scale: 1.2 }] },
                      ]}
                    />
                    <View
                      style={[
                        styles.stepLine,
                        step === 'otp' && styles.stepLineActive,
                      ]}
                    />
                    <View
                      style={[
                        styles.stepDot,
                        step === 'otp' && styles.stepDotActive,
                        step === 'otp' && { transform: [{ scale: 1.2 }] },
                      ]}
                    />
                  </View>

                  {step === 'email' && (
                    <Animated.View
                      entering={FadeIn.duration(300)}
                      exiting={FadeOut.duration(200)}
                    >
                      <Text style={styles.formTitle}>Connexion par email</Text>
                      <Text style={styles.formSubtitle}>
                        Entrez votre adresse email pour recevoir un code
                      </Text>

                      <View style={styles.emailInputContainer}>
                        <Ionicons name="mail-outline" size={20} color="#C4B5A5" style={styles.emailInputIcon} />
                        <TextInput
                          style={styles.emailInput}
                          placeholder="exemple@email.com"
                          placeholderTextColor="#C4B5A5"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          autoFocus
                          value={otpEmail}
                          onChangeText={setOtpEmail}
                          returnKeyType="go"
                          onSubmitEditing={handleSendOtp}
                        />
                      </View>

                      <AnimatedPressable
                        style={[styles.primaryButton, loading && styles.buttonDisabled]}
                        onPress={handleSendOtp}
                        disabled={loading}
                      >
                        <LinearGradient
                          colors={['#FF6B35', '#E55A2B']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.gradientButton}
                        >
                          {loading ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <Text style={styles.primaryButtonText}>Envoyer le code</Text>
                          )}
                        </LinearGradient>
                      </AnimatedPressable>

                      {biometricAvailable && (
                        <TouchableOpacity
                          style={styles.biometricOption}
                          onPress={handleBiometricLogin}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="finger-print" size={20} color={colors.primary} />
                          <Text style={styles.biometricOptionText}>
                            Connexion {biometricTypeName}
                          </Text>
                        </TouchableOpacity>
                      )}

                      <View style={styles.dividerContainer}>
                        <View style={styles.divider} />
                        <Text style={styles.dividerText}>ou</Text>
                        <View style={styles.divider} />
                      </View>

                      <TouchableOpacity
                        style={styles.registerButton}
                        onPress={onRegisterPress}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="person-add-outline" size={20} color={colors.primary} />
                        <Text style={styles.registerButtonText}>Créer un compte</Text>
                      </TouchableOpacity>
                    </Animated.View>
                  )}

                  {step === 'otp' && (
                    <Animated.View
                      entering={SlideInRight.duration(350)}
                      exiting={SlideOutLeft.duration(250)}
                    >
                      <TouchableOpacity
                        style={styles.backToPhone}
                        onPress={() => setStep('email')}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
                        <Text style={styles.backToPhoneText}>Modifier l&apos;email</Text>
                      </TouchableOpacity>

                      <Text style={styles.formTitle}>Code de vérification</Text>
                      <Text style={styles.formSubtitle}>
                        Un code à 6 chiffres a été envoyé à{'\n'}
                        <Text style={styles.phoneHighlight}>
                          {otpEmail.trim()}
                        </Text>
                      </Text>

                      <View style={styles.otpContainer}>
                        <TextInput
                          style={styles.otpInput}
                          placeholder="000000"
                          placeholderTextColor="#C4B5A5"
                          keyboardType="number-pad"
                          value={otpCode}
                          onChangeText={setOtpCode}
                          maxLength={6}
                          autoFocus
                        />
                      </View>

                      {devCode && __DEV__ && (
                        <Animated.View
                          entering={BounceIn.duration(500)}
                          style={styles.devCodeContainer}
                        >
                          <View style={styles.devCodeHeader}>
                            <Ionicons name="code-slash" size={14} color="#E65100" />
                            <Text style={styles.devCodeTitle}>Mode Développement</Text>
                          </View>
                          <Text style={styles.devCodeLabel}>Code de test :</Text>
                          <Text style={styles.devCodeValue}>{devCode}</Text>
                          <TouchableOpacity
                            style={styles.devCodeCopyButton}
                            onPress={() => setOtpCode(devCode)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="copy" size={14} color="#E65100" />
                            <Text style={styles.devCodeCopyText}>Utiliser ce code</Text>
                          </TouchableOpacity>
                        </Animated.View>
                      )}

                      <AnimatedPressable
                        style={[styles.primaryButton, loading && styles.buttonDisabled]}
                        onPress={handleVerifyOtp}
                        disabled={loading}
                      >
                        <LinearGradient
                          colors={['#FF6B35', '#E55A2B']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.gradientButton}
                        >
                          {loading ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="checkmark-circle" size={20} color="#fff" />
                              <Text style={styles.primaryButtonText}>Se connecter</Text>
                            </>
                          )}
                        </LinearGradient>
                      </AnimatedPressable>

                      <TouchableOpacity
                        style={styles.resendButton}
                        onPress={handleSendOtp}
                        disabled={countdown > 0}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.resendText,
                            countdown > 0 && styles.resendTextDisabled,
                          ]}
                        >
                          {countdown > 0
                            ? `Renvoyer le code (${countdown}s)`
                            : 'Renvoyer le code'}
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                  )}
                </>
              )}

              {/* ─── Email mode ──────────────────────────────── */}
              {authMode === 'email' && (
                <Animated.View
                  entering={FadeIn.duration(300)}
                >
                  <Text style={styles.formTitle}>Connexion par email</Text>
                  <Text style={styles.formSubtitle}>
                    Connectez-vous avec votre adresse email et mot de passe
                  </Text>

                  {/* Email input */}
                  <View style={styles.emailInputContainer}>
                    <Ionicons name="mail-outline" size={20} color="#C4B5A5" style={styles.emailInputIcon} />
                    <TextInput
                      style={styles.emailInput}
                      placeholder="exemple@email.com"
                      placeholderTextColor="#C4B5A5"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus
                      value={email}
                      onChangeText={setEmail}
                      onSubmitEditing={() => passwordRef.current?.focus()}
                      returnKeyType="next"
                    />
                  </View>

                  {/* Password input */}
                  <View style={styles.emailInputContainer}>
                    <Ionicons name="lock-closed-outline" size={20} color="#C4B5A5" style={styles.emailInputIcon} />
                    <TextInput
                      ref={passwordRef}
                      style={styles.emailInput}
                      placeholder="Mot de passe"
                      placeholderTextColor="#C4B5A5"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      value={password}
                      onChangeText={setPassword}
                      returnKeyType="go"
                      onSubmitEditing={handleEmailLogin}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.passwordToggle}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#C4B5A5"
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Forgot password */}
                  <TouchableOpacity
                    style={styles.forgotPassword}
                    activeOpacity={0.7}
                    onPress={() => Alert.alert('Récupération', 'La récupération de mot de passe sera disponible prochainement.')}
                  >
                    <Text style={styles.forgotPasswordText}>Mot de passe oublié ?</Text>
                  </TouchableOpacity>

                  {/* Login button */}
                  <AnimatedPressable
                    style={[styles.primaryButton, loading && styles.buttonDisabled]}
                    onPress={handleEmailLogin}
                    disabled={loading}
                  >
                    <LinearGradient
                      colors={['#FF6B35', '#E55A2B']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.gradientButton}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="log-in-outline" size={20} color="#fff" />
                          <Text style={styles.primaryButtonText}>Se connecter</Text>
                        </>
                      )}
                    </LinearGradient>
                  </AnimatedPressable>

                  <View style={styles.dividerContainer}>
                    <View style={styles.divider} />
                    <Text style={styles.dividerText}>ou</Text>
                    <View style={styles.divider} />
                  </View>

                  {/* Register */}
                  <TouchableOpacity
                    style={styles.registerButton}
                    onPress={onRegisterPress}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="person-add-outline" size={20} color={colors.primary} />
                    <Text style={styles.registerButtonText}>Créer un compte</Text>
                  </TouchableOpacity>
                </Animated.View>
              )}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  },

  // ─── Decorative elements ─────────────────────────────────────────────
  decorCircle1: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#FF6B35',
    opacity: 0.10,
  },
  decorCircle2: {
    position: 'absolute',
    top: 60,
    left: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#2ECC71',
    opacity: 0.08,
  },
  decorCircle3: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F1C40F',
    opacity: 0.08,
  },

  // ─── Header ──────────────────────────────────────────────────────────
  headerSection: {
    alignItems: 'center',
    paddingTop: spacing.xxl + 10,
    paddingBottom: spacing.lg,
  },
  logoGlow: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    // Ombre portée colorée orange
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  logoInner: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.textSecondary,
    marginTop: 4,
  },

  // ─── Auth mode toggle ────────────────────────────────────────────
  authModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F5F0EB',
    borderRadius: borderRadius.md,
    padding: 3,
    marginBottom: spacing.lg,
  },
  authModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  authModeTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  authModeLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  authModeLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },

  // ─── Email inputs ─────────────────────────────────────────────────
  emailInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBF7F2',
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: '#EDE5DA',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  emailInputIcon: {
    marginRight: spacing.sm,
  },
  emailInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    padding: spacing.md,
    color: colors.text,
  },
  passwordToggle: {
    padding: spacing.sm,
  },

  // ─── Forgot password ─────────────────────────────────────────────
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: spacing.md,
    paddingVertical: 2,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.primary,
  },

  // ─── Step indicator ──────────────────────────────────────────────────
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    gap: 8,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E0D5C8',
  },
  stepDotActive: {
    backgroundColor: colors.primary,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stepLine: {
    width: 44,
    height: 2,
    backgroundColor: '#E0D5C8',
    borderRadius: 1,
  },
  stepLineActive: {
    backgroundColor: colors.primary,
  },

  // ─── Form card (glassmorphism) ───────────────────────────────────────
  formCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    ...shadows.lg,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  formSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
    lineHeight: 20,
  },
  phoneHighlight: {
    fontWeight: '700',
    color: colors.primary,
  },

  // ─── OTP ─────────────────────────────────────────────────────────────
  otpContainer: {
    marginBottom: spacing.md,
  },
  otpInput: {
    backgroundColor: '#FBF7F2',
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: '#EDE5DA',
    padding: spacing.md,
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.text,
    letterSpacing: 14,
  },
  backToPhone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.lg,
    alignSelf: 'flex-start',
  },
  backToPhoneText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  // ─── Dev code ────────────────────────────────────────────────────────
  devCodeContainer: {
    backgroundColor: '#FFF8E1',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#FFE082',
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  devCodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  devCodeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F57F17',
  },
  devCodeLabel: {
    fontSize: 12,
    color: '#795548',
    marginBottom: 4,
  },
  devCodeValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#E65100',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: spacing.sm,
  },
  devCodeCopyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    backgroundColor: '#FFF3E0',
    borderRadius: borderRadius.sm,
  },
  devCodeCopyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E65100',
  },

  // ─── Buttons ─────────────────────────────────────────────────────────
  primaryButton: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  gradientButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  resendButton: {
    alignItems: 'center',
    marginTop: spacing.sm,
    padding: spacing.sm,
  },
  resendText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },
  resendTextDisabled: {
    color: '#C4B5A5',
  },

  // ─── Biometric ───────────────────────────────────────────────────────
  biometricOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    padding: spacing.sm,
    gap: 8,
  },
  biometricOptionText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },

  // ─── Divider & Register ──────────────────────────────────────────────
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#EDE5DA',
  },
  dividerText: {
    fontSize: 13,
    marginHorizontal: spacing.md,
    color: '#9E9488',
    fontWeight: '500',
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: '#FFFFFF',
    gap: spacing.sm,
  },
  registerButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },

  // ─── Biometric full screen ───────────────────────────────────────────
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
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
    marginBottom: spacing.xl,
  },
  biometricTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  biometricSubtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  switchButton: {
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  switchButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
});
