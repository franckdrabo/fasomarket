import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Lire l'URL de l'API depuis l'env EAS (injecté par eas.json à la compilation)
// ou depuis la config app.json.extra.apiUrl (fallback)
// ou depuis __DEV__ pour le développement local pur
const currentEnv =
  (process as any).env?.APP_ENV ??
  (__DEV__ ? 'development' : 'production');

const API_BASE_URL =
  Constants.expoConfig?.extra?.apiUrl?.[currentEnv] ??
  (__DEV__
    ? 'http://10.0.2.2:3000/api/v1' // Android emulator -> localhost
    : 'https://api.bazario.com/api/v1');

const TOKEN_KEY = '@bazario/accessToken';
const REFRESH_TOKEN_KEY = '@bazario/refreshToken';

interface RequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  requiresAuth?: boolean;
}

async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

async function storeTokens(accessToken: string, refreshToken: string) {
  await AsyncStorage.setItem(TOKEN_KEY, accessToken);
  await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

async function clearTokens() {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
}

export { getAccessToken, getRefreshToken, storeTokens, clearTokens };

async function request<T = any>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, headers = {}, requiresAuth = true } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (requiresAuth) {
    const token = await getAccessToken();
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  const config: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  // Token expiré — tenter un refresh
  if (response.status === 401 && requiresAuth) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Réessayer avec le nouveau token
      const newToken = await getAccessToken();
      requestHeaders['Authorization'] = `Bearer ${newToken}`;
      config.headers = requestHeaders;
      const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, config);
      if (!retryResponse.ok) {
        throw new ApiError(
          retryResponse.status,
          await retryResponse.json().catch(() => ({ message: 'Erreur inconnue' })),
        );
      }
      return retryResponse.json();
    } else {
      // Refresh failed — déconnexion
      await clearTokens();
      throw new ApiError(401, { message: 'Session expirée, veuillez vous reconnecter' });
    }
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      await response.json().catch(() => ({ message: 'Erreur inconnue' })),
    );
  }

  return response.json();
}

async function refreshAccessToken(): Promise<boolean> {
  try {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return false;

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    await storeTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, data: any) {
    super(data?.message || `Erreur ${status}`);
    this.status = status;
    this.data = data;
  }
}

// ─── API Methods ──────────────────────────────────────────────────────────────

export const api = {
  // Auth
  auth: {
    sendOtp: (phone: string) =>
      request('/auth/send-otp', {
        method: 'POST',
        body: { phone },
        requiresAuth: false,
      }),

    verifyOtp: (phone: string, code: string, fcmToken?: string) =>
      request<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; phone: string; nom: string; avatar?: string; ville?: string };
      }>('/auth/verify-otp', {
        method: 'POST',
        body: { phone, code, fcmToken },
        requiresAuth: false,
      }),

    refresh: (refreshToken: string) =>
      request<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
        requiresAuth: false,
      }),

    getProfile: () => request('/auth/profile'),

    updateProfile: (data: { nom?: string; ville?: string; bio?: string }) =>
      request('/auth/profile', {
        method: 'PATCH',
        body: data,
      }),

    // Biométrie
    enableBiometric: (refreshToken: string) =>
      request<{ biometricEnabled: boolean; message: string }>('/auth/enable-biometric', {
        method: 'POST',
        body: { refreshToken },
      }),

    disableBiometric: () =>
      request<{ biometricEnabled: boolean; message: string }>('/auth/disable-biometric', {
        method: 'POST',
      }),

    biometricLogin: (refreshToken: string) =>
      request<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; phone: string; nom: string; avatar?: string; ville?: string };
      }>('/auth/biometric-login', {
        method: 'POST',
        body: { refreshToken },
        requiresAuth: false,
      }),
  },

  // Articles
  articles: {
    list: (params?: Record<string, any>) =>
      request(`/articles?${new URLSearchParams(params).toString()}`),

    getById: (id: string) => request(`/articles/${id}`),

    create: (data: any) =>
      request('/articles', { method: 'POST', body: data }),

    update: (id: string, data: any) =>
      request(`/articles/${id}`, { method: 'PUT', body: data }),

    delete: (id: string) =>
      request(`/articles/${id}`, { method: 'DELETE' }),

    markAsSold: (id: string) =>
      request(`/articles/${id}/sold`, { method: 'PATCH' }),
  },

  // Conversations
  conversations: {
    list: () => request('/conversations'),

    getById: (id: string) => request(`/conversations/${id}`),

    create: (articleId: string) =>
      request('/conversations', { method: 'POST', body: { articleId } }),
  },

  // Upload
  upload: {
    image: (file: any) => {
      const formData = new FormData();
      formData.append('file', file);
      return request('/upload/image', {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/form-data' },
        body: formData,
      });
    },
  },

  // Paiements Mobile Money
  payments: {
    initiateMobileMoney: (transactionId: string, telephone: string, moyenPaiement: string) =>
      request('/payments/mobile-money/initiate', {
        method: 'POST',
        body: { transactionId, telephone, moyenPaiement },
      }),

    getStatus: (transactionId: string) =>
      request(`/payments/status/${transactionId}`),
  },

  // Favoris
  favoris: {
    toggle: (articleId: string) =>
      request<{ favori: boolean; message: string }>(`/favoris/toggle/${articleId}`, {
        method: 'POST',
      }),

    list: () => request('/favoris'),

    check: (articleId: string) =>
      request<{ favori: boolean }>(`/favoris/check/${articleId}`),
  },

  // Transactions
  transactions: {
    initiate: (data: { articleId: string; conversationId: string; montant: number; moyenPaiement: string }) =>
      request('/transactions/initiate', {
        method: 'POST',
        body: data,
      }),

    confirmPayment: (id: string, reference: string) =>
      request(`/transactions/confirm-payment/${id}`, {
        method: 'POST',
        body: { reference },
      }),

    confirmReception: (transactionId: string) =>
      request('/transactions/confirm-reception', {
        method: 'POST',
        body: { transactionId },
      }),

    openDispute: (transactionId: string, motif: string) =>
      request('/transactions/dispute', {
        method: 'POST',
        body: { transactionId, motif },
      }),

    list: () => request('/transactions'),

    getById: (id: string) => request(`/transactions/${id}`),
  },

  // Notifications
  notifications: {
    registerToken: (token: string) =>
      request('/notifications/register-token', {
        method: 'POST',
        body: { token },
      }),

    unregisterToken: (token: string) =>
      request('/notifications/unregister-token', {
        method: 'DELETE',
        body: { token },
      }),

    // Historique
    getHistory: (page: number = 1, limit: number = 20) =>
      request(`/notifications/history?page=${page}&limit=${limit}`),

    getUnreadCount: () =>
      request<{ count: number }>('/notifications/unread-count'),

    markAsRead: (id: string) =>
      request(`/notifications/mark-read/${id}`, {
        method: 'POST',
      }),

    markAllAsRead: () =>
      request('/notifications/mark-all-read', {
        method: 'POST',
      }),
  },
};
