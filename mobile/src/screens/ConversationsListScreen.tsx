import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { Conversation } from '../types';
import EmptyState from '../components/EmptyState';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

// Données mock pour le développement
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
          id: 'm4', contenu: "D'accord pour 25000 FCFA", type: 'TEXTE',
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
      let loaded: Conversation[];

      try {
        // Interroger le vrai backend
        const data = await api.conversations.list() as any;
        loaded = Array.isArray(data) ? data : data.data || [];
      } catch (apiError) {
        // Backend injoignable → repli sur les conversations de démo
        console.warn('Conversations: backend injoignable, démo affichée');
        loaded = createMockConversations(user?.id);
      }

      setConversations(loaded);
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

  function renderConversation({ item, index }: { item: Conversation; index: number }) {
    const other = getOtherParticipant(item);
    const lastMsg = getLastMessage(item);
    const nonLu = getNonLuCount(item);
    const formattedPrice = item.article.prix.toLocaleString('fr-FR');

    const messagePreview = lastMsg
      ? lastMsg.type === 'OFFRE'
        ? `💰 ${lastMsg.contenu}`
        : lastMsg.contenu
      : 'Aucun message';

    return (
      <Animated.View entering={FadeIn.duration(400).delay(index * 80)}>
        <TouchableOpacity
          style={styles.convItem}
          onPress={() => onConversationPress(item)}
          activeOpacity={0.7}
        >
          <View style={[styles.avatar, nonLu > 0 && styles.avatarActive]}>
            {other.avatar ? (
              <Image source={{ uri: other.avatar }} style={styles.avatarImage} />
            ) : (
              <Ionicons
                name="person"
                size={22}
                color={nonLu > 0 ? colors.textOnPrimary : colors.primary}
              />
            )}
          </View>
          <View style={styles.convContent}>
            <View style={styles.convHeader}>
              <Text style={[styles.convName, nonLu > 0 && styles.convNameUnread]} numberOfLines={1}>
                {other.nom}
              </Text>
              {lastMsg && (
                <Text style={styles.convTime}>{getTimeAgo(lastMsg.timestamp)}</Text>
              )}
            </View>
            <Text style={styles.articleRef} numberOfLines={1}>
              {item.article.titre} - {formattedPrice} FCFA
            </Text>
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
          <Ionicons name="chevron-forward" size={18} color={colors.disabled} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </Animated.View>
    );
  }

  function renderEmpty() {
    if (loading) return null;
    return (
      <EmptyState
        icon="chatbubbles-outline"
        title="Aucune conversation"
        description="Contactez un vendeur depuis une annonce pour démarrer une discussion"
      />
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

      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(600)} style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Messages</Text>
            <Text style={styles.headerSubtitle}>
              {conversations.length > 0
                ? `${conversations.length} conversation${conversations.length !== 1 ? 's' : ''}`
                : 'Aucune conversation'}
            </Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="chatbubble-ellipses" size={24} color={colors.primary} />
          </View>
        </Animated.View>

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

  // Decorative
  decorCircle1: {
    position: 'absolute',
    top: -30,
    left: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FF6B35',
    opacity: 0.10,
  },
  decorCircle2: {
    position: 'absolute',
    bottom: 100,
    right: -15,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2ECC71',
    opacity: 0.06,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    ...typography.h2,
  },
  headerSubtitle: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },

  // List
  list: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },

  // Conversation item
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
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
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
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
  articleRef: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
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
  emptyIconWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    lineHeight: 20,
  },
});
