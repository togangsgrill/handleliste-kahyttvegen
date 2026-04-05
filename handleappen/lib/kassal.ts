import { supabase } from './supabase';

const API_KEY = process.env.EXPO_PUBLIC_KASSAL_API_KEY ?? '';
const BASE = 'https://kassal.app/api/v1';

const headers = () => ({
  Authorization: `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
});

// Cache er gyldig i 7 dager
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface KassalAllergen {
  code: string;
  display_name: string;
  contains: 'YES' | 'NO' | 'CAN_CONTAIN_TRACES';
}

export interface KassalProduct {
  ean: string;
  kassalId: number | null;
  name: string;
  brand: string | null;
  vendor: string | null;
  imageUrl: string | null;
  weight: number | null;
  weightUnit: string | null;
  ingredients: string | null;
  categoryTop: string | null;
  categoryMid: string | null;
  categorySub: string | null;
  allergens: KassalAllergen[];
}

interface ApiCategory {
  id: number;
  depth: number;
  name: string;
}

interface ApiAllergen {
  code: string;
  display_name: string;
  contains: 'YES' | 'NO' | 'CAN_CONTAIN_TRACES';
}

interface ApiProduct {
  id: number;
  name: string;
  vendor: string | null;
  brand: string | null;
  description: string | null;
  ean: string;
  image: string | null;
  weight: number | null;
  weight_unit: string | null;
  ingredients: string | null;
  category?: ApiCategory[];
  allergens?: ApiAllergen[];
}

function mapProduct(p: ApiProduct): KassalProduct {
  const cats = p.category ?? [];
  const top = cats.find((c) => c.depth === -2)?.name ?? null;
  const mid = cats.find((c) => c.depth === -1)?.name ?? null;
  const sub = cats.find((c) => c.depth === 0)?.name ?? null;
  const allergens = p.allergens ?? [];

  return {
    ean: p.ean,
    kassalId: p.id,
    name: p.name,
    brand: p.brand ?? null,
    vendor: p.vendor ?? null,
    imageUrl: p.image ?? null,
    weight: p.weight ?? null,
    weightUnit: p.weight_unit ?? null,
    ingredients: p.ingredients ?? null,
    categoryTop: top,
    categoryMid: mid,
    categorySub: sub,
    allergens,
  };
}

async function cacheProduct(product: KassalProduct) {
  await supabase.from('kassal_products').upsert({
    ean: product.ean,
    kassal_id: product.kassalId,
    name: product.name,
    brand: product.brand,
    vendor: product.vendor,
    image_url: product.imageUrl,
    weight: product.weight,
    weight_unit: product.weightUnit,
    ingredients: product.ingredients,
    category_top: product.categoryTop,
    category_mid: product.categoryMid,
    category_sub: product.categorySub,
    allergens: product.allergens.length > 0 ? product.allergens : null,
    fetched_at: new Date().toISOString(),
  }, { onConflict: 'ean' });
}

async function getCached(ean: string): Promise<KassalProduct | null> {
  const { data } = await supabase
    .from('kassal_products')
    .select('*')
    .eq('ean', ean)
    .maybeSingle();
  if (!data) return null;
  const age = Date.now() - new Date(data.fetched_at).getTime();
  if (age > CACHE_TTL_MS) return null;
  return {
    ean: data.ean,
    kassalId: data.kassal_id,
    name: data.name,
    brand: data.brand,
    vendor: data.vendor,
    imageUrl: data.image_url,
    weight: data.weight,
    weightUnit: data.weight_unit,
    ingredients: data.ingredients,
    categoryTop: data.category_top ?? null,
    categoryMid: data.category_mid ?? null,
    categorySub: data.category_sub ?? null,
    allergens: data.allergens ?? [],
  };
}

export async function lookupByEan(ean: string): Promise<KassalProduct | null> {
  const cached = await getCached(ean);
  if (cached) return cached;

  const res = await fetch(`${BASE}/products/ean/${encodeURIComponent(ean)}`, { headers: headers() });
  if (!res.ok) return null;
  const json = await res.json();
  const products: ApiProduct[] = json.data ?? [];
  if (products.length === 0) return null;

  const product = mapProduct(products[0]);
  await cacheProduct(product);
  return product;
}

export async function searchProducts(query: string, size = 5): Promise<KassalProduct[]> {
  if (!query.trim()) return [];
  const res = await fetch(`${BASE}/products?search=${encodeURIComponent(query)}&size=${size}`, { headers: headers() });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data ?? []).map(mapProduct);
}
