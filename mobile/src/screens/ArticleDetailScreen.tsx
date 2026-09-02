import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  Share,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ArticleCardData } from '../components/ArticleCard';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { getTimeAgo } from '../utils/date';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface Props {
  article: ArticleCardData;
  onBack: () => void;
  onContactSeller?: (article: ArticleCardData) => void;
}

export default function ArticleDetailScreen({ article, onBack, onContactSeller }: Props) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(article.favoris || false);
  const { user } = useAuthStore();

  const hasMultiplePhotos = article.photos && article.photos.length > 1;
  const formattedPrice = article.prix.toLocaleString('fr-FR');

  const etatLabels: Record<string, string> = {
    NEUF: 'Neuf',
    COMME_NEUF: 'Comme neuf',
    BON_ETAT: 'Bon état',
    SATISFAISANT: 'Satisfaisant',
  };

  const categorieLabels: Record<string, string> = {
    VETEMENTS: 'Vêtements',
    CHAUSSURES: 'Chaussures',
    ELECTRONIQUE: 'Électronique',
    MAISON: 'Maison',
    AUTRES: 'Autres',
  };

  async function handleShare() {
    try {
      await Share.share({
        message: `Découvre "${article.titre}" sur FasoMarket - ${formattedPrice} FCFA\nhttps://fasomarket.com/article/${article.id}`,
      });
    } catch {}
  }

  function handleWhatsApp() {
    const phone = article.vendeur.telephone;
    if (!phone) {
      Alert.alert('Indisponible', 'Le vendeur n\'a pas renseigné son numéro WhatsApp.');
      return;
    }

    // Formatage pour WhatsApp (enlever les espaces, +, etc si nécessaire)
    const cleanPhone = phone.replace(/\D/g, '');
    const message = encodeURIComponent(`Bonjour, je suis intéressé par votre annonce "${article.titre}" sur FasoMarket.`);
    const url = `whatsapp://send?phone=${cleanPhone}&text=${message}`;

    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        // Fallback web si l'app n'est pas installée
        Linking.openURL(`https://wa.me/${cleanPhone}?text=${message}`);
      }
    });
  }

  function handleContact() {
    if (onContactSeller) {
      onContactSeller(article);
    } else {
      Alert.alert(
        'Contacter le vendeur',
        'La messagerie sera disponible dans une prochaine version.',
      );
    }
  }

  function handleReport() {
    Alert.alert(
      'Signaler cet article',
      'Pourquoi souhaitez-vous signaler cette annonce ?',
      [
        { text: 'Contrefaçon / Produit interdit', onPress: () => submitReport('CONTREFACON') },
        { text: 'Fraude / Arnaque', onPress: () => submitReport('FRAUDE') },
        { text: 'Article déjà vendu', onPress: () => submitReport('VENDU') },
        { text: 'Autre', onPress: () => submitReport('AUTRE') },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  }

  async function submitReport(reason: string) {
    try {
      // Simuler un appel API pour le signalement
      // En production : await api.articles.report(article.id, reason);
      Alert.alert('Merci', 'Votre signalement a été pris en compte. Nos modérateurs vont l\'examiner.');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'envoyer le signalement pour le moment.');
    }
  }

  const isOwnArticle = user?.id === article.vendeur.id;

  return (
    <LinearGradient
      colors={['#FDDCB5', '#FFF0E0', '#FFF8F0']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      {/* Decorative circles */}
      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />

      {/* Header Overlay */}
      <SafeAreaView style={styles.headerOverlay} edges={['top']}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.headerButton} onPress={onBack}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerButton} onPress={async () => {
              try {
                const res = await api.favoris.toggle(article.id);
                setIsFavorite(res.favori);
              } catch {}
            }}>
              <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={handleReport}>
              <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Image Gallery */}
        <View style={styles.imageGallery}>
          {article.photos && article.photos.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(
                  e.nativeEvent.contentOffset.x / SCREEN_WIDTH,
                );
                if (index !== currentImageIndex) {
                  setCurrentImageIndex(Math.max(0, Math.min(index, article.photos.length - 1)));
                }
              }}
            >
              {article.photos.map((photoUrl, index) => (
                <Image
                  key={`${photoUrl}-${index}`}
                  source={photoUrl}
                  style={styles.mainImage}
                  contentFit="cover"
                  transition={500}
                />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.mainImage, styles.imagePlaceholder]}>
              <Ionicons name="image-outline" size={60} color={colors.disabled} />
              <Text style={styles.noImageText}>Aucune photo</Text>
            </View>
          )}

          {/* Dots indicator */}
          {hasMultiplePhotos && (
            <View style={styles.dotsContainer}>
              {article.photos.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    index === currentImageIndex && styles.dotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Price & Title */}
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formattedPrice} FCFA</Text>
            {article.favoris && (
              <View style={styles.favorisBadge}>
                <Ionicons name="heart" size={14} color={colors.error} />
                <Text style={styles.favorisText}>Favori</Text>
              </View>
            )}
          </View>

          <Text style={styles.title}>{article.titre}</Text>

          {/* Badges */}
          <View style={styles.badgesRow}>
            <View style={styles.badge}>
              <Ionicons name="pricetag-outline" size={14} color={colors.primary} />
              <Text style={styles.badgeText}>{categorieLabels[article.categorie] || article.categorie}</Text>
            </View>
            <View style={styles.badge}>
              <Ionicons name="checkmark-circle-outline" size={14} color={colors.secondary} />
              <Text style={styles.badgeText}>{etatLabels[article.etat] || article.etat}</Text>
            </View>
            {article.ville && (
              <View style={styles.badge}>
                <Ionicons name="location-outline" size={14} color={colors.terracotta} />
                <Text style={styles.badgeText}>{article.ville}</Text>
              </View>
            )}
          </View>

          {/* Seller Card */}
          <TouchableOpacity style={styles.sellerCard}>
            <View style={styles.sellerAvatar}>
              <Ionicons name="person" size={24} color={colors.primary} />
            </View>
            <View style={styles.sellerInfo}>
              <View style={styles.sellerNameRow}>
                <Text style={styles.sellerName}>{article.vendeur.nom}</Text>
                {article.vendeur.noteMoyenne && article.vendeur.noteMoyenne >= 4.5 && (
                  <Ionicons name="shield-checkmark" size={16} color={colors.verified} />
                )}
              </View>
              {article.vendeur.noteMoyenne && (
                <View style={styles.sellerRating}>
                  <Ionicons name="star" size={14} color={colors.accent} />
                  <Text style={styles.sellerRatingText}>
                    {article.vendeur.noteMoyenne.toFixed(1)}
                  </Text>
                </View>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.disabled} />
          </TouchableOpacity>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>
              {article.description || 'Aucune description fournie.'}
            </Text>
          </View>

          {/* Info items */}
          <View style={styles.infoGrid}>
            <InfoItem icon="calendar-outline" label="Publié" value={getTimeAgo(article.dateCreation)} />
            <InfoItem icon="eye-outline" label="Catégorie" value={categorieLabels[article.categorie] || article.categorie} />
            <InfoItem icon="checkmark-circle-outline" label="État" value={etatLabels[article.etat] || article.etat} />
            {article.ville && <InfoItem icon="location-outline" label="Ville" value={article.ville} />}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <View style={styles.bottomContent}>
          <View style={styles.bottomPrice}>
            <Text style={styles.bottomPriceText}>{formattedPrice} FCFA</Text>
          </View>
          {isOwnArticle ? (
            <TouchableOpacity style={styles.ownArticleButton} disabled>
              <Text style={styles.ownArticleButtonText}>Votre annonce</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.actionsContainer}>
              <TouchableOpacity style={styles.whatsappButton} onPress={handleWhatsApp} activeOpacity={0.85}>
                <Ionicons name="logo-whatsapp" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.buyButton} onPress={handleContact} activeOpacity={0.85}>
                <Ionicons name="chatbubble-ellipses" size={20} color={colors.textOnPrimary} />
                <Text style={styles.buyButtonText}>Contacter</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function InfoItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoItem}>
      <Ionicons name={icon as any} size={18} color={colors.textSecondary} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Decorative circles
  decorCircle1: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#FF6B35',
    opacity: 0.08,
  },
  decorCircle2: {
    position: 'absolute',
    bottom: 150,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#2ECC71',
    opacity: 0.05,
  },
  scrollView: {
    flex: 1,
  },

  // Header
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Images
  imageGallery: {
    position: 'relative',
  },
  mainImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.85,
    backgroundColor: colors.surfaceVariant,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceVariant,
  },
  noImageText: {
    ...typography.caption,
    marginTop: spacing.sm,
    color: colors.disabled,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: spacing.md,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 20,
  },

  // Content
  content: {
    padding: spacing.md,
    paddingBottom: 100,
  },

  // Price
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  price: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
  },
  favorisBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  favorisText: {
    ...typography.caption,
    color: colors.error,
    fontWeight: '500',
  },
  title: {
    ...typography.h3,
    marginBottom: spacing.md,
  },

  // Badges
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '500',
  },

  // Seller
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  sellerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  sellerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sellerName: {
    ...typography.body,
    fontWeight: '600',
  },
  sellerRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  sellerRatingText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },

  // Description
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
  },

  // Info Grid
  infoGrid: {
    gap: spacing.sm,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  infoValue: {
    ...typography.body,
    fontWeight: '500',
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.lg,
  },
  bottomContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  bottomPrice: {
    flex: 1,
  },
  bottomPriceText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
  },
  actionsContainer: {
    flex: 2,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  whatsappButton: {
    width: 50,
    height: 50,
    backgroundColor: '#25D366',
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    ...shadows.md,
  },
  contactButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
  buyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    ...shadows.md,
  },
  buyButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
  ownArticleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.disabled,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  ownArticleButtonText: {
    ...typography.button,
    color: colors.textSecondary,
  },
});
