import React, { useState, useEffect, useRef } from 'react';
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
  ScrollView,
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
import { api } from '../services/api';
import { AnimatedPressable } from '../components/animations';
import { colors, spacing, borderRadius, shadows } from '../theme';
import { isValidEmail } from '../utils/validation';

type AuthMode = 'otp' | 'email';
type Step = 'email' | 'otp' | 'profile';

interface RegisterScreenProps {
  onBackToLogin: () => void;
  onComplete: () => void;
}

export default function RegisterScreen({ onBackToLogin, onComplete }: RegisterScreenProps) {
  const [authMode, setAuthMode] = useState<AuthMode>('otp');
  const [step, setStep] = useState<Step>('email');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [ville, setVille] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [registerRole, setRegisterRole] = useState<'BUYER' | 'SELLER'>('BUYER');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const { registerWithProfile, registerWithEmail } = useAuthStore();
  const passwordRef = useRef<TextInput>(null);
  const nomRef = useRef<TextInput>(null);
  const villeRef = useRef<TextInput>(null);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

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
      Alert.alert('Erreur', error?.message || 'Impossible d\'envoyer le code');
    } finally {
      setLoading(false);
    }
  }

  function handleVerifyOtp() {
    if (otpCode.length < 6) {
      Alert.alert('Erreur', 'Le code doit contenir 6 chiffres');
      return;
    }
    setStep('profile');
  }

  async function handleCompleteRegistration() {
    if (!nom.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre nom');
      return;
    }

    setLoading(true);
    try {
      await registerWithProfile(otpEmail.trim(), otpCode, nom.trim(), ville.trim() || undefined, registerRole);
      onComplete();
    } catch (error: any) {
      Alert.alert('Erreur', error?.message || 'Erreur lors de la création du compte');
    } finally {
      setLoading(false);
    }
  }

  function renderStepIndicator() {
    return (
      <View style={styles.stepIndicator}>
        <View style={[styles.stepDot, step === 'email' && styles.stepDotActive]} />
        <View style={[styles.stepLine, step !== 'email' && styles.stepLineActive]} />
        <View style={[styles.stepDot, (step === 'otp' || step === 'profile') && styles.stepDotActive]} />
        <View style={[styles.stepLine, step === 'profile' && styles.stepLineActive]} />
        <View style={[styles.stepDot, step === 'profile' && styles.stepDotActive]} />
      </View>
    );
  }

  async function handleEmailRegister() {
    const trimmedEmail = email.trim().toLowerCase();
    if (!isValidEmail(trimmedEmail)) {
      Alert.alert('Erreur', 'Adresse email invalide');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    if (!nom.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre nom');
      return;
    }

    setLoading(true);
    try {
      await registerWithEmail(trimmedEmail, password, nom.trim(), ville.trim() || undefined, registerRole);
      onComplete();
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  }

  function switchToEmailMode() {
    setAuthMode('email');
  }

  function switchToOtpMode() {
    setAuthMode('otp');
    setStep('email');
    setEmail('');
    setPassword('');
  }

  function goBack() {
    if (authMode === 'email') {
      onBackToLogin();
      return;
    }
    if (step === 'email') onBackToLogin();
    else if (step === 'otp') setStep('email');
    else setStep('otp');
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
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={goBack} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={22} color={colors.text} />
              </TouchableOpacity>
              <LinearGradient
                colors={['#FF6B35', '#E55A2B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoGlow}
              >
                <View style={styles.logoInner}>
                  <Ionicons name="person-add" size={28} color="#fff" />
                </View>
              </LinearGradient>
              <Text style={styles.appName}>FasoMarket</Text>
              <Text style={styles.tagline}>Créez votre compte en quelques étapes</Text>
            </View>

            {/* Auth Mode Toggle */}
            <Animated.View
              entering={FadeIn.delay(200).duration(400)}
              style={styles.formCard}
            >
              {/* Mode toggle: Code par email / Mot de passe */}
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
                  <Text style={[
                    styles.authModeLabel,
                    authMode === 'otp' && styles.authModeLabelActive,
                  ]}>
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
                  <Text style={[
                    styles.authModeLabel,
                    authMode === 'email' && styles.authModeLabelActive,
                  ]}>
                    Mot de passe
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ─── OTP Mode (code par email) ──────────────────── */}
              {authMode === 'otp' && (
                <>
                  {/* Step indicator */}
                  {renderStepIndicator()}

                  {/* Step labels */}
                  <View style={styles.stepLabels}>
                    <Text style={[styles.stepLabel, step === 'email' && styles.stepLabelActive]}>Email</Text>
                    <Text style={[styles.stepLabel, step === 'otp' && styles.stepLabelActive]}>Vérification</Text>
                    <Text style={[styles.stepLabel, step === 'profile' && styles.stepLabelActive]}>Profil</Text>
                  </View>

                  {/* Step 1: Email */}
                  {step === 'email' && (
                    <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)}>
                      <Text style={styles.formTitle}>Quelle est votre email ?</Text>
                      <Text style={styles.formSubtitle}>
                        Entrez votre adresse email pour créer un compte
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
                            <>
                              <Ionicons name="send" size={18} color="#fff" />
                              <Text style={styles.primaryButtonText}>Envoyer le code</Text>
                            </>
                          )}
                        </LinearGradient>
                      </AnimatedPressable>
                    </Animated.View>
                  )}

                  {/* Step 2: OTP */}
                  {step === 'otp' && (
                    <Animated.View entering={SlideInRight.duration(350)} exiting={SlideOutLeft.duration(250)}>
                      <TouchableOpacity
                        style={styles.backLink}                         onPress={() => setStep('email')}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
                        <Text style={styles.backLinkText}>Modifier l&apos;email</Text>
                      </TouchableOpacity>

                      <Text style={styles.formTitle}>Code de vérification</Text>
                      <Text style={styles.formSubtitle}>
                        Entrez le code à 6 chiffres envoyé à{'\n'}
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
                        <Animated.View entering={BounceIn.duration(500)} style={styles.devCodeContainer}>
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

                      <AnimatedPressable style={styles.primaryButton} onPress={handleVerifyOtp}>
                        <LinearGradient colors={['#FF6B35', '#E55A2B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradientButton}>
                          <Ionicons name="checkmark-circle" size={20} color="#fff" />
                          <Text style={styles.primaryButtonText}>Vérifier</Text>
                        </LinearGradient>
                      </AnimatedPressable>

                      <TouchableOpacity style={styles.resendButton} onPress={handleSendOtp} disabled={countdown > 0} activeOpacity={0.7}>
                        <Text style={[styles.resendText, countdown > 0 && styles.resendTextDisabled]}>
                          {countdown > 0 ? `Renvoyer le code (${countdown}s)` : 'Renvoyer le code'}
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                  )}

                  {/* Step 3: Profil */}
                  {step === 'profile' && (
                    <Animated.View entering={SlideInRight.duration(350)} exiting={FadeOut.duration(200)}>
                      <TouchableOpacity style={styles.backLink} onPress={() => setStep('otp')} activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
                        <Text style={styles.backLinkText}>Retour</Text>
                      </TouchableOpacity>

                      <Animated.View entering={BounceIn.duration(600)} style={styles.successBadge}>
                        <LinearGradient colors={['#2ECC71', '#27AE60']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.successCircle}>
                          <Ionicons name="checkmark" size={28} color="#fff" />
                        </LinearGradient>
                      </Animated.View>

                      <Text style={styles.formTitle}>Finalisez votre compte</Text>
                      <Text style={styles.formSubtitle}>
                        Un dernier effort pour personnaliser votre profil
                      </Text>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Nom d&apos;affichage *</Text>
                        <View style={styles.inputContainer}>
                          <Ionicons name="person-outline" size={20} color="#C4B5A5" style={styles.inputIcon} />
                          <TextInput style={styles.textInput} placeholder="Votre nom ou pseudo" placeholderTextColor="#C4B5A5" value={nom} onChangeText={setNom} autoFocus />
                        </View>
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Ville (optionnel)</Text>
                        <View style={styles.inputContainer}>
                          <Ionicons name="location-outline" size={20} color="#C4B5A5" style={styles.inputIcon} />
                          <TextInput style={styles.textInput} placeholder="Votre ville" placeholderTextColor="#C4B5A5" value={ville} onChangeText={setVille} />
                        </View>
                      </View>

                      {/* Role selector */}
                      <View style={styles.roleToggle}>
                        <TouchableOpacity
                          style={[styles.roleTab, registerRole === 'BUYER' && styles.roleTabActive]}
                          onPress={() => setRegisterRole('BUYER')}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="cart-outline" size={16} color={registerRole === 'BUYER' ? colors.secondary : colors.textSecondary} />
                          <Text style={[styles.roleLabel, registerRole === 'BUYER' && styles.roleLabelActive]}>Acheteur</Text>
                          <Text style={styles.roleBadge}>Gratuit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.roleTab, registerRole === 'SELLER' && styles.roleTabSellerActive]}
                          onPress={() => setRegisterRole('SELLER')}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="storefront-outline" size={16} color={registerRole === 'SELLER' ? colors.primary : colors.textSecondary} />
                          <Text style={[styles.roleLabel, registerRole === 'SELLER' && styles.roleLabelSellerActive]}>Vendeur</Text>
                          <Text style={[styles.roleBadge, styles.roleBadgeSeller]}>1000 FCFA</Text>
                        </TouchableOpacity>
                      </View>

                      <AnimatedPressable style={[styles.primaryButton, loading && styles.buttonDisabled]} onPress={handleCompleteRegistration} disabled={loading}>
                        <LinearGradient colors={['#FF6B35', '#E55A2B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradientButton}>
                          {loading ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="rocket" size={18} color="#fff" />
                              <Text style={styles.primaryButtonText}>Créer mon compte</Text>
                            </>
                          )}
                        </LinearGradient>
                      </AnimatedPressable>
                    </Animated.View>
                  )}
                </>
              )}

              {/* ─── Email Mode ──────────────────────────────── */}
              {authMode === 'email' && (
                <Animated.View entering={FadeIn.duration(300)}>
                  <Text style={styles.formTitle}>Inscription par email</Text>
                  <Text style={styles.formSubtitle}>
                    Créez votre compte en quelques secondes
                  </Text>

                  {/* Email */}
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

                  {/* Password */}
                  <View style={styles.emailInputContainer}>
                    <Ionicons name="lock-closed-outline" size={20} color="#C4B5A5" style={styles.emailInputIcon} />
                    <TextInput
                      ref={passwordRef}
                      style={styles.emailInput}
                      placeholder="Mot de passe (min. 6 car.)"
                      placeholderTextColor="#C4B5A5"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      value={password}
                      onChangeText={setPassword}
                      onSubmitEditing={() => nomRef.current?.focus()}
                      returnKeyType="next"
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.passwordToggle} activeOpacity={0.7}>
                      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#C4B5A5" />
                    </TouchableOpacity>
                  </View>

                  {/* Nom */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Nom d&apos;affichage *</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons name="person-outline" size={20} color="#C4B5A5" style={styles.inputIcon} />
                      <TextInput
                        ref={nomRef}
                        style={styles.textInput}
                        placeholder="Votre nom ou pseudo"
                        placeholderTextColor="#C4B5A5"
                        value={nom}
                        onChangeText={setNom}
                        onSubmitEditing={() => villeRef.current?.focus()}
                        returnKeyType="next"
                      />
                    </View>
                  </View>

                  {/* Ville */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Ville (optionnel)</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons name="location-outline" size={20} color="#C4B5A5" style={styles.inputIcon} />
                      <TextInput
                        ref={villeRef}
                        style={styles.textInput}
                        placeholder="Votre ville"
                        placeholderTextColor="#C4B5A5"
                        value={ville}
                        onChangeText={setVille}
                        returnKeyType="done"
                      />
                    </View>
                  </View>

                  {/* Role selector */}
                  <View style={styles.roleToggle}>
                    <TouchableOpacity
                      style={[
                        styles.roleTab,
                        registerRole === 'BUYER' && styles.roleTabActive,
                      ]}
                      onPress={() => setRegisterRole('BUYER')}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="cart-outline" size={16} color={registerRole === 'BUYER' ? colors.secondary : colors.textSecondary} />
                      <Text style={[styles.roleLabel, registerRole === 'BUYER' && styles.roleLabelActive]}>Acheteur</Text>
                      <Text style={styles.roleBadge}>Gratuit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.roleTab,
                        registerRole === 'SELLER' && styles.roleTabSellerActive,
                      ]}
                      onPress={() => setRegisterRole('SELLER')}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="storefront-outline" size={16} color={registerRole === 'SELLER' ? colors.primary : colors.textSecondary} />
                      <Text style={[styles.roleLabel, registerRole === 'SELLER' && styles.roleLabelSellerActive]}>Vendeur</Text>
                      <Text style={[styles.roleBadge, styles.roleBadgeSeller]}>1000 FCFA</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Register button */}
                  <AnimatedPressable
                    style={[styles.primaryButton, loading && styles.buttonDisabled]}
                    onPress={handleEmailRegister}
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
                          <Ionicons name="rocket" size={18} color="#fff" />
                          <Text style={styles.primaryButtonText}>
                            {registerRole === 'BUYER' ? 'Créer mon compte acheteur' : 'Créer mon compte vendeur'}
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </AnimatedPressable>
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
  header: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  backButton: {
    position: 'absolute',
    left: spacing.md,
    top: spacing.xl,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...shadows.sm,
  },
  logoGlow: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    ...shadows.md,
  },
  logoInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
  },
  tagline: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },

  // ─── Auth mode toggle (Téléphone / Email) ────────────────────────
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

  // ─── Step indicator ──────────────────────────────────────────────────
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    gap: 6,
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
    width: 36,
    height: 2,
    backgroundColor: '#E0D5C8',
    borderRadius: 1,
  },
  stepLineActive: {
    backgroundColor: colors.primary,
  },
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: spacing.md,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },

  // ─── Form card ───────────────────────────────────────────────────────
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
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.lg,
    alignSelf: 'flex-start',
  },
  backLinkText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  // ─── Phone input ─────────────────────────────────────────────────────
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBF7F2',
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: '#EDE5DA',
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.lg,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    padding: spacing.md,
    color: colors.text,
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

  // ─── Profile inputs ──────────────────────────────────────────────────
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBF7F2',
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: '#EDE5DA',
    paddingHorizontal: spacing.md,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    padding: spacing.md,
    color: colors.text,
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

  // ─── Role selector (Acheteur / Vendeur) ───────────────────────────
  roleToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    borderRadius: borderRadius.lg,
    padding: 4,
    marginBottom: spacing.md,
    gap: 4,
  },
  roleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md - 2,
  },
  roleTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.secondary + '30',
  },
  roleTabSellerActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  roleLabelActive: {
    color: colors.secondary,
    fontWeight: '700',
  },
  roleLabelSellerActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  roleBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.success,
    backgroundColor: colors.success + '18',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  roleBadgeSeller: {
    color: colors.primary,
    backgroundColor: colors.primary + '18',
  },

  // ─── Success badge ───────────────────────────────────────────────────
  successBadge: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  successCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
});
