import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api';

const SOCKET_URL = __DEV__
  ? 'http://192.168.1.70:3000/chat'
  : 'https://api.fasomarket.com/chat';

let socket: Socket | null = null;
let listeners: Map<string, Set<(...args: any[]) => void>> = new Map();

export interface ChatMessage {
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

export interface TypingEvent {
  userId: string;
  conversationId: string;
  isTyping: boolean;
}

/**
 * Connecte le socket avec le token JWT
 */
export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const token = await getAccessToken();
  if (!token) throw new Error('Non authentifié');

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    console.log('🔌 Socket connecté');
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket déconnecté:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('🔌 Erreur socket:', error.message);
  });

  // Ré-attacher tous les listeners enregistrés
  listeners.forEach((callbacks, event) => {
    callbacks.forEach((cb) => {
      socket?.on(event, cb);
    });
  });

  return socket;
}

/**
 * Déconnecte le socket
 */
export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    listeners.clear();
  }
}

/**
 * Rejoindre une conversation (room Socket.IO)
 */
export function joinConversation(conversationId: string) {
  socket?.emit('joinConversation', { conversationId });
}

/**
 * Envoyer un message
 */
export function sendMessage(data: {
  conversationId: string;
  contenu: string;
  offrePrix?: number;
}) {
  socket?.emit('sendMessage', data);
}

/**
 * Signaler que l'utilisateur est en train d'écrire
 */
export function sendTyping(conversationId: string, isTyping: boolean) {
  socket?.emit('typing', { conversationId, isTyping });
}

/**
 * Écouter les nouveaux messages
 */
export function onNewMessage(callback: (message: ChatMessage) => void) {
  const event = 'newMessage';
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(callback);
  socket?.on(event, callback);

  // Retourne une fonction pour se désabonner
  return () => {
    listeners.get(event)?.delete(callback);
    socket?.off(event, callback);
  };
}

/**
 * Écouter les événements de frappe
 */
export function onTyping(callback: (event: TypingEvent) => void) {
  const event = 'userTyping';
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(callback);
  socket?.on(event, callback);

  return () => {
    listeners.get(event)?.delete(callback);
    socket?.off(event, callback);
  };
}

/**
 * Réinitialiser les listeners et se reconnecter
 */
export async function reconnectSocket() {
  disconnectSocket();
  return connectSocket();
}

export { socket };
