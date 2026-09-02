import React, { useState, useEffect } from 'react';
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
  Linking,
} from 'react-native';
import Animated, { FadeIn, BounceIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../stores/authStore';
import { colors, spacing, borderRadius, shadows } from '../theme';
import CountryPicker from '../components/CountryPicker';
import { SUPPORTED_COUNTRIES, DEFAULT_COUNTRY } from '../utils/countries';
import type { Country } from '../utils/countries';

/**
 * Extrait le pays + numéro national depuis un numéro international (+22507…).
 * Retourne null si le numéro ne correspond à aucun pays supporté.
 */
function parseInternationalPhone(phone?: string | null): { country: Country; national: string } | null {
  if (!phone) return null;
  const p = phone.trim();
  if (!p.startsWith('+')) return null; // pseudo-téléphone (_email_…) ou format inconnu

  const country =
    SUPPORTED_COUNTRIES.slice()
      .sort((a, b) => b.code.length - a.code.length) // +225 avant +22 (collisions)
      .find((c) => p.startsWith(c.code)) || null;
  if (!country) return null;

  const national = p.slice(country.code.length);
  if (!/^\d+$/.test(national)) return null;
  return { country, national };
}

const OPERATEURS = [
  {
    id: 'ORANGE_MONEY',
    name: 'Orange Money',
    icon: 'phone-portrait',
    color: '#FF7900',
  },
  {
    id: 'MOOV_MONEY',
    name: 'Moov Money',
    icon: 'phone-portrait',
    color: '#0033A0',
  },
  {
    id: 'WAVE',
    name: 'Wave',
    icon: 'water',
    color: '#1A8CDB',
  },
];

interface Props {
  onComplete: () => void;
  onSkip?: () => void;
}

export default function SellerActivationScreen({ onComplete, onSkip }: Props) {
  const { user, initiateSellerActivation, confirmSellerActivation, refreshProfile, markSellerActivated } = useAuthStore();
  const [selectedOperator, setSelectedOperator] = useState<string | null>(null);

  // Pré-remplir le numéro Mobile Money avec celui du compte si disponible (+22507…)
  const parsedPhone = parseInternationalPhone(user?.phone);
  const [selectedCountry, setSelectedCountry] = useState<Country>(() => parsedPhone?.country ?? DEFAULT_COUNTRY);
  const [phoneNumber, setPhoneNumber] = useState(() => parsedPhone?.national ?? '');
  const [loading, setLoading] = useState(false);
  const [paymentRef, setPaymentRef] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  // Garde de sécurité : si le store indique déjà un compte activé
  // (état obsolète), ne pas afficher l'écran de paiement.
  useEffect(() => {
    if (user?.sellerFeePaid) {
      onComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePay() {
    if (!selectedOperator) {
      Alert.alert('Opérateur', 'Veuillez sélectionner votre opérateur Mobile Money');
      return;
    }
    if (!phoneNumber || phoneNumber.length < 8) {
      Alert.alert('Téléphone', 'Veuillez entrer un numéro valide');
      return;
    }

    // Si un paiement est déjà initié (en attente de confirmation), ne pas ré-initier
    if (paymentRef) {
      if (paymentUrl) {
        // Rouvrir la page de paiement si l'utilisateur l'a quittée sans payer
        Linking.openURL(paymentUrl).catch(() => {});
      }
      askForPhoneConfirmation();
      return;
    }

    setLoading(true);
    try {
      const fullPhone = `${selectedCountry.code}${phoneNumber}`;
      // Étape 1 : initier le paiement de 1000 FCFA via CinetPay
      const { reference, paymentUrl: url } = await initiateSellerActivation(fullPhone, selectedOperator);
      setPaymentRef(reference);
      setPaymentUrl(url || null);

      // Mode réel : ouvrir la page de paiement sécurisée CinetPay
      // puis attendre la confirmation manuelle de l'utilisateur
      if (url) {
        Linking.openURL(url).catch(() => {});
        askForPhoneConfirmation();
        return;
      }

      // Mode simulation (dev, pas de clé CinetPay) : pas de page externe.
      // On confirme automatiquement le paiement simulé.
      await checkAndActivate(reference);
    } catch (error: any) {
      const message = error?.message || 'Le paiement a échoué. Veuillez réessayer.';

      // Frais déjà réglés (ex: webhook reçu avant la confirmation, autre appareil,
      // store obsolète) → re-synchroniser le profil et clôturer l'écran.
      if (/déjà payé/i.test(message)) {
        await refreshProfile().catch(() => {});
        markSellerActivated();
        Alert.alert(
          'Compte déjà activé 🎉',
          'Votre compte vendeur est déjà activé. Vous pouvez maintenant publier des annonces.',
          [{ text: "C'est parti !", onPress: onComplete }],
        );
        return;
      }

      Alert.alert('Erreur', message);
    } finally {
      setLoading(false);
    }
  }

  /** Demande à l'utilisateur de confirmer le paiement sur son téléphone (mode réel) */
  function askForPhoneConfirmation() {
    Alert.alert(
      'Paiement initié',
      'Complétez le paiement de 1 000 FCFA sur la page sécurisée ouverte, puis appuyez sur OK.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'OK, confirmé', onPress: () => checkAndActivate(paymentRef!) },
      ],
    );
  }

  /** Vérifie le paiement auprès du provider et active le compte si confirmé */
  async function checkAndActivate(ref: string) {
    setLoading(true);
    try {
      await confirmSellerActivation(ref);
      // Éviter tout état obsolète après activation réussie
      setPaymentRef(null);
      setPaymentUrl(null);
      Alert.alert(
        'Compte vendeur activé ! 🎉',
        'Votre paiement a été confirmé. Vous pouvez maintenant publier des annonces et vendre sur Bazario.',
        [{ text: "C'est parti !", onPress: onComplete }],
      );
    } catch (confirmError: any) {
      Alert.alert(
        'Paiement non confirmé',
        confirmError?.message || 'Le paiement n\'a pas pu être confirmé. Veuillez réessayer.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Vérifier à nouveau',
            onPress: () => {
              if (paymentUrl) Linking.openURL(paymentUrl).catch(() => {});
              askForPhoneConfirmation();
            },
          },
        ],
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={['#FFF8F0', '#FFE8D6']} style={styles.container}>
      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeIn.duration(600)} style={styles.content}>
            {/* Icone de bienvenue */}
            <Animated.View entering={BounceIn.duration(800)} style={styles.iconWrapper}>
              <LinearGradient
                colors={['#FF6B35', '#E55A2B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconGradient}
              >
                <Ionicons name="storefront" size={40} color="#fff" />
              </LinearGradient>
            </Animated.View>

            <Text style={styles.title}>Activation compte vendeur</Text>
            <Text style={styles.subtitle}>
              Pour commencer à vendre, veuillez payer les frais d&apos;activation uniques de{' '}
              <Text style={styles.highlight}>1 000 FCFA</Text>
            </Text>

            {/* Carte d'info */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Ionicons name="person-outline" size={18} color={colors.primary} />
                <Text style={styles.infoText}>{user?.nom || 'Vous'}</Text>
              </View>
              {user?.email && (
                <View style={styles.infoRow}>
                  <Ionicons name="mail-outline" size={18} color={colors.primary} />
                  <Text style={styles.infoText}>{user.email}</Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Ionicons name="pricetag-outline" size={18} color={colors.primary} />
                <Text style={styles.infoText}>1 000 FCFA (paiement unique)</Text>
              </View>
            </View>

            {/* Sélection de l'opérateur */}
            <Text style={styles.sectionTitle}>Choisissez votre opérateur</Text>
            <View style={styles.operatorList}>
              {OPERATEURS.map((op) => {
                const isSelected = selectedOperator === op.id;
                return (
                  <TouchableOpacity
                    key={op.id}
                    style={[
                      styles.operatorCard,
                      isSelected && { borderColor: op.color, backgroundColor: `${op.color}10` },
                    ]}
                    onPress={() => setSelectedOperator(op.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.operatorIcon, { backgroundColor: op.color + '20' }]}>
                      <Ionicons name={op.icon as any} size={24} color={op.color} />
                    </View>
                    <Text style={[styles.operatorName, isSelected && { color: op.color }]}>
                      {op.name}
                    </Text>
                    <View style={[styles.radio, isSelected && { borderColor: op.color }]}>
                      {isSelected && <View style={[styles.radioInner, { backgroundColor: op.color }]} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Numéro de téléphone */}
            <Text style={styles.sectionTitle}>Votre numéro Mobile Money</Text>
            <View style={styles.phoneInputContainer}>
              <CountryPicker
                selectedCountry={selectedCountry}
                onSelect={setSelectedCountry}
              />
              <TextInput
                style={styles.phoneInput}
                placeholder={selectedCountry.phoneFormat}
                placeholderTextColor="#C4B5A5"
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={(text) => setPhoneNumber(text.replace(/[^0-9]/g, ''))}
                maxLength={selectedCountry.maxLength}
              />
            </View>

            {/* Bouton paiement */}
            <TouchableOpacity
              style={[styles.payButton, loading && styles.buttonDisabled]}
              onPress={handlePay}
              disabled={loading}
              activeOpacity={0.85}
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
                    <Ionicons name="lock-open" size={20} color="#fff" />
                    <Text style={styles.payButtonText}>
                      Payer 1 000 FCFA
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Ignorer */}
            {onSkip && (
              <TouchableOpacity
                style={styles.skipButton}
                onPress={onSkip}
                activeOpacity={0.7}
              >
                <Text style={styles.skipText}>
                  Plus tard — je ne peux pas vendre sans activation
                </Text>
              </TouchableOpacity>
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
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },

  // Décorations
  decorCircle1: {
    position: 'absolute',
    top: -60,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#FF6B35',
    opacity: 0.06,
  },
  decorCircle2: {
    position: 'absolute',
    bottom: 100,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#2ECC71',
    opacity: 0.05,
  },

  // Icone
  iconWrapper: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconGradient: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },

  // Texte
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  highlight: {
    fontWeight: '700',
    color: colors.primary,
  },

  // Info card
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },

  // Section
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },

  // Opérateurs
  operatorList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  operatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: '#EDE5DA',
    gap: spacing.md,
  },
  operatorIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatorName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.disabled,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
  },

  // Téléphone
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: '#EDE5DA',
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xl,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    padding: spacing.md,
    color: colors.text,
  },

  // Bouton
  payButton: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  gradientButton: {
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  payButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Skip
  skipButton: {
    alignItems: 'center',
    padding: spacing.md,
  },
  skipText: {
    fontSize: 13,
    color: '#9E9488',
    fontWeight: '400',
    textAlign: 'center',
  },
});
