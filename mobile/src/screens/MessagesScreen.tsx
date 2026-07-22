import React, { useState } from 'react';
import ConversationsListScreen from './ConversationsListScreen';
import ChatScreen from './ChatScreen';
import { Conversation } from '../types';

export default function MessagesScreen() {
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);

  if (activeConversation) {
    return (
      <ChatScreen
        conversation={activeConversation}
        onBack={() => setActiveConversation(null)}
      />
    );
  }

  return (
    <ConversationsListScreen
      onConversationPress={(conv) => setActiveConversation(conv)}
    />
  );
}
