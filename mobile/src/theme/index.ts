// FasoMarket — Thème aux couleurs ouest-africaines
export const colors = {
  primary: '#FF6B35',        // Orange soleil
  primaryDark: '#E55A2B',
  primaryLight: '#FF8C5A',

  secondary: '#2ECC71',      // Vert savane
  secondaryDark: '#27AE60',

  accent: '#F1C40F',         // Jaune soleil

  background: '#FFF8F0',     // Crème
  surface: '#FFFFFF',
  surfaceVariant: '#FFF0E0',

  text: '#2C3E50',           // Gris anthracite
  textSecondary: '#7F8C8D',
  textOnPrimary: '#FFFFFF',

  error: '#E74C3C',
  warning: '#F39C12',
  success: '#2ECC71',

  border: '#E8D5C4',
  disabled: '#BDC3C7',

  // Terracotta / Terre cuite
  terracotta: '#D35400',
  terracottaLight: '#E67E22',

  // Couleurs spécifiques
  verified: '#2ECC71',
  pending: '#F1C40F',
  sold: '#E74C3C',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 6,
  md: 12,
  lg: 20,
  full: 999,
};

export const typography = {
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.text,
  },
  h2: {
    fontSize: 22,
    fontWeight: '600' as const,
    color: colors.text,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    color: colors.text,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: colors.textSecondary,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    color: colors.textSecondary,
  },
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
};
