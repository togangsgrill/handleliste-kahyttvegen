import { useState, useEffect, useCallback } from 'react';
import { Text, TouchableOpacity, View, ScrollView, Platform, Modal, ActivityIndicator, Alert } from 'react-native';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import { RecipeCard } from '@/components/recipe-card';

const C = {
  bg: '#d8fff0', white: '#ffffff', low: '#bffee7', container: '#b2f6de',
  high: '#a7f1d8', highest: '#9decd2', primary: '#006947',
  primaryContainer: '#00feb2', text: '#00362a', textSec: '#2f6555',
  outline: '#81b8a5', tertiary: '#006575',
  font: "'Plus Jakarta Sans', system-ui, sans-serif",
  fontBody: "'Manrope', system-ui, sans-serif",
};
const isWeb = Platform.OS === 'web';

interface Recipe {
  id: string;
  name: string;
  base_servings: number;
  description: string | null;
  description_is_ai: boolean;
  source_type: string | null;
  source_label: string | null;
  source_url: string | null;
  created_at: string;
}

interface RecipeIngredient {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
}

const SOURCE_ICON: Record<string, string> = {
  instagram: 'photo-camera', tiktok: 'videocam', web: 'article',
  book: 'menu-book', unknown: 'help-outline',
};

function formatQty(q: number | null) {
  if (q === null) return '';
  if (q === Math.round(q)) return String(q);
  return q.toFixed(1).replace(/\.0$/, '');
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'i dag';
  if (days === 1) return 'i går';
  if (days < 7) return `${days} dager siden`;
  if (days < 30) return `${Math.floor(days / 7)} uker siden`;
  return `${Math.floor(days / 30)} mnd siden`;
}

export default function RecipesListScreen() {
  const insets = useSafeAreaInsets();
  const householdId = useAuthStore((s) => s.householdId);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [loadingIngredients, setLoadingIngredients] = useState(false);
  const [lists, setLists] = useState<{ id: string; name: string }[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [addingToList, setAddingToList] = useState(false);
  const [addedCount, setAddedCount] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRecipes = useCallback(async () => {
    if (!householdId) return;
    const { data } = await supabase
      .from('recipes')
      .select('id, name, base_servings, description, description_is_ai, source_type, source_label, source_url, created_at')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false });
    setRecipes(data ?? []);
    setLoading(false);
  }, [householdId]);

  useEffect(() => { fetchRecipes(); }, [fetchRecipes]);

  useEffect(() => {
    if (!householdId) return;
    supabase.from('shopping_lists').select('id, name')
      .eq('household_id', householdId).eq('is_deleted', false)
      .order('updated_at', { ascending: false })
      .then(({ data }) => { if (data) setLists(data); });
  }, [householdId]);

  const openRecipe = async (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setSelectedListId(null);
    setAddedCount(null);
    setLoadingIngredients(true);
    const { data } = await supabase
      .from('recipe_ingredients')
      .select('id, name, quantity, unit')
      .eq('recipe_id', recipe.id)
      .order('created_at', { ascending: true });
    setIngredients(data ?? []);
    setLoadingIngredients(false);
  };

  const handleDeleteRecipe = async () => {
    if (!selectedRecipe) return;

    const confirmed = isWeb
      ? typeof window !== 'undefined' && window.confirm(`Slette oppskriften "${selectedRecipe.name}"? Dette kan ikke angres.`)
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Slette oppskrift?',
            `"${selectedRecipe.name}" vil bli slettet permanent.`,
            [
              { text: 'Avbryt', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Slett', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmed) return;

    setDeleting(true);
    const { error } = await supabase.from('recipes').delete().eq('id', selectedRecipe.id);
    setDeleting(false);

    if (error) {
      if (isWeb) window.alert(`Kunne ikke slette: ${error.message}`);
      else Alert.alert('Feil', `Kunne ikke slette: ${error.message}`);
      return;
    }

    setRecipes((prev) => prev.filter((r) => r.id !== selectedRecipe.id));
    setSelectedRecipe(null);
  };

  const handleAddToList = async () => {
    if (!selectedListId || !selectedRecipe) return;
    setAddingToList(true);
    await supabase.from('list_items').insert(
      ingredients.map((ing) => ({
        list_id: selectedListId,
        name: ing.name,
        quantity: Math.max(1, Math.round(ing.quantity ?? 1)),
        note: ing.unit ? `${formatQty(ing.quantity)} ${ing.unit} · fra ${selectedRecipe.name}` : `fra ${selectedRecipe.name}`,
        recipe_id: selectedRecipe.id,
        is_checked: false,
        is_deleted: false,
      }))
    );
    setAddedCount(ingredients.length);
    setAddingToList(false);
  };

  const cardStyle = [
    { backgroundColor: C.white, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.outline + '33' },
    isWeb ? ({ boxShadow: '0px 4px 12px rgba(0,54,42,0.04)' } as any) : {},
  ];

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
              onPress={() => router.back()}
              style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(0,105,71,0.08)', alignItems: 'center', justifyContent: 'center' }}
              activeOpacity={0.7}
            >
              <MaterialIcons name="arrow-back" size={22} color={C.primary} />
            </TouchableOpacity>
            <Text style={{ flex: 1, fontSize: 20, fontWeight: '700', color: C.text, fontFamily: C.font } as any}>Mine oppskrifter</Text>
            <TouchableOpacity
              onPress={() => router.push('/(app)/lists/import')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 } as any}
              activeOpacity={0.8}
            >
              <MaterialIcons name="add" size={16} color={C.white} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.white, fontFamily: C.fontBody } as any}>Importer</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 120, maxWidth: 680, alignSelf: 'center' as any, width: '100%' as any }}>

          {loading ? (
            <ActivityIndicator color={C.primary} style={{ marginTop: 60 }} />
          ) : recipes.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 } as any}>
              <MaterialIcons name="restaurant-menu" size={56} color="rgba(0,105,71,0.15)" />
              <Text style={{ fontSize: 18, fontWeight: '600', color: C.text, fontFamily: C.font } as any}>Ingen oppskrifter ennå</Text>
              <Text style={{ fontSize: 14, color: C.textSec, fontFamily: C.fontBody, textAlign: 'center' } as any}>
                Importer oppskrifter fra bilde, screenshot eller tekst
              </Text>
              <TouchableOpacity
                style={{ marginTop: 8, backgroundColor: C.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 999 }}
                onPress={() => router.push('/(app)/lists/import')}
                activeOpacity={0.8}
              >
                <Text style={{ color: C.white, fontWeight: '700', fontFamily: C.font } as any}>Importer første oppskrift</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {recipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  variant="card"
                  name={recipe.name}
                  description={recipe.description}
                  servings={recipe.base_servings}
                  sourceLabel={recipe.source_label}
                  imageUrl={(recipe as any).image_url ?? null}
                  onPress={() => openRecipe(recipe)}
                />
              ))}
            </View>
          )}
        </ScrollView>

        {/* Recipe detail modal */}
        <Modal visible={!!selectedRecipe} transparent animationType="slide">
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,54,42,0.3)' }}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setSelectedRecipe(null)} />
            <View style={[{
              backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28,
              maxHeight: '85%' as any,
            }, isWeb ? ({ boxShadow: '0px -20px 60px rgba(0,54,42,0.15)' } as any) : {}]}>
              {/* Handle */}
              <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.outline + '66' }} />
              </View>

              <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
                {selectedRecipe && (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 } as any}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 22, fontWeight: '800', color: C.text, fontFamily: C.font } as any}>{selectedRecipe.name}</Text>
                        {selectedRecipe.description && (
                          <Text style={{ fontSize: 14, color: C.textSec, fontFamily: C.fontBody, marginTop: 4, fontStyle: 'italic' } as any}>
                            {selectedRecipe.description}
                            {selectedRecipe.description_is_ai && (
                              <Text style={{ fontSize: 11, color: C.outline } as any}> (AI)</Text>
                            )}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity onPress={() => setSelectedRecipe(null)} activeOpacity={0.7}>
                        <MaterialIcons name="close" size={22} color={C.textSec} />
                      </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 } as any}>
                      <View style={{ backgroundColor: C.low, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 4 } as any}>
                        <MaterialIcons name="people" size={14} color={C.textSec} />
                        <Text style={{ fontSize: 13, fontWeight: '700', color: C.textSec, fontFamily: C.fontBody } as any}>{selectedRecipe.base_servings} porsjoner</Text>
                      </View>
                      {selectedRecipe.source_label && (
                        <View style={{ backgroundColor: C.low, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 4 } as any}>
                          <MaterialIcons name={(SOURCE_ICON[selectedRecipe.source_type ?? ''] ?? 'link') as any} size={14} color={C.textSec} />
                          <Text style={{ fontSize: 13, fontWeight: '600', color: C.textSec, fontFamily: C.fontBody } as any}>{selectedRecipe.source_label}</Text>
                        </View>
                      )}
                    </View>

                    {/* Ingredients */}
                    <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.textSec, fontFamily: C.fontBody, marginBottom: 10 } as any}>
                      Ingredienser
                    </Text>

                    {loadingIngredients ? (
                      <ActivityIndicator color={C.primary} />
                    ) : (
                      <View style={{ borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.outline + '33', marginBottom: 20 }}>
                        {ingredients.map((ing, i) => (
                          <View key={ing.id} style={[
                            { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 12 } as any,
                            i < ingredients.length - 1 ? { borderBottomWidth: 1, borderBottomColor: 'rgba(129,184,165,0.15)' } : {},
                          ]}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.primary }} />
                            <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: C.text, fontFamily: C.fontBody, textTransform: 'capitalize' } as any}>{ing.name}</Text>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: C.textSec, fontFamily: C.fontBody } as any}>
                              {formatQty(ing.quantity)}{ing.unit ? ' ' + ing.unit : ing.quantity && ing.quantity > 1 ? ' stk' : ''}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Add to list */}
                    {addedCount !== null ? (
                      <View style={{ backgroundColor: C.primaryContainer + '77', borderRadius: 16, padding: 16, alignItems: 'center', gap: 6 } as any}>
                        <MaterialIcons name="check-circle" size={24} color={C.primary} />
                        <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, fontFamily: C.font } as any}>{addedCount} varer lagt til!</Text>
                      </View>
                    ) : (
                      <>
                        <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.textSec, fontFamily: C.fontBody, marginBottom: 10 } as any}>
                          Legg til i liste
                        </Text>
                        <View style={{ borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.outline + '33', marginBottom: 16 }}>
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

                        <TouchableOpacity
                          style={[{
                            paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                            flexDirection: 'row', gap: 8,
                            backgroundColor: selectedListId ? C.primary : C.outline + '66',
                          } as any, isWeb && selectedListId ? ({ boxShadow: '0px 4px 16px rgba(0,105,71,0.3)' } as any) : {}]}
                          onPress={handleAddToList}
                          disabled={!selectedListId || addingToList}
                          activeOpacity={0.8}
                        >
                          {addingToList
                            ? <><ActivityIndicator color={C.white} size="small" /><Text style={{ color: C.white, fontSize: 16, fontWeight: '700', fontFamily: C.font } as any}>Legger til...</Text></>
                            : <Text style={{ color: C.white, fontSize: 16, fontWeight: '700', fontFamily: C.font } as any}>
                                Legg til {ingredients.length} ingredienser
                              </Text>
                          }
                        </TouchableOpacity>
                      </>
                    )}

                    {/* Slett oppskrift */}
                    <TouchableOpacity
                      style={{
                        marginTop: 16, paddingVertical: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                        flexDirection: 'row', gap: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca',
                      } as any}
                      onPress={handleDeleteRecipe}
                      disabled={deleting}
                      activeOpacity={0.7}
                    >
                      {deleting ? (
                        <ActivityIndicator color="#b91c1c" size="small" />
                      ) : (
                        <>
                          <MaterialIcons name="delete-outline" size={18} color="#b91c1c" />
                          <Text style={{ color: '#b91c1c', fontSize: 14, fontWeight: '700', fontFamily: C.fontBody } as any}>
                            Slett oppskrift
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}
