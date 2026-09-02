import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { TransactionData, STATUT_ESCROW_LABELS, STATUT_ESCROW_COLORS, MOYEN_PAIEMENT_LABELS } from '../types';
import { getTimeAgo } from '../utils/date';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

interface Props {
  onTransactionPress: (transaction: TransactionData) => void;
}

export default function TransactionHistoryScreen({ onTransactionPress }: Props) {
  const [activeTab, setActiveTab] = useState<'achats' | 'ventes'>('achats');
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user } = useAuthStore();

  const fetchTransactions = useCallback(async () => {
    try {
      const data = await api.transactions.list();
      setTransactions(data as TransactionData[]);
    } catch (error) {
      console.error('Erreur chargement transactions:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  function handleRefresh() {
    setIsRefreshing(true);
    fetchTransactions();
  }

  const filteredTransactions = transactions.filter((t) =>
    activeTab === 'achats'
      ? t.acheteur.id === user?.id
      : t.vendeur.id === user?.id,
  );

  function renderTransactionCard({ item }: { item: TransactionData }) {
    const isBuyer = item.acheteur.id === user?.id;
    const otherParty = isBuyer ? item.vendeur : item.acheteur;
    const statusColor = STATUT_ESCROW_COLORS[item.statutEscrow] || colors.textSecondary;
    const statusLabel = STATUT_ESCROW_LABELS[item.statutEscrow] || item.statutEscrow;

    return (
      <TouchableOpacity
        style={styles.transactionCard}
        onPress={() => onTransactionPress(item)}
        activeOpacity={0.7}
      >
        {/* Article thumbnail + infos */}
        <View style={styles.cardRow}>
          <View style={styles.articleThumb}>
            {item.article.photos?.[0] ? (
              <View style={[styles.thumbImage, { backgroundColor: colors.surfaceVariant }]}>
                <Ionicons name="image" size={20} color={colors.disabled} />
              </View>
            ) : (
              <View style={[styles.thumbImage, styles.thumbPlaceholder]}>
                <Ionicons name="pricetag" size={20} color={colors.primary} />
              </View>
            )}
          </View>

          <View style={styles.cardInfo}>
            <Text style={styles.articleTitle} numberOfLines={1}>
              {item.article.titre}
            </Text>
            <Text style={styles.otherParty}>
              {isBuyer ? 'Vendeur' : 'Acheteur'} : {otherParty.nom}
            </Text>
            <Text style={styles.price}>
              {item.montant.toLocaleString('fr-FR')} FCFA
            </Text>
            <Text style={styles.paymentMethod}>
              {MOYEN_PAIEMENT_LABELS[item.moyenPaiement] || item.moyenPaiement}
            </Text>
          </View>

          <View style={styles.cardRight}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusLabel, { color: statusColor }]}>
                {statusLabel}
              </Text>
            </View>
            <Text style={styles.dateText}>{getTimeAgo(item.dateCreation)}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.disabled} />
          </View>
        </View>

        {/* Actions rapides selon le statut */}
        {item.statutEscrow === 'BLOQUE' && isBuyer && (
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onTransactionPress(item)}
            >
              <Ionicons name="checkmark-circle" size={16} color={colors.secondary} />
              <Text style={styles.actionButtonText}>Confirmer réception</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  function renderEmptyState() {
    const icon = activeTab === 'achats' ? 'cart-outline' : 'bag-outline';
    const title = activeTab === 'achats' ? 'Aucun achat' : 'Aucune vente';
    const subtitle = activeTab === 'achats'
      ? 'Vous n\'avez pas encore effectué d\'achat. Parcourez les articles et effectuez votre premier achat !'
      : 'Vous n\'avez pas encore vendu d\'article. Publiez votre première annonce !';

    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIcon}>
          <Ionicons name={icon as any} size={48} color={colors.disabled} />
        </View>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptySubtitle}>{subtitle}</Text>
      </View>
    );
  }

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

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Mes transactions</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'achats' && styles.tabActive]}
          onPress={() => setActiveTab('achats')}
        >
          <Ionicons
            name="cart-outline"
            size={18}
            color={activeTab === 'achats' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.tabLabel, activeTab === 'achats' && styles.tabLabelActive]}>
            Mes achats
          </Text>
          {transactions.filter((t) => t.acheteur.id === user?.id).length > 0 && (
            <View style={styles.tabCount}>
              <Text style={styles.tabCountText}>
                {transactions.filter((t) => t.acheteur.id === user?.id).length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'ventes' && styles.tabActive]}
          onPress={() => setActiveTab('ventes')}
        >
          <Ionicons
            name="bag-outline"
            size={18}
            color={activeTab === 'ventes' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.tabLabel, activeTab === 'ventes' && styles.tabLabelActive]}>
            Mes ventes
          </Text>
          {transactions.filter((t) => t.vendeur.id === user?.id).length > 0 && (
            <View style={styles.tabCount}>
              <Text style={styles.tabCountText}>
                {transactions.filter((t) => t.vendeur.id === user?.id).length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Liste */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement des transactions...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          renderItem={renderTransactionCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            filteredTransactions.length === 0 && styles.listEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Decorative circles
  decorCircle1: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#FF6B35',
    opacity: 0.08,
  },
  decorCircle2: {
    position: 'absolute',
    bottom: 100,
    left: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2ECC71',
    opacity: 0.05,
  },

  // Header
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  screenTitle: {
    ...typography.h2,
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 3,
    ...shadows.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  tabActive: {
    backgroundColor: colors.surfaceVariant,
  },
  tabLabel: {
    ...typography.bodySmall,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  tabCount: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  tabCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.bodySmall,
  },

  // List
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  listEmpty: {
    flex: 1,
    justifyContent: 'center',
  },

  // Transaction card
  transactionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  articleThumb: {
    width: 60,
    height: 60,
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
  cardInfo: {
    flex: 1,
  },
  articleTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  otherParty: {
    ...typography.caption,
    marginTop: 2,
  },
  price: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 4,
  },
  paymentMethod: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  dateText: {
    ...typography.caption,
    fontSize: 10,
  },

  // Quick actions
  quickActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.secondary + '10',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
  },
  actionButtonText: {
    ...typography.caption,
    color: colors.secondary,
    fontWeight: '600',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
