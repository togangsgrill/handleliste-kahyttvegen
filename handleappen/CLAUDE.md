# Handleappen - Instruksjoner for Claude Code

## Prosjektoversikt
Familieorientert handleliste-app. Expo (React Native) + Supabase + NativeWind.
- **Repo:** togangsgrill/handleliste-kahyttvegen
- **Supabase:** prosjekt-ref `ofzdcktbdfphytehiwsy`
- **Status:** Fungerende MVP med alle kjernefunksjoner. UI trenger redesign.

## Viktigste filer
- `ARCHITECTURE.md` — Full produktspec, DB-skjema, byggerekkefølge med status
- `stitch-export/stitch/` — Google Stitch UI-designs (HTML + PNG) som er mål-designet
- `.env` — API-nøkler (Supabase, Claude, Google Vision). ALDRI commit denne.

## Hva er bygget (fungerer)
- Anonym auth + husholdninger med invite-koder
- Handlelister med CRUD, avhuking, kategorier, sanntid (Supabase Realtime)
- Statistikk-side, historikk med søk
- Strekkodeskanning (html5-qrcode)
- Prishistorikk-hook (venter på kvitteringsdata)
- Claude API wrapper + Google Vision OCR (stubs, nøkler er konfigurert i .env)
- NativeWind installert og konfigurert med Stitch fargepalett i tailwind.config.js
- 18 Supabase-tabeller med RLS, seed-data, updated_at triggers

## Høyeste prioritet: UI-redesign etter Stitch

### Problemet
UI-et matcher ikke Stitch-designene i `stitch-export/stitch/`. Funksjonaliteten fungerer, men det visuelle er langt unna mockups.

### Stitch-designfiler (mørkt tema er primær)
- `stitch-export/stitch/mine_lister_m_rkt_tema/` — Hovedskjerm med lister
- `stitch-export/stitch/aktiv_handleliste_m_rkt_tema/` — Handleliste-detalj
- `stitch-export/stitch/historikk_innsikt_m_rkt_tema/` — Historikk
- `stitch-export/stitch/husholdning_deling_m_rkt_tema/` — Innstillinger/husholdning
- `stitch-export/stitch/import_r_oppskrift_ai/` — Oppskriftsimport (lyst tema)
- `stitch-export/stitch/kvitteringsskanning_ocr/` — Kvitteringsskanning (tom)

Hver mappe har `code.html` (Tailwind CSS kildekode) og `screen.png` (visuelt mål).

### Designsystem fra Stitch
- **Fonter:** Plus Jakarta Sans (headlines), Manrope (body) — lastes via Google Fonts i _layout.tsx
- **Farger (dark):** bg `#001510`, surface `#001d16`/`#002f26`, primary `#00eea6`, text `#d8fff0`
- **Nøkkeleffekter som mangler:** backdrop-blur, gradients, custom box-shadows, ring-*, opacity modifiers (bg-x/20)
- **Løsning:** Bruk `Platform.OS === 'web'` med inline `style` for web-spesifikke CSS-egenskaper som NativeWind ikke støtter

### Fremgangsmåte for UI-arbeid
1. Åpne `screen.png` for skjermen du jobber med
2. Les tilhørende `code.html` for eksakte Tailwind-klasser
3. Oversett til NativeWind className i React Native-komponenten
4. For effekter NativeWind ikke støtter (blur, gradient, shadow), bruk:
   ```tsx
   <View
     className="bg-surface-container-low rounded-3xl p-6"
     style={Platform.OS === 'web' ? {
       backdropFilter: 'blur(20px)',
       boxShadow: '0px 20px 40px rgba(0,0,0,0.3)',
     } : {}}
   >
   ```
5. Sammenlign visuelt med screen.png etter hver endring

### Tailwind-konfig
`tailwind.config.js` har allerede alle Stitch-farger definert. Klassene `bg-background`, `text-on-surface`, `bg-surface-container-high`, `text-primary` etc. er tilgjengelige.

## Neste steg etter UI

### Features som gjenstår (se ARCHITECTURE.md steg 5-15)
| Steg | Status |
|------|--------|
| 6. Geolokasjon + butikkvalg | Ikke startet |
| 7. Sanntid (aktivitetslogg i UI) | Delvis |
| 8. Kvitteringsskanning | Stubs klare, trenger UI |
| 9. Prishistorikk | Hook klar, trenger UI + data |
| 10. AI-forslag | Stub klar, trenger UI |
| 11. Oppskrifter | Ikke startet |
| 14. Eksport CSV | Ikke startet |
| 15. Gamification | Ikke startet |

### Trumf.no dataimport
Se `COWORK-TRUMF-INSTRUKSJON.md` for instruksjoner om å importere handlehistorikk fra Trumf via Chrome MCP. Dette fyller price_history-tabellen.

## Tekniske notater
- Supabase MCP er konfigurert — bruk `mcp__plugin_supabase_supabase__execute_sql` for SQL
- Anonym auth: RLS-policy for `households` INSERT ble fikset til `WITH CHECK (true)` 
- `expo-localization` detekterer ikke alltid norsk på web — fallback sjekker `navigator.language`
- Stitch bruker Material Symbols Outlined ikoner — vi bruker MaterialIcons via IconSymbol-komponenten
