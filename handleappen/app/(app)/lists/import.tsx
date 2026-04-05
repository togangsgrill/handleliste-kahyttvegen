import { useRef, useCallback } from 'react';
import {
  Text, TextInput, TouchableOpacity, View, ScrollView,
  Platform, ActivityIndicator, Image,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  useRecipeImport,
  formatQty,
  scaleIngredients,
  SOURCE_TYPE_LABELS,
  type InputMode,
  type ImportStep,
  type ParsedIngredient,
} from '@/hooks/useRecipeImport';

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

const cardStyle = [
  { backgroundColor: C.white, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.outline + '33' },
  isWeb ? ({ boxShadow: '0px 4px 12px rgba(0,54,42,0.04)' } as any) : {},
];

function PrimaryButton({ label, onPress, disabled = false, loading = false }: {
  label: string; onPress: () => void; disabled?: boolean; loading?: boolean;
}) {
  return (
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
}

// ── Ingrediens-rad ────────────────────────────────────────────────────────

function IngredientRow({ ing, onToggle, isLast }: {
  ing: ParsedIngredient; onToggle: () => void; isLast: boolean;
}) {
  const hasAllergen = (ing.allergens?.length ?? 0) > 0;
  return (
    <TouchableOpacity
      onPress={onToggle}
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
}

// ── Hovedkomponent ────────────────────────────────────────────────────────

export default function ImportScreen() {
  const insets = useSafeAreaInsets();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    step, setStep, inputMode, setInputMode,
    imageUri, imageBase64, textInput, setTextInput,
    loading, progress, error,
    recipes, shoppingLists, selectedListId, setSelectedListId,
    saving, savedCount,
    handleFileLoaded, handleParse,
    toggleRecipe, goToIngredients,
    toggleIngredient, selectAllIngredients, updateServings,
    handleSave, reset,
  } = useRecipeImport();

  // ── Fil-velger ──────────────────────────────────────────────────────────

  const openFilePicker = useCallback(() => {
    if (!isWeb) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = inputMode === 'pdf' ? 'application/pdf,image/*' : 'image/*';
    input.addEventListener('change', (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        handleFileLoaded(dataUrl);
      };
      reader.readAsDataURL(file);
    });
    input.click();
  }, [inputMode, handleFileLoaded]);

  // ── Step: input ─────────────────────────────────────────────────────────

  const renderInput = () => (
    <>
      {/* Tab-velger: Bilde / PDF / Tekst */}
      <View style={{ flexDirection: 'row', backgroundColor: C.low, borderRadius: 12, padding: 4, marginBottom: 20 }}>
        {([
          { mode: 'image' as InputMode, label: '📷  Bilde' },
          { mode: 'pdf' as InputMode, label: '📄  PDF / Ukesmeny' },
          { mode: 'text' as InputMode, label: '📝  Tekst' },
        ]).map(({ mode, label }) => (
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
            <Text style={{ fontSize: 13, fontWeight: '700', color: inputMode === mode ? C.primary : C.textSec, fontFamily: C.fontBody } as any}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {inputMode === 'text' ? (
        <View style={cardStyle}>
          <TextInput
            style={{ minHeight: 160, fontSize: 15, color: C.text, fontFamily: C.fontBody, textAlignVertical: 'top' } as any}
            placeholder={'Lim inn oppskrift her...\n\nEksempel:\nLaks med dill\n4 porsjoner\n500g laksefilet\n1 ss smør\n3 ss fersk dill'}
            placeholderTextColor={C.outline}
            value={textInput}
            onChangeText={setTextInput}
            multiline
            numberOfLines={8}
          />
        </View>
      ) : (
        <TouchableOpacity
          onPress={loading ? undefined : openFilePicker}
          activeOpacity={loading ? 1 : 0.8}
          style={[{
            borderRadius: 20, borderWidth: 2,
            borderColor: loading ? C.primary : imageUri ? C.primary : C.outline + '66',
            borderStyle: imageUri ? 'solid' : 'dashed',
            overflow: 'hidden', minHeight: 180,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: loading ? C.low : imageUri ? 'transparent' : C.low + '88',
          } as any]}
        >
          {loading ? (
            <View style={{ alignItems: 'center', gap: 14, padding: 28 } as any}>
              <ActivityIndicator size="large" color={C.primary} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.primary, fontFamily: C.fontBody } as any}>
                {progress ?? 'Analyserer...'}
              </Text>
            </View>
          ) : imageUri ? (
            <Image source={{ uri: imageUri }} style={{ width: '100%', height: 240 } as any} resizeMode="cover" />
          ) : (
            <View style={{ alignItems: 'center', gap: 10, padding: 24 } as any}>
              <MaterialIcons name={inputMode === 'pdf' ? 'upload-file' : 'add-photo-alternate'} size={44} color={C.outline} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: C.textSec, fontFamily: C.fontBody, textAlign: 'center' } as any}>
                {inputMode === 'pdf' ? (
                  <>Trykk for å velge fil{'\n'}
                    <Text style={{ fontSize: 13, fontWeight: '400' } as any}>PDF eller bilde av ukesmenyen</Text>
                  </>
                ) : (
                  <>Trykk for å velge bilde{'\n'}
                    <Text style={{ fontSize: 13, fontWeight: '400' } as any}>Screenshot fra Instagram, TikTok, blogg eller kokebok</Text>
                  </>
                )}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {error && (
        <View style={{ marginTop: 16, backgroundColor: 'rgba(179,27,37,0.08)', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 } as any}>
          <MaterialIcons name="error-outline" size={18} color={C.error} />
          <Text style={{ flex: 1, fontSize: 14, color: C.error, fontFamily: C.fontBody } as any}>{error}</Text>
        </View>
      )}

      {inputMode === 'text' ? (
        <View style={{ marginTop: 16 }}>
          <PrimaryButton
            label="✨  Analyser oppskrift"
            onPress={handleParse}
            disabled={!textInput.trim()}
            loading={loading}
          />
        </View>
      ) : imageUri && !loading ? (
        <View style={{ marginTop: 16 }}>
          <PrimaryButton
            label={inputMode === 'pdf' ? '✨  Analyser ukesmeny' : '✨  Analyser oppskrift'}
            onPress={handleParse}
            disabled={!imageUri}
          />
        </View>
      ) : null}
    </>
  );

  // ── Step: select-recipes (kun PDF) ──────────────────────────────────────

  const renderSelectRecipes = () => {
    const selectedCount = recipes.filter((r) => r.selected).length;
    const allLoaded = recipes.every((r) => !r.loadingIngredients);

    return (
      <>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 } as any}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: C.textSec, fontFamily: C.fontBody } as any}>
            {selectedCount} av {recipes.length} valgt
          </Text>
          <TouchableOpacity onPress={() => recipes.forEach((_, i) => toggleRecipe(i))} activeOpacity={0.7}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.primary, fontFamily: C.fontBody } as any}>Velg alle</Text>
          </TouchableOpacity>
        </View>

        <View style={{ gap: 10, marginBottom: 20 }}>
          {recipes.map((recipe, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => toggleRecipe(idx)}
              activeOpacity={0.75}
              style={{
                padding: 16, borderRadius: 16,
                backgroundColor: recipe.selected ? C.low : C.white,
                borderWidth: 1.5,
                borderColor: recipe.selected ? C.primary + '55' : C.outline + '33',
                flexDirection: 'row', alignItems: 'center', gap: 12,
              } as any}
            >
              <View style={{
                width: 24, height: 24, borderRadius: 999, marginTop: 1,
                borderWidth: 2, borderColor: recipe.selected ? C.primary : C.outline,
                backgroundColor: recipe.selected ? C.primary : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {recipe.selected && <MaterialIcons name="check" size={14} color={C.white} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, fontFamily: C.fontBody } as any}>
                  {recipe.title}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 } as any}>
                  <Text style={{ fontSize: 12, color: C.outline, fontFamily: C.fontBody } as any}>
                    {recipe.servings} porsjoner
                  </Text>
                  {recipe.loadingIngredients ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fff8e1', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 } as any}>
                      <ActivityIndicator size={10} color="#b45309" />
                      <Text style={{ fontSize: 10, fontWeight: '600', color: '#b45309', fontFamily: C.fontBody } as any}>
                        henter ingredienser...
                      </Text>
                    </View>
                  ) : recipe.ingredients.length > 0 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#e8faf3', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 } as any}>
                      <Text style={{ fontSize: 10 } as any}>🛒</Text>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#006947', fontFamily: C.fontBody } as any}>
                        {recipe.ingredients.length} ingredienser
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <PrimaryButton
          label={`Gå til ingredienser (${selectedCount} oppskrifter) →`}
          onPress={goToIngredients}
          disabled={selectedCount === 0}
        />
      </>
    );
  };

  // ── Step: ingredients ───────────────────────────────────────────────────

  const renderIngredients = () => {
    const selectedRecipes = recipes.filter((r) => r.selected);
    const multipleRecipes = selectedRecipes.length > 1;

    const totalSelected = selectedRecipes.reduce(
      (sum, r) => sum + r.ingredients.filter((i) => i.selected).length, 0
    );
    const totalIngredients = selectedRecipes.reduce(
      (sum, r) => sum + r.ingredients.length, 0
    );
    const anyLoading = selectedRecipes.some((r) => r.loadingIngredients);

    return (
      <>
        {selectedRecipes.map((recipe, recipeDisplayIdx) => {
          const recipeIdx = recipes.indexOf(recipe);
          const nonStaples = recipe.ingredients.filter((i) => !i.is_staple);
          const staples = recipe.ingredients.filter((i) => i.is_staple);
          const selectedInRecipe = recipe.ingredients.filter((i) => i.selected).length;

          return (
            <View key={recipeIdx} style={{ marginBottom: 24 }}>
              {/* Oppskrift-header */}
              {multipleRecipes && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 4 } as any}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: C.text, fontFamily: C.font } as any}>
                    {recipe.title}
                  </Text>
                  <Text style={{ fontSize: 12, color: C.textSec, fontFamily: C.fontBody } as any}>
                    {selectedInRecipe}/{recipe.ingredients.length}
                  </Text>
                </View>
              )}

              {/* Porsjons-skalering */}
              <View style={[cardStyle, { marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, fontFamily: C.font } as any}>Porsjoner</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 } as any}>
                  <TouchableOpacity
                    style={{ width: 36, height: 36, borderRadius: 999, backgroundColor: C.low, alignItems: 'center', justifyContent: 'center' }}
                    onPress={() => updateServings(recipeIdx, Math.max(1, recipe.servings - 1))}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 20, color: C.text }}>−</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: C.text, minWidth: 28, textAlign: 'center' } as any}>{recipe.servings}</Text>
                  <TouchableOpacity
                    style={{ width: 36, height: 36, borderRadius: 999, backgroundColor: C.low, alignItems: 'center', justifyContent: 'center' }}
                    onPress={() => updateServings(recipeIdx, recipe.servings + 1)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 20, color: C.text }}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {recipe.loadingIngredients ? (
                <View style={[cardStyle, { alignItems: 'center', gap: 12, padding: 32 }]}>
                  <ActivityIndicator size="large" color={C.primary} />
                  <Text style={{ fontSize: 14, color: C.textSec, fontFamily: C.fontBody } as any}>
                    Henter ingredienser...
                  </Text>
                </View>
              ) : recipe.ingredients.length === 0 ? (
                <View style={[cardStyle, { alignItems: 'center', gap: 8, padding: 24 }]}>
                  <MaterialIcons name="info-outline" size={24} color={C.outline} />
                  <Text style={{ fontSize: 14, color: C.textSec, fontFamily: C.fontBody, textAlign: 'center' } as any}>
                    Ingen ingredienser funnet for denne oppskriften.
                  </Text>
                </View>
              ) : (
                <>
                  {/* Velg alle / ingen */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 8 } as any}>
                    <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.textSec, fontFamily: C.font } as any}>
                      {selectedInRecipe}/{recipe.ingredients.length} valgt
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 10 } as any}>
                      <TouchableOpacity onPress={() => selectAllIngredients(recipeIdx, true)} activeOpacity={0.7}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: C.primary, fontFamily: C.fontBody } as any}>Alle</Text>
                      </TouchableOpacity>
                      <Text style={{ color: C.outline }}>·</Text>
                      <TouchableOpacity onPress={() => selectAllIngredients(recipeIdx, false)} activeOpacity={0.7}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: C.textSec, fontFamily: C.fontBody } as any}>Ingen</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Ikke-basisvarer */}
                  {nonStaples.length > 0 && (
                    <View style={[cardStyle, { marginBottom: staples.length > 0 ? 12 : 0, padding: 0, overflow: 'hidden' }]}>
                      {nonStaples.map((ing, idx) => {
                        const globalIdx = recipe.ingredients.indexOf(ing);
                        return (
                          <IngredientRow
                            key={`${ing.name}-${globalIdx}`}
                            ing={ing}
                            onToggle={() => toggleIngredient(recipeIdx, globalIdx)}
                            isLast={idx === nonStaples.length - 1}
                          />
                        );
                      })}
                    </View>
                  )}

                  {/* Basisvarer */}
                  {staples.length > 0 && (
                    <>
                      <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.textSec, fontFamily: C.fontBody, marginBottom: 8, marginTop: nonStaples.length > 0 ? 4 : 0, paddingHorizontal: 4 } as any}>
                        Basisvarer — har du dette hjemme?
                      </Text>
                      <View style={[cardStyle, { padding: 0, overflow: 'hidden' }]}>
                        {staples.map((ing, idx) => {
                          const globalIdx = recipe.ingredients.indexOf(ing);
                          return (
                            <IngredientRow
                              key={`${ing.name}-${globalIdx}`}
                              ing={ing}
                              onToggle={() => toggleIngredient(recipeIdx, globalIdx)}
                              isLast={idx === staples.length - 1}
                            />
                          );
                        })}
                      </View>
                    </>
                  )}
                </>
              )}
            </View>
          );
        })}

        {/* Listevelger */}
        {shoppingLists.length > 0 && (
          <View style={[cardStyle, { marginBottom: 16, padding: 0, overflow: 'hidden' }]}>
            <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.textSec, fontFamily: C.fontBody, padding: 16, paddingBottom: 8 } as any}>
              Legg ingredienser i handleliste (valgfritt)
            </Text>
            {shoppingLists.map((list, i) => (
              <TouchableOpacity
                key={list.id}
                onPress={() => setSelectedListId(selectedListId === list.id ? null : list.id)}
                activeOpacity={0.7}
                style={[
                  { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12 } as any,
                  i < shoppingLists.length - 1 ? { borderBottomWidth: 1, borderBottomColor: 'rgba(129,184,165,0.15)' } : {},
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

        <PrimaryButton
          label={
            selectedListId
              ? `Lagre ${selectedRecipes.length > 1 ? selectedRecipes.length + ' oppskrifter' : 'oppskrift'} og legg til ${totalSelected} varer`
              : `Lagre ${selectedRecipes.length > 1 ? selectedRecipes.length + ' oppskrifter' : 'oppskrift'}`
          }
          onPress={handleSave}
          disabled={selectedRecipes.length === 0 || anyLoading}
          loading={saving}
        />
      </>
    );
  };

  // ── Step: done ──────────────────────────────────────────────────────────

  const renderDone = () => {
    const savedNames = recipes.filter((r) => r.selected).map((r) => r.title);
    return (
      <View style={{ alignItems: 'center', gap: 16, paddingTop: 40 } as any}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.primaryContainer + '88', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name="check-circle" size={40} color={C.primary} />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: C.text, fontFamily: C.font, textAlign: 'center' } as any}>
          {savedNames.length === 1 ? `${savedNames[0]} er lagret!` : `${savedNames.length} oppskrifter lagret!`}
        </Text>
        {savedCount > 0 && (
          <Text style={{ fontSize: 15, color: C.textSec, fontFamily: C.fontBody, textAlign: 'center' } as any}>
            {savedCount} ingredienser lagt til i handlelisten.
          </Text>
        )}
        <View style={{ gap: 10, width: '100%', marginTop: 16 } as any}>
          <TouchableOpacity
            style={{ paddingVertical: 16, borderRadius: 16, alignItems: 'center', backgroundColor: C.primary }}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={{ color: C.white, fontSize: 16, fontWeight: '700', fontFamily: C.font } as any}>Tilbake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ paddingVertical: 14, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: C.outline + '55' }}
            onPress={reset}
            activeOpacity={0.7}
          >
            <Text style={{ color: C.primary, fontSize: 16, fontWeight: '600', fontFamily: C.fontBody } as any}>Importer ny oppskrift</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ── Layout ──────────────────────────────────────────────────────────────

  const stepTitles: Record<ImportStep, string> = {
    input: 'Importer oppskrift',
    'select-recipes': 'Velg oppskrifter',
    ingredients: 'Velg ingredienser',
    done: 'Ferdig!',
  };

  const stepSubtitles: Record<ImportStep, string> = {
    input: 'Velg hvordan du vil importere — bilde, PDF eller tekst.',
    'select-recipes': 'Vi fant flere oppskrifter. Velg hvilke du vil lagre.',
    ingredients: 'Juster porsjoner og velg ingredienser til handlelisten.',
    done: '',
  };

  const allSteps: ImportStep[] = recipes.length > 1
    ? ['input', 'select-recipes', 'ingredients']
    : ['input', 'ingredients'];

  const handleBack = () => {
    if (step === 'done') { reset(); return; }
    if (step === 'ingredients') {
      setStep(recipes.length > 1 ? 'select-recipes' : 'input');
      return;
    }
    if (step === 'select-recipes') { setStep('input'); return; }
    router.back();
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
              onPress={handleBack}
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
              {allSteps.map((s, i) => (
                <View key={s} style={{
                  height: 3, borderRadius: 2, flex: 1,
                  backgroundColor: s === step ? C.primary : (
                    allSteps.indexOf(step) > i ? C.primary + '55' : C.outline + '33'
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
          {stepSubtitles[step] ? (
            <Text style={{ fontSize: 14, color: C.textSec, fontFamily: C.fontBody, marginBottom: 24 } as any}>
              {stepSubtitles[step]}
            </Text>
          ) : null}

          {step === 'input' && renderInput()}
          {step === 'select-recipes' && renderSelectRecipes()}
          {step === 'ingredients' && renderIngredients()}
          {step === 'done' && renderDone()}
        </ScrollView>
      </View>
    </>
  );
}
