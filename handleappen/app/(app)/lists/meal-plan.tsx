import { useState, useEffect, useCallback } from 'react';
import {
  Text, TouchableOpacity, View, ScrollView, Modal, Platform,
  ActivityIndicator, Image,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import { isStaple } from '@/hooks/useRecipeImport';
import { RecipeCard, getRecipeVisual } from '@/components/recipe-card';

const C = {
  bg: '#d8fff0', white: '#ffffff', low: '#bffee7', container: '#b2f6de',
  high: '#a7f1d8', primary: '#006947', primaryContainer: '#00feb2',
  text: '#00362a', textSec: '#2f6555', outline: '#81b8a5',
  error: '#b31b25',
  font: Platform.OS === 'web' ? "'Plus Jakarta Sans', system-ui, sans-serif" : undefined,
  fontBody: Platform.OS === 'web' ? "'Manrope', system-ui, sans-serif" : undefined,
};
const isWeb = Platform.OS === 'web';

const DAYS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
const DAYS_FULL = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];

interface Recipe {
  id: string;
  name: string;
  base_servings: number;
  source_label: string | null;
  description: string | null;
}

interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string | null;
}

interface MealSlot {
  id?: string;
  day_of_week: number;
  recipe_id: string | null;
  recipe?: Recipe;
  custom_name: string | null;
  servings: number;
}

interface ShoppingList {
  id: string;
  name: string;
}

// Normaliserer varenavn for sammenligning
function normalizeName(n: string) {
  return n.toLowerCase().trim();
}


// Beregn mandag i inneværende uke
function getWeekStart(offset = 0): Date {
  const now = new Date();
  const day = now.getDay(); // 0=søn
  const diff = (day === 0 ? -6 : 1 - day) + offset * 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatWeekStart(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function weekLabel(d: Date): string {
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  return `${d.getDate()}. ${d.toLocaleDateString('nb-NO', { month: 'short' })} – ${end.getDate()}. ${end.toLocaleDateString('nb-NO', { month: 'short' })}`;
}

function IngredientRow({ ing, onToggle }: { ing: { name: string; quantity: number; unit: string | null; recipeNames: string[]; skip: boolean }; onToggle: () => void }) {
  return (
    <TouchableOpacity onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, opacity: ing.skip ? 0.45 : 1 } as any}>
      <View style={{
        width: 24, height: 24, borderRadius: 7,
        backgroundColor: ing.skip ? 'transparent' : C.primary,
        borderWidth: ing.skip ? 2 : 0,
        borderColor: C.outline + '66',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {!ing.skip && <MaterialIcons name="check" size={15} color={C.white} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: C.text, textTransform: 'capitalize', fontFamily: C.fontBody } as any}>
          {ing.name}
        </Text>
        <Text style={{ fontSize: 11, color: C.textSec, fontFamily: C.fontBody } as any}>
          {ing.quantity % 1 === 0 ? ing.quantity : ing.quantity.toFixed(1)}{ing.unit ? ` ${ing.unit}` : ''} · fra {ing.recipeNames.join(', ')}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function MealPlanScreen() {
  const insets = useSafeAreaInsets();
  const householdId = useAuthStore((s) => s.householdId);

  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = getWeekStart(weekOffset);
  const weekStartStr = formatWeekStart(weekStart);

  const [slots, setSlots] = useState<MealSlot[]>([]);
  const [ingredientCounts, setIngredientCounts] = useState<Record<string, number>>({});
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);

  // Velg-oppskrift-modal
  const [pickingDay, setPickingDay] = useState<number | null>(null);




  const refreshRecipes = useCallback(async () => {
    if (!householdId) return;
    const { data } = await supabase.from('recipes').select('id, name, base_servings, source_label, description')
      .eq('household_id', householdId).order('name');
    setRecipes(data ?? []);
  }, [householdId]);

  // Import-modal
  const [showImport, setShowImport] = useState(false);
  const [importIngredients, setImportIngredients] = useState<
    { name: string; quantity: number; unit: string | null; recipeNames: string[]; alreadyOnList: boolean; skip: boolean; is_staple: boolean }[]
  >([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);

  const loadWeek = useCallback(async () => {
    if (!householdId) return;
    setLoading(true);
    const { data } = await supabase
      .from('meal_plan')
      .select('id, day_of_week, recipe_id, custom_name, servings, recipes(id, name, base_servings, source_label, description)')
      .eq('household_id', householdId)
      .eq('week_start', weekStartStr);

    const filled: MealSlot[] = DAYS.map((_, i) => {
      const found = (data ?? []).find((r: any) => r.day_of_week === i);
      return found
        ? { id: found.id, day_of_week: i, recipe_id: found.recipe_id, recipe: found.recipes ?? undefined, custom_name: found.custom_name, servings: found.servings }
        : { day_of_week: i, recipe_id: null, custom_name: null, servings: 4 };
    });
    setSlots(filled);

    // Hent ingredienstellingen for alle oppskrifter i uken
    const recipeIds = filled.filter((s) => s.recipe_id).map((s) => s.recipe_id!);
    if (recipeIds.length > 0) {
      const { data: counts } = await supabase
        .from('recipe_ingredients')
        .select('recipe_id')
        .in('recipe_id', recipeIds);
      const tally: Record<string, number> = {};
      for (const row of counts ?? []) {
        tally[row.recipe_id] = (tally[row.recipe_id] ?? 0) + 1;
      }
      setIngredientCounts(tally);
    }

    setLoading(false);
  }, [householdId, weekStartStr]);

  useEffect(() => { loadWeek(); }, [loadWeek]);

  useEffect(() => {
    if (!householdId) return;
    supabase.from('recipes').select('id, name, base_servings, source_label, description')
      .eq('household_id', householdId).order('name')
      .then(({ data }) => setRecipes(data ?? []));

    supabase.from('shopping_lists').select('id, name')
      .eq('household_id', householdId).eq('is_deleted', false).order('created_at', { ascending: false })
      .then(({ data }) => {
        setShoppingLists(data ?? []);
        if (data && data.length > 0) setSelectedListId(data[0].id);
      });
  }, [householdId]);

  const assignRecipe = async (dayIndex: number, recipe: Recipe | null) => {
    if (!householdId) return;
    const existing = slots[dayIndex];

    if (recipe === null) {
      // Fjern
      if (existing.id) {
        await supabase.from('meal_plan').delete().eq('id', existing.id);
      }
    } else {
      const payload = {
        household_id: householdId,
        week_start: weekStartStr,
        day_of_week: dayIndex,
        meal_type: 'dinner',
        recipe_id: recipe.id,
        custom_name: null,
        servings: recipe.base_servings,
      };
      if (existing.id) {
        await supabase.from('meal_plan').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('meal_plan').insert(payload);
      }
    }
    setPickingDay(null);
    loadWeek();
  };

  const [generatingIngredients, setGeneratingIngredients] = useState(false);

  const prepareImport = async () => {
    if (!selectedListId) return;
    setGeneratingIngredients(true);
    setShowImport(true);

    try {
      // Hent eksisterende varer på listen
      const { data: existingItems } = await supabase
        .from('list_items')
        .select('name')
        .eq('list_id', selectedListId)
        .eq('is_deleted', false);
      const existingNames = new Set((existingItems ?? []).map((i: any) => normalizeName(i.name)));

      // Hent husholdningens allergener
      const { data: hh } = await supabase.from('households').select('allergens').eq('id', householdId!).single();
      const allergens: string[] = hh?.allergens ?? [];

      // Hent alle ingredienser fra planlagte oppskrifter
      const recipesWithSlots = slots.filter((s) => s.recipe_id && s.recipe);
      const allIngredients: { name: string; quantity: number; unit: string | null; recipeName: string; servings: number; baseServings: number; is_staple: boolean }[] = [];

      for (const slot of recipesWithSlots) {
        // Sjekk om oppskriften allerede har ingredienser
        const { data: ings } = await supabase
          .from('recipe_ingredients')
          .select('name, quantity, unit')
          .eq('recipe_id', slot.recipe_id!);

        const ingredients = ings ?? [];

        for (const ing of ingredients) {
          const scale = slot.servings / (slot.recipe!.base_servings || 4);
          allIngredients.push({
            name: ing.name,
            quantity: ing.quantity * scale,
            unit: ing.unit,
            recipeName: slot.recipe!.name,
            servings: slot.servings,
            baseServings: slot.recipe!.base_servings,
            is_staple: isStaple(ing.name),
          });
        }
      }

    // Aggreger: slå sammen like ingredienser
    const merged = new Map<string, { name: string; quantity: number; unit: string | null; recipeNames: string[]; is_staple: boolean }>();
    for (const ing of allIngredients) {
      const key = normalizeName(ing.name);
      if (merged.has(key)) {
        const existing = merged.get(key)!;
        existing.quantity += ing.quantity;
        if (!existing.recipeNames.includes(ing.recipeName)) existing.recipeNames.push(ing.recipeName);
      } else {
        merged.set(key, { name: ing.name, quantity: ing.quantity, unit: ing.unit, recipeNames: [ing.recipeName], is_staple: ing.is_staple });
      }
    }

    setImportIngredients(
      [...merged.values()].map((ing) => ({
        ...ing,
        alreadyOnList: existingNames.has(normalizeName(ing.name)),
        // Basisvarer og varer som allerede er på listen: skip som standard
        skip: ing.is_staple || existingNames.has(normalizeName(ing.name)),
      }))
    );
    setImportDone(false);
    } finally {
      setGeneratingIngredients(false);
    }
  };

  const doImport = async () => {
    if (!selectedListId) return;
    setImporting(true);

    const toAdd = importIngredients.filter((i) => !i.skip);
    for (const ing of toAdd) {
      // Sjekk om varen allerede finnes på listen (kan ha blitt lagt til siden vi sjekket)
      const { data: existing } = await supabase
        .from('list_items')
        .select('id, quantity')
        .eq('list_id', selectedListId)
        .ilike('name', ing.name)
        .eq('is_deleted', false)
        .maybeSingle();

      if (existing) {
        // Øk antallet
        await supabase.from('list_items').update({
          quantity: existing.quantity + Math.ceil(ing.quantity),
          note: `fra ukesmeny`,
        }).eq('id', existing.id);
      } else {
        await supabase.from('list_items').insert({
          list_id: selectedListId,
          name: ing.name,
          quantity: Math.max(1, Math.ceil(ing.quantity)),
          note: ing.recipeNames.length === 1 ? `fra ${ing.recipeNames[0]}` : `fra ukesmeny`,
        });
      }
    }

    setImporting(false);
    setImportDone(true);
  };

  const filledDays = slots.filter((s) => s.recipe_id || s.custom_name).length;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {/* Header */}
        <View style={{
          backgroundColor: 'rgba(236,253,245,0.9)',
          paddingTop: insets.top + 8,
          ...(isWeb ? { backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', boxShadow: '0px 10px 30px rgba(0,54,42,0.06)', position: 'sticky', top: 0, zIndex: 40 } as any : {}),
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 } as any}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ padding: 8, borderRadius: 12, backgroundColor: 'rgba(0,105,71,0.1)' }}
            >
              <MaterialIcons name="arrow-back" size={22} color={C.primary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: C.text, fontFamily: C.font } as any}>Ukesmeny</Text>
              <Text style={{ fontSize: 12, color: C.textSec, fontFamily: C.fontBody } as any}>{weekLabel(weekStart)}</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(app)/lists/import')}
              style={{ padding: 8, borderRadius: 12, backgroundColor: 'rgba(0,105,71,0.1)' }}
              activeOpacity={0.8}
            >
              <MaterialIcons name="file-upload" size={22} color={C.primary} />
            </TouchableOpacity>
            {filledDays > 0 && (
              <TouchableOpacity
                onPress={prepareImport}
                style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: C.primary }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.white, fontFamily: C.fontBody } as any}>
                  Legg i liste
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, maxWidth: 680, alignSelf: 'center' as any, width: '100%' as any }}>

          {/* Ukenavigasjon */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <TouchableOpacity
              onPress={() => setWeekOffset((v) => v - 1)}
              style={{ padding: 10, borderRadius: 10, backgroundColor: C.container }}
            >
              <MaterialIcons name="chevron-left" size={22} color={C.primary} />
            </TouchableOpacity>
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, fontFamily: C.fontBody } as any}>
              {weekOffset === 0 ? 'Denne uken' : weekOffset === 1 ? 'Neste uke' : weekOffset === -1 ? 'Forrige uke' : weekLabel(weekStart)}
            </Text>
            <TouchableOpacity
              onPress={() => setWeekOffset((v) => v + 1)}
              style={{ padding: 10, borderRadius: 10, backgroundColor: C.container }}
            >
              <MaterialIcons name="chevron-right" size={22} color={C.primary} />
            </TouchableOpacity>
          </View>

          {/* Dagskort */}
          {loading ? (
            <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
          ) : (
            <View style={{ gap: 10 }}>
              {slots.map((slot, i) => {
                const date = new Date(weekStart);
                date.setDate(weekStart.getDate() + i);
                const dateLabel = `${date.getDate()}. ${date.toLocaleDateString('nb-NO', { month: 'short' })}`;
                const hasRecipe = !!slot.recipe;

                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setPickingDay(i)}
                    activeOpacity={0.75}
                    style={[{
                      backgroundColor: hasRecipe ? C.white : C.white,
                      borderRadius: 18, padding: 16,
                      flexDirection: 'row', alignItems: 'center', gap: 14,
                      borderWidth: hasRecipe ? 0 : 1,
                      borderColor: C.outline + '33',
                      borderStyle: hasRecipe ? 'solid' : 'dashed',
                    } as any, isWeb && hasRecipe ? ({ boxShadow: '0px 4px 16px rgba(0,54,42,0.06)' } as any) : {}]}
                  >
                    {/* Dag-badge */}
                    <View style={{
                      width: 48, height: 48, borderRadius: 14,
                      backgroundColor: hasRecipe ? C.primaryContainer : C.low,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: C.primary, fontFamily: C.fontBody } as any}>{DAYS[i]}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: C.text, fontFamily: C.font } as any}>{date.getDate()}</Text>
                    </View>

                    {/* Oppskrift-emoji/gradient */}
                    {hasRecipe && (() => {
                      const visual = getRecipeVisual(slot.recipe!.name);
                      return (
                        <View
                          style={[
                            { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: visual.solidColor },
                            isWeb ? ({
                              background: `linear-gradient(135deg, ${visual.gradient[0]}, ${visual.gradient[1]}, ${visual.gradient[2]})`,
                            } as any) : {},
                          ]}
                        >
                          <Text style={{ fontSize: 22 }}>{visual.emoji}</Text>
                        </View>
                      );
                    })()}

                    {/* Innhold */}
                    <View style={{ flex: 1 }}>
                      {hasRecipe ? (
                        <>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, fontFamily: C.fontBody } as any} numberOfLines={1}>
                            {slot.recipe!.name}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 } as any}>
                            <Text style={{ fontSize: 12, color: C.textSec, fontFamily: C.fontBody } as any}>
                              {slot.servings} porsjoner
                            </Text>
                            {slot.recipe_id && (ingredientCounts[slot.recipe_id] ?? 0) > 0 ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#e8faf3', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 } as any}>
                                <Text style={{ fontSize: 10 } as any}>🛒</Text>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: '#006947', fontFamily: C.fontBody } as any}>
                                  {ingredientCounts[slot.recipe_id]} ingredienser klare
                                </Text>
                              </View>
                            ) : slot.recipe_id ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fff8e1', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 } as any}>
                                <Text style={{ fontSize: 10 } as any}>⏳</Text>
                                <Text style={{ fontSize: 10, fontWeight: '600', color: '#b45309', fontFamily: C.fontBody } as any}>
                                  henter ingredienser...
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </>
                      ) : (
                        <Text style={{ fontSize: 15, color: C.outline, fontFamily: C.fontBody } as any}>
                          Legg til middag...
                        </Text>
                      )}
                    </View>

                    {hasRecipe && (
                      <TouchableOpacity
                        onPress={(e) => { e.stopPropagation(); assignRecipe(i, null); }}
                        hitSlop={8}
                        style={{ padding: 6, borderRadius: 8, backgroundColor: C.error + '15' }}
                      >
                        <MaterialIcons name="close" size={16} color={C.error} />
                      </TouchableOpacity>
                    )}
                    <MaterialIcons
                      name={hasRecipe ? 'edit' : 'add-circle-outline'}
                      size={20}
                      color={C.outline}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Oppsummering */}
          {filledDays > 0 && (
            <View style={{ marginTop: 24, padding: 16, backgroundColor: C.container, borderRadius: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: C.textSec, fontFamily: C.fontBody } as any}>
                {filledDays} av 7 dager planlagt · trykk «Legg i liste» for å importere ingredienser
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Velg oppskrift modal */}
        <Modal visible={pickingDay !== null} transparent animationType="slide">
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,54,42,0.3)' }}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setPickingDay(null)} />
            <View style={[{
              backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28,
              maxHeight: '80%' as any,
            }, isWeb ? ({ boxShadow: '0px -20px 60px rgba(0,54,42,0.15)' } as any) : {}]}>
              <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.outline + '66' }} />
              </View>
              <View style={{ paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, fontFamily: C.font } as any}>
                  {pickingDay !== null ? DAYS_FULL[pickingDay] : ''}
                </Text>
                {pickingDay !== null && slots[pickingDay]?.recipe_id && (
                  <TouchableOpacity
                    onPress={() => assignRecipe(pickingDay!, null)}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(179,27,37,0.08)' }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: C.error, fontFamily: C.fontBody } as any}>Fjern</Text>
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
                {recipes.length === 0 ? (
                  <View style={{ alignItems: 'center', padding: 40, gap: 12 } as any}>
                    <MaterialIcons name="restaurant-menu" size={40} color={C.outline} />
                    <Text style={{ fontSize: 15, color: C.textSec, textAlign: 'center', fontFamily: C.fontBody } as any}>
                      Ingen oppskrifter lagret ennå.{'\n'}Importer en oppskrift først.
                    </Text>
                    <TouchableOpacity
                      onPress={() => { setPickingDay(null); router.push('/(app)/lists/import'); }}
                      style={{ paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: C.primary, marginTop: 8 }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '700', color: C.white, fontFamily: C.fontBody } as any}>Importer oppskrift</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    {recipes.map((recipe) => {
                      const isSelected = pickingDay !== null && slots[pickingDay]?.recipe_id === recipe.id;
                      return (
                        <RecipeCard
                          key={recipe.id}
                          variant="compact"
                          name={recipe.name}
                          servings={recipe.base_servings}
                          sourceLabel={recipe.source_label}
                          imageUrl={(recipe as any).image_url ?? null}
                          ingredientCount={ingredientCounts[recipe.id]}
                          selected={isSelected}
                          onPress={() => pickingDay !== null && assignRecipe(pickingDay, recipe)}
                          right={isSelected ? <MaterialIcons name="check-circle" size={20} color={C.primary} /> : null}
                        />
                      );
                    })}
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Import-modal */}
        <Modal visible={showImport} transparent animationType="slide">
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,54,42,0.3)' }}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => !importing && setShowImport(false)} />
            <View style={[{
              backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28,
              maxHeight: '90%' as any,
            }, isWeb ? ({ boxShadow: '0px -20px 60px rgba(0,54,42,0.15)' } as any) : {}]}>
              <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.outline + '66' }} />
              </View>

              {generatingIngredients ? (
                <View style={{ padding: 40, alignItems: 'center', gap: 16 } as any}>
                  <ActivityIndicator size="large" color={C.primary} />
                  <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, fontFamily: C.font, textAlign: 'center' } as any}>
                    Henter ingredienser...
                  </Text>
                  <Text style={{ fontSize: 14, color: C.textSec, fontFamily: C.fontBody, textAlign: 'center' } as any}>
                    Claude genererer ingredienslister for oppskriftene
                  </Text>
                </View>
              ) : importDone ? (
                <View style={{ padding: 40, alignItems: 'center', gap: 16 } as any}>
                  <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.primaryContainer, alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name="check" size={32} color={C.primary} />
                  </View>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: C.text, fontFamily: C.font, textAlign: 'center' } as any}>
                    Lagt til i listen!
                  </Text>
                  <Text style={{ fontSize: 14, color: C.textSec, fontFamily: C.fontBody, textAlign: 'center' } as any}>
                    {importIngredients.filter((i) => !i.skip).length} ingredienser lagt til
                    {importIngredients.filter((i) => i.skip).length > 0
                      ? `, ${importIngredients.filter((i) => i.skip).length} hoppet over`
                      : ''}
                  </Text>
                  <TouchableOpacity
                    onPress={() => { setShowImport(false); if (selectedListId) router.push(`/(app)/lists/${selectedListId}`); }}
                    style={{ paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, backgroundColor: C.primary, marginTop: 8 }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '700', color: C.white, fontFamily: C.fontBody } as any}>Åpne liste</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={{ paddingHorizontal: 24, paddingVertical: 16 }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, fontFamily: C.font, marginBottom: 4 } as any}>
                      Legg ingredienser i liste
                    </Text>
                    <Text style={{ fontSize: 13, color: C.textSec, fontFamily: C.fontBody } as any}>
                      Huk av det du allerede har hjemme
                    </Text>
                  </View>

                  {/* Listevalg */}
                  {shoppingLists.length > 1 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {shoppingLists.map((l) => (
                          <TouchableOpacity
                            key={l.id}
                            onPress={() => setSelectedListId(l.id)}
                            style={{
                              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                              backgroundColor: selectedListId === l.id ? C.primary : C.container,
                            }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: '600', color: selectedListId === l.id ? C.white : C.text, fontFamily: C.fontBody } as any}>
                              {l.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  )}

                  <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                    {/* Ingredienser som legges til */}
                    {importIngredients.some((i) => !i.alreadyOnList && !i.is_staple) && (
                      <View style={{ marginBottom: 16 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.textSec, fontFamily: C.fontBody, marginBottom: 8 } as any}>
                          Legges til
                        </Text>
                        {importIngredients.filter((i) => !i.alreadyOnList && !i.is_staple).map((ing, idx) => (
                          <IngredientRow key={`add-${idx}`} ing={ing} onToggle={() => setImportIngredients((prev) =>
                            prev.map((p) => normalizeName(p.name) === normalizeName(ing.name) ? { ...p, skip: !p.skip } : p)
                          )} />
                        ))}
                      </View>
                    )}

                    {/* Basisvarer — opt-out (skip som standard) */}
                    {importIngredients.some((i) => i.is_staple && !i.alreadyOnList) && (
                      <View style={{ marginBottom: 16 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.textSec, fontFamily: C.fontBody, marginBottom: 8 } as any}>
                          Basisvarer (har du trolig hjemme)
                        </Text>
                        {importIngredients.filter((i) => i.is_staple && !i.alreadyOnList).map((ing, idx) => (
                          <IngredientRow key={`staple-${idx}`} ing={ing} onToggle={() => setImportIngredients((prev) =>
                            prev.map((p) => normalizeName(p.name) === normalizeName(ing.name) ? { ...p, skip: !p.skip } : p)
                          )} />
                        ))}
                      </View>
                    )}

                    {/* Allerede på listen */}
                    {importIngredients.some((i) => i.alreadyOnList) && (
                      <View style={{ marginBottom: 16 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.textSec, fontFamily: C.fontBody, marginBottom: 8 } as any}>
                          Allerede på listen
                        </Text>
                        {importIngredients.filter((i) => i.alreadyOnList).map((ing, idx) => (
                          <IngredientRow key={`exists-${idx}`} ing={ing} onToggle={() => setImportIngredients((prev) =>
                            prev.map((p) => normalizeName(p.name) === normalizeName(ing.name) ? { ...p, skip: !p.skip } : p)
                          )} />
                        ))}
                      </View>
                    )}
                  </ScrollView>

                  <View style={{ padding: 16, gap: 10 }}>
                    <TouchableOpacity
                      onPress={doImport}
                      disabled={importing || importIngredients.filter((i) => !i.skip).length === 0}
                      style={{
                        paddingVertical: 16, alignItems: 'center', borderRadius: 14,
                        backgroundColor: importing || importIngredients.filter((i) => !i.skip).length === 0 ? C.outline : C.primary,
                        flexDirection: 'row', justifyContent: 'center', gap: 8,
                      } as any}
                    >
                      {importing && <ActivityIndicator size="small" color={C.white} />}
                      <Text style={{ fontSize: 16, fontWeight: '700', color: C.white, fontFamily: C.fontBody } as any}>
                        {importing ? 'Legger til...' : `Legg til ${importIngredients.filter((i) => !i.skip).length} ingredienser`}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setShowImport(false)}
                      style={{ paddingVertical: 14, alignItems: 'center' }}
                    >
                      <Text style={{ fontSize: 15, fontWeight: '600', color: C.textSec, fontFamily: C.fontBody } as any}>Avbryt</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}
