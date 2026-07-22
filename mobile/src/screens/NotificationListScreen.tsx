import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { getTimeAgo } from '../utils/date';
import { FadeInView } from '../components/animations';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

// ─── Types ─────────────────────────────────────────────────────────────────

interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string | null;
  data: Record<string, string> | null;
  status: string;
  fcmToken: string | null;
  errorMessage: string | null;
  dateCreation: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Icônes par type ───────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  payment_received: { icon: 'card', color: colors.primary },
  payment_confirmed: { icon: 'shield-checkmark', color: colors.success },
  payment_confirmed_buyer: { icon: 'shield-checkmark', color: colors.success },
  payment_released: { icon: 'cash', color: colors.success },
  payment_failed: { icon: 'close-circle', color: colors.error },
  payment_initiated: { icon: 'hourglass', color: colors.warning },
  dispute_opened: { icon: 'warning', color: colors.error },
  new_message: { icon: 'chatbubble', color: '#3498DB' },
  article_sold: { icon: 'checkmark-circle', color: colors.success },
  article_question: { icon: 'help-circle', color: colors.terracotta },
};

const DEFAULT_ICON = { icon: 'notifications', color: colors.textSecondary };

function getTypeIcon(type: string | null) {
  if (type && TYPE_ICONS[type]) return TYPE_ICONS[type];
  return DEFAULT_ICON;
}

// ─── Composant ─────────────────────────────────────────────────────────────

interface Props {
  onNotificationPress?: (notification: NotificationItem) => void;
  onBack?: () => void;
}

export default function NotificationListScreen({ onNotificationPress, onBack }: Props) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  // ─── Chargement ─────────────────────────────────────────────────────────

  const fetchNotifications = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    try {
      const response = await api.notifications.getHistory(pageNum, 20) as any;
      const data = response.data || response;

      if (Array.isArray(data)) {
        // Réponse plate (pas de wrapper pagination)
        setNotifications(append ? (prev) => [...prev, ...data] : data);
      } else if (data.data) {
        // Réponse avec pagination
        setNotifications(append ? (prev) => [...prev, ...data.data] : data.data);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Erreur chargement notifications:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await api.notifications.getUnreadCount() as any;
      setUnreadCount(response.count || 0);
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotifications(1);
    fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  // ─── Actions ────────────────────────────────────────────────────────────

  function handleRefresh() {
    setIsRefreshing(true);
    setPage(1);
    fetchNotifications(1);
    fetchUnreadCount();
  }

  function handleLoadMore() {
    if (isLoadingMore || !pagination || page >= pagination.totalPages) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNotifications(nextPage, true);
  }

  async function handleMarkAsRead(notification: NotificationItem) {
    if (notification.status === 'SENT') {
      try {
        await api.notifications.markAsRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, status: 'DELIVERED' } : n,
          ),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {}
    }
    onNotificationPress?.(notification);
  }

  async function handleMarkAllAsRead() {
    if (unreadCount === 0) return;

    setIsMarkingAll(true);
    try {
      await api.notifications.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => (n.status === 'SENT' ? { ...n, status: 'DELIVERED' } : n)),
      );
      setUnreadCount(0);
    } catch {
      Alert.alert('Erreur', 'Impossible de marquer tout comme lu');
    } finally {
      setIsMarkingAll(false);
    }
  }

  // ─── Rendu ──────────────────────────────────────────────────────────────

  function renderNotificationItem({ item }: { item: NotificationItem }) {
    const isUnread = item.status === 'SENT';
    const typeInfo = getTypeIcon(item.type);

    return (
      <TouchableOpacity
        style={[styles.notificationCard, isUnread && styles.notificationUnread]}
        onPress={() => handleMarkAsRead(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.typeIcon, { backgroundColor: typeInfo.color + '15' }]}>
          <Ionicons name={typeInfo.icon as any} size={22} color={typeInfo.color} />
        </View>

        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text
              style={[styles.notificationTitle, isUnread && styles.notificationTitleUnread]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text style={styles.notificationTime}>
              {getTimeAgo(item.dateCreation)}
            </Text>
          </View>

          <Text style={styles.notificationBody} numberOfLines={2}>
            {item.body}
          </Text>

          {isUnread && (
            <View style={styles.unreadDot}>
              <View style={styles.unreadDotInner} />
            </View>
          )}
        </View>

        <Ionicons name="chevron-forward" size={16} color={colors.disabled} />
      </TouchableOpacity>
    );
  }

  function renderHeader() {
    return (
      <View style={styles.headerContent}>
        {/* Stats bar */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{pagination?.total || notifications.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{unreadCount}</Text>
            <Text style={styles.statLabel}>Non lues</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.success }]}>
              {notifications.length - unreadCount}
            </Text>
            <Text style={styles.statLabel}>Lues</Text>
          </View>
        </View>

        {/* Mark all as read button */}
        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={handleMarkAllAsRead}
            disabled={isMarkingAll}
          >
            {isMarkingAll ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={18} color={colors.primary} />
                <Text style={styles.markAllText}>
                  Tout marquer comme lu ({unreadCount})
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  }

  function renderEmptyState() {
    if (isLoading) return null;
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIcon}>
          <Ionicons name="notifications-off-outline" size={48} color={colors.disabled} />
        </View>
        <Text style={styles.emptyTitle}>Aucune notification</Text>
        <Text style={styles.emptySubtitle}>
          Vous recevrez des notifications ici lorsque quelqu'un vous enverra un message,
          effectuera un paiement ou interagira avec vos annonces.
        </Text>
      </View>
    );
  }

  function renderFooter() {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.footerText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backButton} />
        )}
        <View style={styles.headerTitleRow}>
          <Ionicons name="notifications" size={22} color={colors.primary} />
          <Text style={styles.screenTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.backButton} />
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement des notifications...</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotificationItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={notifications.length > 0 ? renderHeader : null}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderFooter}
          contentContainerStyle={[
            styles.listContent,
            notifications.length === 0 && styles.listEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  screenTitle: {
    ...typography.h2,
  },
  headerBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 22,
    alignItems: 'center',
  },
  headerBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
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
    paddingBottom: spacing.xxl,
  },
  listEmpty: {
    flex: 1,
    justifyContent: 'center',
  },

  // Header content (stats + mark all)
  headerContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },

  // Stats
  statsBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    ...typography.caption,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },

  // Mark all button
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceVariant,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  markAllText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },

  // Notification card
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.md,
    ...shadows.sm,
  },
  notificationUnread: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    backgroundColor: colors.surface,
  },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationTitle: {
    ...typography.body,
    fontWeight: '500',
    flex: 1,
    marginRight: spacing.sm,
  },
  notificationTitleUnread: {
    fontWeight: '700',
    color: colors.text,
  },
  notificationTime: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textSecondary,
  },
  notificationBody: {
    ...typography.bodySmall,
    marginTop: 2,
    lineHeight: 18,
  },

  // Unread dot
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  unreadDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
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

  // Footer
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  footerText: {
    ...typography.caption,
  },
});
