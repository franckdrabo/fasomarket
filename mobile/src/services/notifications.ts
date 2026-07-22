import { Platform } from 'react-native';
import * as ExpoNotifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface NotificationData {
  type?: string;
  transactionId?: string;
  articleId?: string;
  conversationId?: string;
  [key: string]: string | undefined;
}

export type NotificationNavigationHandler = (data: NotificationData) => void;

// ─── Configuration ─────────────────────────────────────────────────────────

// Configuration du comportement des notifications en premier plan
ExpoNotifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Stockage local ────────────────────────────────────────────────────────

const PUSH_TOKEN_KEY = '@bazario/pushToken';
const NOTIFICATION_OPENED_KEY = '@bazario/notificationOpened';

async function getStoredPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(PUSH_TOKEN_KEY);
}

async function storePushToken(token: string) {
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
}

async function clearPushToken() {
  await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
}

// ─── Channels Android ──────────────────────────────────────────────────────

async function setupNotificationChannels() {
  if (Platform.OS !== 'android') return;

  // Channel général
  await ExpoNotifications.setNotificationChannelAsync('bazario_default', {
    name: 'Notifications générales',
    description: 'Notifications importantes de Bazario',
    importance: ExpoNotifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 100, 100, 100],
    lightColor: '#FF6B35',
    sound: 'default',
  });

  // Channel messages
  await ExpoNotifications.setNotificationChannelAsync('bazario_messages', {
    name: 'Messages',
    description: 'Nouveaux messages de vos conversations',
    importance: ExpoNotifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 50, 100, 50],
    lightColor: '#2ECC71',
    sound: 'default',
    enableVibrate: true,
  });

  // Channel transactions
  await ExpoNotifications.setNotificationChannelAsync('bazario_transactions', {
    name: 'Transactions',
    description: 'Paiements, confirmations et litiges',
    importance: ExpoNotifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 100, 200, 100],
    lightColor: '#3498DB',
    sound: 'default',
    enableVibrate: true,
  });

  // Channel promotions
  await ExpoNotifications.setNotificationChannelAsync('bazario_promotions', {
    name: 'Promotions',
    description: 'Offres et recommandations',
    importance: ExpoNotifications.AndroidImportance.LOW,
    sound: null,
    enableVibrate: false,
  });
}

// ─── Permission ────────────────────────────────────────────────────────────

async function requestPermission(): Promise<boolean> {
  if (!Device.isDevice) {
    console.log('⚠️ Les notifications push ne sont pas supportées sur simulateur');
    return false;
  }

  const { status: existingStatus } = await ExpoNotifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await ExpoNotifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('❌ Permission notifications refusée');
    return false;
  }

  return true;
}

// ─── Récupération du token Expo ───────────────────────────────────────────

async function getExpoPushToken(): Promise<string | null> {
  try {
    const tokenData = await ExpoNotifications.getExpoPushTokenAsync({
      projectId: undefined, // Sera automatiquement détecté depuis app.json
    });
    return tokenData.data;
  } catch (error) {
    console.error('❌ Erreur récupération token Expo:', error);
    return null;
  }
}

// ─── Enregistrement du token ───────────────────────────────────────────────

export async function registerForPushNotifications(): Promise<string | null> {
  // Vérifier si déjà enregistré
  const existing = await getStoredPushToken();
  if (existing) {
    // Ré-enregistrer au cas où le token aurait changé côté backend
    try {
      await api.notifications.registerToken(existing);
    } catch {
      // Si erreur, on continue et on réessaye avec un nouveau token
    }
    return existing;
  }

  // Configurer les channels Android
  await setupNotificationChannels();

  // Demander la permission
  const hasPermission = await requestPermission();
  if (!hasPermission) return null;

  // Récupérer le token Expo
  const token = await getExpoPushToken();
  if (!token) {
    console.log('❌ Impossible de récupérer le token push');
    return null;
  }

  // Enregistrer sur le backend
  try {
    await api.notifications.registerToken(token);
    await storePushToken(token);
    console.log('✅ Token push enregistré:', token.substring(0, 20) + '...');
    return token;
  } catch (error) {
    console.error('❌ Erreur enregistrement token sur le backend:', error);
    // Stocker quand même pour réessayer plus tard
    await storePushToken(token);
    return token;
  }
}

// ─── Désenregistrement ─────────────────────────────────────────────────────

export async function unregisterPushNotifications() {
  const token = await getStoredPushToken();
  if (token) {
    try {
      await api.notifications.unregisterToken(token);
    } catch (error) {
      console.error('❌ Erreur désenregistrement token:', error);
    }
    await clearPushToken();
  }
}

// ─── Gestion des notifications entrantes ───────────────────────────────────

let navigationHandler: NotificationNavigationHandler | null = null;

export function setNotificationNavigationHandler(handler: NotificationNavigationHandler) {
  navigationHandler = handler;
}

// Gérer la notification reçue en premier plan
export function onNotificationReceived(
  callback: (notification: ExpoNotifications.Notification) => void,
) {
  const subscription = ExpoNotifications.addNotificationReceivedListener((notification) => {
    console.log('📩 Notification reçue (premier plan):', notification.request.content.data);
    callback(notification);
  });
  return subscription;
}

// Gérer le tap sur une notification
export function onNotificationTapped(
  callback: (data: NotificationData) => void,
) {
  const subscription = ExpoNotifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as NotificationData;
    console.log('👆 Notification tapée:', data);

    // Naviguer vers l'écran approprié
    if (navigationHandler) {
      navigationHandler(data);
    }

    callback(data);
  });
  return subscription;
}

// Vérifier si l'app a été ouverte via une notification (au démarrage)
export async function getInitialNotification(): Promise<NotificationData | null> {
  const response = await ExpoNotifications.getLastNotificationResponseAsync();
  if (response) {
    const data = response.notification.request.content.data as NotificationData;
    console.log('🔓 App ouverte via notification:', data);
    return data;
  }
  return null;
}

// ─── Note ────────────────────────────────────────────────────────────────────
// Les fonctions `getNavigationTarget` et `formatNotificationTime` sont
// conservées pour référence mais le routage est géré dans AppNavigator.
// @todo: Supprimer quand le système de navigation sera refactoré avec @react-navigation.