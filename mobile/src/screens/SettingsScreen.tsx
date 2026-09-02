import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../stores/authStore';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';
import { checkBiometricAvailability, getBiometricTypeName } from '../services/biometric';

interface Props {
  onBack: () => void;
}

export default function SettingsScreen({ onBack }: Props) {
  const { biometricEnabled, enableBiometric, disableBiometric, logout } = useAuthStore();
  const [biometricType, setBiometricType] = useState<string>('Biométrie');
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    checkBiometricAvailability().then(status => {
      setBiometricAvailable(status.isAvailable);
      if (status.biometryType) {
        setBiometricType(getBiometricTypeName(status.biometryType));
      }
    });
  }, []);

  async function handleToggleBiometric(value: boolean) {
    if (value) {
      // Pour l'activation, on pourrait demander une authentification immédiate
      // Mais ici on simplifie en utilisant le store
      try {
        await enableBiometric();
        Alert.alert('Succès', `${biometricType} activé pour la connexion.`);
      } catch (error: any) {
        Alert.alert('Erreur', error.message);
      }
    } else {
      await disableBiometric();
    }
  }

  function handleLogout() {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se déconnecter', style: 'destructive', onPress: logout },
      ],
    );
  }

  return (
    <LinearGradient
      colors={['#FDDCB5', '#FFF0E0', '#FFF8F0']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />

      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Paramètres</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Section Sécurité */}
          <Text style={styles.sectionTitle}>Sécurité</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <View style={[styles.iconBox, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="finger-print-outline" size={20} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Connexion {biometricType}</Text>
                  <Text style={styles.settingDesc}>
                    {biometricAvailable
                      ? `Utiliser ${biometricType.toLowerCase()} pour vous connecter`
                      : 'Non disponible sur cet appareil'}
                  </Text>
                </View>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleToggleBiometric}
                disabled={!biometricAvailable}
                trackColor={{ false: '#D1C4B9', true: colors.primary }}
                thumbColor={Platform.OS === 'ios' ? undefined : '#fff'}
              />
            </View>
          </View>

          {/* Section Application */}
          <Text style={styles.sectionTitle}>Application</Text>
          <View style={styles.settingsCard}>
            <TouchableOpacity style={styles.settingItem} onPress={() => Alert.alert('Notifications', 'La gestion granulaire des notifications arrive bientôt.')}>
              <View style={styles.settingInfo}>
                <View style={[styles.iconBox, { backgroundColor: '#3498DB15' }]}>
                  <Ionicons name="notifications-outline" size={20} color="#3498DB" />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Notifications Push</Text>
                  <Text style={styles.settingDesc}>Alertes, messages et ventes</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.disabled} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.settingItem} onPress={() => Alert.alert('Langue', 'Pour l\'instant, FasoMarket est disponible uniquement en Français.')}>
              <View style={styles.settingInfo}>
                <View style={[styles.iconBox, { backgroundColor: colors.secondary + '15' }]}>
                  <Ionicons name="language-outline" size={20} color={colors.secondary} />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Langue</Text>
                  <Text style={styles.settingDesc}>Français</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.disabled} />
            </TouchableOpacity>
          </View>

          {/* Section À propos */}
          <Text style={styles.sectionTitle}>À propos</Text>
          <View style={styles.settingsCard}>
            <TouchableOpacity style={styles.settingItem}>
              <Text style={styles.simpleLabel}>Conditions Générales d&apos;Utilisation</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.disabled} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.settingItem}>
              <Text style={styles.simpleLabel}>Politique de confidentialité</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.disabled} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <View style={styles.settingItem}>
              <Text style={styles.simpleLabel}>Version</Text>
              <Text style={styles.versionText}>2.1.0</Text>
            </View>
          </View>

          {/* Logout */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={colors.error} />
            <Text style={styles.logoutText}>Déconnexion</Text>
          </TouchableOpacity>

          <Text style={styles.footerText}>FasoMarket — Fait avec ❤️ pour l&apos;Afrique</Text>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  decorCircle1: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FF6B35',
    opacity: 0.08,
  },
  decorCircle2: {
    position: 'absolute',
    bottom: 50,
    left: -15,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2ECC71',
    opacity: 0.05,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.h3,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  sectionTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  settingsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingLabel: {
    ...typography.body,
    fontWeight: '600',
  },
  settingDesc: {
    ...typography.caption,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  simpleLabel: {
    ...typography.body,
    color: colors.text,
  },
  versionText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#fff',
    marginTop: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error + '30',
    ...shadows.sm,
  },
  logoutText: {
    ...typography.button,
    color: colors.error,
  },
  footerText: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.xl,
    color: colors.disabled,
  },
});
