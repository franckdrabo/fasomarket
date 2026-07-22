import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MessageBubble, { MessageData } from '../components/MessageBubble';
import {
  connectSocket,
  joinConversation,
  sendMessage,
  sendTyping,
  onNewMessage,
  onTyping,
  ChatMessage,
  TypingEvent,
} from '../services/socket';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

interface Conversation {
  id: string;
  article: { id: string; titre: string; prix: number; photos: string[] };
  acheteur: { id: string; nom: string; avatar?: string };
  vendeur: { id: string; nom: string; avatar?: string };
}

interface Props {
  conversation: Conversation;
  onBack: () => void;
}

export default function ChatScreen({ conversation, onBack }: Props) {
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [inputText, setInputText] = useState('');
  const [sendingOffer, setSendingOffer] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const [showOfferInput, setShowOfferInput] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeout = useRef<NodeJS.Timeout>();
  const { user } = useAuthStore();

  const isOwn = (expediteurId: string) => expediteurId === user?.id;
  const otherParticipant = conversation.acheteur.id === user?.id
    ? conversation.vendeur
    : conversation.acheteur;

  // Connexion socket + chargement des messages
  useEffect(() => {
    let unsubscribeMessage: (() => void) | undefined;
    let unsubscribeTyping: (() => void) | undefined;

    async function init() {
      try {
        await connectSocket();
        setIsConnected(true);

        // Rejoindre la conversation
        joinConversation(conversation.id);

        // Écouter les nouveaux messages
        unsubscribeMessage = onNewMessage((message: ChatMessage) => {
          setMessages((prev) => [...prev, message as MessageData]);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        });

        // Écouter le statut de frappe
        unsubscribeTyping = onTyping((event: TypingEvent) => {
          if (event.conversationId === conversation.id) {
            setOtherUserTyping(event.isTyping);
            if (event.isTyping) {
              clearTimeout(typingTimeout.current);
              typingTimeout.current = setTimeout(() => setOtherUserTyping(false), 3000);
            }
          }
        });

        // Charger les messages existants
        // En prod: const data = await api.messages.getByConversation(conversation.id);
        const mockMessages: MessageData[] = [
          {
            id: 'm1', conversationId: conversation.id,
            expediteurId: otherParticipant.id,
            contenu: 'Bonjour ! Cet article est-il toujours disponible ?',
            type: 'TEXTE', lu: true,
            timestamp: new Date(Date.now() - 86400000).toISOString(),
            expediteur: { id: otherParticipant.id, nom: otherParticipant.nom },
          },
          {
            id: 'm2', conversationId: conversation.id,
            expediteurId: user?.id || '',
            contenu: 'Oui, tout à fait !',
            type: 'TEXTE', lu: true,
            timestamp: new Date(Date.now() - 82800000).toISOString(),
            expediteur: { id: user?.id || '', nom: user?.nom || 'Moi' },
          },
          {
            id: 'm3', conversationId: conversation.id,
            expediteurId: otherParticipant.id,
            contenu: `Parfait, je suis intéressé. Pouvez-vous me donner plus de détails ?`,
            type: 'TEXTE', lu: true,
            timestamp: new Date(Date.now() - 72000000).toISOString(),
            expediteur: { id: otherParticipant.id, nom: otherParticipant.nom },
          },
        ];
        setMessages(mockMessages);
      } catch (error) {
        console.error('Erreur init chat:', error);
      }
    }

    init();

    return () => {
      unsubscribeMessage?.();
      unsubscribeTyping?.();
      clearTimeout(typingTimeout.current);
    };
  }, [conversation.id]);

  // Envoyer un message texte
  function handleSendText() {
    const text = inputText.trim();
    if (!text) return;

    sendMessage({
      conversationId: conversation.id,
      contenu: text,
    });

    setInputText('');
    sendTyping(conversation.id, false);
  }

  // Envoyer une offre de prix
  function handleSendOffer() {
    if (!offerPrice || isNaN(Number(offerPrice)) || Number(offerPrice) <= 0) {
      Alert.alert('Erreur', 'Entrez un prix valide');
      return;
    }

    sendMessage({
      conversationId: conversation.id,
      contenu: `Proposition de ${Number(offerPrice).toLocaleString('fr-FR')} FCFA`,
      offrePrix: Number(offerPrice),
    });

    setOfferPrice('');
    setShowOfferInput(false);
    setSendingOffer(false);
  }

  // Signaler la frappe
  function handleTextChange(text: string) {
    setInputText(text);
    sendTyping(conversation.id, text.length > 0);
  }

  // Accepter une offre
  function handleAcceptOffer(message: MessageData) {
    Alert.alert(
      'Accepter l\'offre',
      `Initier le paiement de ${message.offrePrix?.toLocaleString('fr-FR')} FCFA ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Oui, payer',
          onPress: () => {
            // Navigation vers le paiement
            Alert.alert('✅', 'Paiement initié ! (à implémenter)');
          },
        },
      ],
    );
  }

  function handleDeclineOffer(message: MessageData) {
    Alert.alert('Offre refusée');
  }

  function renderItem({ item }: { item: MessageData }) {
    return (
      <MessageBubble
        message={item}
        isOwn={isOwn(item.expediteurId)}
        onAcceptOffer={handleAcceptOffer}
        onDeclineOffer={handleDeclineOffer}
      />
    );
  }

  function renderHeader() {
    return (
      <View style={styles.chatHeader}>
        <View style={styles.chatHeaderContent}>
          <View style={styles.chatHeaderAvatar}>
            <Ionicons name="person" size={20} color={colors.textSecondary} />
          </View>
          <View style={styles.chatHeaderInfo}>
            <Text style={styles.chatHeaderName}>{otherParticipant.nom}</Text>
            <Text style={styles.chatHeaderArticle} numberOfLines={1}>
              À propos de: {conversation.article.titre}
            </Text>
          </View>
        </View>
        <View style={styles.connectionStatus}>
          <View style={[styles.statusDot, isConnected ? styles.statusOnline : styles.statusOffline]} />
          <Text style={styles.statusText}>{isConnected ? 'En ligne' : 'Hors ligne'}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{otherParticipant.nom}</Text>
          {otherUserTyping && (
            <Text style={styles.typingText}>En train d'écrire...</Text>
          )}
        </View>
        <TouchableOpacity style={styles.headerAction}>
          <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
        </TouchableOpacity>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
        />

        {/* Offer Input Toggle */}
        {showOfferInput && (
          <View style={styles.offerInputContainer}>
            <View style={styles.offerInputRow}>
              <TextInput
                style={styles.offerInput}
                placeholder="Votre prix en FCFA"
                placeholderTextColor={colors.disabled}
                keyboardType="number-pad"
                value={offerPrice}
                onChangeText={setOfferPrice}
              />
              <TouchableOpacity style={styles.offerSendButton} onPress={handleSendOffer}>
                <Ionicons name="send" size={18} color={colors.textOnPrimary} />
                <Text style={styles.offerSendText}>Proposer</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.cancelOffer}
              onPress={() => { setShowOfferInput(false); setOfferPrice(''); }}
            >
              <Text style={styles.cancelOfferText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity
            style={styles.offerToggle}
            onPress={() => setShowOfferInput(!showOfferInput)}
          >
            <Ionicons
              name="cash-outline"
              size={22}
              color={showOfferInput ? colors.textOnPrimary : colors.accent}
            />
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder="Votre message..."
            placeholderTextColor={colors.disabled}
            value={inputText}
            onChangeText={handleTextChange}
            multiline
            maxLength={500}
          />

          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSendText}
            disabled={!inputText.trim()}
          >
            <Ionicons
              name="send"
              size={20}
              color={inputText.trim() ? colors.textOnPrimary : colors.disabled}
            />
          </TouchableOpacity>
        </View>

        {/* Article info bar */}
        <View style={styles.articleBar}>
          <View style={styles.articleBarContent}>
            <View style={styles.articleBarImage}>
              <Ionicons name="pricetag" size={16} color={colors.primary} />
            </View>
            <View style={styles.articleBarInfo}>
              <Text style={styles.articleBarTitle} numberOfLines={1}>
                {conversation.article.titre}
              </Text>
              <Text style={styles.articleBarPrice}>
                {conversation.article.prix.toLocaleString('fr-FR')} FCFA
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
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
  headerInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  headerName: {
    ...typography.body,
    fontWeight: '600',
  },
  typingText: {
    ...typography.caption,
    color: colors.primary,
    fontStyle: 'italic',
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Chat
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    paddingVertical: spacing.sm,
    flexGrow: 1,
  },

  // Chat header (info article)
  chatHeader: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  chatHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chatHeaderAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatHeaderName: {
    ...typography.body,
    fontWeight: '600',
  },
  chatHeaderArticle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusOnline: {
    backgroundColor: colors.success,
  },
  statusOffline: {
    backgroundColor: colors.disabled,
  },
  statusText: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // Offer input
  offerInputContainer: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  offerInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  offerInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  offerSendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.secondary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  offerSendText: {
    ...typography.button,
    color: colors.textOnPrimary,
    fontSize: 14,
  },
  cancelOffer: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  cancelOfferText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  offerToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.surfaceVariant,
  },

  // Article bar
  articleBar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  articleBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  articleBarImage: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  articleBarInfo: {
    flex: 1,
  },
  articleBarTitle: {
    ...typography.bodySmall,
    fontWeight: '500',
  },
  articleBarPrice: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
});
