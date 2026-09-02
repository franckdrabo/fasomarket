#!/bin/bash
# ──────────────────────────────────────────────────────────────────────
# generate-icons.sh — Redimensionne l'icône FasoMarket en toutes tailles
# requis par Google Play Store et Apple App Store.
#
# Usage:
#   ./scripts/generate-icons.sh [chemin-vers-icone-1024.png]
#
# Dépendances: ImageMagick (convert) OU macOS (sips)
# Sortie: dossier mobile/assets/icons/ avec toutes les tailles
# ──────────────────────────────────────────────────────────────────────

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────
SOURCE="${1:-mobile/assets/icon.png}"
OUTPUT_DIR="mobile/assets/icons"

# Vérifier que l'image source existe
if [ ! -f "$SOURCE" ]; then
  echo "❌ Image source introuvable: $SOURCE"
  echo "Usage: $0 [chemin-vers-icone-1024.png]"
  exit 1
fi

# Créer le dossier de sortie
mkdir -p "$OUTPUT_DIR"

echo "🖼️  Redimensionnement de l'icône FasoMarket..."
echo "   Source: $SOURCE"
echo "   Sortie: $OUTPUT_DIR/"
echo ""

# ─── Détection de l'outil disponible ────────────────────────────────
USE_SIPS=false
USE_CONVERT=false

if command -v convert &> /dev/null; then
  USE_CONVERT=true
  echo "✅ ImageMagick détecté (convert)"
elif command -v sips &> /dev/null; then
  USE_SIPS=true
  echo "✅ macOS sips détecté"
else
  echo "❌ Ni ImageMagick ni sips détecté."
  echo "   Installez ImageMagick: brew install imagemagick (macOS) ou apt install imagemagick (Linux)"
  exit 1
fi

# ─── Fonction de redimensionnement ──────────────────────────────────
resize() {
  local size=$1
  local name=$2
  local output="$OUTPUT_DIR/fasomarket-${name}-${size}x${size}.png"

  if [ "$USE_CONVERT" = true ]; then
    convert "$SOURCE" -resize "${size}x${size}" -quality 100 "$output"
  else
    sips -z "$size" "$size" "$SOURCE" --out "$output" > /dev/null 2>&1
  fi

  echo "   ✅ $name → ${size}×${size}"
}

# ─── Génération des tailles ─────────────────────────────────────────
echo ""
echo "📱 Apple App Store:"
resize 1024 "icon-appstore"
resize 180  "icon-iphone-60pt@3x"
resize 120  "icon-iphone-60pt@2x"
resize 167  "icon-ipad-pro-83pt@2x"
resize 152  "icon-ipad-76pt@2x"
resize 76   "icon-ipad-76pt@1x"
resize 58   "icon-settings-29pt@2x"
resize 40   "icon-settings-20pt@2x"

echo ""
echo "🤖 Google Play Store:"
resize 512  "icon-play-store"
resize 192  "icon-xxxhdpi"
resize 144  "icon-xxhdpi"
resize 96   "icon-xhdpi"
resize 72   "icon-hdpi"
resize 48   "icon-mdpi"
resize 36   "icon-ldpi"

echo ""
echo "🎨 Android Adaptive Icon:"
resize 432  "adaptive-fg"
resize 432  "adaptive-bg"

# ─── Générer l'adaptive icon background ─────────────────────────────
echo ""
echo "🎨 Génération du background adaptive icon..."
BG_OUTPUT="$OUTPUT_DIR/fasomarket-adaptive-bg-432x432.png"

if [ "$USE_CONVERT" = true ]; then
  convert -size 432x432 xc:'#FF6B35' "$BG_OUTPUT"
else
  # Créer un PNG solide orange via Python (plus portable que sips pour les solid colors)
  python3 -c "
import struct, zlib

def create_orange_png(filename, size=432):
    # Orange color #FF6B35
    r, g, b = 255, 107, 53
    raw_data = b''
    for y in range(size):
        raw_data += b'\\x00'  # filter byte
        raw_data += bytes([r, g, b]) * size

    def chunk(chunk_type, data):
        c = chunk_type + data
        crc = zlib.crc32(c) & 0xffffffff
        return struct.pack('>I', len(data)) + c + struct.pack('>I', crc)

    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    compressed = zlib.compress(raw_data)

    with open(filename, 'wb') as f:
        f.write(b'\\x89PNG\\r\\n\\x1a\\n')
        f.write(chunk(b'IHDR', ihdr))
        f.write(chunk(b'IDAT', compressed))
        f.write(chunk(b'IEND', b''))

create_orange_png('$BG_OUTPUT')
" 2>/dev/null
  echo "   ✅ adaptive-bg → 432×432 (orange #FF6B35)"
fi

# ─── Feature Graphic ────────────────────────────────────────────────
echo ""
echo "🖼️  Feature Graphic (1024×500):"
echo "   ℹ️  Utilisez l'outil HTML: docs/generate-assets.html"
echo "   ou générez-le manuellement avec ImageMagick:"
echo "   convert -size 1024x500 xc:'#FF6B35' -fill white -font Helvetica-Bold -pointsize 56 -gravity center -annotate +0-40 'FasoMarket' -pointsize 24 -annotate +0+30 'Achetez et vendez en toute confiance' feature-graphic.png"

# ─── Résumé ──────────────────────────────────────────────────────────
echo ""
echo "✅ Terminé ! $(ls -1 "$OUTPUT_DIR"/*.png 2>/dev/null | wc -l) icônes générées dans $OUTPUT_DIR/"
echo ""
echo "📋 Fichiers générés:"
ls -la "$OUTPUT_DIR"/*.png 2>/dev/null | awk '{print "   " $NF " (" $5 " bytes)"}'
