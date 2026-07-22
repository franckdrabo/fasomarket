import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../stores/authStore';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

interface Props {
  onNavigate?: (screen: { type: 'transactions' } | { type: 'favoris' }) => void;
}

export default function ProfileScreen({ onNavigate }: Props) {
  const { user, logout } = useAuthStore();

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

  const menuItems = [
    { icon: 'swap-horizontal-outline', label: 'Mes transactions', subtitle: 'Achats, ventes, statuts', route: 'transactions' as const },
    { icon: 'person-outline', label: 'Mes informations', subtitle: 'Nom, téléphone, ville', route: 'info' as const },
    { icon: 'bag-outline', label: 'Mes articles', subtitle: 'Gérer mes annonces', route: 'articles' as const },
    { icon: 'heart-outline', label: 'Mes favoris', subtitle: 'Articles sauvegardés', route: 'favoris' as const },
    { icon: 'star-outline', label: 'Mes avis', subtitle: `Note: ${user?.noteMoyenne || '—'}`, route: 'avis' as const },
    { icon: 'settings-outline', label: 'Paramètres', subtitle: 'Notifications, confidentialité', route: 'settings' as const },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <Text style={styles.screenTitle}>Profil</Text>

        {/* User card */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color={colors.primary} />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.nom || 'Utilisateur'}</Text>
            <Text style={styles.userPhone}>{user?.phone || ''}</Text>
            {user?.ville && (
              <View style={styles.userLocation}>
                <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.locationText}>{user.ville}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.editButton}>
            <Ionicons name="create-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatItem value={user?.nbVentes || 0} label="Ventes" />
          <StatItem value={user?.nbAchats || 0} label="Achats" />
          <StatItem value={user?.noteMoyenne?.toFixed(1) || '—'} label="Note" icon="star" />
        </View>

        {/* Menu */}
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={() => {
                if (item.route === 'transactions') {
                  onNavigate?.({ type: 'transactions' });
                } else if (item.route === 'favoris') {
                  onNavigate?.({ type: 'favoris' });
                }
              }}
            >
              <View style={[styles.menuIcon, item.route === 'transactions' && styles.menuIconHighlight]}>
                <Ionicons
                  name={item.icon as any}
                  size={22}
                  color={item.route === 'transactions' ? colors.primary : colors.primary}
                />
              </View>
              <View style={styles.menuContent}>
                <Text style={[styles.menuLabel, item.route === 'transactions' && styles.menuLabelHighlight]}>
                  {item.label}
                </Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.disabled} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatItem({ value, label, icon }: { value: string | number; label: string; icon?: string }) {
  return (
    <View style={styles.statItem}>
      <View style={styles.statValueRow}>
        {icon && <Ionicons name={icon as any} size={16} color={colors.accent} />}
        <Text style={styles.statValue}>{value}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  screenTitle: {
    ...typography.h2,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },

  // User card
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.md,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  userName: {
    ...typography.h3,
  },
  userPhone: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  userLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  statItem: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    ...typography.caption,
    marginTop: 2,
  },

  // Menu
  menuSection: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
    marginBottom: spacing.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconHighlight: {
    backgroundColor: colors.primary + '15',
  },
  menuContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  menuLabel: {
    ...typography.body,
    fontWeight: '500',
  },
  menuLabelHighlight: {
    fontWeight: '700',
    color: colors.primary,
  },
  menuSubtitle: {
    ...typography.caption,
    marginTop: 2,
  },

  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  logoutText: {
    ...typography.body,
    color: colors.error,
    fontWeight: '500',
  },
});
