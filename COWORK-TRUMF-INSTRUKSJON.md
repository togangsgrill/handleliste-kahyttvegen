# Claude Cowork: Trumf.no Handlehistorikk → Handleappen

## Mål
Hente kjøpshistorikk fra Trumf.no (NorgesGruppen bonusprogram) via Chrome MCP og importere dataen inn i Handleappen sin Supabase-database.

## Forutsetninger
1. Du er logget inn på trumf.no i Chrome
2. Chrome MCP-server er konfigurert i Claude Code
3. Du har tilgang til handleliste-kahyttvegen prosjektet

## Steg-for-steg

### 1. Naviger til Trumf handlehistorikk
Bruk Chrome MCP til å navigere til `https://www.trumf.no/handlehistorikk` (eller tilsvarende URL for kvitteringsoversikt).

### 2. Hent kvitteringsdata
For hver kvittering på siden:
- Les butikknavn, dato og totalbeløp
- Klikk inn på kvitteringen for å se varelinjer
- Les hvert varenavn, antall og pris

### 3. Strukturer dataen
Konverter til dette formatet per kvittering:
```json
{
  "store_chain": "Kiwi",
  "store_name": "Kiwi Torshov",
  "date": "2026-03-15",
  "total": 342.50,
  "items": [
    { "name": "Lettmelk 1.5L", "quantity": 2, "unit_price": 22.90, "total_price": 45.80 },
    { "name": "Grovbrød", "quantity": 1, "unit_price": 34.00, "total_price": 34.00 }
  ]
}
```

### 4. Importer til Supabase
For hver kvittering, kjør SQL via Supabase MCP:

```sql
-- 1. Finn eller opprett butikk
INSERT INTO store_locations (chain, name)
VALUES ('Kiwi', 'Kiwi Torshov')
ON CONFLICT DO NOTHING;

-- 2. Opprett kvittering
INSERT INTO receipts (household_id, store_location_id, total_amount, purchased_at)
VALUES (
  '<household_id>',
  (SELECT id FROM store_locations WHERE chain = 'Kiwi' AND name = 'Kiwi Torshov' LIMIT 1),
  342.50,
  '2026-03-15'
)
RETURNING id;

-- 3. Opprett varelinjer
INSERT INTO receipt_items (receipt_id, name, quantity, unit_price, total_price)
VALUES
  ('<receipt_id>', 'Lettmelk 1.5L', 2, 22.90, 45.80),
  ('<receipt_id>', 'Grovbrød', 1, 34.00, 34.00);

-- 4. Oppdater prishistorikk
INSERT INTO price_history (household_id, item_name, store_location_id, unit_price, observed_at, receipt_id, confidence)
VALUES
  ('<household_id>', 'lettmelk 1.5l', '<store_id>', 22.90, '2026-03-15', '<receipt_id>', 0.8),
  ('<household_id>', 'grovbrød', '<store_id>', 34.00, '2026-03-15', '<receipt_id>', 0.8);
```

### 5. Verifiser
Sjekk at dataen er importert:
```sql
SELECT COUNT(*) FROM receipts WHERE household_id = '<household_id>';
SELECT COUNT(*) FROM price_history WHERE household_id = '<household_id>';
```

## Viktig
- Varenavn lagres i lowercase i price_history (for matching)
- confidence = 0.8 for Trumf-data (høyere enn OCR men lavere enn manuelt korrigert)
- Household ID finner du med: `SELECT id FROM households LIMIT 1;`
- Trumf viser typisk de siste 3-12 måneder med handlehistorikk

## Prosjektkontekst
- Repo: `handleliste-kahyttvegen/handleappen`
- Supabase prosjekt-ref: `ofzdcktbdfphytehiwsy`
- Arkitekturdokument: `ARCHITECTURE.md`
- Supabase MCP er allerede konfigurert i dette prosjektet
