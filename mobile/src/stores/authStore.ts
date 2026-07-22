import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, storeTokens, clearTokens, getRefreshToken } from '../services/api';
import { disconnectSocket } from '../services/socket';
import { unregisterPushNotifications } from '../services/notifications';

interface User {
  id: string;
  phone: string;
  nom: string;
  avatar?: string;
  ville?: string;
  bio?: string;
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
  loginWithOtp: (phone: string, code: string) => Promise<void>;
  loginWithBiometric: () => Promise<boolean>;
  logout: () => Promise<void>;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => Promise<void>;
  updateProfile: (data: { nom?: string; ville?: string; bio?: string }) => Promise<void>;
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

      // Tentative de refresh du token
      const data = await api.auth.refresh(refreshToken);
      await storeTokens(data.accessToken, data.refreshToken);

      // Récupérer le profil
      const user = await api.auth.getProfile();
      const biometricState = await AsyncStorage.getItem('@bazario/biometricEnabled');

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        biometricEnabled: biometricState === 'true',
      });
    } catch {
      // Session expirée
      await clearTokens();
      set({ isLoading: false });
    }
  },

  loginWithOtp: async (phone: string, code: string) => {
    const response = await api.auth.verifyOtp(phone, code);
    await storeTokens(response.accessToken, response.refreshToken);

    set({
      user: response.user,
      isAuthenticated: true,
    });
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

    // Nettoyage du stockage local
    await clearTokens();
    await AsyncStorage.removeItem('@bazario/biometricEnabled');

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
    await AsyncStorage.setItem('@bazario/biometricEnabled', 'true');

    set({ biometricEnabled: true });
  },

  disableBiometric: async () => {
    await api.auth.disableBiometric();
    await AsyncStorage.removeItem('@bazario/biometricEnabled');

    set({ biometricEnabled: false });
  },

  updateProfile: async (data) => {
    const user = await api.auth.updateProfile(data);
    set((state) => ({
      user: state.user ? { ...state.user, ...user } : null,
    }));
  },
}));
