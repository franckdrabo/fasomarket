import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppNavigator, { type AppNavigatorRef } from './src/navigation/AppNavigator';
import {
  initNotifications,
  registerForPushNotifications,
  setNotificationNavigationHandler,
  onNotificationReceived,
  onNotificationTapped,
  getInitialNotification,
} from './src/services/notifications';
import { colors } from './src/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
});

export default function App() {
  // Référence vers le navigateur pour le deep linking
  const navigatorRef = useRef<AppNavigatorRef>(null);

  useEffect(() => {
    let receivedSubscription: { remove: () => void } | undefined;
    let tappedSubscription: { remove: () => void } | undefined;

    async function setupNotifications() {
      // Initialiser le module (lazy) — ne fait rien dans Expo Go
      await initNotifications();

      // Configurer le handler de navigation
      setNotificationNavigationHandler((data) => {
        if (navigatorRef.current) {
          navigatorRef.current.handleNotificationNavigation(data);
        }
      });

      // S'abonner aux notifications reçues en premier plan
      receivedSubscription = onNotificationReceived((notification) => {
        console.log('📩 Notification reçue:', notification?.request?.content?.title);
      });

      // S'abonner aux taps sur les notifications
      tappedSubscription = onNotificationTapped((data) => {
        console.log('👆 Navigation depuis notification:', data);
      });

      // Vérifier si l'app a été ouverte via une notification
      const initialData = await getInitialNotification();
      if (initialData && navigatorRef.current) {
        setTimeout(() => {
          navigatorRef.current?.handleNotificationNavigation(initialData);
        }, 800);
      }

      // Enregistrer pour les notifications push (silencieux dans Expo Go)
      registerForPushNotifications().then((token) => {
        if (token) console.log('✅ Notifications push activées');
      });
    }

    setupNotifications();

    return () => {
      if (receivedSubscription) receivedSubscription.remove();
      if (tappedSubscription) tappedSubscription.remove();
    };
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncStoragePersister }}
    >
      <SafeAreaProvider>
        <StatusBar style="dark" backgroundColor={colors.background} />
        <AppNavigator ref={navigatorRef} />
      </SafeAreaProvider>
    </PersistQueryClientProvider>
  );
}
