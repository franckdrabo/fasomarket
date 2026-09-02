#!/usr/bin/env python3
"""
generate-assets.py — Génère les assets graphiques pour FasoMarket
- Feature graphic 1024×500 (Google Play)
- Icônes redimensionnées (toutes tailles)
- Adaptive icon foreground/background

Usage:
    python3 scripts/generate-assets.py [chemin-icone-source]

Dépendances: Pillow (pip install Pillow)
"""

import os
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ─── Configuration ───────────────────────────────────────────────────
SOURCE = sys.argv[1] if len(sys.argv) > 1 else "mobile/assets/icon.png"
OUTPUT_ICONS = "mobile/assets/icons"
OUTPUT_FEATURE = "mobile/assets/feature-graphic.png"

ORANGE = (255, 107, 53)
ORANGE_DARK = (229, 90, 43)
ORANGE_DEEP = (211, 84, 0)
WHITE = (255, 255, 255)
CREAM = (255, 248, 240)

ICON_SIZES = {
    # Apple App Store
    "icon-appstore": 1024,
    "icon-iphone-60pt@3x": 180,
    "icon-iphone-60pt@2x": 120,
    "icon-ipad-pro-83pt@2x": 167,
    "icon-ipad-76pt@2x": 152,
    "icon-ipad-76pt@1x": 76,
    "icon-settings-29pt@2x": 58,
    "icon-settings-20pt@2x": 40,
    # Google Play Store
    "icon-play-store": 512,
    "icon-xxxhdpi": 192,
    "icon-xxhdpi": 144,
    "icon-xhdpi": 96,
    "icon-hdpi": 72,
    "icon-mdpi": 48,
    "icon-ldpi": 36,
    # Android Adaptive
    "adaptive-fg": 432,
}


def create_gradient(width, height, color1, color2, direction="horizontal"):
    """Crée un dégradé linéaire."""
    img = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(img)
    for x in range(width):
        ratio = x / width if direction == "horizontal" else 0
        r = int(color1[0] + (color2[0] - color1[0]) * ratio)
        g = int(color1[1] + (color2[1] - color1[1]) * ratio)
        b = int(color1[2] + (color2[2] - color1[2]) * ratio)
        draw.line([(x, 0), (x, height)], fill=(r, g, b))
    return img


def draw_rounded_rect(draw, xy, radius, fill):
    """Dessine un rectangle arrondi."""
    x1, y1, x2, y2 = xy
    draw.rounded_rectangle(xy, radius=radius, fill=fill)


def get_font(size, bold=False):
    """Essaie de charger une police, sinon utilise la police par défaut."""
    font_paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf" if bold else "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/TTF/DejaVuSans.ttf",
    ]
    for path in font_paths:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def generate_feature_graphic(source_img):
    """Génère le feature graphic 1024×500 pour Google Play."""
    W, H = 1024, 500

    # Background gradient
    img = create_gradient(W, H, ORANGE, ORANGE_DEEP, "horizontal")
    draw = ImageDraw.Draw(img)

    # Decorative circles (white, semi-transparent)
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)

    circles = [
        (850, 100, 200),
        (150, 400, 150),
        (600, 450, 100),
        (950, 380, 80),
    ]
    for cx, cy, r in circles:
        overlay_draw.ellipse(
            [cx - r, cy - r, cx + r, cy + r],
            fill=(255, 255, 255, 25)
        )

    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(img)

    # Icon (rounded corners)
    icon_size = 140
    icon_x = 80
    icon_y = (H - icon_size) // 2

    if source_img:
        resized_icon = source_img.resize((icon_size, icon_size), Image.LANCZOS)
        # Create rounded mask
        mask = Image.new("L", (icon_size, icon_size), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rounded_rectangle([0, 0, icon_size - 1, icon_size - 1], radius=28, fill=255)

        img.paste(resized_icon, (icon_x, icon_y), mask)

        # White border
        draw.rounded_rectangle(
            [icon_x, icon_y, icon_x + icon_size, icon_y + icon_size],
            radius=28,
            outline=(255, 255, 255, 77),
            width=3
        )

    text_x = icon_x + icon_size + 40 if source_img else 80

    # App name
    font_name = get_font(56, bold=True)
    draw.text((text_x, H // 2 - 50), "FasoMarket", fill=WHITE, font=font_name)

    # Tagline
    font_tagline = get_font(24)
    draw.text((text_x, H // 2 + 10), "Achetez et vendez en toute confiance", fill=(255, 255, 255, 230), font=font_tagline)

    # Sub-tagline
    font_sub = get_font(18)
    draw.text((text_x, H // 2 + 50), "Orange Money  ·  Moov Money  ·  Wave", fill=(255, 255, 255, 180), font=font_sub)

    # Right side: shopping basket icon (simplified)
    overlay2 = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    overlay2_draw = ImageDraw.Draw(overlay2)
    bx, by = 830, 200
    # Basket body
    overlay2_draw.rounded_rectangle(
        [bx - 55, by, bx + 55, by + 80],
        radius=8,
        fill=(255, 255, 255, 35)
    )
    # Basket handle
    overlay2_draw.arc(
        [bx - 35, by - 50, bx + 35, by + 10],
        start=180, end=0,
        fill=(255, 255, 255, 35),
        width=8
    )
    # Horizontal lines on basket
    for i in range(1, 4):
        y = by + i * 20
        overlay2_draw.line([(bx - 45, y), (bx + 45, y)], fill=(255, 255, 255, 25), width=2)

    img = Image.alpha_composite(img.convert("RGBA"), overlay2).convert("RGB")

    # Save
    os.makedirs(os.path.dirname(OUTPUT_FEATURE), exist_ok=True)
    img.save(OUTPUT_FEATURE, "PNG", optimize=True)
    print(f"   ✅ Feature graphic → {OUTPUT_FEATURE} ({W}×{H})")


def generate_icons(source_img):
    """Redimensionne l'icône en toutes tailles requises."""
    os.makedirs(OUTPUT_ICONS, exist_ok=True)

    for name, size in ICON_SIZES.items():
        resized = source_img.resize((size, size), Image.LANCZOS)
        output = f"{OUTPUT_ICONS}/fasomarket-{name}-{size}x{size}.png"
        resized.save(output, "PNG", optimize=True)
        print(f"   ✅ {name} → {size}×{size}")


def generate_adaptive_bg():
    """Génère le background orange pour l'adaptive icon Android."""
    size = 432
    img = Image.new("RGB", (size, size), ORANGE)
    output = f"{OUTPUT_ICONS}/fasomarket-adaptive-bg-{size}x{size}.png"
    img.save(output, "PNG")
    print(f"   ✅ adaptive-bg → {size}×{size} (orange solid)")


def main():
    print("🖼️  Génération des assets FasoMarket...\n")

    # Load source image
    source_img = None
    if os.path.exists(SOURCE):
        source_img = Image.open(SOURCE).convert("RGBA")
        print(f"📁 Source: {SOURCE} ({source_img.width}×{source_img.height})\n")
    else:
        print(f"⚠️  Source introuvable: {SOURCE}")
        print("   Génération avec placeholder...\n")

    # Generate
    print("📱 Feature Graphic:")
    generate_feature_graphic(source_img)

    print(f"\n🎨 Icônes ({len(ICON_SIZES)} tailles):")
    if source_img:
        generate_icons(source_img)
    else:
        # Generate placeholder icons
        for name, size in ICON_SIZES.items():
            img = Image.new("RGB", (size, size), ORANGE)
            draw = ImageDraw.Draw(img)
            font = get_font(max(size // 3, 12), bold=True)
            bbox = draw.textbbox((0, 0), "B", font=font)
            tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
            draw.text(((size - tw) // 2, (size - th) // 2 - 2), "B", fill=WHITE, font=font)
            output = f"{OUTPUT_ICONS}/fasomarket-{name}-{size}x{size}.png"
            img.save(output, "PNG")
            print(f"   ✅ {name} → {size}×{size} (placeholder)")

    print("\n🎨 Adaptive Icon Background:")
    generate_adaptive_bg()

    # Summary
    files = [f for f in os.listdir(OUTPUT_ICONS) if f.endswith(".png")]
    print(f"\n✅ Terminé ! {len(files)} fichiers générés dans {OUTPUT_ICONS}/")
    print(f"   + Feature graphic: {OUTPUT_FEATURE}")


if __name__ == "__main__":
    main()
