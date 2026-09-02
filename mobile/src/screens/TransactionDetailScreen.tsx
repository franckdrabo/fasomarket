import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import {
  TransactionData,
  STATUT_ESCROW_LABELS,
  STATUT_ESCROW_COLORS,
  MOYEN_PAIEMENT_LABELS,
} from '../types';
import { FadeInView } from '../components/animations';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

interface Props {
  transaction: TransactionData;
  onBack: () => void;
  onRefresh?: () => void;
}

export default function TransactionDetailScreen({ transaction, onBack, onRefresh }: Props) {
  const { user } = useAuthStore();
  const [showDisputeInput, setShowDisputeInput] = useState(false);
  const [disputeMotif, setDisputeMotif] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  const isBuyer = transaction.acheteur.id === user?.id;
  const _otherParty = isBuyer ? transaction.vendeur : transaction.acheteur;
  const statusColor = STATUT_ESCROW_COLORS[transaction.statutEscrow] || colors.textSecondary;
  const statusLabel = STATUT_ESCROW_LABELS[transaction.statutEscrow] || transaction.statutEscrow;

  // ─── Actions ─────────────────────────────────────────────────────────

  async function handleConfirmReception() {
    Alert.alert(
      'Confirmer la réception',
      `Confirmez-vous avoir reçu "${transaction.article.titre}" ? Cette action libérera les fonds vers ${transaction.vendeur.nom}.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Oui, confirmer',
          style: 'destructive',
          onPress: async () => {
            setIsActionLoading(true);
            try {
              await api.transactions.confirmReception(transaction.id);
              Alert.alert('✅ Fonds libérés !', 'Le vendeur a été notifié.');
              onRefresh?.();
              onBack();
            } catch (error: any) {
              Alert.alert('Erreur', error?.data?.message || 'Une erreur est survenue');
            } finally {
              setIsActionLoading(false);
            }
          },
        },
      ],
    );
  }

  async function handleOpenDispute() {
    if (!disputeMotif.trim() || disputeMotif.trim().length < 10) {
      Alert.alert('Motif requis', 'Veuillez décrire le problème (minimum 10 caractères)');
      return;
    }

    setIsActionLoading(true);
    try {
      await api.transactions.openDispute(transaction.id, disputeMotif.trim());
      Alert.alert(
        '⚠️ Litige ouvert',
        'Un litige a été ouvert. L\'équipe Bazario va traiter votre dossier sous 48h.',
      );
      setShowDisputeInput(false);
      setDisputeMotif('');
      onRefresh?.();
    } catch (error: any) {
      Alert.alert('Erreur', error?.data?.message || 'Une erreur est survenue');
    } finally {
      setIsActionLoading(false);
    }
  }

  function handleLeaveReview() {
    Alert.alert('Laisser un avis', 'Cette fonctionnalité sera bientôt disponible !');
  }

  // ─── État du timeline ────────────────────────────────────────────────

  const timelineSteps = [
    { label: 'Paiement initié', done: true, date: transaction.dateCreation },
    {
      label: 'Paiement confirmé',
      done: transaction.statutEscrow !== 'EN_ATTENTE',
      date: transaction.statutEscrow !== 'EN_ATTENTE' ? transaction.dateCreation : undefined,
    },
    {
      label: 'Expédition / Remise',
      done: transaction.statutEscrow === 'LIBERE' || transaction.statutEscrow === 'LITIGE',
    },
    {
      label: 'Réception confirmée',
      done: transaction.statutEscrow === 'LIBERE',
      date: transaction.dateValidation,
    },
  ];

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détail transaction</Text>
        <View style={styles.headerRight} />
      </SafeAreaView>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Status hero */}
        <FadeInView duration={300}>
          <View style={[styles.heroCard, { borderLeftColor: statusColor }]}>
            <View style={[styles.heroIcon, { backgroundColor: statusColor + '15' }]}>
              <Ionicons
                name={
                  transaction.statutEscrow === 'LIBERE' ? 'checkmark-circle' :
                  transaction.statutEscrow === 'LITIGE' ? 'warning' :
                  transaction.statutEscrow === 'REMBOURSE' ? 'refresh' :
                  'shield-checkmark'
                }
                size={32}
                color={statusColor}
              />
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroStatus}>{statusLabel}</Text>
              <Text style={styles.heroAmount}>
                {transaction.montant.toLocaleString('fr-FR')} FCFA
              </Text>
              <Text style={styles.heroMethod}>
                via {MOYEN_PAIEMENT_LABELS[transaction.moyenPaiement] || transaction.moyenPaiement}
              </Text>
            </View>
          </View>
        </FadeInView>

        {/* Timeline */}
        <FadeInView duration={400}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Suivi de la transaction</Text>
            <View style={styles.timeline}>
              {timelineSteps.map((step, index) => (
                <View key={index} style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <View
                      style={[
                        styles.timelineDot,
                        step.done && styles.timelineDotDone,
                        !step.done && styles.timelineDotPending,
                      ]}
                    />
                    {index < timelineSteps.length - 1 && (
                      <View
                        style={[
                          styles.timelineLine,
                          step.done && styles.timelineLineDone,
                        ]}
                      />
                    )}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text
                      style={[
                        styles.timelineLabel,
                        step.done && styles.timelineLabelDone,
                      ]}
                    >
                      {step.label}
                    </Text>
                    {step.date && (
                      <Text style={styles.timelineDate}>
                        {new Date(step.date).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </FadeInView>

        {/* Article info */}
        <FadeInView duration={500}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Article</Text>
            <View style={styles.articleCard}>
              <View style={styles.articleThumb}>
                {transaction.article.photos?.[0] ? (
                  <View style={[styles.thumbImage, { backgroundColor: colors.surfaceVariant }]}>
                    <Ionicons name="image" size={24} color={colors.disabled} />
                  </View>
                ) : (
                  <View style={[styles.thumbImage, styles.thumbPlaceholder]}>
                    <Ionicons name="pricetag" size={24} color={colors.primary} />
                  </View>
                )}
              </View>
              <View style={styles.articleInfo}>
                <Text style={styles.articleTitle}>{transaction.article.titre}</Text>
                <Text style={styles.articlePrice}>
                  {transaction.article.prix.toLocaleString('fr-FR')} FCFA
                </Text>
              </View>
            </View>
          </View>
        </FadeInView>

        {/* Parties */}
        <FadeInView duration={600}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Participants</Text>
            <View style={styles.partiesCard}>
              <View style={styles.partyRow}>
                <View style={styles.partyAvatar}>
                  <Ionicons name="person" size={20} color={colors.primary} />
                </View>
                <View style={styles.partyInfo}>
                  <Text style={styles.partyRole}>
                    {isBuyer ? 'Vous (Acheteur)' : 'Acheteur'}
                  </Text>
                  <Text style={styles.partyName}>{transaction.acheteur.nom}</Text>
                </View>
                {isBuyer && (
                  <View style={styles.partyBadge}>
                    <Text style={styles.partyBadgeText}>Moi</Text>
                  </View>
                )}
              </View>
              <View style={styles.partyDivider} />
              <View style={styles.partyRow}>
                <View style={styles.partyAvatar}>
                  <Ionicons name="person" size={20} color={colors.secondary} />
                </View>
                <View style={styles.partyInfo}>
                  <Text style={styles.partyRole}>
                    {isBuyer ? 'Vendeur' : 'Vous (Vendeur)'}
                  </Text>
                  <Text style={styles.partyName}>{transaction.vendeur.nom}</Text>
                </View>
                {!isBuyer && (
                  <View style={styles.partyBadge}>
                    <Text style={styles.partyBadgeText}>Moi</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </FadeInView>

        {/* Transaction details */}
        <FadeInView duration={700}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Détails financiers</Text>
            <View style={styles.detailsCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Montant</Text>
                <Text style={styles.detailValue}>
                  {transaction.montant.toLocaleString('fr-FR')} FCFA
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Frais de service (5%)</Text>
                <Text style={styles.detailValue}>
                  {transaction.fraisService.toLocaleString('fr-FR')} FCFA
                </Text>
              </View>
              <View style={[styles.detailRow, styles.detailTotalRow]}>
                <Text style={styles.detailTotalLabel}>Total</Text>
                <Text style={styles.detailTotalValue}>
                  {(transaction.montant + transaction.fraisService).toLocaleString('fr-FR')} FCFA
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Moyen de paiement</Text>
                <Text style={styles.detailValue}>
                  {MOYEN_PAIEMENT_LABELS[transaction.moyenPaiement] || transaction.moyenPaiement}
                </Text>
              </View>
              {transaction.referencePaiement && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Référence</Text>
                  <Text style={[styles.detailValue, styles.referenceText]} selectable>
                    {transaction.referencePaiement}
                  </Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Date de création</Text>
                <Text style={styles.detailValue}>
                  {new Date(transaction.dateCreation).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
              </View>
              {transaction.dateLimite && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date limite</Text>
                  <Text style={styles.detailValue}>
                    {new Date(transaction.dateLimite).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </FadeInView>

        {/* Dispute info */}
        {transaction.motifLitige && (
          <FadeInView duration={800}>
            <View style={styles.section}>
              <View style={styles.disputeCard}>
                <View style={styles.disputeHeader}>
                  <Ionicons name="warning" size={20} color={colors.error} />
                  <Text style={styles.disputeTitle}>Motif du litige</Text>
                </View>
                <Text style={styles.disputeText}>{transaction.motifLitige}</Text>
              </View>
            </View>
          </FadeInView>
        )}

        {/* Actions */}
        <FadeInView duration={900}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions</Text>
            <View style={styles.actionsCard}>
              {/* Confirmer réception (acheteur uniquement, quand BLOQUE) */}
              {isBuyer && transaction.statutEscrow === 'BLOQUE' && (
                <TouchableOpacity
                  style={[styles.mainAction, styles.actionConfirm]}
                  onPress={handleConfirmReception}
                  disabled={isActionLoading}
                >
                  <Ionicons name="checkmark-circle" size={22} color={colors.textOnPrimary} />
                  <Text style={styles.mainActionText}>Confirmer la réception</Text>
                </TouchableOpacity>
              )}

              {/* Ouvrir un litige (quand BLOQUE) */}
              {transaction.statutEscrow === 'BLOQUE' && (
                <View>
                  {!showDisputeInput ? (
                    <TouchableOpacity
                      style={styles.secondaryAction}
                      onPress={() => setShowDisputeInput(true)}
                    >
                      <Ionicons name="warning-outline" size={20} color={colors.error} />
                      <Text style={styles.secondaryActionText}>Ouvrir un litige</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.disputeInputContainer}>
                      <Text style={styles.disputeInputLabel}>
                        Décrivez le problème rencontré :
                      </Text>
                      <TextInput
                        style={styles.disputeInput}
                        placeholder="Article non reçu, endommagé, pas conforme..."
                        placeholderTextColor={colors.disabled}
                        multiline
                        numberOfLines={3}
                        value={disputeMotif}
                        onChangeText={setDisputeMotif}
                        maxLength={500}
                      />
                      <View style={styles.disputeActions}>
                        <TouchableOpacity
                          style={styles.cancelButton}
                          onPress={() => { setShowDisputeInput(false); setDisputeMotif(''); }}
                        >
                          <Text style={styles.cancelButtonText}>Annuler</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.submitDisputeButton,
                            (!disputeMotif.trim() || disputeMotif.trim().length < 10) &&
                              styles.submitDisputeDisabled,
                          ]}
                          onPress={handleOpenDispute}
                          disabled={!disputeMotif.trim() || disputeMotif.trim().length < 10 || isActionLoading}
                        >
                          <Text style={styles.submitDisputeText}>Ouvrir le litige</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Laisser un avis (quand LIBERE) */}
              {transaction.statutEscrow === 'LIBERE' && !transaction.avis && (
                <TouchableOpacity
                  style={styles.secondaryAction}
                  onPress={handleLeaveReview}
                >
                  <Ionicons name="star-outline" size={20} color={colors.accent} />
                  <Text style={[styles.secondaryActionText, { color: colors.accent }]}>
                    Laisser un avis
                  </Text>
                </TouchableOpacity>
              )}

              {/* Avis déjà laissé */}
              {transaction.avis && (
                <View style={styles.reviewDone}>
                  <Ionicons name="star" size={18} color={colors.accent} />
                  <Text style={styles.reviewDoneText}>
                    Avis laissé • {transaction.avis.note}/5
                  </Text>
                </View>
              )}

              {/* Aucune action disponible */}
              {transaction.statutEscrow === 'EN_ATTENTE' && (
                <View style={styles.noAction}>
                  <Ionicons name="hourglass" size={20} color={colors.textSecondary} />
                  <Text style={styles.noActionText}>
                    En attente de confirmation du paiement...
                  </Text>
                </View>
              )}
              {transaction.statutEscrow === 'REMBOURSE' && (
                <View style={styles.noAction}>
                  <Ionicons name="refresh" size={20} color={colors.textSecondary} />
                  <Text style={styles.noActionText}>
                    Cette transaction a été remboursée.
                  </Text>
                </View>
              )}
            </View>
          </View>
        </FadeInView>
      </ScrollView>
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
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },

  // Hero
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderLeftWidth: 4,
    ...shadows.md,
    gap: spacing.md,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfo: {
    flex: 1,
  },
  heroStatus: {
    ...typography.h3,
  },
  heroAmount: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  heroMethod: {
    ...typography.bodySmall,
    marginTop: 2,
  },

  // Section
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
  },

  // Timeline
  timeline: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  timelineRow: {
    flexDirection: 'row',
  },
  timelineLeft: {
    alignItems: 'center',
    width: 24,
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  timelineDotDone: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  timelineDotPending: {
    backgroundColor: colors.surface,
    borderColor: colors.disabled,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 2,
  },
  timelineLineDone: {
    backgroundColor: colors.secondary + '40',
  },
  timelineContent: {
    flex: 1,
    marginLeft: spacing.md,
    paddingBottom: spacing.lg,
  },
  timelineLabel: {
    ...typography.body,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  timelineLabelDone: {
    color: colors.text,
    fontWeight: '600',
  },
  timelineDate: {
    ...typography.caption,
    marginTop: 2,
  },

  // Article
  articleCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.sm,
  },
  articleThumb: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlaceholder: {
    backgroundColor: colors.surfaceVariant,
  },
  articleInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  articleTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  articlePrice: {
    ...typography.h3,
    color: colors.primary,
    marginTop: 4,
  },

  // Parties
  partiesCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  partyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  partyDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
    marginLeft: 44,
  },
  partyAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partyInfo: {
    flex: 1,
  },
  partyRole: {
    ...typography.caption,
  },
  partyName: {
    ...typography.body,
    fontWeight: '600',
  },
  partyBadge: {
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  partyBadgeText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primary,
  },

  // Financial details
  detailsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    ...typography.bodySmall,
  },
  detailValue: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  detailTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  detailTotalLabel: {
    ...typography.body,
    fontWeight: '700',
  },
  detailTotalValue: {
    ...typography.body,
    fontWeight: '700',
    color: colors.primary,
  },
  referenceText: {
    fontSize: 11,
    color: colors.textSecondary,
  },

  // Dispute
  disputeCard: {
    backgroundColor: colors.error + '08',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.error + '20',
  },
  disputeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  disputeTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.error,
  },
  disputeText: {
    ...typography.bodySmall,
    lineHeight: 20,
  },

  // Actions
  actionsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.sm,
  },
  mainAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  actionConfirm: {
    backgroundColor: colors.secondary,
  },
  mainActionText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error + '30',
  },
  secondaryActionText: {
    ...typography.button,
    color: colors.error,
  },

  // Dispute input
  disputeInputContainer: {
    gap: spacing.sm,
  },
  disputeInputLabel: {
    ...typography.bodySmall,
    fontWeight: '500',
  },
  disputeInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  disputeActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    ...typography.button,
    color: colors.textSecondary,
  },
  submitDisputeButton: {
    flex: 2,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.error,
  },
  submitDisputeDisabled: {
    backgroundColor: colors.disabled,
  },
  submitDisputeText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },

  // Review
  reviewDone: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  reviewDoneText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  // No action
  noAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  noActionText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
