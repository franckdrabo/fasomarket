import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export interface BiometricStatus {
  isAvailable: boolean;
  biometryType: LocalAuthentication.AuthenticationType | null;
  errorMessage?: string;
}

/**
 * Vérifie si l'authentification biométrique est disponible sur l'appareil
 */
export async function checkBiometricAvailability(): Promise<BiometricStatus> {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) {
      return {
        isAvailable: false,
        biometryType: null,
        errorMessage: 'Appareil non compatible',
      };
    }

    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) {
      return {
        isAvailable: false,
        biometryType: null,
        errorMessage: Platform.select({
          ios: 'Ajoutez une empreinte ou Face ID dans vos réglages',
          android: 'Ajoutez une empreinte dans vos réglages',
          default: 'Aucune donnée biométrique enregistrée',
        }),
      };
    }

    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const biometryType = types.length > 0 ? types[0] : null;

    return {
      isAvailable: true,
      biometryType,
    };
  } catch (error: any) {
    return {
      isAvailable: false,
      biometryType: null,
      errorMessage: error.message,
    };
  }
}

/**
 * Obtient le nom du type biométrique pour l'affichage
 */
export function getBiometricTypeName(
  type: LocalAuthentication.AuthenticationType | null,
): string {
  switch (type) {
    case LocalAuthentication.AuthenticationType.FINGERPRINT:
      return Platform.select({ ios: 'Touch ID', android: 'Empreinte', default: 'Empreinte' });
    case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
      return Platform.select({ ios: 'Face ID', android: 'Reconnaissance faciale', default: 'Face ID' });
    case LocalAuthentication.AuthenticationType.IRIS:
      return 'Iris';
    default:
      return 'Biométrie';
  }
}

/**
 * Authentifie l'utilisateur via biométrie
 */
export async function authenticateWithBiometric(
  promptMessage?: string,
): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: promptMessage || 'Connectez-vous à FasoMarket',
      fallbackLabel: 'Utiliser le code',
      cancelLabel: 'Annuler',
      disableDeviceFallback: false,
    });

    return result.success;
  } catch {
    return false;
  }
}
