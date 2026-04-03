import { Platform, Dimensions } from 'react-native';

// Stitch-generated color system — deep emerald
export const Colors = {
  light: {
    text: '#00362a',
    textSecondary: '#2f6555',
    textTertiary: '#4c8170',
    background: '#d8fff0',
    backgroundElevated: '#ffffff',
    backgroundGrouped: '#d8fff0',
    backgroundGroupedSecondary: '#b2f6de',
    tint: '#006947',
    icon: '#4c8170',
    tabIconDefault: '#4c8170',
    tabIconSelected: '#006947',
    separator: 'rgba(79, 129, 112, 0.15)',
    destructive: '#b31b25',
    success: '#006947',
    card: '#bffee7',
    cardHighlight: '#a7f1d8',
    inputBackground: '#b2f6de',
    primary: '#006947',
    primaryContainer: '#00feb2',
    onPrimary: '#ffffff',
    surface: '#d8fff0',
    surfaceContainer: '#b2f6de',
    surfaceContainerHigh: '#a7f1d8',
    surfaceContainerHighest: '#9decd2',
    outlineVariant: 'rgba(79, 129, 112, 0.15)',
    tertiary: '#006575',
  },
  dark: {
    text: '#d8fff0',
    textSecondary: '#a7f1d8',
    textTertiary: 'rgba(167, 241, 216, 0.5)',
    background: '#001510',
    backgroundElevated: '#00110c',
    backgroundGrouped: '#001510',
    backgroundGroupedSecondary: '#001d16',
    tint: '#00eea6',
    icon: '#81b8a5',
    tabIconDefault: 'rgba(167, 241, 216, 0.4)',
    tabIconSelected: '#00eea6',
    separator: 'rgba(47, 101, 85, 0.3)',
    destructive: '#ffb4ab',
    success: '#00eea6',
    card: '#001d16',
    cardHighlight: '#002f26',
    inputBackground: 'rgba(0, 47, 38, 0.4)',
    primary: '#00eea6',
    primaryContainer: '#006746',
    onPrimary: '#003825',
    surface: '#001510',
    surfaceContainer: '#00251e',
    surfaceContainerHigh: 'rgba(0, 47, 38, 0.4)',
    surfaceContainerHighest: '#00362a',
    outlineVariant: 'rgba(47, 101, 85, 0.2)',
    tertiary: '#00dcfd',
  },
};

export const Fonts = Platform.select({
  ios: {
    headline: 'system-ui',
    body: 'system-ui',
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    headline: 'normal',
    body: 'normal',
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    headline: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
    body: "'Manrope', system-ui, -apple-system, sans-serif",
    sans: "system-ui, -apple-system, sans-serif",
    serif: "Georgia, serif",
    rounded: "system-ui, sans-serif",
    mono: "SFMono-Regular, Menlo, monospace",
  },
});

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 40,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

const { width } = Dimensions.get('window');
export const isTablet = width >= 768;
export const isDesktop = width >= 1024;
export const contentMaxWidth = 480;
