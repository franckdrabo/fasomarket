import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  BounceIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  useAuthStore,
  isSellerActivationSkipped,
  markSellerActivationSkipped,
  clearSellerActivationSkipped,
} from '../stores/authStore';
import { checkBiometricAvailability } from '../services/biometric';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import BiometricSetupScreen from '../screens/BiometricSetupScreen';
import HomeScreen from '../screens/HomeScreen';
import SellScreen from '../screens/SellScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ArticleDetailScreen from '../screens/ArticleDetailScreen';
import CreateArticleScreen from '../screens/CreateArticleScreen';
import ChatScreen from '../screens/ChatScreen';
import NotificationListScreen from '../screens/NotificationListScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import MyArticlesScreen from '../screens/MyArticlesScreen';
import SellerActivationScreen from '../screens/SellerActivationScreen';
import InfoScreen from '../screens/InfoScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { ArticleCardData } from '../components/ArticleCard';
import { Conversation } from '../types';
import { api } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import { AnimatedPressable, FadeInView } from '../components/animations';
import { colors, spacing, typography, shadows } from '../theme';
import type { NotificationData } from '../services/notifications';

// Types d'écrans pour le stack
// NOTE : les écrans d'escrow (payment, paymentConfirmation, transactions,
// transactionDetail) ont été retirés : l'achat se fait 100% en P2P via la
// messagerie. Les fichiers sources restent conservés dans le repo.
type AppScreen =
  | { type: 'tabs' }
  | { type: 'articleDetail'; article: ArticleCardData }
  | { type: 'createArticle' }
  | { type: 'chat'; conversation: Conversation }
  | { type: 'notifications' }
  | { type: 'favoris' }
  | { type: 'myArticles' }
  | { type: 'info' }
  | { type: 'settings' };

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
  const [showRegistration, setShowRegistration] = useState(false);
  const [showAuthOverlay, setShowAuthOverlay] = useState(true);
  const [showSellerActivation, setShowSellerActivation] = useState(false);

  useEffect(() => {
    initialize();
    checkBiometricAvailability().then((s) => setBiometricAvailable(s.isAvailable));
  }, []);

  // Gérer la connexion socket globale
  useEffect(() => {
    if (isAuthenticated) {
      connectSocket().catch(err => console.error('Erreur socket globale:', err));
    } else {
      disconnectSocket();
    }
  }, [isAuthenticated]);

  // Détermine si l'overlay d'activation vendeur doit s'afficher : utilisateur
  // connecté, rôle vendeur, frais non payés et choix « Plus tard » absent.
  async function maybePromptSellerActivation(): Promise<boolean> {
    const state = useAuthStore.getState();
    const shouldPrompt =
      state.isAuthenticated &&
      state.user?.role === 'SELLER' &&
      !state.user?.sellerFeePaid;
    if (!shouldPrompt || !state.user?.id) return false;
    const skipped = await isSellerActivationSkipped(state.user.id);
    return !skipped;
  }

  // Surveiller si l'utilisateur est un nouveau vendeur (pas encore payé).
  // L'overlay ne s'affiche pas automatiquement si l'utilisateur a déjà
  // choisi « Plus tard » (préférence mémorisée par utilisateur).
  useEffect(() => {
    let active = true;
    maybePromptSellerActivation().then((show) => {
      if (active) setShowSellerActivation(show);
    });
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  function navigate(screen: AppScreen) {
    setScreenStack((prev) => [...prev, screen]);
  }

  function goBack() {
    setScreenStack((prev) => prev.slice(0, -1));
  }

  // Achat 100% P2P : « Contacter le vendeur » ouvre une conversation dans la
  // messagerie. L'acheteur et le vendeur négocient et l'acheteur paie le
  // vendeur directement (Mobile Money sur le numéro communiqué dans le chat).
  async function handleContactSeller(article: ArticleCardData) {
    try {
      const conversation = await api.conversations.create(article.id) as Conversation;
      navigate({ type: 'chat', conversation });
    } catch (error: any) {
      Alert.alert(
        'Impossible de contacter le vendeur',
        error?.message || 'Veuillez réessayer dans quelques instants.',
      );
    }
  }

  // Logique de deep linking (déclarée AVANT les early returns pour être utilisée par useImperativeHandle)
  function handleDeepLink(data: NotificationData) {
    if (!data || !data.type) return;
    console.log('🧭 Navigation depuis notification:', data.type);

    // Les notifications liées à l'escrow (payment_*, dispute_*) ne naviguent
    // plus nulle part : l'écran transactions a été retiré (achat P2P).
    switch (data.type) {
      case 'new_message':
      case 'article_sold':
      case 'article_question':
        setScreenStack([{ type: 'tabs' }]);
        break;

      default:
        setScreenStack([{ type: 'tabs' }]);
        break;
    }
  }

  // useImperativeHandle DOIT être avant les early returns pour respecter les règles des hooks React
  useImperativeHandle(ref, () => ({
    handleNotificationNavigation: (data: NotificationData) => {
      handleDeepLink(data);
    },
  }));

  // Loading screen
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>FasoMarket...</Text>
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

  // Toujours afficher les onglets — même sans authentification
  // Login/Register s'affichent en superposition quand nécessaire
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
              onContactSeller={handleContactSeller}
            />
          </Animated.View>
        );
      case 'chat':
        return (
          <Animated.View
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(250)}
            style={{ flex: 1 }}
          >
            <ChatScreen
              conversation={currentScreen.conversation}
              onBack={goBack}
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
      case 'myArticles':
        return (
          <Animated.View
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(250)}
            style={{ flex: 1 }}
          >
            <MyArticlesScreen
              key={refreshKey}
              onBack={() => {
                setRefreshKey((k) => k + 1);
                goBack();
              }}
              onArticlePress={(article) => navigate({ type: 'articleDetail', article })}
            />
          </Animated.View>
        );
      case 'info':
        return (
          <Animated.View
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(250)}
            style={{ flex: 1 }}
          >
            <InfoScreen onBack={goBack} />
          </Animated.View>
        );
      case 'settings':
        return (
          <Animated.View
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(250)}
            style={{ flex: 1 }}
          >
            <SettingsScreen onBack={goBack} />
          </Animated.View>
        );
      default:
        return (
          <MainTabs
            onNavigate={navigate}
            onActivateSeller={() => setShowSellerActivation(true)}
          />
        );
    }
  }

  function handleLoginComplete() {
    setShowAuthOverlay(false);
    setShowRegistration(false);
    // L'effet sur isAuthenticated gère aussi ce cas ; on force ici un
    // affichage immédiat si éligible pour éviter un flash entre les overlays.
    maybePromptSellerActivation().then((show) => {
      if (show) setShowSellerActivation(true);
    });
  }

  return (
    <View style={{ flex: 1 }}>
      {renderScreen()}

      {/* Overlay de connexion */}
      {!isAuthenticated && showAuthOverlay && !showRegistration && (
        <View style={StyleSheet.absoluteFill}>
          <LoginScreen
            onRegisterPress={() => setShowRegistration(true)}
            onComplete={handleLoginComplete}
            onSkip={() => setShowAuthOverlay(false)}
          />
        </View>
      )}

      {/* Overlay d'inscription */}
      {!isAuthenticated && showRegistration && (
        <View style={StyleSheet.absoluteFill}>
          <RegisterScreen
            onBackToLogin={() => setShowRegistration(false)}
            onComplete={handleLoginComplete}
          />
        </View>
      )}

      {/* Overlay activation vendeur (paiement 1000 FCFA) */}
      {showSellerActivation && (
        <View style={StyleSheet.absoluteFill}>
          <SellerActivationScreen
            onComplete={() => {
              // Compte activé : la préférence « Plus tard » n'a plus lieu d'être
              const state = useAuthStore.getState();
              if (state.user?.id) clearSellerActivationSkipped(state.user.id);
              setShowSellerActivation(false);
            }}
            onSkip={() => {
              // Mémoriser « Plus tard » pour ne pas réafficher l'overlay
              // à chaque lancement de l'app
              const state = useAuthStore.getState();
              if (state.user?.id) markSellerActivationSkipped(state.user.id);
              setShowSellerActivation(false);
            }}
          />
        </View>
      )}
    </View>
  );
});

interface MainTabsProps {
  onNavigate: (screen: AppScreen) => void;
  onActivateSeller: () => void;
}

function MainTabs({ onNavigate, onActivateSeller }: MainTabsProps) {
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
          <FadeInView key="home" duration={250} style={{ flex: 1 }}>
            <HomeScreen
              onArticlePress={(article) => onNavigate({ type: 'articleDetail', article })}
            />
          </FadeInView>
        );
      case 1:
        return (
          <FadeInView key="sell" duration={250} style={{ flex: 1 }}>
            <SellScreen
              onStartCreating={() => onNavigate({ type: 'createArticle' })}
            />
          </FadeInView>
        );
      case 2:
        return (
          <FadeInView key="messages" duration={250} style={{ flex: 1 }}>
            <MessagesScreen />
          </FadeInView>
        );
      case 3:
        return (
          <FadeInView key="profile" duration={250} style={{ flex: 1 }}>
            <ProfileScreen
              onNavigate={(screen) => {
                if (screen.type === 'favoris') {
                  onNavigate({ type: 'favoris' });
                } else if (screen.type === 'myArticles') {
                  onNavigate({ type: 'myArticles' });
                } else if (screen.type === 'info') {
                  onNavigate({ type: 'info' });
                } else if (screen.type === 'settings') {
                  onNavigate({ type: 'settings' });
                }
              }}
              onActivateSeller={onActivateSeller}
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
  loadingText: {
    ...typography.h2,
    marginTop: spacing.md,
    color: colors.primary,
  },
  tabContainer: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingTop: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.sm,
    paddingHorizontal: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 10,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: 2,
    minWidth: 56,
  },
  tabIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: {
    backgroundColor: colors.surfaceVariant,
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 3,
    color: colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },

  // Badge notifications
  tabBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
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
