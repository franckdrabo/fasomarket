import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { Conversation } from '../types';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

// Données mock pour le développement (utilise user?.id comme référence)
function createMockConversations(userId: string | undefined): Conversation[] {
  const moi = userId || 'current';
  return [
    {
      id: 'conv1',
      article: { id: '1', titre: 'Robe africaine wax - Taille M', prix: 15000, photos: [] },
      acheteur: { id: 'v1', nom: 'Alice K.' },
      vendeur: { id: moi, nom: 'Moi' },
      messages: [
        {
          id: 'm1', contenu: 'Bonjour, est-ce toujours disponible ?', type: 'TEXTE',
          timestamp: new Date(Date.now() - 3600000).toISOString(), lu: true, expediteurId: 'v1',
        },
      ],
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'conv2',
      article: { id: '2', titre: 'iPhone 13 Pro 256Go', prix: 450000, photos: [] },
      acheteur: { id: moi, nom: 'Moi' },
      vendeur: { id: 'v2', nom: 'Bob T.' },
      messages: [
        {
          id: 'm2', contenu: '💰 Proposition: 420000 FCFA', type: 'OFFRE',
          timestamp: new Date(Date.now() - 7200000).toISOString(), lu: false, expediteurId: 'v2',
        },
      ],
      updatedAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 'conv3',
      article: { id: '3', titre: 'Canapé 3 places en tissu beige', prix: 85000, photos: [] },
      acheteur: { id: 'v3', nom: 'Mariam D.' },
      vendeur: { id: moi, nom: 'Moi' },
      messages: [
        {
          id: 'm3', contenu: 'Super, merci !', type: 'TEXTE',
          timestamp: new Date(Date.now() - 86400000).toISOString(), lu: true, expediteurId: 'v3',
        },
      ],
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'conv4',
      article: { id: '4', titre: 'Sac à main en cuir véritable', prix: 25000, photos: [] },
      acheteur: { id: moi, nom: 'Moi' },
      vendeur: { id: 'v4', nom: 'Fatou S.' },
      messages: [
        {
          id: 'm4', contenu: 'D\'accord pour 25000 FCFA', type: 'TEXTE',
          timestamp: new Date(Date.now() - 172800000).toISOString(), lu: true, expediteurId: 'v4',
        },
      ],
      updatedAt: new Date(Date.now() - 172800000).toISOString(),
    },
  ];
}

interface Props {
  onConversationPress: (conversation: Conversation) => void;
}

export default function ConversationsListScreen({ onConversationPress }: Props) {
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>(
    () => createMockConversations(user?.id),
  );
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  async function fetchConversations() {
    setLoading(true);
    try {
      // En prod: appeler l'API réelle
      // const data = await api.conversations.list();
      // setConversations(data);
    } catch (error) {
      console.error('Erreur chargement conversations:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchConversations();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConversations();
    setRefreshing(false);
  }, []);

  function getOtherParticipant(conv: Conversation) {
    const isAcheteur = conv.acheteur.id === user?.id;
    return isAcheteur ? conv.vendeur : conv.acheteur;
  }

  function getLastMessage(conv: Conversation) {
    return conv.messages?.[0];
  }

  function getNonLuCount(conv: Conversation) {
    return conv.messages?.filter((m) => !m.lu && m.expediteurId !== user?.id).length || 0;
  }

  function getTimeAgo(dateString: string): string {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return "À l'instant";
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return `Il y a ${Math.floor(diffDays / 7)} sem`;
  }

  function renderConversation({ item }: { item: Conversation }) {
    const other = getOtherParticipant(item);
    const lastMsg = getLastMessage(item);
    const nonLu = getNonLuCount(item);
    const formattedPrice = item.article.prix.toLocaleString('fr-FR');

    const messagePreview = lastMsg
      ? lastMsg.type === 'OFFRE'
        ? `💰 Proposition: ${lastMsg.contenu}`
        : lastMsg.contenu
      : 'Aucun message';

    return (
      <TouchableOpacity
        style={styles.convItem}
        onPress={() => onConversationPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.avatar, nonLu > 0 && styles.avatarActive]}>
          <Ionicons name="person" size={22} color={nonLu > 0 ? colors.textOnPrimary : colors.textSecondary} />
        </View>
        <View style={styles.convContent}>
          <View style={styles.convHeader}>
            <Text style={[styles.convName, nonLu > 0 && styles.convNameUnread]}>
              {other.nom}
            </Text>
            {lastMsg && (
              <Text style={styles.convTime}>{getTimeAgo(lastMsg.timestamp)}</Text>
            )}
          </View>
          <View style={styles.convMeta}>
            <Text style={styles.articleRef} numberOfLines={1}>
              {item.article.titre} - {formattedPrice} FCFA
            </Text>
          </View>
          <View style={styles.convPreview}>
            <Text
              style={[styles.convMessage, nonLu > 0 && styles.convMessageUnread]}
              numberOfLines={1}
            >
              {messagePreview}
            </Text>
            {nonLu > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{nonLu}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  function renderEmpty() {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubbles-outline" size={64} color={colors.disabled} />
        <Text style={styles.emptyTitle}>Aucune conversation</Text>
        <Text style={styles.emptySubtitle}>
          Contactez un vendeur depuis une annonce{'\n'}pour démarrer une discussion
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <Text style={styles.headerSubtitle}>
          {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
        </Text>
      </SafeAreaView>

      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h2,
  },
  headerSubtitle: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  list: {
    paddingVertical: spacing.sm,
    flexGrow: 1,
  },

  // Item
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarActive: {
    backgroundColor: colors.primary,
  },
  convContent: {
    flex: 1,
  },
  convHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convName: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
  },
  convNameUnread: {
    fontWeight: '700',
    color: colors.text,
  },
  convTime: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  convMeta: {
    marginTop: 2,
  },
  articleRef: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  convPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  convMessage: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  convMessageUnread: {
    color: colors.text,
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: spacing.sm,
  },
  unreadText: {
    color: colors.textOnPrimary,
    fontSize: 12,
    fontWeight: '700',
  },

  // Empty
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    lineHeight: 20,
  },
});
