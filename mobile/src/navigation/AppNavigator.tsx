import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../stores/authStore';
import { checkBiometricAvailability } from '../services/biometric';
import LoginScreen from '../screens/LoginScreen';
import BiometricSetupScreen from '../screens/BiometricSetupScreen';
import HomeScreen from '../screens/HomeScreen';
import SellScreen from '../screens/SellScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ArticleDetailScreen from '../screens/ArticleDetailScreen';
import CreateArticleScreen from '../screens/CreateArticleScreen';
import PaymentScreen from '../screens/PaymentScreen';
import PaymentConfirmationScreen from '../screens/PaymentConfirmationScreen';
import TransactionHistoryScreen from '../screens/TransactionHistoryScreen';
import TransactionDetailScreen from '../screens/TransactionDetailScreen';
import NotificationListScreen from '../screens/NotificationListScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import { ArticleCardData } from '../components/ArticleCard';
import { TransactionData } from '../types';
import { api } from '../services/api';
import { AnimatedPressable, FadeInView } from '../components/animations';
import { colors, spacing, shadows } from '../theme';
import type { NotificationData } from '../services/notifications';

// Types d'écrans pour le stack
type AppScreen =
  | { type: 'tabs' }
  | { type: 'articleDetail'; article: ArticleCardData }
  | { type: 'createArticle' }
  | { type: 'payment'; article: ArticleCardData }
  | { type: 'paymentConfirmation'; transactionId: string; montant: number; provider: string }
  | { type: 'transactions' }
  | { type: 'transactionDetail'; transaction: TransactionData }
  | { type: 'notifications' }
  | { type: 'favoris' };

// Interface exposée via la ref pour le deep linking depuis les notifications
export interface AppNavigatorRef {
  handleNotificationNavigation: (data: NotificationData) => void;
}

const AppNavigator = forwardRef<AppNavigatorRef, {}>(function AppNavigator(_props, ref) {
  const { isAuthenticated, isLoading, initialize } = useAuthStore();
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [screenStack, setScreenStack] = useState<AppScreen[]>([{ type: 'tabs' }]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    initialize();
    checkBiometricAvailability().then((s) => setBiometricAvailable(s.isAvailable));
  }, []);

  function navigate(screen: AppScreen) {
    setScreenStack((prev) => [...prev, screen]);
  }

  function goBack() {
    setScreenStack((prev) => prev.slice(0, -1));
  }

  // Loading screen animé
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.View
          entering={FadeIn.duration(600).delay(200)}
          style={styles.loadingContent}
        >
          <Animated.View
            entering={FadeIn.duration(800).delay(400)}
            style={styles.logoContainer}
          >
            <Ionicons name="basket" size={60} color={colors.primary} />
          </Animated.View>
          <Animated.Text
            entering={FadeIn.duration(800).delay(600)}
            style={styles.appName}
          >
            Bazario
          </Animated.Text>
          <ActivityIndicator
            size="small"
            color={colors.primary}
            style={{ marginTop: spacing.lg }}
          />
        </Animated.View>
      </View>
    );
  }

  if (showBiometricSetup) {
    return (
      <BiometricSetupScreen
        onComplete={() => setShowBiometricSetup(false)}
        onSkip={() => setShowBiometricSetup(false)}
      />
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const currentScreen = screenStack[screenStack.length - 1];

  // Transition animée entre les écrans
  function renderScreen() {
    switch (currentScreen.type) {
      case 'articleDetail':
        return (
          <Animated.View
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(250)}
            style={{ flex: 1 }}
          >
            <ArticleDetailScreen
              article={currentScreen.article}
              onBack={goBack}
              onBuyPress={() => navigate({ type: 'payment', article: currentScreen.article })}
            />
          </Animated.View>
        );
      case 'createArticle':
        return (
          <Animated.View
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(250)}
            style={{ flex: 1 }}
          >
            <CreateArticleScreen
              onBack={goBack}
              onSuccess={goBack}
            />
          </Animated.View>
        );
      case 'payment':
        return (
          <Animated.View
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(250)}
            style={{ flex: 1 }}
          >
            <PaymentScreen
              article={{
                id: currentScreen.article.id,
                titre: currentScreen.article.titre,
                prix: currentScreen.article.prix,
                photos: currentScreen.article.photos,
                vendeur: currentScreen.article.vendeur,
              }}
              onBack={goBack}
              onPaymentComplete={(result) => {
                navigate({
                  type: 'paymentConfirmation',
                  transactionId: result.transactionId,
                  montant: result.montant,
                  provider: result.provider,
                });
              }}
            />
          </Animated.View>
        );
      case 'paymentConfirmation':
        return (
          <Animated.View
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(250)}
            style={{ flex: 1 }}
          >
            <PaymentConfirmationScreen
              transactionId={currentScreen.transactionId}
              montant={currentScreen.montant}
              provider={currentScreen.provider}
              onBack={goBack}
              onDone={() => {
                setScreenStack([{ type: 'tabs' }]);
              }}
            />
          </Animated.View>
        );
      case 'transactions':
        return (
          <Animated.View
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(250)}
            style={{ flex: 1 }}
          >
            <TransactionHistoryScreen
              key={refreshKey}
              onTransactionPress={(transaction) => {
                navigate({ type: 'transactionDetail', transaction });
              }}
            />
          </Animated.View>
        );
      case 'transactionDetail':
        return (
          <Animated.View
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(250)}
            style={{ flex: 1 }}
          >
            <TransactionDetailScreen
              transaction={currentScreen.transaction}
              onBack={() => {
                setRefreshKey((k) => k + 1);
                goBack();
              }}
            />
          </Animated.View>
        );
      case 'notifications':
        return (
          <Animated.View
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(250)}
            style={{ flex: 1 }}
          >
            <NotificationListScreen
              onBack={goBack}
              onNotificationPress={(notification) => {
                goBack();
                if (notification.type && notification.data) {
                  handleDeepLink(notification.data ?? {});
                }
              }}
            />
          </Animated.View>
        );
      case 'favoris':
        return (
          <Animated.View
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(250)}
            style={{ flex: 1 }}
          >
            <FavoritesScreen
              onBack={goBack}
              onArticlePress={(article) => navigate({ type: 'articleDetail', article })}
            />
          </Animated.View>
        );
      default:
        return (
          <MainTabs
            onNavigate={navigate}
          />
        );
    }
  }

  // Logique de deep linking extraite pour être utilisée dans les deux contextes
  function handleDeepLink(data: NotificationData) {
    if (!data || !data.type) return;
    console.log('🧭 Navigation depuis notification:', data.type);

    switch (data.type) {
      case 'payment_received':
      case 'payment_confirmed':
      case 'payment_confirmed_buyer':
      case 'payment_released':
      case 'payment_failed':
      case 'dispute_opened':
        setScreenStack([{ type: 'transactions' }]);
        break;

      case 'new_message':
        setScreenStack([{ type: 'tabs' }]);
        break;

      case 'article_sold':
      case 'article_question':
        setScreenStack([{ type: 'tabs' }]);
        break;

      default:
        setScreenStack([{ type: 'tabs' }]);
        break;
    }
  }

  // Exposer handleNotificationNavigation via la ref pour App.tsx
  useImperativeHandle(ref, () => ({
    handleNotificationNavigation: (data: NotificationData) => {
      handleDeepLink(data);
    },
  }));

  return (
    <View style={{ flex: 1 }}>
      {renderScreen()}
    </View>
  );
});

interface MainTabsProps {
  onNavigate: (screen: AppScreen) => void;
}

function MainTabs({ onNavigate }: MainTabsProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Charger le nombre de notifications non lues
  useEffect(() => {
    async function fetchUnread() {
      try {
        const response = await api.notifications.getUnreadCount() as any;
        setUnreadNotifications(response.count || 0);
      } catch {}
    }
    fetchUnread();

    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { key: 'home', icon: 'home', label: 'Accueil', activeIcon: 'home' },
    { key: 'sell', icon: 'add-circle-outline', label: 'Vendre', activeIcon: 'add-circle' },
    {
      key: 'messages',
      icon: 'chatbubble-outline',
      label: 'Messages',
      activeIcon: 'chatbubble',
      badge: unreadNotifications,
    },
    { key: 'profile', icon: 'person-outline', label: 'Profil', activeIcon: 'person' },
  ];

  function renderScreen() {
    switch (activeTab) {
      case 0:
        return (
          <FadeInView key="home" duration={250}>
            <HomeScreen
              onArticlePress={(article) => onNavigate({ type: 'articleDetail', article })}
            />
          </FadeInView>
        );
      case 1:
        return (
          <FadeInView key="sell" duration={250}>
            <SellScreen
              onStartCreating={() => onNavigate({ type: 'createArticle' })}
            />
          </FadeInView>
        );
      case 2:
        return (
          <FadeInView key="messages" duration={250}>
            <MessagesScreen />
          </FadeInView>
        );
      case 3:
        return (
          <FadeInView key="profile" duration={250}>
            <ProfileScreen
              onNavigate={(screen) => {
                if (screen.type === 'transactions') {
                  onNavigate({ type: 'transactions' });
                } else if (screen.type === 'favoris') {
                  onNavigate({ type: 'favoris' });
                }
              }}
            />
          </FadeInView>
        );
      default:
        return null;
    }
  }

  return (
    <View style={styles.tabContainer}>
      <View style={styles.content}>
        {renderScreen()}
      </View>

      <View style={styles.tabBar}>
        {tabs.map((tab, index) => {
          const isActive = activeTab === index;
          const iconName = isActive ? tab.activeIcon : tab.icon;

          return (
            <TabBarButton
              key={tab.key}
              icon={iconName}
              label={tab.label}
              isActive={isActive}
              onPress={() => setActiveTab(index)}
              badge={tab.badge}
            />
          );
        })}
      </View>
    </View>
  );
}

interface TabBarButtonProps {
  icon: string;
  label: string;
  isActive: boolean;
  onPress: () => void;
  badge?: number;
}

function TabBarButton({ icon, label, isActive, onPress, badge }: TabBarButtonProps) {
  return (
    <AnimatedPressable onPress={onPress} scaleTo={0.92} style={styles.tabButton}>
      <View style={[styles.tabIconWrapper, isActive && styles.tabIconActive]}>
        <Ionicons
          name={icon as any}
          size={isActive ? 24 : 22}
          color={isActive ? colors.primary : colors.textSecondary}
        />
        {badge !== undefined && badge > 0 && (
          <View style={styles.tabBadge}>
            <Text style={styles.tabBadgeText}>
              {badge > 99 ? '99+' : badge}
            </Text>
          </View>
        )}
      </View>
      <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

export default AppNavigator;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loadingContent: {
    alignItems: 'center',
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
    marginTop: spacing.md,
  },
  tabContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingTop: spacing.xs,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.md,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  tabIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: {
    backgroundColor: colors.surfaceVariant,
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },

  // Badge notifications
  tabBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: colors.primary,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});
