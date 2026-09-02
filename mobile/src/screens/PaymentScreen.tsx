import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';
import CountryPicker from '../components/CountryPicker';
import { DEFAULT_COUNTRY } from '../utils/countries';
import type { Country } from '../utils/countries';

interface PaymentProvider {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

const PAYMENT_PROVIDERS: PaymentProvider[] = [
  {
    id: 'ORANGE_MONEY',
    name: 'Orange Money',
    icon: 'phone-portrait',
    color: '#FF7900',
    description: 'Paiement mobile via Orange Money',
  },
  {
    id: 'MOOV_MONEY',
    name: 'Moov Money',
    icon: 'phone-portrait',
    color: '#0033A0',
    description: 'Paiement mobile via Moov Money',
  },
  {
    id: 'WAVE',
    name: 'Wave',
    icon: 'water',
    color: '#1A8CDB',
    description: 'Paiement mobile via Wave',
  },
];

interface ArticleSummary {
  id: string;
  titre: string;
  prix: number;
  photos?: string[];
  vendeur: { nom: string };
}

interface PaymentResult {
  transactionId: string;
  montant: number;
  provider: string;
}

interface Props {
  article: ArticleSummary;
  onBack: () => void;
  onPaymentComplete: (result: PaymentResult) => void;
}

export default function PaymentScreen({ article, onBack, onPaymentComplete }: Props) {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const formattedPrice = article.prix.toLocaleString('fr-FR');
  const commissionFasoMarket = article.prix * 0.005; // 0.5%
  const total = article.prix + commissionFasoMarket;

  async function handlePayment() {
    if (!selectedProvider) {
      Alert.alert('Sélection', 'Veuillez choisir un moyen de paiement');
      return;
    }
    if (!phoneNumber || phoneNumber.length < 8) {
      Alert.alert('Téléphone', 'Veuillez entrer un numéro de téléphone valide');
      return;
    }
    if (!agreed) {
      Alert.alert('Confirmation', 'Veuillez accepter les conditions');
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Créer une conversation si elle n'existe pas
      let conversationId = '';
      try {
        const conv = await api.conversations.create(article.id);
        conversationId = conv.id;
      } catch {
        // La conversation existe peut-être déjà
        const convs = await api.conversations.list();
        const existing = convs.find(
          (c: any) => c.articleId === article.id,
        );
        if (existing) conversationId = existing.id;
      }

      if (!conversationId) {
        throw new Error('Impossible de créer une conversation avec le vendeur');
      }

      // 2. Initier la transaction en escrow
      const transaction = await api.transactions.initiate({
        articleId: article.id,
        conversationId,
        montant: article.prix,
        moyenPaiement: selectedProvider,
      });

      // 3. Initier le paiement mobile money (CinetPay)
      const fullPhone = `${selectedCountry.code}${phoneNumber}`;
      const initiated = await api.payments.initiateMobileMoney(
        transaction.id,
        fullPhone,
        selectedProvider,
      );

      // Ouvrir la page de paiement sécurisée CinetPay
      if (initiated.paymentUrl) {
        Linking.openURL(initiated.paymentUrl).catch(() => {});
      }

      // Rediriger vers la confirmation
      onPaymentComplete({
        transactionId: transaction.id,
        montant: article.prix,
        provider: selectedProvider,
      });
    } catch (error: any) {
      const message = error?.data?.message || error?.message || 'Une erreur est survenue';
      Alert.alert('Erreur', message);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paiement sécurisé</Text>
        <View style={styles.headerRight} />
      </SafeAreaView>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Résumé de l'article */}
        <View style={styles.articleCard}>
          <View style={styles.articleImagePlaceholder}>
            <Ionicons name="pricetag" size={28} color={colors.primary} />
          </View>
          <View style={styles.articleInfo}>
            <Text style={styles.articleTitle} numberOfLines={2}>
              {article.titre}
            </Text>
            <Text style={styles.articleSeller}>Vendeur: {article.vendeur.nom}</Text>
            <Text style={styles.articlePrice}>{formattedPrice} FCFA</Text>
          </View>
        </View>

        {/* Sélection du provider */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Moyen de paiement</Text>
          <Text style={styles.sectionSubtitle}>
            Choisissez votre opérateur mobile money
          </Text>

          <View style={styles.providersList}>
            {PAYMENT_PROVIDERS.map((provider) => {
              const isSelected = selectedProvider === provider.id;
              return (
                <TouchableOpacity
                  key={provider.id}
                  style={[
                    styles.providerCard,
                    isSelected && {
                      borderColor: provider.color,
                      backgroundColor: `${provider.color}08`,
                    },
                  ]}
                  onPress={() => setSelectedProvider(provider.id)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.providerIcon,
                      { backgroundColor: provider.color + '15' },
                    ]}
                  >
                    <Ionicons
                      name={provider.icon as any}
                      size={28}
                      color={provider.color}
                    />
                  </View>
                  <View style={styles.providerInfo}>
                    <Text style={styles.providerName}>{provider.name}</Text>
                    <Text style={styles.providerDesc}>{provider.description}</Text>
                  </View>
                  <View
                    style={[
                      styles.radio,
                      isSelected && { borderColor: provider.color },
                    ]}
                  >
                    {isSelected && (
                      <View
                        style={[styles.radioInner, { backgroundColor: provider.color }]}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Numéro de téléphone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Numéro de téléphone</Text>
          <Text style={styles.sectionSubtitle}>
            Entrez votre numéro pour recevoir la demande de paiement
          </Text>

          <View style={styles.phoneInputContainer}>
            <CountryPicker
              selectedCountry={selectedCountry}
              onSelect={setSelectedCountry}
            />
            <TextInput
              style={styles.phoneInput}
              placeholder={selectedCountry.phoneFormat}
              placeholderTextColor={colors.disabled}
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={(text) => setPhoneNumber(text.replace(/[^0-9]/g, ''))}
              maxLength={selectedCountry.maxLength}
            />
          </View>
        </View>

        {/* Récapitulatif des frais */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Récapitulatif</Text>

          <View style={styles.feeCard}>
            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>Prix de l&apos;article</Text>
              <Text style={styles.feeValue}>{formattedPrice} FCFA</Text>
            </View>
            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>Commission FasoMarket (0.5%)</Text>
              <Text style={styles.feeValue}>{commissionFasoMarket.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} FCFA</Text>
            </View>
            <View style={[styles.feeRow, styles.feeTotalRow]}>
              <Text style={styles.feeTotalLabel}>Total à payer</Text>
              <Text style={styles.feeTotalValue}>
                {total.toLocaleString('fr-FR')} FCFA
              </Text>
            </View>
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="shield-checkmark" size={20} color={colors.secondary} />
            <Text style={styles.infoBoxText}>
              Paiement sécurisé via FasoMarket Escrow. Les fonds sont bloqués jusqu&apos;à
              confirmation de réception.
            </Text>
          </View>
        </View>

        {/* Conditions */}
        <TouchableOpacity
          style={styles.termsRow}
          onPress={() => setAgreed(!agreed)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
            {agreed && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
          <Text style={styles.termsText}>
            J&apos;accepte les{' '}
            <Text style={styles.termsLink}>conditions d&apos;utilisation</Text> et la{' '}
            <Text style={styles.termsLink}>politique de remboursement</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom Bar */}
      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <View style={styles.bottomContent}>
          <View style={styles.bottomTotal}>
            <Text style={styles.bottomTotalLabel}>Total</Text>
            <Text style={styles.bottomTotalPrice}>
              {total.toLocaleString('fr-FR')} FCFA
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.payButton,
              (!selectedProvider || !phoneNumber || !agreed || isProcessing) &&
                styles.payButtonDisabled,
            ]}
            onPress={handlePayment}
            disabled={!selectedProvider || !phoneNumber || !agreed || isProcessing}
          >
            {isProcessing ? (
              <View style={styles.processingRow}>
                <Ionicons name="hourglass" size={20} color={colors.textOnPrimary} />
                <Text style={styles.payButtonText}>Traitement...</Text>
              </View>
            ) : (
              <Text style={styles.payButtonText}>
                Payer {total.toLocaleString('fr-FR')} FCFA
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
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

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 120,
    gap: spacing.lg,
  },

  // Article summary card
  articleCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.sm,
  },
  articleImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  articleInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  articleTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  articleSeller: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  articlePrice: {
    ...typography.h3,
    color: colors.primary,
    marginTop: 4,
  },

  // Section
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
  },
  sectionSubtitle: {
    ...typography.bodySmall,
    marginTop: -4,
  },

  // Providers
  providersList: {
    gap: spacing.sm,
  },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: spacing.md,
  },
  providerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    ...typography.body,
    fontWeight: '600',
  },
  providerDesc: {
    ...typography.caption,
    marginTop: 2,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.disabled,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  // Phone input
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Fee recap
  feeCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.sm,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeLabel: {
    ...typography.bodySmall,
  },
  feeValue: {
    ...typography.body,
    fontWeight: '500',
  },
  feeTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  feeTotalLabel: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 17,
  },
  feeTotalValue: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '700',
  },

  // Info box
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.secondary + '30',
  },
  infoBoxText: {
    ...typography.bodySmall,
    flex: 1,
    lineHeight: 20,
  },

  // Terms
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.disabled,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  termsText: {
    ...typography.bodySmall,
    flex: 1,
    lineHeight: 20,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: '600',
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.lg,
  },
  bottomContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  bottomTotal: {
    flex: 1,
  },
  bottomTotalLabel: {
    ...typography.caption,
  },
  bottomTotalPrice: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '700',
  },
  payButton: {
    flex: 1.5,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  payButtonDisabled: {
    backgroundColor: colors.disabled,
    ...shadows.sm,
  },
  payButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
