import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
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

// ─── Lazy loaders ───────────────────────────────────────────────────────────
// Les imports statiques d'expo-notifications et expo-device déclenchent
// un warning dans Expo Go (SDK 53+). On les importe dynamiquement pour
// ne charger le module que quand on est sûr de ne pas être dans Expo Go.

let _ExpoNotifications: any = null;
let _Device: any = null;
let _loaded = false;

async function ensureLoaded() {
  if (_loaded) return;
  _loaded = true;

  // Ne rien charger si on est dans Expo Go (SDK 53+ ne supporte pas les push)
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return;
  }

  try {
    _ExpoNotifications = await import('expo-notifications');
  } catch {
    // Module non disponible
  }

  try {
    _Device = await import('expo-device');
  } catch {
    // Module non disponible
  }
}

function getExpo(): any {
  return _ExpoNotifications;
}

function getDevice(): any {
  return _Device;
}

// ─── Configuration ──────────────────────────────────────────────────────────
// Appelée une fois pour configurer le handler de notifications (avant tout
// appel à registerForPushNotifications ou onNotificationReceived).

export async function initNotifications() {
  await ensureLoaded();
  const Expo = getExpo();
  if (!Expo) return;

  Expo.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// ─── Stockage local ────────────────────────────────────────────────────────

const PUSH_TOKEN_KEY = '@bazario/pushToken';

async function getStoredPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(PUSH_TOKEN_KEY);
}

// Exporté pour que authStore puisse l'envoyer lors du login OTP
export { getStoredPushToken };

async function storePushToken(token: string) {
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
}

async function clearPushToken() {
  await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
}

// ─── Channels Android ──────────────────────────────────────────────────────

async function setupNotificationChannels() {
  if (Platform.OS !== 'android') return;
  const Expo = getExpo();
  if (!Expo) return;

  await Expo.setNotificationChannelAsync('bazario_default', {
    name: 'Notifications générales',
    description: 'Notifications importantes de Bazario',
    importance: Expo.AndroidImportance.HIGH,
    vibrationPattern: [0, 100, 100, 100],
    lightColor: '#FF6B35',
    sound: 'default',
  });

  await Expo.setNotificationChannelAsync('bazario_messages', {
    name: 'Messages',
    description: 'Nouveaux messages de vos conversations',
    importance: Expo.AndroidImportance.HIGH,
    vibrationPattern: [0, 50, 100, 50],
    lightColor: '#2ECC71',
    sound: 'default',
    enableVibrate: true,
  });

  await Expo.setNotificationChannelAsync('bazario_transactions', {
    name: 'Transactions',
    description: 'Paiements, confirmations et litiges',
    importance: Expo.AndroidImportance.HIGH,
    vibrationPattern: [0, 100, 200, 100],
    lightColor: '#3498DB',
    sound: 'default',
    enableVibrate: true,
  });

  await Expo.setNotificationChannelAsync('bazario_promotions', {
    name: 'Promotions',
    description: 'Offres et recommandations',
    importance: Expo.AndroidImportance.LOW,
    sound: null,
    enableVibrate: false,
  });
}

// ─── Permission ────────────────────────────────────────────────────────────

async function requestPermission(): Promise<boolean> {
  const Device = getDevice();
  if (Device && !Device.isDevice) {
    console.log('⚠️ Les notifications push ne sont pas supportées sur simulateur');
    return false;
  }

  const Expo = getExpo();
  if (!Expo) return false;

  const { status: existingStatus } = await Expo.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Expo.requestPermissionsAsync();
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
  const Expo = getExpo();
  if (!Expo) return null;

  try {
    // Lire le projectId depuis différentes sources possibles du manifest
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants.expoConfig as any)?.projectId ??
      Constants.expoConfig?.updates?.url?.match(/u\.expo\.dev\/([a-f0-9-]+)/i)?.[1];

    if (!projectId) {
      console.warn('⚠️ projectId non trouvé - les notifications push ne fonctionneront pas');
      return null;
    }

    const tokenData = await Expo.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch {
    return null;
  }
}

// ─── Enregistrement du token ───────────────────────────────────────────────

export async function registerForPushNotifications(): Promise<string | null> {
  await ensureLoaded();

  const Expo = getExpo();
  if (!Expo) return null; // Silencieux — Expo Go ou module non dispo

  // Vérifier si déjà enregistré
  const existing = await getStoredPushToken();
  if (existing) {
    try {
      await api.notifications.registerToken(existing);
    } catch {
      // Si erreur, on continue
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
  if (!token) return null;

  // Enregistrer sur le backend
  try {
    await api.notifications.registerToken(token);
    await storePushToken(token);
    console.log('✅ Token push enregistré:', token.substring(0, 20) + '...');
    return token;
  } catch (error) {
    console.error('❌ Erreur enregistrement token sur le backend:', error);
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
  callback: (notification: any) => void,
) {
  const Expo = getExpo();
  if (!Expo) {
    return { remove: () => {} };
  }

  const subscription = Expo.addNotificationReceivedListener((notification: any) => {
    console.log('📩 Notification reçue (premier plan):', notification.request.content.data);
    callback(notification);
  });
  return subscription;
}

// Gérer le tap sur une notification
export function onNotificationTapped(callback: (data: NotificationData) => void) {
  const Expo = getExpo();
  if (!Expo) {
    return { remove: () => {} };
  }

  const subscription = Expo.addNotificationResponseReceivedListener((response: any) => {
    const data = response.notification.request.content.data as NotificationData;
    console.log('👆 Notification tapée:', data);

    if (navigationHandler) {
      navigationHandler(data);
    }

    callback(data);
  });
  return subscription;
}

// Vérifier si l'app a été ouverte via une notification (au démarrage)
export async function getInitialNotification(): Promise<NotificationData | null> {
  const Expo = getExpo();
  if (!Expo) return null;

  try {
    const response = await Expo.getLastNotificationResponseAsync();
    if (response) {
      const data = response.notification.request.content.data as NotificationData;
      console.log('🔓 App ouverte via notification:', data);
      return data;
    }
  } catch {
    // Module non disponible
  }
  return null;
}

// ─── Note ────────────────────────────────────────────────────────────────────
// Les fonctions `getNavigationTarget` et `formatNotificationTime` sont
// conservées pour référence mais le routage est géré dans AppNavigator.
// @todo: Supprimer quand le système de navigation sera refactoré avec @react-navigation.
