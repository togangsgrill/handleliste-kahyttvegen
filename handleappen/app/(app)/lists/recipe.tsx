import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Text, TextInput, TouchableOpacity, View, ScrollView,
  Platform, ActivityIndicator, Image, Modal,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { parseRecipeFromImage, parseRecipe, type RecipeParseResult } from '@/lib/claude';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import type { Database } from '@/types/database';

type ShoppingList = Database['public']['Tables']['shopping_lists']['Row'];

const C = {
  bg: '#d8fff0', white: '#ffffff', low: '#bffee7', container: '#b2f6de',
  high: '#a7f1d8', highest: '#9decd2', primary: '#006947',
  primaryContainer: '#00feb2', onPrimaryFixed: '#00472f',
  text: '#00362a', textSec: '#2f6555', outline: '#81b8a5',
  tertiary: '#006575', error: '#b31b25',
  font: "'Plus Jakarta Sans', system-ui, sans-serif",
  fontBody: "'Manrope', system-ui, sans-serif",
};
const isWeb = Platform.OS === 'web';

// ── Steps ──────────────────────────────────────────────────────────────────
type Step = 'input' | 'confirm-source' | 'ingredients' | 'done';

interface ParsedIngredient {
  name: string;
  quantity: number;
  unit: string | null;
  is_staple: boolean;
  selected: boolean;
  allergens?: string[];
  substitute?: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatQty(q: number) {
  if (q === Math.round(q)) return String(q);
  return q.toFixed(1).replace(/\.0$/, '');
}

function scaleIngredients(
  ingredients: ParsedIngredient[],
  baseServings: number,
  targetServings: number,
): ParsedIngredient[] {
  const ratio = targetServings / baseServings;
  return ingredients.map((i) => ({ ...i, quantity: Math.round(i.quantity * ratio * 10) / 10 }));
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', web: 'Nettsted/Blogg',
  book: 'Kokebok', unknown: 'Ukjent',
};

// Map Claude's source_type output to DB-gyldige verdier
function normalizeSourceType(t: string | null): string | null {
  if (!t) return null;
  const map: Record<string, string> = {
    blog: 'web', website: 'web', cookbook: 'book', kokebok: 'book',
    instagram: 'instagram', tiktok: 'tiktok', unknown: 'unknown',
  };
  return map[t.toLowerCase()] ?? 'unknown';
}

// ── Component ──────────────────────────────────────────────────────────────
export default function RecipeImportScreen() {
  const insets = useSafeAreaInsets();
  const householdId = useAuthStore((s) => s.householdId);
  const userId = useAuthStore((s) => s.userId);

  // Lists (no Realtime — avoids duplicate channel error)
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [householdAllergens, setHouseholdAllergens] = useState<string[]>([]);
  useEffect(() => {
    if (!householdId) return;
    supabase
      .from('shopping_lists').select('id, name')
      .eq('household_id', householdId).eq('is_deleted', false)
      .order('updated_at', { ascending: false })
      .then(({ data }) => { if (data) setLists(data as ShoppingList[]); });
    supabase
      .from('households').select('allergens').eq('id', householdId).single()
      .then(({ data }) => { if (data) setHouseholdAllergens(data.allergens ?? []); });
  }, [householdId]);

  // ── State ────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image input
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMediaType, setImageMediaType] = useState<string>('image/jpeg');
  const [textInput, setTextInput] = useState('');
  const [inputMode, setInputMode] = useState<'image' | 'text'>('image');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Parsed result
  const [parsed, setParsed] = useState<RecipeParseResult | null>(null);

  // Source confirmation
  const [sourceLabel, setSourceLabel] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceType, setSourceType] = useState<string | null>(null);

  // Ingredients + servings
  const [baseServings, setBaseServings] = useState(4);
  const [targetServings, setTargetServings] = useState(4);
  const [ingredients, setIngredients] = useState<ParsedIngredient[]>([]);

  // List selection
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [showListPicker, setShowListPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedRecipeName, setSavedRecipeName] = useState<string | null>(null);

  // ── Image picker (web) ───────────────────────────────────────────────────
  const handleFileChange = useCallback((e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      // dataUrl = "data:image/jpeg;base64,/9j/..."
      const [header, b64] = dataUrl.split(',');
      const mt = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
      setImageUri(dataUrl);
      setImageBase64(b64);
      setImageMediaType(mt);
      setError(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const openFilePicker = () => {
    if (isWeb) {
      if (!fileInputRef.current) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', handleFileChange);
        fileInputRef.current = input;
      }
      fileInputRef.current.click();
    }
  };

  // ── Parse ────────────────────────────────────────────────────────────────
  const handleParse = useCallback(async () => {
    setLoading(true);
    setError(null);
    setParsed(null);
    try {
      let result: RecipeParseResult;
      if (inputMode === 'image' && imageBase64) {
        result = await parseRecipeFromImage(imageBase64, imageMediaType, householdAllergens);
      } else if (inputMode === 'text' && textInput.trim()) {
        result = await parseRecipe(textInput.trim(), householdAllergens);
      } else {
        setError('Velg et bilde eller skriv inn oppskriftstekst.');
        setLoading(false);
        return;
      }

      setParsed(result);
      setSourceLabel(result.source_label ?? '');
      setSourceUrl(result.source_url ?? '');
      setSourceType(normalizeSourceType(result.source_type));
      const servings = result.servings ?? 4;
      setBaseServings(servings);
      setTargetServings(servings);
      setIngredients(result.ingredients.map((i) => ({ ...i, selected: !i.is_staple, allergens: i.allergens ?? [], substitute: i.substitute ?? null })));
      setStep('confirm-source');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ukjent feil');
    } finally {
      setLoading(false);
    }
  }, [inputMode, imageBase64, imageMediaType, textInput]);

  // ── Scaled ingredients ───────────────────────────────────────────────────
  const scaledIngredients = baseServings === targetServings
    ? ingredients
    : scaleIngredients(ingredients, baseServings, targetServings);

  const selectedCount = scaledIngredients.filter((i) => i.selected).length;

  const toggleIngredient = (idx: number) =>
    setIngredients((prev) => prev.map((item, i) => i === idx ? { ...item, selected: !item.selected } : item));

  // ── Save & add to list ───────────────────────────────────────────────────
  const handleSave = async () => {
    if (!householdId || !selectedListId || selectedCount === 0 || !parsed) return;
    setSaving(true);

    // 1. Insert recipe
    const { data: recipeRow, error: recipeErr } = await supabase
      .from('recipes')
      .insert({
        household_id: householdId,
        name: parsed.title,
        base_servings: baseServings,
        image_url: null, // base64 lagres ikke i DB
        source_type: normalizeSourceType(sourceType),
        source_label: sourceLabel.trim() || null,
        source_url: sourceUrl.trim() || null,
        source_confidence: parsed.source_confidence ?? null,
        description: parsed.description ?? null,
        description_is_ai: true,
      })
      .select('id')
      .single();

    if (recipeErr || !recipeRow) {
      setError(`Kunne ikke lagre oppskriften: ${recipeErr?.message ?? 'ukjent feil'}`);
      setSaving(false);
      return;
    }

    const recipeId = recipeRow.id;

    // 2. Insert recipe_ingredients (all, at base servings)
    await supabase.from('recipe_ingredients').insert(
      ingredients.map((ing) => ({
        recipe_id: recipeId,
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
      }))
    );

    // 3. Add selected (scaled) ingredients to list with recipe_id link
    const selected = scaledIngredients.filter((i) => i.selected);
    await supabase.from('list_items').insert(
      selected.map((ing) => ({
        list_id: selectedListId,
        name: ing.name,
        quantity: Math.max(1, Math.round(ing.quantity)) || 1,
        note: ing.unit ? `${formatQty(ing.quantity)} ${ing.unit} · fra ${parsed.title}` : `fra ${parsed.title}`,
        recipe_id: recipeId,
        is_checked: false,
        is_deleted: false,
      }))
    );

    setSavedRecipeName(parsed.title);
    setSaving(false);
    setStep('done');
  };

  // ── Render helpers ───────────────────────────────────────────────────────
  const cardStyle = [
    { backgroundColor: C.white, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.outline + '33' },
    isWeb ? ({ boxShadow: '0px 4px 12px rgba(0,54,42,0.04)' } as any) : {},
  ];

  const primaryBtn = (label: string, onPress: () => void, disabled = false, loading = false) => (
    <TouchableOpacity
      style={[{
        paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
        flexDirection: 'row', gap: 8,
        backgroundColor: disabled ? C.outline + '66' : C.primary,
      } as any, isWeb && !disabled ? ({ boxShadow: '0px 4px 16px rgba(0,105,71,0.3)' } as any) : {}]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading
        ? <><ActivityIndicator color={C.white} size="small" /><Text style={{ color: C.white, fontSize: 16, fontWeight: '700', fontFamily: C.font } as any}>Venter...</Text></>
        : <Text style={{ color: C.white, fontSize: 16, fontWeight: '700', fontFamily: C.font } as any}>{label}</Text>}
    </TouchableOpacity>
  );

  // ── STEP: input ──────────────────────────────────────────────────────────
  const renderInput = () => (
    <>
      {/* Tab switcher */}
      <View style={{ flexDirection: 'row', backgroundColor: C.low, borderRadius: 12, padding: 4, marginBottom: 20 }}>
        {(['image', 'text'] as const).map((mode) => (
          <TouchableOpacity
            key={mode}
            onPress={() => setInputMode(mode)}
            activeOpacity={0.7}
            style={{
              flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
              backgroundColor: inputMode === mode ? C.white : 'transparent',
              ...(isWeb && inputMode === mode ? ({ boxShadow: '0px 2px 8px rgba(0,54,42,0.08)' } as any) : {}),
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: inputMode === mode ? C.primary : C.textSec, fontFamily: C.fontBody } as any}>
              {mode === 'image' ? '📷  Bilde / skjermbilde' : '📝  Lim inn tekst'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {inputMode === 'image' ? (
        <TouchableOpacity
          onPress={openFilePicker}
          activeOpacity={0.8}
          style={[{
            borderRadius: 20, borderWidth: 2, borderColor: imageUri ? C.primary : C.outline + '66',
            borderStyle: imageUri ? 'solid' : 'dashed',
            overflow: 'hidden', minHeight: 200,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: imageUri ? 'transparent' : C.low + '88',
          } as any]}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={{ width: '100%', height: 280 } as any} resizeMode="cover" />
          ) : (
            <View style={{ alignItems: 'center', gap: 12, padding: 32 } as any}>
              <MaterialIcons name="add-photo-alternate" size={48} color={C.outline} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: C.textSec, fontFamily: C.fontBody, textAlign: 'center' } as any}>
                Trykk for å velge bilde{'\n'}
                <Text style={{ fontSize: 13, fontWeight: '400' } as any}>
                  Screenshot fra Instagram, TikTok, blogg eller kokebok
                </Text>
              </Text>
            </View>
          )}
        </TouchableOpacity>
      ) : (
        <View style={cardStyle}>
          <TextInput
            style={{ minHeight: 160, fontSize: 15, color: C.text, fontFamily: C.fontBody, textAlignVertical: 'top' } as any}
            placeholder={'Lim inn oppskrift her...\n\nEksempel:\n4 egg\n3 dl mel\n200 g smør\n1 ts bakepulver'}
            placeholderTextColor={C.outline}
            value={textInput}
            onChangeText={setTextInput}
            multiline
            numberOfLines={8}
          />
        </View>
      )}

      {error && (
        <View style={{ marginTop: 16, backgroundColor: 'rgba(179,27,37,0.08)', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 } as any}>
          <MaterialIcons name="error-outline" size={18} color={C.error} />
          <Text style={{ flex: 1, fontSize: 14, color: C.error, fontFamily: C.fontBody } as any}>{error}</Text>
        </View>
      )}

      <View style={{ marginTop: 16 }}>
        {primaryBtn(
          '✨  Analyser oppskrift',
          handleParse,
          (inputMode === 'image' && !imageBase64) || (inputMode === 'text' && !textInput.trim()),
          loading,
        )}
      </View>
    </>
  );

  // ── STEP: confirm-source ─────────────────────────────────────────────────
  const renderConfirmSource = () => (
    <>
      {imageUri && (
        <Image source={{ uri: imageUri }} style={{ width: '100%', height: 160, borderRadius: 16, marginBottom: 16 } as any} resizeMode="cover" />
      )}

      <View style={[cardStyle, { marginBottom: 16 }]}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: C.text, fontFamily: C.font, marginBottom: 4 } as any}>{parsed?.title}</Text>
        {parsed?.description && (
          <Text style={{ fontSize: 14, color: C.textSec, fontFamily: C.fontBody, marginBottom: 4, fontStyle: 'italic' } as any}>
            {parsed.description}
            <Text style={{ fontSize: 11, color: C.outline } as any}> (AI-generert)</Text>
          </Text>
        )}
        <Text style={{ fontSize: 13, color: C.textSec, fontFamily: C.fontBody } as any}>{parsed?.ingredients.length} ingredienser · {baseServings} porsjoner</Text>
      </View>

      <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.textSec, fontFamily: C.fontBody, marginBottom: 10 } as any}>
        Kilde — bekreft eller korriger
      </Text>

      {/* Source type chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
          <TouchableOpacity
            onPress={() => setSourceType(null)}
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: sourceType === null ? C.primary : C.low }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: sourceType === null ? C.white : C.textSec, fontFamily: C.fontBody } as any}>Ukjent</Text>
          </TouchableOpacity>
          {Object.entries(SOURCE_TYPE_LABELS).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              onPress={() => setSourceType(key)}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: sourceType === key ? C.primary : C.low }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: sourceType === key ? C.white : C.textSec, fontFamily: C.fontBody } as any}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={{ gap: 10, marginBottom: 20 }}>
        <TextInput
          style={[{ backgroundColor: C.low, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: C.text, fontFamily: C.fontBody } as any]}
          placeholder="Kilde / brukernavn (f.eks. @matblogg)"
          placeholderTextColor={C.outline}
          value={sourceLabel}
          onChangeText={setSourceLabel}
        />
        <TextInput
          style={[{ backgroundColor: C.low, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: C.text, fontFamily: C.fontBody } as any]}
          placeholder="URL (valgfritt)"
          placeholderTextColor={C.outline}
          value={sourceUrl}
          onChangeText={setSourceUrl}
          keyboardType="url"
          autoCapitalize="none"
        />
      </View>

      {primaryBtn('Gå til ingredienser →', () => setStep('ingredients'))}
    </>
  );

  // ── STEP: ingredients ────────────────────────────────────────────────────
  const renderIngredients = () => (
    <>
      {/* Servings scaler */}
      <View style={[cardStyle, { marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, fontFamily: C.font } as any}>Porsjoner</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 } as any}>
          <TouchableOpacity
            style={{ width: 36, height: 36, borderRadius: 999, backgroundColor: C.low, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => setTargetServings((v) => Math.max(1, v - 1))}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 20, color: C.text }}>−</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: '700', color: C.text, minWidth: 28, textAlign: 'center' } as any}>{targetServings}</Text>
          <TouchableOpacity
            style={{ width: 36, height: 36, borderRadius: 999, backgroundColor: C.low, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => setTargetServings((v) => v + 1)}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 20, color: C.text }}>+</Text>
          </TouchableOpacity>
        </View>
        {targetServings !== baseServings && (
          <Text style={{ fontSize: 11, color: C.textSec, fontFamily: C.fontBody } as any}>
            (oppr. {baseServings})
          </Text>
        )}
      </View>

      {/* Select all / none */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 10 } as any}>
        <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.textSec, fontFamily: C.font } as any}>
          {selectedCount}/{scaledIngredients.length} valgt
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 } as any}>
          <TouchableOpacity onPress={() => setIngredients((p) => p.map((i) => ({ ...i, selected: true })))} activeOpacity={0.7}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.primary, fontFamily: C.fontBody } as any}>Alle</Text>
          </TouchableOpacity>
          <Text style={{ color: C.outline }}>·</Text>
          <TouchableOpacity onPress={() => setIngredients((p) => p.map((i) => ({ ...i, selected: false })))} activeOpacity={0.7}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.textSec, fontFamily: C.fontBody } as any}>Ingen</Text>
          </TouchableOpacity>
        </View>
      </View>

      {(() => {
        const renderIngredientRow = (ing: ParsedIngredient, globalIdx: number, isLast: boolean) => {
          const hasAllergen = (ing.allergens?.length ?? 0) > 0;
          return (
            <TouchableOpacity
              key={`${ing.name}-${globalIdx}`}
              onPress={() => toggleIngredient(globalIdx)}
              activeOpacity={0.7}
              style={[
                { paddingVertical: 12, paddingHorizontal: 16, gap: 4 } as any,
                !isLast ? { borderBottomWidth: 1, borderBottomColor: 'rgba(129,184,165,0.15)' } : {},
                !ing.selected ? { opacity: 0.45 } : {},
                hasAllergen ? { backgroundColor: 'rgba(255,200,0,0.06)' } : {},
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 } as any}>
                <View style={{
                  width: 24, height: 24, borderRadius: 999,
                  borderWidth: 2, borderColor: ing.selected ? C.primary : C.outline,
                  backgroundColor: ing.selected ? C.primary : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {ing.selected && <MaterialIcons name="check" size={14} color={C.white} />}
                </View>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 } as any}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: C.text, fontFamily: C.fontBody, textTransform: 'capitalize' } as any}>
                    {ing.name}
                  </Text>
                  {hasAllergen && <MaterialIcons name="warning-amber" size={15} color="#c97b00" />}
                </View>
                <View style={{ backgroundColor: C.container, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.textSec, fontFamily: C.fontBody } as any}>
                    {formatQty(ing.quantity)}{ing.unit ? ' ' + ing.unit : ' stk'}
                  </Text>
                </View>
              </View>
              {hasAllergen && ing.substitute && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 38 } as any}>
                  <MaterialIcons name="swap-horiz" size={13} color="#c97b00" />
                  <Text style={{ fontSize: 12, color: '#c97b00', fontFamily: C.fontBody, fontWeight: '600' } as any}>
                    Bytt til: {ing.substitute}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        };

        const nonStaples = scaledIngredients.map((ing, i) => ({ ing, i })).filter(({ ing }) => !ing.is_staple);
        const staples = scaledIngredients.map((ing, i) => ({ ing, i })).filter(({ ing }) => ing.is_staple);

        return (
          <>
            <View style={[cardStyle, { marginBottom: staples.length > 0 ? 12 : 20, padding: 0, overflow: 'hidden' }]}>
              {nonStaples.map(({ ing, i }, idx) => renderIngredientRow(ing, i, idx === nonStaples.length - 1))}
            </View>

            {staples.length > 0 && (
              <>
                <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.textSec, fontFamily: C.fontBody, marginBottom: 8, paddingHorizontal: 4 } as any}>
                  Basisvarer — har du dette hjemme?
                </Text>
                <View style={[cardStyle, { marginBottom: 20, padding: 0, overflow: 'hidden' }]}>
                  {staples.map(({ ing, i }, idx) => renderIngredientRow(ing, i, idx === staples.length - 1))}
                </View>
              </>
            )}
          </>
        );
      })()}

      {/* List picker */}
      {lists.length > 0 && (
        <View style={[cardStyle, { marginBottom: 16, padding: 0, overflow: 'hidden' }]}>
          <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.textSec, fontFamily: C.fontBody, padding: 16, paddingBottom: 8 } as any}>
            Legg til i liste
          </Text>
          {lists.map((list, i) => (
            <TouchableOpacity
              key={list.id}
              onPress={() => setSelectedListId(list.id)}
              activeOpacity={0.7}
              style={[
                { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12 } as any,
                i < lists.length - 1 ? { borderBottomWidth: 1, borderBottomColor: 'rgba(129,184,165,0.15)' } : {},
                selectedListId === list.id ? { backgroundColor: 'rgba(0,105,71,0.05)' } : {},
              ]}
            >
              <MaterialIcons name="shopping-basket" size={18} color={selectedListId === list.id ? C.primary : C.textSec} />
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: C.text, fontFamily: C.fontBody } as any}>{list.name}</Text>
              {selectedListId === list.id && <MaterialIcons name="check-circle" size={18} color={C.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {error && (
        <View style={{ marginBottom: 12, backgroundColor: 'rgba(179,27,37,0.08)', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 } as any}>
          <MaterialIcons name="error-outline" size={18} color={C.error} />
          <Text style={{ flex: 1, fontSize: 14, color: C.error, fontFamily: C.fontBody } as any}>{error}</Text>
        </View>
      )}

      {primaryBtn(
        `Lagre oppskrift og legg til ${selectedCount} varer`,
        handleSave,
        !selectedListId || selectedCount === 0,
        saving,
      )}
    </>
  );

  // ── STEP: done ───────────────────────────────────────────────────────────
  const renderDone = () => (
    <View style={{ alignItems: 'center', gap: 16, paddingTop: 40 } as any}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.primaryContainer + '88', alignItems: 'center', justifyContent: 'center' }}>
        <MaterialIcons name="check-circle" size={40} color={C.primary} />
      </View>
      <Text style={{ fontSize: 22, fontWeight: '800', color: C.text, fontFamily: C.font, textAlign: 'center' } as any}>
        {savedRecipeName} er lagret!
      </Text>
      <Text style={{ fontSize: 15, color: C.textSec, fontFamily: C.fontBody, textAlign: 'center' } as any}>
        Oppskriften er lagret og {selectedCount} ingredienser er lagt til i handlelisten.
      </Text>
      <View style={{ gap: 10, width: '100%', marginTop: 16 } as any}>
        <TouchableOpacity
          style={{ paddingVertical: 16, borderRadius: 16, alignItems: 'center', backgroundColor: C.primary }}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={{ color: C.white, fontSize: 16, fontWeight: '700', fontFamily: C.font } as any}>Tilbake til lister</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ paddingVertical: 14, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: C.outline + '55' }}
          onPress={() => {
            setStep('input'); setParsed(null); setImageUri(null); setImageBase64(null);
            setTextInput(''); setIngredients([]); setSelectedListId(null); setSavedRecipeName(null); setError(null);
          }}
          activeOpacity={0.7}
        >
          <Text style={{ color: C.primary, fontSize: 16, fontWeight: '600', fontFamily: C.fontBody } as any}>Importer ny oppskrift</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Layout ───────────────────────────────────────────────────────────────
  const stepTitles: Record<Step, string> = {
    input: 'Importer oppskrift',
    'confirm-source': 'Bekreft kilde',
    ingredients: 'Velg ingredienser',
    done: 'Ferdig!',
  };

  const stepSubtitles: Record<Step, string> = {
    input: 'Last opp bilde eller screenshot fra Instagram, TikTok, blogg eller kokebok.',
    'confirm-source': 'Claude har tolket kilden. Korriger hvis nødvendig.',
    ingredients: 'Juster porsjoner og velg hvilke ingredienser som legges på handlelisten.',
    done: '',
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {/* Header */}
        <View style={{
          backgroundColor: 'rgba(236,253,245,0.8)', paddingTop: insets.top + 8, zIndex: 40,
          ...(isWeb ? { backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', boxShadow: '0px 10px 30px rgba(0,54,42,0.06)', position: 'sticky', top: 0 } as any : {}),
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, gap: 12 } as any}>
            <TouchableOpacity
              onPress={step === 'input' || step === 'done' ? () => router.back() : () => setStep(step === 'ingredients' ? 'confirm-source' : 'input')}
              style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(0,105,71,0.08)', alignItems: 'center', justifyContent: 'center' }}
              activeOpacity={0.7}
            >
              <MaterialIcons name="arrow-back" size={22} color={C.primary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: C.text, fontFamily: C.font } as any}>{stepTitles[step]}</Text>
            </View>
            <MaterialIcons name="restaurant-menu" size={20} color={C.primary} />
          </View>

          {/* Step indicator */}
          {step !== 'done' && (
            <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 24, paddingBottom: 12 } as any}>
              {(['input', 'confirm-source', 'ingredients'] as Step[]).map((s, i) => (
                <View key={s} style={{
                  height: 3, borderRadius: 2, flex: 1,
                  backgroundColor: s === step ? C.primary : (
                    ['input', 'confirm-source', 'ingredients'].indexOf(step) > i ? C.primary + '55' : C.outline + '33'
                  ),
                }} />
              ))}
            </View>
          )}
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 160, maxWidth: 680, alignSelf: 'center' as any, width: '100%' as any }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Subtitle */}
          {stepSubtitles[step] ? (
            <Text style={{ fontSize: 14, color: C.textSec, fontFamily: C.fontBody, marginBottom: 24 } as any}>
              {stepSubtitles[step]}
            </Text>
          ) : null}

          {step === 'input' && renderInput()}
          {step === 'confirm-source' && renderConfirmSource()}
          {step === 'ingredients' && renderIngredients()}
          {step === 'done' && renderDone()}
        </ScrollView>
      </View>
    </>
  );
}
