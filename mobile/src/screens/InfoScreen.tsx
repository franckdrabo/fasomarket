import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';
import { AnimatedPressable } from '../components/animations';

interface Props {
  onBack: () => void;
}

export default function InfoScreen({ onBack }: Props) {
  const { user, setUser } = useAuthStore();
  const [nom, setNom] = useState(user?.nom || '');
  const [ville, setVille] = useState(user?.ville || '');
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!nom.trim()) {
      Alert.alert('Erreur', 'Le nom est requis');
      return;
    }

    setLoading(true);
    try {
      const updatedUser = await api.auth.updateProfile({
        nom: nom.trim(),
        ville: ville.trim(),
      });
      setUser(updatedUser);
      Alert.alert('Succès', 'Vos informations ont été mises à jour.', [
        { text: 'OK', onPress: onBack },
      ]);
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de mettre à jour le profil');
    } finally {
      setLoading(false);
    }
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
          <Text style={styles.headerTitle}>Mes informations</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.formCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nom d&apos;affichage</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="person-outline" size={20} color={colors.primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={nom}
                    onChangeText={setNom}
                    placeholder="Votre nom"
                    placeholderTextColor={colors.disabled}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Ville</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="location-outline" size={20} color={colors.primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={ville}
                    onChangeText={setVille}
                    placeholder="Votre ville"
                    placeholderTextColor={colors.disabled}
                  />
                </View>
              </View>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
                <Text style={styles.infoText}>
                  Ces informations sont visibles par les autres utilisateurs sur vos annonces et dans le chat.
                </Text>
              </View>

              <AnimatedPressable
                style={[styles.saveButton, loading && styles.buttonDisabled]}
                onPress={handleSave}
                disabled={loading}
              >
                <LinearGradient
                  colors={['#FF6B35', '#E55A2B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientButton}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                      <Text style={styles.saveButtonText}>Enregistrer</Text>
                    </>
                  )}
                </LinearGradient>
              </AnimatedPressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
    left: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FF6B35',
    opacity: 0.08,
  },
  decorCircle2: {
    position: 'absolute',
    bottom: 100,
    right: -15,
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
    paddingTop: spacing.lg,
  },
  formCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.md,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceVariant,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  infoText: {
    ...typography.caption,
    flex: 1,
    lineHeight: 18,
  },
  saveButton: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  saveButtonText: {
    ...typography.button,
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
