import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api, storeTokens, clearTokens, getRefreshToken } from '../services/api';
import { disconnectSocket } from '../services/socket';
import { unregisterPushNotifications, getStoredPushToken } from '../services/notifications';

interface User {
  id: string;
  phone?: string;
  email?: string;
  nom: string;
  avatar?: string;
  ville?: string;
  bio?: string;
  role?: 'BUYER' | 'SELLER';
  sellerFeePaid?: boolean;
  noteMoyenne?: number;
  nbVentes?: number;
  nbAchats?: number;
  badgeVerifie?: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  biometricEnabled: boolean;

  // Actions
  initialize: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  markSellerActivated: () => void;
  loginWithOtp: (email: string, code: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, nom: string, ville?: string, role?: 'BUYER' | 'SELLER') => Promise<void>;
  initiateSellerActivation: (telephone: string, operateur: string) => Promise<{ reference: string; paymentUrl?: string }>;
  confirmSellerActivation: (reference: string) => Promise<void>;
  loginWithBiometric: () => Promise<boolean>;
  logout: () => Promise<void>;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => Promise<void>;
  updateProfile: (data: { nom?: string; ville?: string; bio?: string; avatar?: string }) => Promise<void>;
  registerWithProfile: (email: string, code: string, nom: string, ville?: string, role?: 'BUYER' | 'SELLER') => Promise<void>;
  setUser: (user: User | null) => void;
}

// ─── Préférence « activation vendeur reportée » ────────────────────────────
// Mémorisée par utilisateur : l'overlay d'activation ne se réaffiche pas
// à chaque lancement si l'utilisateur a choisi « Plus tard ».

const SELLER_SKIP_KEY_PREFIX = 'fasomarket_seller_activation_skipped_';

function sellerSkipKey(userId: string): string {
  return `${SELLER_SKIP_KEY_PREFIX}${userId}`;
}

export async function isSellerActivationSkipped(userId: string): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(sellerSkipKey(userId));
    return value === 'true';
  } catch {
    return false;
  }
}

export async function markSellerActivationSkipped(userId: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(sellerSkipKey(userId), 'true');
  } catch {}
}

export async function clearSellerActivationSkipped(userId: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(sellerSkipKey(userId));
  } catch {}
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  biometricEnabled: false,

  initialize: async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        set({ isLoading: false });
        return;
      }

      // Rafraîchir les tokens (timeout 10 s pour ne pas bloquer le démarrage)
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 10000)
      );

      let data: any;
      try {
        data = await Promise.race([
          api.auth.refresh(refreshToken),
          timeoutPromise,
        ]);
      } catch (error: any) {
        // Session réellement expirée (401) → on nettoie les tokens.
        // Erreur réseau / timeout → on GARDE les tokens : l'utilisateur
        // restera connecté au prochain lancement une fois le réseau revenu.
        if (error?.status === 401) {
          await clearTokens();
        }
        set({ isLoading: false });
        return;
      }

      await storeTokens(data.accessToken, data.refreshToken);

      // Récupérer le profil
      const user = await api.auth.getProfile();
      const biometricState = await SecureStore.getItemAsync('fasomarket_biometric').catch(() => null);

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        biometricEnabled: biometricState === 'true',
      });
    } catch (error: any) {
      // getProfile a échoué : on ne déconnecte que si la session est
      // réellement invalide (401). En cas de panne réseau, les tokens
      // sont conservés pour le prochain lancement.
      if (error?.status === 401) {
        await clearTokens();
      }
      set({ isLoading: false });
    }
  },

  // Re-synchronise l'utilisateur avec le serveur (profil complet : rôle,
  // sellerFeePaid, etc.) — utile après une activation vendeur externe.
  refreshProfile: async () => {
    const user = await api.auth.getProfile();
    set({ user });
  },

  // Marque le compte vendeur comme activé localement (mise à jour optimiste
  // quand le serveur confirme les frais payés mais que le réseau est coupé).
  markSellerActivated: () => {
    set((state) => ({
      user: state.user ? { ...state.user, role: 'SELLER', sellerFeePaid: true } : null,
    }));
  },

  loginWithOtp: async (email: string, code: string) => {
    // Envoyer le FCM token pour que les notifications push fonctionnent
    // immédiatement après le login (sinon l'utilisateur ne recevrait aucune
    // notification push tant qu'il n'aurait pas relancé l'app).
    const fcmToken = await getStoredPushToken().catch(() => null);
    const response = await api.auth.verifyOtp(email, code, fcmToken || undefined);
    await storeTokens(response.accessToken, response.refreshToken);

    set({
      user: response.user,
      isAuthenticated: true,
    });
  },

  loginWithEmail: async (email: string, password: string) => {
    const response = await api.auth.loginEmail(email, password);
    await storeTokens(response.accessToken, response.refreshToken);

    set({
      user: response.user,
      isAuthenticated: true,
    });
  },

  registerWithEmail: async (email: string, password: string, nom: string, ville?: string, role?: 'BUYER' | 'SELLER') => {
    const response = await api.auth.registerEmail(email, password, nom, ville, role);
    await storeTokens(response.accessToken, response.refreshToken);

    set({
      user: response.user as User,
      isAuthenticated: true,
    });
  },

  initiateSellerActivation: async (telephone: string, operateur: string) => {
    // Initier le paiement de 1000 FCFA via CinetPay → l'utilisateur paie sur la page sécurisée
    const initiated = await api.auth.activateSeller(telephone, operateur);
    if (!initiated.providerReference) {
      throw new Error('Référence de paiement manquante');
    }
    return {
      reference: initiated.providerReference,
      paymentUrl: initiated.paymentUrl,
    };
  },

  confirmSellerActivation: async (reference: string) => {
    // Vérifier le paiement auprès du provider puis activer le compte vendeur
    const confirm = await api.auth.confirmSellerActivation(reference);
    set((state) => ({
      user: state.user
        ? { ...state.user, role: 'SELLER', sellerFeePaid: confirm.sellerFeePaid }
        : null,
    }));
  },

  loginWithBiometric: async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return false;

      const response = await api.auth.biometricLogin(refreshToken);
      await storeTokens(response.accessToken, response.refreshToken);

      set({
        user: response.user,
        isAuthenticated: true,
      });

      return true;
    } catch {
      return false;
    }
  },

  logout: async () => {
    // Nettoyage côté serveur
    try {
      await unregisterPushNotifications();
    } catch {}

    // Déconnexion socket temps réel
    disconnectSocket();

    // Nettoyage du stockage local sécurisé
    await clearTokens();
    await SecureStore.deleteItemAsync('fasomarket_biometric').catch(() => {});

    // Reset du state
    set({
      user: null,
      isAuthenticated: false,
      biometricEnabled: false,
    });
  },

  enableBiometric: async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) throw new Error('Aucun token');

    await api.auth.enableBiometric(refreshToken);
    await SecureStore.setItemAsync('fasomarket_biometric', 'true');

    set({ biometricEnabled: true });
  },

  disableBiometric: async () => {
    await api.auth.disableBiometric();
    await SecureStore.deleteItemAsync('fasomarket_biometric').catch(() => {});

    set({ biometricEnabled: false });
  },

  updateProfile: async (data) => {
    const user = await api.auth.updateProfile(data);
    set((state) => ({
      user: state.user ? { ...state.user, ...user } : null,
    }));
  },

  registerWithProfile: async (email: string, code: string, nom: string, ville?: string, role?: 'BUYER' | 'SELLER') => {
    const response = await api.auth.verifyOtp(email, code);
    await storeTokens(response.accessToken, response.refreshToken);

    // Mettre à jour le profil avec le nom, la ville et le rôle
    const updatedUser = await api.auth.updateProfile({
      nom,
      ville: ville || undefined,
      role: role || undefined,
    } as any);

    set({
      user: {
        ...response.user,
        ...updatedUser,
      },
      isAuthenticated: true,
    });
  },

  setUser: (user: User | null) => {
    set({ user });
  },
}));
