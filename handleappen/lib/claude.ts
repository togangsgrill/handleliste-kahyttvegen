const CLAUDE_API_KEY = process.env.EXPO_PUBLIC_CLAUDE_API_KEY;
const CLAUDE_MODEL = 'claude-sonnet-4-5';
const CLAUDE_PROXY_URL = 'https://ofzdcktbdfphytehiwsy.supabase.co/functions/v1/claude-proxy';

export function isClaudeConfigured(): boolean {
  return !!CLAUDE_API_KEY;
}

async function callClaudeAPI(body: object): Promise<string> {
  const response = await fetch(CLAUDE_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude proxy error ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error.message ?? JSON.stringify(data.error));
  return data.content[0]?.text ?? '';
}

export async function callClaude(systemPrompt: string, userMessage: string, maxTokens = 2000): Promise<string> {
  return callClaudeAPI({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });
}

// Extract JSON from a string that may contain surrounding text (object or array)
function extractJson(text: string): string {
  // Strip markdown code fences
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const firstBrace = stripped.indexOf('{');
  const firstBracket = stripped.indexOf('[');

  // Pick whichever delimiter comes first (-1 means not found)
  const tryObj = firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket);

  if (tryObj) {
    const s = stripped.slice(firstBrace);
    const last = s.lastIndexOf('}');
    if (last !== -1) return s.slice(0, last + 1);
  }
  if (firstBracket !== -1) {
    const s = stripped.slice(firstBracket);
    const last = s.lastIndexOf(']');
    if (last !== -1) return s.slice(0, last + 1);
  }
  throw new Error('No JSON found in response');
}

// Parse receipt OCR text into structured items
export async function parseReceipt(ocrText: string): Promise<{
  items: { name: string; quantity: number; unitPrice: number; totalPrice: number }[];
  total: number | null;
}> {
  const result = await callClaude(
    `Du er en ekspert på norske dagligvarekvitteringer. Returner JSON med format:
{"items": [{"name": "Produktnavn", "quantity": 1, "unitPrice": 29.90, "totalPrice": 29.90}], "total": 342.50}
Returner KUN gyldig JSON, ingen annen tekst.`,
    ocrText
  );

  return JSON.parse(extractJson(result));
}

export interface RecipeParseResult {
  title: string;
  servings: number | null;
  description: string | null;
  source_type: string | null;   // 'instagram' | 'tiktok' | 'blog' | 'cookbook' | null
  source_label: string | null;  // f.eks. "@matblogg" eller "Trines Matblogg"
  source_url: string | null;
  source_confidence: number;    // 0–1
  ingredients: {
    name: string;
    quantity: number;
    unit: string | null;
    is_staple: boolean;          // true = basisvare folk flest har hjemme
    allergens?: string[];        // allergener ingrediensen inneholder
    substitute?: string | null;  // foreslått erstatning hvis allergen
  }[];
}

function buildRecipeSystemPrompt(allergens: string[] = []): string {
  const allergenSection = allergens.length > 0
    ? `\n\nHUSHOLDNINGENS ALLERGIER/INTOLERANSER: ${allergens.join(', ')}
For hver ingrediens, legg til:
- "allergens": array med hvilke av husholdningens allergener ingrediensen inneholder (tom array hvis ingen)
- "substitute": kort norsk forslag til allergivennlig erstatning hvis ingrediensen treffer en allergen, ellers null
  Eksempler: "glutenfri pasta" for pasta ved glutenallergi, "laktosefri fløte" for fløte ved laktoseintoleranse, "havremelk" for melk ved laktoseintoleranse`
    : '';

  return `Du er en ekspert på å tolke oppskrifter fra bilder og tekst (norsk og engelsk).
Returner JSON med dette formatet:
{
  "title": "Oppskriftsnavn",
  "servings": 4,
  "description": "Kort AI-generert beskrivelse av retten (ikke kopiert fra originalen)",
  "source_type": "instagram",
  "source_label": "@brukernavn eller sitenavn",
  "source_url": "https://... eller null",
  "source_confidence": 0.9,
  "ingredients": [
    {"name": "olivenolje", "quantity": 2, "unit": "ss", "is_staple": true, "allergens": [], "substitute": null},
    {"name": "mel", "quantity": 3, "unit": "dl", "is_staple": true, "allergens": ["gluten"], "substitute": "glutenfritt mel"},
    {"name": "laksefilet", "quantity": 500, "unit": "g", "is_staple": false, "allergens": [], "substitute": null}
  ]
}
Regler:
- Normaliser ingrediensnavn til norsk, små bokstaver
- Konverter tekstmengder til tall ("en halv" → 0.5, "to" → 2)
- source_type: "instagram" | "tiktok" | "blog" | "cookbook" | "website" | null
- source_confidence: hvor sikker du er på kildeinfo (0–1)
- description: lag en kort, naturlig beskrivelse basert på ingredienser og navn — IKKE kopier tekst fra originalen
- Alltid inkluder "allergens" (tom array []) og "substitute" (null) på alle ingredienser
- "is_staple": sett true for basisvarer de fleste norske husholdninger har hjemme og sjelden trenger å kjøpe spesielt. Eksempler som SKAL være true: olje (olivenolje, nøytral olje, rapsolje), smør, salt, pepper, sukker, mel, bakepulver, vaniljesukker, eddik (alle typer), soyasaus, flytende kjøttfond, grønnsaksbuljong, kyllingkraft, fiskekraft, tomatpuré, hvitløk, løk, vann. Sett false for alt annet — spesifikke kjøttstykker, fersk fisk, grønnsaker utover løk/hvitløk, meieriprodukter, pasta, ris, hermetikk, krydderblandinger man ikke alltid har.
- Returner KUN gyldig JSON, ingen annen tekst${allergenSection}`;
}

// Parse recipe from image (base64) using Claude vision
export async function parseRecipeFromImage(imageBase64: string, mediaType: string, allergens: string[] = []): Promise<RecipeParseResult> {
  const text = await callClaudeAPI({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    system: buildRecipeSystemPrompt(allergens),
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
        { type: 'text', text: 'Trekk ut oppskriften fra dette bildet.' },
      ],
    }],
  });
  return JSON.parse(extractJson(text));
}

// Parse recipe from plain text
export async function parseRecipe(recipeText: string, allergens: string[] = []): Promise<RecipeParseResult> {
  const result = await callClaude(buildRecipeSystemPrompt(allergens), recipeText, 2000);
  try {
    return JSON.parse(extractJson(result));
  } catch {
    throw new Error(`JSON-parsing feilet. Råsvar: ${result.slice(0, 300)}`);
  }
}

// ── Ukesmeny-import ──────────────────────────────────────────────────────────

export interface MealPlanRecipe {
  title: string;
  servings: number | null;
  description?: string | null;
  ingredients?: { name: string; quantity: number; unit: string | null; is_staple: boolean }[];
}

export interface MealPlanParseResult {
  recipes: MealPlanRecipe[];
}

const MEAL_PLAN_TITLES_SYSTEM = `Du er en ekspert på å tolke norske ukesmenyer fra bilder og PDF-sider.
En ukesmeny inneholder typisk 4–6 oppskrifter (f.eks. ukens fisk, ukens suppe, ukens vegetar, ukens pasta, ukens ekstra).

Returner JSON med dette formatet — KUN tittel og porsjoner:
{
  "recipes": [
    {"title": "Laks med dill og poteter", "servings": 4},
    {"title": "Potet og sellerirotsuppe", "servings": 6}
  ]
}

Regler:
- Inkluder ALLE oppskrifter du finner — typisk 4–6 stykker
- servings: antall porsjoner fra oppskriften, eller 4 hvis ikke oppgitt
- Returner KUN gyldig JSON, ingen annen tekst, ingen kodeblokk`;

const MEAL_PLAN_INGREDIENTS_SYSTEM = `Du er en ekspert på å lese norske oppskrifter fra PDF-dokumenter.
Finn oppskriften med tittelen som brukeren oppgir og returner ingredienslisten som JSON-array.

Returner KUN et JSON-array:
[
  {"name": "laksefilet", "quantity": 500, "unit": "g", "is_staple": false},
  {"name": "smør", "quantity": 1, "unit": "ss", "is_staple": true}
]

Regler:
- Hent KUN ingredienser som faktisk står i dokumentet for denne oppskriften
- Normaliser ingrediensnavn til norsk, små bokstaver
- is_staple: true for basisvarer folk flest har hjemme (olje, smør, salt, pepper, sukker, mel, hvitløk, løk, vann, buljong, soyasaus, eddik, tomatpuré, bakepulver, vaniljesukker, melis)
- is_staple: false for alt annet
- Konverter tekstmengder til tall ("en halv" → 0.5, "to" → 2, "3 klyper" → 3)
- Hvis oppskriften ikke finnes i dokumentet, returner tom array []
- Returner KUN gyldig JSON, ingen annen tekst`;

export async function parseMealPlanFromImage(
  fileBase64: string,
  mediaType: string,
  onProgress?: (msg: string) => void,
): Promise<MealPlanParseResult> {
  const isPdf = mediaType === 'application/pdf';
  const contentBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: fileBase64 } };

  // Steg 1: Hent oppskriftstitler
  onProgress?.('Leser oppskriftsnavn...');
  const titlesText = await callClaudeAPI({
    model: CLAUDE_MODEL,
    max_tokens: 1000,
    system: MEAL_PLAN_TITLES_SYSTEM,
    messages: [{
      role: 'user',
      content: [contentBlock, { type: 'text', text: 'List opp alle oppskriftene i denne ukesmenyen. Returner KUN JSON.' }],
    }],
  });
  console.log('[parseMealPlanFromImage] titler råsvar:', titlesText.slice(0, 500));

  const titlesResult: MealPlanParseResult = JSON.parse(extractJson(titlesText));
  const recipes = Array.isArray(titlesResult?.recipes) ? titlesResult.recipes : [];
  if (recipes.length === 0) throw new Error('Fant ingen oppskrifter i filen. Prøv et klarere bilde eller en annen side.');

  // Steg 2: Hent ingredienser per oppskrift i separate kall
  const recipesWithIngredients: MealPlanRecipe[] = [];
  for (const recipe of recipes) {
    onProgress?.(`Henter ingredienser for "${recipe.title}"...`);
    try {
      const ingText = await callClaudeAPI({
        model: CLAUDE_MODEL,
        max_tokens: 1500,
        system: MEAL_PLAN_INGREDIENTS_SYSTEM,
        messages: [{
          role: 'user',
          content: [
            contentBlock,
            { type: 'text', text: `Finn ingredienslisten for oppskriften "${recipe.title}" i dette dokumentet. Returner KUN JSON-array.` },
          ],
        }],
      });
      console.log(`[parseMealPlanFromImage] ingredienser for "${recipe.title}":`, ingText.slice(0, 300));
      const ingredients = JSON.parse(extractJson(ingText));
      recipesWithIngredients.push({ ...recipe, ingredients: Array.isArray(ingredients) ? ingredients : [] });
    } catch (e) {
      console.error(`Kunne ikke hente ingredienser for "${recipe.title}":`, e);
      recipesWithIngredients.push({ ...recipe, ingredients: [] });
    }
  }

  return { recipes: recipesWithIngredients };
}

// Generate ingredients for a recipe by name (used when meal plan import only has title)
export async function generateRecipeIngredients(
  recipeName: string,
  servings: number,
  allergens: string[] = []
): Promise<{ name: string; quantity: number; unit: string | null; is_staple: boolean }[]> {
  const allergenNote = allergens.length > 0
    ? `\nHusholdningens allergener: ${allergens.join(', ')}. Foreslå alternativer der relevant.`
    : '';

  const result = await callClaude(
    `Du er en ekspert på norske oppskrifter. Gitt et oppskriftsnavn og antall porsjoner, generer en realistisk ingrediensliste.
Returner JSON-array:
[{"name": "laksefilet", "quantity": 500, "unit": "g", "is_staple": false}]

Regler:
- Norske ingrediensnavn, små bokstaver
- is_staple: true for basisvarer folk flest har hjemme (olje, smør, salt, pepper, sukker, mel, hvitløk, løk, vann, buljong, soyasaus, eddik, tomatpuré)
- is_staple: false for alt annet
- Mengder tilpasset ${servings} porsjoner
- Returner KUN gyldig JSON, ingen annen tekst${allergenNote}`,
    `Oppskrift: ${recipeName}, ${servings} porsjoner`
  );

  return JSON.parse(extractJson(result));
}

// Generate shopping suggestions based on purchase history
export async function generateSuggestions(
  purchaseHistory: { name: string; frequency: number; lastPurchased: string }[]
): Promise<{ name: string; confidence: number; categoryName: string | null }[]> {
  const result = await callClaude(
    `Du foreslår varer til en norsk handleliste basert på kjøpshistorikk fra kvitteringer.

Regler for varenavn:
- Normaliser til kort, naturlig norsk handlenavn (slik man ville skrevet det på en lapp)
- Fjern merkenavn, vekt, størrelse og butikkspesifikke koder
- Eksempler: "YOGHURT VANILJE 800G Q" → "Yoghurt vanilje", "BANANER BAMA" → "Bananer", "EGG FRITTGÅENDE 18STK S/M FIRST PRICE" → "Egg", "HELMELK 1,75L TINE" → "Helmelk"
- Behold mengde kun hvis det er naturlig (f.eks. "Egg 12 stk")

Returner JSON-array med maks 10 forslag, sortert etter relevans:
[{"name": "Yoghurt vanilje", "confidence": 0.9, "categoryName": "Meieri"}]

Gyldige kategorier: Frukt & grønt, Meieri, Kjøtt, Fisk & sjømat, Brød & bakevarer, Hermetikk & tørrvarer, Frysevarer, Drikke, Snacks & godteri, Husholdning, Personlig pleie, Annet

Returner KUN gyldig JSON, ingen annen tekst.`,
    JSON.stringify(purchaseHistory)
  );

  return JSON.parse(extractJson(result));
}
