import { Text, TouchableOpacity, View, Image, Platform } from 'react-native';
import type { ReactNode } from 'react';

const C = {
  white: '#ffffff', low: '#bffee7', container: '#b2f6de',
  primary: '#006947', text: '#00362a', textSec: '#2f6555',
  outline: '#81b8a5',
  font: Platform.OS === 'web' ? "'Plus Jakarta Sans', system-ui, sans-serif" : undefined,
  fontBody: Platform.OS === 'web' ? "'Manrope', system-ui, sans-serif" : undefined,
};
const isWeb = Platform.OS === 'web';

// ── Kategorimapping ──────────────────────────────────────────────────────
// Mapper oppskriftsnavn til emoji + gradient-farger basert på keywords.

export interface RecipeVisual {
  emoji: string;
  gradient: [string, string, string]; // 3 stopp for CSS-gradient
  solidColor: string; // fallback for native
}

const CATEGORIES: { keywords: string[]; visual: RecipeVisual }[] = [
  {
    keywords: ['fisk', 'laks', 'torsk', 'sei', 'hyse', 'sjømat', 'reker', 'skrei', 'makrell', 'sild', 'tunfisk'],
    visual: { emoji: '🐟', gradient: ['#0891b2', '#06b6d4', '#67e8f9'], solidColor: '#06b6d4' },
  },
  {
    keywords: ['suppe', 'buljong', 'kraft'],
    visual: { emoji: '🍲', gradient: ['#d97706', '#f59e0b', '#fde68a'], solidColor: '#f59e0b' },
  },
  {
    keywords: ['kake', 'terte', 'dessert', 'boller', 'paj', 'kjeks', 'muffins', 'sjokolade', 'iskrem', 'pudding', 'pannekake', 'vaffel', 'suksess'],
    visual: { emoji: '🍰', gradient: ['#7c3aed', '#a78bfa', '#ddd6fe'], solidColor: '#a78bfa' },
  },
  {
    keywords: ['pasta', 'bolognese', 'lasagne', 'spaghetti', 'tagliatelle', 'ravioli', 'carbonara', 'pesto'],
    visual: { emoji: '🍝', gradient: ['#dc2626', '#ef4444', '#fca5a5'], solidColor: '#ef4444' },
  },
  {
    keywords: ['pizza'],
    visual: { emoji: '🍕', gradient: ['#ea580c', '#f97316', '#fdba74'], solidColor: '#f97316' },
  },
  {
    keywords: ['kylling', 'chicken'],
    visual: { emoji: '🍗', gradient: ['#c2410c', '#ea580c', '#fb923c'], solidColor: '#ea580c' },
  },
  {
    keywords: ['lam', 'oksekjøtt', 'storfekjøtt', 'biff', 'entrecôte', 'stek', 'ribbe', 'svin', 'bacon', 'kjøttdeig', 'kjøttkaker', 'pølse'],
    visual: { emoji: '🥩', gradient: ['#78350f', '#b45309', '#d97706'], solidColor: '#b45309' },
  },
  {
    keywords: ['vegetar', 'dal', 'linser', 'kikerter', 'bønner', 'tofu', 'quinoa', 'salat', 'grønnsak'],
    visual: { emoji: '🥗', gradient: ['#059669', '#10b981', '#6ee7b7'], solidColor: '#10b981' },
  },
  {
    keywords: ['taco', 'burrito', 'tortilla', 'wrap', 'quesadilla', 'enchilada'],
    visual: { emoji: '🌮', gradient: ['#b45309', '#f59e0b', '#fcd34d'], solidColor: '#f59e0b' },
  },
  {
    keywords: ['sushi', 'ramen', 'nudler', 'asiat', 'thai', 'indisk', 'curry', 'tandoori', 'wok'],
    visual: { emoji: '🍜', gradient: ['#b91c1c', '#dc2626', '#fca5a5'], solidColor: '#dc2626' },
  },
  {
    keywords: ['egg', 'omelett', 'eggerøre', 'frokost'],
    visual: { emoji: '🍳', gradient: ['#ca8a04', '#eab308', '#fde047'], solidColor: '#eab308' },
  },
  {
    keywords: ['brød', 'rundstykke', 'bagel', 'sandwich', 'toast', 'baguette', 'focaccia'],
    visual: { emoji: '🥖', gradient: ['#a16207', '#ca8a04', '#fde047'], solidColor: '#ca8a04' },
  },
  {
    keywords: ['risotto', 'ris'],
    visual: { emoji: '🍚', gradient: ['#84cc16', '#a3e635', '#d9f99d'], solidColor: '#a3e635' },
  },
  {
    keywords: ['burger', 'hamburger'],
    visual: { emoji: '🍔', gradient: ['#92400e', '#d97706', '#fbbf24'], solidColor: '#d97706' },
  },
];

const DEFAULT_VISUAL: RecipeVisual = {
  emoji: '🍽️', gradient: ['#006947', '#059669', '#6ee7b7'], solidColor: '#10b981',
};

export function getRecipeVisual(name: string): RecipeVisual {
  const n = name.toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.keywords.some((kw) => n.includes(kw))) return cat.visual;
  }
  return DEFAULT_VISUAL;
}

// ── Komponent ────────────────────────────────────────────────────────────

export interface RecipeCardProps {
  name: string;
  servings?: number | null;
  description?: string | null;
  sourceLabel?: string | null;
  imageUrl?: string | null;
  ingredientCount?: number | null;
  ingredientStatus?: 'loading' | 'ready' | 'missing' | null;
  variant: 'card' | 'compact';
  selected?: boolean;
  onPress?: () => void;
  right?: ReactNode;
  left?: ReactNode;
  badge?: ReactNode;
}

function GradientHero({ visual, imageUrl, height }: { visual: RecipeVisual; imageUrl?: string | null; height: number }) {
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{ width: '100%', height, backgroundColor: visual.solidColor } as any}
        resizeMode="cover"
      />
    );
  }
  return (
    <View
      style={[
        { height, alignItems: 'center', justifyContent: 'center', backgroundColor: visual.solidColor },
        isWeb ? ({
          background: `linear-gradient(135deg, ${visual.gradient[0]}, ${visual.gradient[1]}, ${visual.gradient[2]})`,
        } as any) : {},
      ]}
    >
      <Text style={{ fontSize: 48 }}>{visual.emoji}</Text>
    </View>
  );
}

function GradientThumb({ visual, imageUrl, size = 64 }: { visual: RecipeVisual; imageUrl?: string | null; size?: number }) {
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{ width: size, height: size, borderRadius: 14, backgroundColor: visual.solidColor } as any}
        resizeMode="cover"
      />
    );
  }
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: visual.solidColor },
        isWeb ? ({
          background: `linear-gradient(135deg, ${visual.gradient[0]}, ${visual.gradient[1]}, ${visual.gradient[2]})`,
        } as any) : {},
      ]}
    >
      <Text style={{ fontSize: size * 0.5 }}>{visual.emoji}</Text>
    </View>
  );
}

function StatusBadge({ count, status }: { count?: number | null; status?: 'loading' | 'ready' | 'missing' | null }) {
  if (status === 'loading') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fff8e1', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 } as any}>
        <Text style={{ fontSize: 10 } as any}>⏳</Text>
        <Text style={{ fontSize: 10, fontWeight: '600', color: '#b45309', fontFamily: C.fontBody } as any}>
          henter...
        </Text>
      </View>
    );
  }
  if (count != null && count > 0) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#e8faf3', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 } as any}>
        <Text style={{ fontSize: 10 } as any}>🛒</Text>
        <Text style={{ fontSize: 10, fontWeight: '700', color: '#006947', fontFamily: C.fontBody } as any}>
          {count} ingredienser
        </Text>
      </View>
    );
  }
  return null;
}

export function RecipeCard({
  name, servings, description, sourceLabel, imageUrl,
  ingredientCount, ingredientStatus,
  variant, selected, onPress, right, left, badge,
}: RecipeCardProps) {
  const visual = getRecipeVisual(name);

  if (variant === 'card') {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={onPress ? 0.85 : 1}
        style={[
          {
            backgroundColor: C.white, borderRadius: 20, overflow: 'hidden',
            borderWidth: 1, borderColor: C.outline + '33',
          },
          isWeb ? ({ boxShadow: '0px 4px 16px rgba(0,54,42,0.06)' } as any) : {},
        ]}
      >
        <GradientHero visual={visual} imageUrl={imageUrl} height={120} />
        <View style={{ padding: 16 } as any}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: C.text, fontFamily: C.font } as any} numberOfLines={1}>
            {name}
          </Text>
          {description && (
            <Text style={{ fontSize: 13, color: C.textSec, fontFamily: C.fontBody, marginTop: 4 } as any} numberOfLines={2}>
              {description}
            </Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' } as any}>
            {servings != null && (
              <View style={{ backgroundColor: C.container, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: C.textSec, fontFamily: C.fontBody } as any}>
                  {servings} porsjoner
                </Text>
              </View>
            )}
            <StatusBadge count={ingredientCount} status={ingredientStatus} />
            {sourceLabel && (
              <Text style={{ fontSize: 11, color: C.outline, fontFamily: C.fontBody } as any}>
                · {sourceLabel}
              </Text>
            )}
            {right && <View style={{ marginLeft: 'auto' } as any}>{right}</View>}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // compact
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      style={[
        {
          backgroundColor: selected ? C.low : C.white,
          borderRadius: 16,
          padding: 12,
          borderWidth: 1.5,
          borderColor: selected ? C.primary + '55' : C.outline + '22',
          flexDirection: 'row', alignItems: 'center', gap: 12,
        } as any,
        isWeb ? ({ boxShadow: '0px 2px 8px rgba(0,54,42,0.04)' } as any) : {},
      ]}
    >
      {left}
      <GradientThumb visual={visual} imageUrl={imageUrl} size={56} />
      <View style={{ flex: 1, minWidth: 0 } as any}>
        <Text
          style={{ fontSize: 15, fontWeight: '700', color: C.text, fontFamily: C.fontBody } as any}
          numberOfLines={1}
        >
          {name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' } as any}>
          {servings != null && (
            <Text style={{ fontSize: 11, color: C.outline, fontFamily: C.fontBody } as any}>
              {servings} porsjoner
            </Text>
          )}
          {badge}
          <StatusBadge count={ingredientCount} status={ingredientStatus} />
        </View>
      </View>
      {right}
    </TouchableOpacity>
  );
}
