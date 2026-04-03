const CLAUDE_API_KEY = process.env.EXPO_PUBLIC_CLAUDE_API_KEY;
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

export function isClaudeConfigured(): boolean {
  return !!CLAUDE_API_KEY;
}

export async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  if (!CLAUDE_API_KEY) {
    throw new Error('Claude API key not configured. Add EXPO_PUBLIC_CLAUDE_API_KEY to .env');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0]?.text ?? '';
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

  return JSON.parse(result);
}

// Generate shopping suggestions based on purchase history
export async function generateSuggestions(
  purchaseHistory: { name: string; frequency: number; lastPurchased: string }[]
): Promise<{ name: string; confidence: number }[]> {
  const result = await callClaude(
    `Du foreslår varer til en handleliste basert på kjøpshistorikk. Returner JSON-array:
[{"name": "Varenavn", "confidence": 0.85}]
Sorter etter relevans. Maks 10 forslag. Returner KUN gyldig JSON.`,
    JSON.stringify(purchaseHistory)
  );

  return JSON.parse(result);
}
