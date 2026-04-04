const TRUMF_API = 'https://platform.trumf.no/api/ngp/trumf';

export interface TrumfReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number | null;
  totalPrice: number;
}

export interface TrumfReceipt {
  id: string;
  storeName: string;
  storeChain: string;
  purchasedAt: string; // ISO date string
  totalAmount: number;
  items: TrumfReceiptItem[];
}

interface TrumfApiTransaction {
  transactionId: string;
  transactionDate: string;
  storeName: string;
  chainName: string;
  totalAmount: number;
}

interface TrumfApiLineItem {
  description: string;
  quantity: number;
  unitPrice: number | null;
  amount: number;
}

function normalizeChain(chainName: string): string {
  const n = chainName.toUpperCase();
  if (n.includes('KIWI')) return 'KIWI';
  if (n.includes('MENY')) return 'MENY';
  if (n.includes('SPAR') || n.includes('EUROSPAR')) return 'SPAR';
  if (n.includes('JOKER')) return 'JOKER';
  if (n.includes('ODD')) return 'ODD';
  if (n.includes('COOP')) return 'COOP';
  if (n.includes('REMA') || n.includes('REITAN')) return 'REMA';
  return chainName.toUpperCase();
}

export async function fetchTrumfReceipts(accessToken: string): Promise<TrumfReceipt[]> {
  // Hent liste over transaksjoner
  const listRes = await fetch(`${TRUMF_API}/purchases`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!listRes.ok) throw new Error(`Trumf API feil: ${listRes.status}`);
  const listJson = await listRes.json();

  const transactions: TrumfApiTransaction[] = listJson.purchases ?? listJson.data ?? listJson ?? [];

  // Hent detaljer for hver transaksjon
  const receipts: TrumfReceipt[] = [];
  for (const tx of transactions) {
    try {
      const detailRes = await fetch(`${TRUMF_API}/purchases/${tx.transactionId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!detailRes.ok) continue;
      const detail = await detailRes.json();

      const lineItems: TrumfApiLineItem[] = detail.lineItems ?? detail.items ?? [];
      const items: TrumfReceiptItem[] = lineItems
        .filter((li) => li.amount > 0) // filtrer ut pant, rabatter etc.
        .map((li) => ({
          name: li.description,
          quantity: li.quantity ?? 1,
          unitPrice: li.unitPrice ?? null,
          totalPrice: li.amount,
        }));

      receipts.push({
        id: tx.transactionId,
        storeName: tx.storeName ?? detail.storeName ?? '',
        storeChain: normalizeChain(tx.chainName ?? detail.chainName ?? tx.storeName ?? ''),
        purchasedAt: tx.transactionDate ?? detail.transactionDate,
        totalAmount: tx.totalAmount ?? detail.totalAmount,
        items,
      });
    } catch {
      // Skip transaksjoner som feiler
    }
  }

  return receipts;
}
