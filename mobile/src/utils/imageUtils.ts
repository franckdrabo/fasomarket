import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Compresse et redimensionne une image pour optimiser l'upload.
 * @param uri URI de l'image source
 * @param maxWidth Largeur maximale (défaut 1200px)
 * @param quality Qualité de compression (0 à 1, défaut 0.7)
 */
export async function compressImage(
  uri: string,
  maxWidth: number = 1200,
  quality: number = 0.7
): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  } catch (error) {
    console.error('Erreur lors de la compression de l\'image:', error);
    return uri; // Fallback sur l'originale en cas d'erreur
  }
}
