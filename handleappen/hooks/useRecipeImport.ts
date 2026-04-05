import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import { useUIStore } from '@/stores/useUIStore';
import {
  parseRecipeFromImage,
  parseRecipe,
  parseMealPlanTitles,
  parseMealPlanIngredients,
  type RecipeParseResult,
} from '@/lib/claude';

// ── Typer ─────────────────────────────────────────────────────────────────

export type InputMode = 'image' | 'pdf' | 'text';
export type ImportStep = 'input' | 'select-recipes' | 'ingredients' | 'done';

export interface ParsedIngredient {
  name: string;
  quantity: number;
  unit: string | null;
  is_staple: boolean;
  selected: boolean;
  allergens?: string[];
  substitute?: string | null;
}

export interface ImportedRecipe {
  title: string;
  baseServings: number;
  servings: number;
  description: string | null;
  source_type: string | null;
  source_label: string | null;
  source_url: string | null;
  source_confidence: number;
  ingredients: ParsedIngredient[];
  loadingIngredients: boolean;
  selected: boolean; // for velg-oppskrifter-steget
}

export interface ShoppingListItem {
  id: string;
  name: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

const STAPLE_KEYWORDS = [
  'olje', 'olivenolje', 'rapsolje', 'nøytral olje', 'smør', 'salt', 'pepper',
  'sukker', 'mel', 'hvitløk', 'løk', 'vann', 'buljong', 'kraft',
  'soyasaus', 'eddik', 'balsamico', 'tomatpuré', 'bakepulver', 'vaniljesukker',
  'melis', 'kanel', 'muskat', 'paprikapulver', 'oregano', 'timian', 'laurbærblad',
  'spisskummen', 'gurkemeie', 'garam masala',
];

export function isStaple(name: string): boolean {
  const n = name.toLowerCase().trim();
  return STAPLE_KEYWORDS.some((kw) => n === kw || n.includes(kw));
}

export function formatQty(q: number) {
  if (q === Math.round(q)) return String(q);
  return q.toFixed(1).replace(/\.0$/, '');
}

export function scaleIngredients(
  ingredients: ParsedIngredient[],
  baseServings: number,
  targetServings: number,
): ParsedIngredient[] {
  const ratio = targetServings / baseServings;
  return ingredients.map((i) => ({ ...i, quantity: Math.round(i.quantity * ratio * 10) / 10 }));
}

const SOURCE_TYPE_MAP: Record<string, string> = {
  blog: 'web', website: 'web', cookbook: 'book', kokebok: 'book',
  instagram: 'instagram', tiktok: 'tiktok', unknown: 'unknown',
};

export function normalizeSourceType(t: string | null): string | null {
  if (!t) return null;
  return SOURCE_TYPE_MAP[t.toLowerCase()] ?? 'unknown';
}

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', web: 'Nettsted/Blogg',
  book: 'Kokebok', unknown: 'Ukjent',
};

// ── Hook ──────────────────────────────────────────────────────────────────

export function useRecipeImport() {
  const householdId = useAuthStore((s) => s.householdId);

  // Steg
  const [step, setStep] = useState<ImportStep>('input');
  const [inputMode, setInputMode] = useState<InputMode>('image');

  // Input
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMediaType, setImageMediaType] = useState('image/jpeg');
  const [textInput, setTextInput] = useState('');

  // Status
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Parsed
  const [recipes, setRecipes] = useState<ImportedRecipe[]>([]);
  const abortRef = useRef(false);

  // Shopping lists
  const [shoppingLists, setShoppingLists] = useState<ShoppingListItem[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [householdAllergens, setHouseholdAllergens] = useState<string[]>([]);

  // Save
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  // Load lists og allergens
  useEffect(() => {
    if (!householdId) return;
    supabase
      .from('shopping_lists').select('id, name')
      .eq('household_id', householdId).eq('is_deleted', false)
      .order('updated_at', { ascending: false })
      .then(({ data }) => setShoppingLists((data ?? []) as ShoppingListItem[]));
    supabase
      .from('households').select('allergens').eq('id', householdId).single()
      .then(({ data }) => setHouseholdAllergens(data?.allergens ?? []));
  }, [householdId]);

  // ── Fil-opplasting ────────────────────────────────────────────────────

  const handleFileLoaded = useCallback((dataUrl: string) => {
    const [header, b64] = dataUrl.split(',');
    const mt = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
    setImageUri(dataUrl);
    setImageBase64(b64);
    setImageMediaType(mt);
    setError(null);
  }, []);

  // ── Parse ─────────────────────────────────────────────────────────────

  const handleParse = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRecipes([]);
    abortRef.current = false;

    try {
      if (inputMode === 'pdf') {
        // PDF/ukesmeny: to-stegs parsing
        if (!imageBase64) throw new Error('Velg en fil først.');
        setProgress('Leser oppskriftsnavn...');

        const titles = await parseMealPlanTitles(imageBase64, imageMediaType);
        const initial: ImportedRecipe[] = titles.map((r) => ({
          title: r.title,
          baseServings: r.servings ?? 4,
          servings: r.servings ?? 4,
          description: null,
          source_type: 'unknown',
          source_label: 'Ukesmeny',
          source_url: null,
          source_confidence: 0,
          ingredients: [],
          loadingIngredients: false,
          selected: true,
        }));
        setRecipes(initial);
        setStep('select-recipes');
        setLoading(false);
        setProgress(null);
      } else {
        // Bilde eller tekst: ett kall → én oppskrift
        let result: RecipeParseResult;
        if (inputMode === 'image') {
          if (!imageBase64) throw new Error('Velg et bilde først.');
          setProgress('Analyserer bilde...');
          result = await parseRecipeFromImage(imageBase64, imageMediaType, householdAllergens);
        } else {
          if (!textInput.trim()) throw new Error('Skriv inn oppskriftstekst.');
          setProgress('Analyserer tekst...');
          result = await parseRecipe(textInput.trim(), householdAllergens);
        }

        setRecipes([{
          title: result.title,
          baseServings: result.servings ?? 4,
          servings: result.servings ?? 4,
          description: result.description ?? null,
          source_type: normalizeSourceType(result.source_type),
          source_label: result.source_label ?? null,
          source_url: result.source_url ?? null,
          source_confidence: result.source_confidence ?? 0,
          ingredients: result.ingredients.map((ing) => ({
            ...ing,
            selected: !ing.is_staple,
            allergens: ing.allergens ?? [],
            substitute: ing.substitute ?? null,
          })),
          loadingIngredients: false,
          selected: true,
        }]);
        setStep('ingredients');
        setLoading(false);
        setProgress(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ukjent feil');
      setLoading(false);
      setProgress(null);
    }
  }, [inputMode, imageBase64, imageMediaType, textInput, householdAllergens]);

  // ── Oppskriftvalg ─────────────────────────────────────────────────────

  const toggleRecipe = useCallback((idx: number) => {
    setRecipes((prev) => prev.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r));
  }, []);

  const goToIngredients = useCallback(() => setStep('ingredients'), []);

  // ── Ingrediens-toggle ─────────────────────────────────────────────────

  const toggleIngredient = useCallback((recipeIdx: number, ingredientIdx: number) => {
    setRecipes((prev) => prev.map((r, ri) => ri !== recipeIdx ? r : {
      ...r,
      ingredients: r.ingredients.map((ing, ii) => ii !== ingredientIdx ? ing : { ...ing, selected: !ing.selected }),
    }));
  }, []);

  const selectAllIngredients = useCallback((recipeIdx: number, selected: boolean) => {
    setRecipes((prev) => prev.map((r, ri) => ri !== recipeIdx ? r : {
      ...r,
      ingredients: r.ingredients.map((ing) => ({ ...ing, selected })),
    }));
  }, []);

  const updateServings = useCallback((recipeIdx: number, servings: number) => {
    setRecipes((prev) => prev.map((r, ri) => ri !== recipeIdx ? r : { ...r, servings }));
  }, []);

  // ── Lagre ─────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!householdId) return;
    setSaving(true);
    setError(null);

    const selected = recipes.filter((r) => r.selected);
    const isPdfImport = inputMode === 'pdf';
    let totalIngredients = 0;
    const savedForBackground: { id: string; title: string }[] = [];

    try {
      for (const recipe of selected) {
        // Sjekk duplikat
        const { data: existing } = await supabase.from('recipes')
          .select('id')
          .eq('household_id', householdId)
          .ilike('name', recipe.title)
          .maybeSingle();

        let recipeId = existing?.id ?? null;

        if (!existing) {
          const { data: inserted, error: insertErr } = await supabase.from('recipes').insert({
            household_id: householdId,
            name: recipe.title,
            base_servings: recipe.baseServings,
            source_type: normalizeSourceType(recipe.source_type),
            source_label: recipe.source_label?.trim() || null,
            source_url: recipe.source_url?.trim() || null,
            source_confidence: recipe.source_confidence,
            description: recipe.description,
            description_is_ai: true,
          }).select('id').single();

          if (insertErr) throw new Error(`Kunne ikke lagre ${recipe.title}: ${insertErr.message}`);
          recipeId = inserted?.id ?? null;

          // For PDF: samle opp for bakgrunn-ingredienshenting
          if (isPdfImport && recipeId) {
            savedForBackground.push({ id: recipeId, title: recipe.title });
          }
        }

        // Lagre ingredienser (kun for bilde/tekst som allerede har dem)
        if (recipeId && !existing && recipe.ingredients.length > 0) {
          await supabase.from('recipe_ingredients').insert(
            recipe.ingredients.map((ing) => ({
              recipe_id: recipeId,
              name: ing.name,
              quantity: ing.quantity,
              unit: ing.unit,
            }))
          );
        }

        // Legg valgte ingredienser i handlelisten (skalert)
        if (recipeId && selectedListId && recipe.ingredients.length > 0) {
          const scale = recipe.servings / recipe.baseServings;
          const toAdd = recipe.ingredients.filter((ing) => ing.selected);
          for (const _ing of toAdd) {
            const ing = { ..._ing, quantity: Math.round(_ing.quantity * scale * 10) / 10 };
            const { data: existingItem } = await supabase
              .from('list_items')
              .select('id, quantity')
              .eq('list_id', selectedListId)
              .ilike('name', ing.name)
              .eq('is_deleted', false)
              .maybeSingle();

            if (existingItem) {
              await supabase.from('list_items').update({
                quantity: existingItem.quantity + Math.max(1, Math.ceil(ing.quantity)),
                note: `fra ${recipe.title}`,
              }).eq('id', existingItem.id);
            } else {
              await supabase.from('list_items').insert({
                list_id: selectedListId,
                name: ing.name,
                quantity: Math.max(1, Math.ceil(ing.quantity)),
                note: ing.unit ? `${formatQty(ing.quantity)} ${ing.unit} · fra ${recipe.title}` : `fra ${recipe.title}`,
                recipe_id: recipeId,
                is_checked: false,
                is_deleted: false,
              });
            }
            totalIngredients++;
          }
        }
      }

      setSavedCount(totalIngredients);
      setStep('done');

      // PDF: hent ingredienser parallelt i bakgrunnen
      if (isPdfImport && savedForBackground.length > 0 && imageBase64) {
        const b64 = imageBase64;
        const mt = imageMediaType;
        const showToast = useUIStore.getState().showToast;
        (async () => {
          const promises = savedForBackground.map(async (saved) => {
            try {
              const ings = await parseMealPlanIngredients(b64, mt, saved.title);
              if (ings.length > 0) {
                await supabase.from('recipe_ingredients').insert(
                  ings.map((ing) => ({
                    recipe_id: saved.id,
                    name: ing.name,
                    quantity: ing.quantity,
                    unit: ing.unit,
                  }))
                );
                showToast(`${saved.title} — ${ings.length} ingredienser klare`, '🛒');
              }
            } catch (e) {
              console.error(`Bakgrunn: ingredienser for "${saved.title}" feilet:`, e);
            }
          });
          await Promise.all(promises);
        })();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ukjent feil');
    } finally {
      setSaving(false);
    }
  }, [householdId, recipes, selectedListId, inputMode, imageBase64, imageMediaType]);

  // ── Reset ─────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    abortRef.current = true;
    setStep('input');
    setInputMode('image');
    setImageUri(null);
    setImageBase64(null);
    setTextInput('');
    setRecipes([]);
    setError(null);
    setLoading(false);
    setProgress(null);
    setSelectedListId(null);
    setSavedCount(0);
    setSaving(false);
  }, []);

  return {
    // State
    step, setStep, inputMode, setInputMode,
    imageUri, imageBase64, imageMediaType, textInput, setTextInput,
    loading, progress, error,
    recipes, shoppingLists, selectedListId, setSelectedListId,
    saving, savedCount,
    householdAllergens,

    // Actions
    handleFileLoaded, handleParse,
    toggleRecipe, goToIngredients,
    toggleIngredient, selectAllIngredients, updateServings,
    handleSave, reset,
  };
}
