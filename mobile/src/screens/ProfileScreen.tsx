import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, BounceIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { compressImage } from '../utils/imageUtils';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

interface Props {
  onNavigate?: (screen: { type: 'favoris' } | { type: 'myArticles' } | { type: 'info' } | { type: 'settings' }) => void;
  onActivateSeller?: () => void;
}

export default function ProfileScreen({ onNavigate, onActivateSeller }: Props) {
  const { user, logout, setUser } = useAuthStore();
  const [isUploading, setIsUploading] = useState(false);

  async function handleChangeAvatar() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) return;

      setIsUploading(true);
      const originalUri = result.assets[0].uri;

      // 1. Compression
      const compressedUri = await compressImage(originalUri, 400); // 400px suffit pour un avatar

      // 2. Upload (simulé ou réel)
      const uploadResult = await api.upload.image(compressedUri);
      const avatarUrl = uploadResult.url;

      // 3. Update profile
      const updatedUser = await api.auth.updateProfile({ avatar: avatarUrl });
      setUser(updatedUser);

      Alert.alert('Succès', 'Votre photo de profil a été mise à jour.');
    } catch (error) {
      console.error('Avatar upload error:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour la photo de profil.');
    } finally {
      setIsUploading(false);
    }
  }

  function handleLogout() {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },                { text: 'Se déconnecter', style: 'destructive', onPress: logout },
      ],
    );
  }

  // NOTE : « Mes transactions » (escrow) a été retiré : l'achat se fait 100%
  // en P2P via la messagerie, il n'y a plus de transactions à suivre.
  const menuItems = [
    { icon: 'bag-outline', label: 'Mes articles', subtitle: 'Gérer mes annonces', route: 'myArticles' as const },
    { icon: 'heart-outline', label: 'Mes favoris', subtitle: 'Articles sauvegardés', route: 'favoris' as const },
    { icon: 'star-outline', label: 'Mes avis', subtitle: `Note: ${user?.noteMoyenne || '—'}`, route: 'avis' as const },
    { icon: 'person-outline', label: 'Mes informations', subtitle: 'Nom, email, ville', route: 'info' as const },
    { icon: 'settings-outline', label: 'Paramètres', subtitle: 'Notifications, confidentialité', route: 'settings' as const },
  ];

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <Animated.View entering={FadeIn.duration(600)}>
            <Text style={styles.screenTitle}>Profil</Text>
          </Animated.View>

          {/* User card */}
          <Animated.View entering={BounceIn.duration(600).delay(100)} style={styles.userCard}>
            <LinearGradient
              colors={['#FFF0E0', '#FFE8D6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.userCardGradient}
            >
              <View style={styles.avatarRow}>
                <TouchableOpacity
                  style={styles.avatarContainer}
                  onPress={handleChangeAvatar}
                  disabled={isUploading}
                >
                  <View style={styles.avatar}>
                    {user?.avatar ? (
                      <Image
                        source={{ uri: user.avatar }}
                        style={styles.avatarImage}
                      />
                    ) : (
                      <LinearGradient
                        colors={[colors.primary, colors.primaryDark]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.avatarGradient}
                      >
                        <Ionicons name="person" size={28} color={colors.textOnPrimary} />
                      </LinearGradient>
                    )}
                    {isUploading && (
                      <View style={styles.avatarOverlay}>
                        <ActivityIndicator color="#fff" />
                      </View>
                    )}
                  </View>
                  <View style={styles.editBadge}>
                    <Ionicons name="camera" size={12} color="#fff" />
                  </View>
                </TouchableOpacity>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user?.nom || 'Utilisateur'}</Text>
                  
                  {/* Badge de rôle */}
                  <View style={styles.roleBadgeRow}>
                    <View style={[
                      styles.roleBadge,
                      user?.role === 'SELLER' ? styles.roleBadgeSeller : styles.roleBadgeBuyer,
                    ]}>
                      <Ionicons
                        name={user?.role === 'SELLER' ? 'storefront-outline' : 'cart-outline'}
                        size={12}
                        color={user?.role === 'SELLER' ? colors.primary : colors.secondary}
                      />
                      <Text style={[
                        styles.roleBadgeText,
                        user?.role === 'SELLER' ? styles.roleBadgeTextSeller : styles.roleBadgeTextBuyer,
                      ]}>
                        {user?.role === 'SELLER' ? 'Vendeur' : 'Acheteur'}
                      </Text>
                    </View>
                    {user?.sellerFeePaid && (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="shield-checkmark" size={12} color={colors.success} />
                        <Text style={styles.verifiedText}>Activé</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.userPhone}>{user?.email || user?.phone || ''}</Text>
                  {user?.ville && (
                    <View style={styles.userLocation}>
                      <Ionicons name="location-outline" size={14} color={colors.primary} />
                      <Text style={styles.locationText}>{user.ville}</Text>
                    </View>
                  )}
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Bannière activation vendeur (visible pour tout compte connecté non activé) */}
          {user && !user?.sellerFeePaid && (
            <Animated.View entering={BounceIn.duration(600).delay(150)} style={styles.activationBanner}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => onActivateSeller?.()}
              >
                <LinearGradient
                  colors={['#FF6B35', '#E55A2B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.activationGradient}
                >
                  <View style={styles.activationContent}>
                    <View style={styles.activationIcon}>
                      <Ionicons name="lock-closed" size={20} color="#fff" />
                    </View>
                    <View style={styles.activationTextCol}>
                      <Text style={styles.activationTitle}>Compte vendeur pas encore activé</Text>
                      <Text style={styles.activationDesc}>
                        Payez 1 000 FCFA pour activer votre compte et commencer à vendre
                      </Text>
                    </View>
                    <View style={styles.activationArrow}>
                      <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Stats */}
          <Animated.View entering={FadeIn.duration(600).delay(200)} style={styles.statsRow}>
            <StatItem value={user?.nbVentes || 0} label="Ventes" icon="arrow-up" />
            <StatItem value={user?.nbAchats || 0} label="Achats" icon="arrow-down" />
            <StatItem value={user?.noteMoyenne?.toFixed(1) || '—'} label="Note" icon="star" />
          </Animated.View>

          {/* Menu */}
          <Animated.View entering={FadeIn.duration(600).delay(300)} style={styles.menuSection}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.menuItem, index === menuItems.length - 1 && styles.menuItemLast]}
                onPress={() => {
                  if (item.route === 'favoris') {
                    onNavigate?.({ type: 'favoris' });
                  } else if (item.route === 'myArticles') {
                    onNavigate?.({ type: 'myArticles' });
                  } else if (item.route === 'info') {
                    onNavigate?.({ type: 'info' });
                  } else if (item.route === 'settings') {
                    onNavigate?.({ type: 'settings' });
                  } else if (item.route === 'avis') {
                    Alert.alert('Avis', 'Le système d\'avis et de notations arrive bientôt.');
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={styles.menuLeft}>
                  <View style={[
                    styles.menuIcon,
                    item.route === 'favoris' && styles.menuIconHeart,
                  ]}>
                    <Ionicons
                      name={item.icon as any}
                      size={20}
                      color={
                        item.route === 'favoris'
                          ? colors.textOnPrimary
                          : colors.primary
                      }
                    />
                  </View>
                  <View style={styles.menuContent}>
                    <Text style={[
                      styles.menuLabel,
                      item.route === 'favoris' && styles.menuLabelHighlight,
                    ]}>
                      {item.label}
                    </Text>
                    <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.disabled} />
              </TouchableOpacity>
            ))}
          </Animated.View>

          {/* Logout */}
          <View style={styles.logoutWrapper}>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
              <Ionicons name="log-out-outline" size={20} color={colors.textOnPrimary} />
              <Text style={styles.logoutText}>Se déconnecter</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function StatItem({ value, label, icon }: { value: string | number; label: string; icon?: string }) {
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.statItem}>
      <View style={styles.statIconRow}>
        {icon && (
          <View style={styles.statIcon}>
            <Ionicons name={icon as any} size={14} color={colors.primary} />
          </View>
        )}
        <Text style={styles.statValue}>{value}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  },
  screenTitle: {
    ...typography.h2,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },

  // User card
  userCard: {
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  userCardGradient: {
    padding: spacing.lg,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: colors.surfaceVariant,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: '#FFF0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  userName: {
    ...typography.h3,
    fontSize: 20,
  },
  // ─── Badge rôle ─────────────────────────────────────────────────────
  roleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  roleBadgeBuyer: {
    backgroundColor: colors.secondary + '15',
  },
  roleBadgeSeller: {
    backgroundColor: colors.primary + '15',
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  roleBadgeTextBuyer: {
    color: colors.secondary,
  },
  roleBadgeTextSeller: {
    color: colors.primary,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.success + '15',
    borderRadius: 4,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.success,
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
    color: colors.primary,
    fontWeight: '500',
  },

  // ─── Bannière activation vendeur ─────────────────────────────────────
  activationBanner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  activationGradient: {
    padding: spacing.md,
  },
  activationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  activationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activationTextCol: {
    flex: 1,
  },
  activationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  activationDesc: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
    lineHeight: 16,
  },
  activationArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    ...typography.caption,
    marginTop: 4,
  },

  // Menu
  menuSection: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  menuIconHeart: {
    backgroundColor: colors.secondary,
  },
  menuContent: {
    flex: 1,
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
  logoutWrapper: {
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  logoutButton: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  logoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  logoutText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
});
