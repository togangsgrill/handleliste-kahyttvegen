// Norwegian grocery chain metadata
// Used for UI branding (colors, icons, logos) and geolocation matching

export interface ChainInfo {
  name: string;
  color: string;         // Primary brand color
  bgColor: string;       // Light background tint
  icon: string;          // MaterialIcons name (fallback)
  shortName: string;     // For compact display
  logoUrl?: string;      // Direct favicon/logo URL
}

export const CHAINS: Record<string, ChainInfo> = {
  'Kiwi': {
    name: 'Kiwi',
    color: '#c8d400',
    bgColor: '#f5f7d6',
    icon: 'local-grocery-store',
    shortName: 'Kiwi',
    logoUrl: 'https://kiwi.no/favicon.ico',
  },
  'Rema 1000': {
    name: 'Rema 1000',
    color: '#0055a0',
    bgColor: '#dfe9f5',
    icon: 'store',
    shortName: 'Rema',
    logoUrl: 'https://www.rema.no/favicon.ico',
  },
  'Coop Extra': {
    name: 'Coop Extra',
    color: '#e30613',
    bgColor: '#fde0e2',
    icon: 'storefront',
    shortName: 'Extra',
    logoUrl: 'https://coop.no/favicon.ico',
  },
  'Coop Mega': {
    name: 'Coop Mega',
    color: '#e30613',
    bgColor: '#fde0e2',
    icon: 'storefront',
    shortName: 'Mega',
    logoUrl: 'https://coop.no/favicon.ico',
  },
  'Coop Prix': {
    name: 'Coop Prix',
    color: '#e30613',
    bgColor: '#fde0e2',
    icon: 'storefront',
    shortName: 'Prix',
    logoUrl: 'https://coop.no/favicon.ico',
  },
  'Coop Obs': {
    name: 'Coop Obs',
    color: '#e30613',
    bgColor: '#fde0e2',
    icon: 'storefront',
    shortName: 'Obs',
    logoUrl: 'https://coop.no/favicon.ico',
  },
  'Meny': {
    name: 'Meny',
    color: '#00843d',
    bgColor: '#d6f0e2',
    icon: 'restaurant',
    shortName: 'Meny',
    logoUrl: 'https://meny.no/favicon-32x32.png',
  },
  'Spar': {
    name: 'Spar',
    color: '#e2001a',
    bgColor: '#fde0e4',
    icon: 'shopping-cart',
    shortName: 'Spar',
    logoUrl: 'https://spar.no/favicon-32x32.png',
  },
  'Eurospar': {
    name: 'Eurospar',
    color: '#e2001a',
    bgColor: '#fde0e4',
    icon: 'shopping-cart',
    shortName: 'Eurospar',
    logoUrl: 'https://spar.no/favicon-32x32.png',
  },
  'Joker': {
    name: 'Joker',
    color: '#e4007c',
    bgColor: '#fde0ef',
    icon: 'local-convenience-store',
    shortName: 'Joker',
    logoUrl: 'https://joker.no/favicon-32x32.png',
  },
  'Bunnpris': {
    name: 'Bunnpris',
    color: '#ffd200',
    bgColor: '#fff8d6',
    icon: 'loyalty',
    shortName: 'Bunnpris',
  },
  'Mester Grønn': {
    name: 'Mester Grønn',
    color: '#4caf50',
    bgColor: '#e8f5e9',
    icon: 'local-florist',
    shortName: 'M.Grønn',
  },
};

export function getChainInfo(chain: string): ChainInfo {
  return CHAINS[chain] ?? {
    name: chain,
    color: '#006947',
    bgColor: '#d8fff0',
    icon: 'store',
    shortName: chain,
  };
}
