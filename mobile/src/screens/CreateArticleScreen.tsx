import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../services/api';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

interface Props {
  onBack: () => void;
  onSuccess?: () => void;
}

const CATEGORIES = [
  { id: 'VETEMENTS', label: 'Vêtements', icon: 'shirt-outline' },
  { id: 'CHAUSSURES', label: 'Chaussures', icon: 'footsteps-outline' },
  { id: 'ELECTRONIQUE', label: 'Électronique', icon: 'phone-portrait-outline' },
  { id: 'MAISON', label: 'Maison', icon: 'home-outline' },
  { id: 'AUTRES', label: 'Autres', icon: 'ellipsis-horizontal-outline' },
];

const ETATS = [
  { id: 'NEUF', label: 'Neuf' },
  { id: 'COMME_NEUF', label: 'Comme neuf' },
  { id: 'BON_ETAT', label: 'Bon état' },
  { id: 'SATISFAISANT', label: 'Satisfaisant' },
];

export default function CreateArticleScreen({ onBack, onSuccess }: Props) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [categorie, setCategorie] = useState('');
  const [etat, setEtat] = useState('');
  const [prix, setPrix] = useState('');
  const [ville, setVille] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  async function pickImages() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 6 - photos.length,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const newPhotos = result.assets.map((a) => a.uri);
      setPhotos((prev) => [...prev, ...newPhotos].slice(0, 6));
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission requise', 'Autorisez l\'accès à la caméra dans les réglages.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets) {
      setPhotos((prev) => [...prev, result.assets[0].uri].slice(0, 6));
    }
  }

  function showPhotoPicker() {
    Alert.alert('Ajouter une photo', '', [
      { text: 'Prendre une photo', onPress: takePhoto },
      { text: 'Choisir dans la galerie', onPress: pickImages },
      { text: 'Annuler', style: 'cancel' },
    ]);
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    // Validation
    if (!titre.trim()) {
      Alert.alert('Erreur', 'Le titre est requis');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Erreur', 'La description est requise');
      return;
    }
    if (!categorie) {
      Alert.alert('Erreur', 'Sélectionnez une catégorie');
      return;
    }
    if (!etat) {
      Alert.alert('Erreur', 'Sélectionnez l\'état de l\'article');
      return;
    }
    if (!prix || isNaN(Number(prix)) || Number(prix) <= 0) {
      Alert.alert('Erreur', 'Entrez un prix valide');
      return;
    }
    if (!ville.trim()) {
      Alert.alert('Erreur', 'La ville est requise');
      return;
    }

    setLoading(true);

    try {
      // Upload photos
      const photoUrls: string[] = [];
      if (photos.length > 0) {
        setUploadingPhotos(true);
        for (const uri of photos) {
          const file = {
            uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
            type: 'image/jpeg' as const,
            name: `photo-${Date.now()}.jpg`,
          };
          const result = await api.upload.image(file);
          photoUrls.push(result.url);
        }
        setUploadingPhotos(false);
      }

      // Créer l'article via l'API
      await api.articles.create({
        titre: titre.trim(),
        description: description.trim(),
        categorie,
        etat,
        prix: Number(prix),
        ville: ville.trim(),
        photos: photoUrls,
      });

      Alert.alert('✅ Publié !', 'Votre article a été mis en ligne.', [
        { text: 'OK', onPress: () => onSuccess?.() || onBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de publier l\'article');
    } finally {
      setLoading(false);
      setUploadingPhotos(false);
    }
  }

  const isValid = titre.trim() && description.trim() && categorie && etat && prix && ville.trim();
  const canAddMore = photos.length < 6;

  return (
    <View style={styles.container}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nouvelle annonce</Text>
        <View style={{ width: 40 }} />
      </SafeAreaView>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Photos */}
        <View style={styles.section}>
          <Text style={styles.label}>Photos ({photos.length}/6)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoList}>
            {photos.map((uri, index) => (
              <View key={index} style={styles.photoItem}>
                <Image source={{ uri }} style={styles.photo} />
                <TouchableOpacity
                  style={styles.removePhoto}
                  onPress={() => removePhoto(index)}
                >
                  <Ionicons name="close-circle" size={22} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}
            {canAddMore && (
              <TouchableOpacity style={styles.addPhoto} onPress={showPhotoPicker}>
                <Ionicons name="camera-outline" size={32} color={colors.primary} />
                <Text style={styles.addPhotoText}>Ajouter</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* Titre */}
        <View style={styles.section}>
          <Text style={styles.label}>Titre *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Robe africaine wax taille M"
            placeholderTextColor={colors.disabled}
            value={titre}
            onChangeText={setTitre}
            maxLength={100}
          />
          <Text style={styles.charCount}>{titre.length}/100</Text>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Décrivez votre article en détail..."
            placeholderTextColor={colors.disabled}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Catégorie */}
        <View style={styles.section}>
          <Text style={styles.label}>Catégorie *</Text>
          <View style={styles.optionsGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.optionChip,
                  categorie === cat.id && styles.optionChipActive,
                ]}
                onPress={() => setCategorie(cat.id)}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={20}
                  color={categorie === cat.id ? colors.textOnPrimary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.optionChipText,
                    categorie === cat.id && styles.optionChipTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* État */}
        <View style={styles.section}>
          <Text style={styles.label}>État *</Text>
          <View style={styles.optionsRow}>
            {ETATS.map((e) => (
              <TouchableOpacity
                key={e.id}
                style={[styles.radioChip, etat === e.id && styles.radioChipActive]}
                onPress={() => setEtat(e.id)}
              >
                <View style={[styles.radio, etat === e.id && styles.radioActive]}>
                  {etat === e.id && <View style={styles.radioInner} />}
                </View>
                <Text style={[styles.radioLabel, etat === e.id && styles.radioLabelActive]}>
                  {e.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Prix */}
        <View style={styles.section}>
          <Text style={styles.label}>Prix *</Text>
          <View style={styles.priceInputContainer}>
            <TextInput
              style={[styles.input, styles.priceInput]}
              placeholder="0"
              placeholderTextColor={colors.disabled}
              value={prix}
              onChangeText={setPrix}
              keyboardType="number-pad"
            />
            <Text style={styles.currencyText}>FCFA</Text>
          </View>
        </View>

        {/* Ville */}
        <View style={styles.section}>
          <Text style={styles.label}>Ville *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Abidjan, Dakar, Ouagadougou..."
            placeholderTextColor={colors.disabled}
            value={ville}
            onChangeText={setVille}
          />
        </View>

        {/* Spacer for bottom button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Submit */}
      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.submitButton, (!isValid || loading) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!isValid || loading}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.textOnPrimary} size="small" />
              <Text style={styles.submitButtonText}>
                {uploadingPhotos ? 'Upload des photos...' : 'Publication...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.submitButtonText}>Publier l'annonce</Text>
          )}
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
    flex: 1,
    textAlign: 'center',
  },

  scrollView: {
    flex: 1,
  },

  // Sections
  section: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  label: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  textArea: {
    minHeight: 100,
    paddingTop: spacing.md,
  },
  charCount: {
    ...typography.caption,
    textAlign: 'right',
    marginTop: spacing.xs,
  },

  // Photos
  photoList: {
    flexDirection: 'row',
  },
  photoItem: {
    position: 'relative',
    marginRight: spacing.sm,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceVariant,
  },
  removePhoto: {
    position: 'absolute',
    top: -6,
    right: -6,
  },
  addPhoto: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceVariant,
  },
  addPhotoText: {
    ...typography.caption,
    color: colors.primary,
    marginTop: 4,
  },

  // Options
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionChipText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  optionChipTextActive: {
    color: colors.textOnPrimary,
  },

  // Radio chips
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  radioChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  radioChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceVariant,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.disabled,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  radioLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  radioLabelActive: {
    color: colors.primary,
  },

  // Price
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  priceInput: {
    flex: 1,
  },
  currencyText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },

  // Bottom
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.lg,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    ...shadows.md,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
