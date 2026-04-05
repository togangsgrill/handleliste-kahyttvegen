import { Platform } from 'react-native';

// Standardiserte skygger — bruk som spread i style-array:
// style={[base, shadows.card]}
// Kun aktive på web (NativeWind box-shadow-rendering på native er uforutsigbar).
const isWeb = Platform.OS === 'web';

export const shadows = {
  // Standard kort på dashbord og lister
  card: isWeb ? ({ boxShadow: '0px 10px 30px rgba(0,54,42,0.06)' } as any) : {},
  // Lettere variant for sub-kort / radrader
  cardLight: isWeb ? ({ boxShadow: '0px 4px 12px rgba(0,54,42,0.04)' } as any) : {},
  // Hover/elevated (f.eks. aktiv handleprofil-hero)
  cardElevated: isWeb ? ({ boxShadow: '0px 8px 24px rgba(0,54,42,0.10)' } as any) : {},
  // FAB / primære svevende knapper
  fab: isWeb ? ({ boxShadow: '0px 20px 50px rgba(0,105,71,0.30)' } as any) : {},
  // Glass-header (sticky topbar)
  header: isWeb ? ({ boxShadow: '0px 10px 30px rgba(0,54,42,0.06)' } as any) : {},
  // Modal / bottom sheet
  sheet: isWeb ? ({ boxShadow: '0px -20px 60px rgba(0,54,42,0.15)' } as any) : {},
} as const;
