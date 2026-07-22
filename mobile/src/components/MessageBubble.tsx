import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

export interface MessageData {
  id: string;
  conversationId: string;
  expediteurId: string;
  contenu: string;
  type: 'TEXTE' | 'OFFRE' | 'SYSTEME';
  offrePrix?: number;
  lu: boolean;
  timestamp: string;
  expediteur: {
    id: string;
    nom: string;
    avatar?: string;
  };
}

interface Props {
  message: MessageData;
  isOwn: boolean;
  onAcceptOffer?: (message: MessageData) => void;
  onDeclineOffer?: (message: MessageData) => void;
}

export default function MessageBubble({ message, isOwn, onAcceptOffer, onDeclineOffer }: Props) {
  const messageDate = new Date(message.timestamp);
  const formattedTime = messageDate.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Message système
  if (message.type === 'SYSTEME') {
    return (
      <View style={styles.systemContainer}>
        <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
        <Text style={styles.systemText}>{message.contenu}</Text>
      </View>
    );
  }

  // Offre de prix
  if (message.type === 'OFFRE') {
    return (
      <View style={[styles.offerContainer, isOwn ? styles.offerOwn : styles.offerOther]}>
        <View style={styles.offerHeader}>
          <Ionicons name="cash-outline" size={20} color={isOwn ? colors.textOnPrimary : colors.accent} />
          <Text style={[styles.offerLabel, isOwn && styles.offerLabelOwn]}>
            Proposition de prix
          </Text>
        </View>
        <Text style={[styles.offerPrice, isOwn && styles.offerPriceOwn]}>
          {message.offrePrix?.toLocaleString('fr-FR')} FCFA
        </Text>
        <Text style={[styles.offerMessage, isOwn && styles.offerMessageOwn]}>
          {message.contenu}
        </Text>

        {!isOwn && onAcceptOffer && onDeclineOffer && (
          <View style={styles.offerActions}>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={() => onDeclineOffer(message)}
            >
              <Text style={styles.declineText}>Refuser</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => onAcceptOffer(message)}
            >
              <Ionicons name="checkmark" size={18} color={colors.textOnPrimary} />
              <Text style={styles.acceptText}>Accepter</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={[styles.time, isOwn ? styles.timeOwn : styles.timeOther]}>
          {formattedTime}
        </Text>
      </View>
    );
  }

  // Message texte normal
  return (
    <View style={[styles.bubbleContainer, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
      {!isOwn && (
        <View style={styles.avatar}>
          <Ionicons name="person" size={14} color={colors.textSecondary} />
        </View>
      )}
      <View style={[styles.bubble, isOwn ? styles.bubbleOwnInner : styles.bubbleOtherInner]}>
        <Text style={[styles.bubbleText, isOwn ? styles.bubbleTextOwn : styles.bubbleTextOther]}>
          {message.contenu}
        </Text>
        <View style={styles.bubbleMeta}>
          <Text style={[styles.time, isOwn ? styles.timeOwn : styles.timeOther]}>
            {formattedTime}
          </Text>
          {isOwn && (
            <Ionicons
              name={message.lu ? 'checkmark-done' : 'checkmark'}
              size={14}
              color={message.lu ? colors.verified : colors.textSecondary}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Bulle normale
  bubbleContainer: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'flex-end',
  },
  bubbleOwn: {
    justifyContent: 'flex-end',
  },
  bubbleOther: {
    justifyContent: 'flex-start',
    gap: spacing.sm,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  bubbleOwnInner: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOtherInner: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
    ...shadows.sm,
  },
  bubbleText: {
    ...typography.body,
    fontSize: 15,
  },
  bubbleTextOwn: {
    color: colors.textOnPrimary,
  },
  bubbleTextOther: {
    color: colors.text,
  },
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 2,
  },
  time: {
    fontSize: 11,
  },
  timeOwn: {
    color: 'rgba(255,255,255,0.7)',
  },
  timeOther: {
    color: colors.textSecondary,
  },

  // Message système
  systemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  systemText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    flexShrink: 1,
  },

  // Offre
  offerContainer: {
    alignSelf: 'center',
    width: '85%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    ...shadows.md,
  },
  offerOwn: {
    backgroundColor: colors.primary,
  },
  offerOther: {
    backgroundColor: colors.surface,
  },
  offerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  offerLabel: {
    ...typography.body,
    fontWeight: '600',
    color: colors.accent,
  },
  offerLabelOwn: {
    color: colors.textOnPrimary,
  },
  offerPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  offerPriceOwn: {
    color: colors.textOnPrimary,
  },
  offerMessage: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  offerMessageOwn: {
    color: 'rgba(255,255,255,0.9)',
  },
  offerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  declineButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  declineText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.secondary,
  },
  acceptText: {
    ...typography.bodySmall,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
});
