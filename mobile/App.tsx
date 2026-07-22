import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import type { EventSubscription } from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator, { type AppNavigatorRef } from './src/navigation/AppNavigator';
import {
  registerForPushNotifications,
  unregisterPushNotifications,
  setNotificationNavigationHandler,
  onNotificationReceived,
  onNotificationTapped,
  getInitialNotification,
} from './src/services/notifications';
import { colors } from './src/theme';

export default function App() {
  // Référence vers le navigateur pour le deep linking
  const navigatorRef = useRef<AppNavigatorRef>(null);

  useEffect(() => {
    let receivedSubscription: EventSubscription | undefined;
    let tappedSubscription: EventSubscription | undefined;

    async function setupNotifications() {
      // Configurer le handler de navigation pour le deep linking
      setNotificationNavigationHandler((data) => {
        // Naviguer vers l'écran approprié via la ref du navigateur
        if (navigatorRef.current) {
          navigatorRef.current.handleNotificationNavigation(data);
        }
      });

      // S'abonner aux notifications reçues en premier plan
      receivedSubscription = onNotificationReceived((notification) => {
        console.log('📩 Notification reçue:', notification.request.content.title);
      });

      // S'abonner aux taps sur les notifications
      tappedSubscription = onNotificationTapped((data) => {
        console.log('👆 Navigation depuis notification:', data);
      });

      // Vérifier si l'app a été ouverte via une notification
      const initialData = await getInitialNotification();
      if (initialData && navigatorRef.current) {
        // Attendre que l'app soit prête avant de naviguer
        setTimeout(() => {
          navigatorRef.current?.handleNotificationNavigation(initialData);
        }, 800);
      }

      // Enregistrer pour les notifications push (silencieux si déjà fait)
      registerForPushNotifications().then((token) => {
        if (token) console.log('✅ Notifications push activées');
      });

    }

    setupNotifications();

    return () => {
      // Nettoyage des abonnements
      if (receivedSubscription) receivedSubscription.remove();
      if (tappedSubscription) tappedSubscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor={colors.background} />
      <AppNavigator ref={navigatorRef} />
    </SafeAreaProvider>
  );
}
