import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import { performOCR, isVisionConfigured } from '@/lib/vision';
import { parseReceipt, isClaudeConfigured } from '@/lib/claude';

export interface ParsedReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  accepted: boolean; // user can deselect before saving
}

export type ScanStep =
  | 'idle'
  | 'ocr'        // running Google Vision
  | 'parsing'    // running Claude
  | 'review'     // user reviews parsed items
  | 'saving'
  | 'done'
  | 'error';

export interface UseReceiptScannerReturn {
  step: ScanStep;
  error: string | null;
  items: ParsedReceiptItem[];
  total: number | null;
  scan: (imageBase64: string, storeLocationId: string | null) => Promise<void>;
  toggleItem: (index: number) => void;
  save: (storeLocationId: string | null) => Promise<void>;
  reset: () => void;
}

export function useReceiptScanner(): UseReceiptScannerReturn {
  const [step, setStep] = useState<ScanStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ParsedReceiptItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [lastImageBase64, setLastImageBase64] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep('idle');
    setError(null);
    setItems([]);
    setTotal(null);
    setLastImageBase64(null);
  }, []);

  const scan = useCallback(async (imageBase64: string, storeLocationId: string | null) => {
    setError(null);
    setLastImageBase64(imageBase64);

    if (!isVisionConfigured()) {
      setError('Google Vision API-nøkkel mangler. Legg til EXPO_PUBLIC_GOOGLE_VISION_API_KEY i .env');
      setStep('error');
      return;
    }
    if (!isClaudeConfigured()) {
      setError('Claude API-nøkkel mangler. Legg til EXPO_PUBLIC_CLAUDE_API_KEY i .env');
      setStep('error');
      return;
    }

    try {
      setStep('ocr');
      const ocrText = await performOCR(imageBase64);

      if (!ocrText.trim()) {
        setError('Ingen tekst funnet i bildet. Prøv igjen med bedre lys.');
        setStep('error');
        return;
      }

      setStep('parsing');
      const parsed = await parseReceipt(ocrText);

      const parsedItems: ParsedReceiptItem[] = parsed.items
        .filter((i) => i.name && i.unitPrice > 0)
        .map((i) => ({
          name: i.name,
          quantity: i.quantity ?? 1,
          unitPrice: i.unitPrice,
          totalPrice: i.totalPrice ?? i.unitPrice * (i.quantity ?? 1),
          accepted: true,
        }));

      if (parsedItems.length === 0) {
        setError('Klarte ikke å lese kvitteringen. Sørg for at bildet er tydelig.');
        setStep('error');
        return;
      }

      setItems(parsedItems);
      setTotal(parsed.total);
      setStep('review');
    } catch (e: any) {
      setError(e?.message ?? 'Ukjent feil under skanning');
      setStep('error');
    }
  }, []);

  const toggleItem = useCallback((index: number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, accepted: !item.accepted } : item))
    );
  }, []);

  const save = useCallback(async (storeLocationId: string | null) => {
    const { userId, householdId } = useAuthStore.getState();
    if (!userId || !householdId) return;

    const acceptedItems = items.filter((i) => i.accepted);
    if (acceptedItems.length === 0) return;

    setStep('saving');
    try {
      // 1. Insert receipt row
      const { data: receipt, error: receiptErr } = await (supabase
        .from('receipts' as any)
        .insert({
          household_id: householdId,
          store_location_id: storeLocationId ?? undefined,
          total_amount: total ?? undefined,
          purchased_at: new Date().toISOString(),
        })
        .select('id')
        .single() as any);

      if (receiptErr) throw receiptErr;
      const receiptId: string = receipt.id;

      // 2. Insert receipt_items
      await (supabase.from('receipt_items' as any).insert(
        acceptedItems.map((item) => ({
          receipt_id: receiptId,
          name: item.name.toUpperCase(), // consistent with existing OCR data
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.totalPrice,
          is_corrected: false,
        }))
      ) as any);

      // 3. Insert price_history — one row per observation (latest is highest observed_at)
      if (storeLocationId) {
        const now = new Date().toISOString();
        await (supabase.from('price_history' as any).insert(
          acceptedItems.map((item) => ({
            household_id: householdId,
            item_name: item.name.toLowerCase(),
            store_location_id: storeLocationId,
            unit_price: item.unitPrice,
            observed_at: now,
            receipt_id: receiptId,
            confidence: 0.9,
          }))
        ) as any);
      }

      setStep('done');
    } catch (e: any) {
      setError(e?.message ?? 'Lagring feilet');
      setStep('error');
    }
  }, [items, total]);

  return { step, error, items, total, scan, toggleItem, save, reset };
}
