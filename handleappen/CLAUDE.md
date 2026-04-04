# Handleappen - Instruksjoner for Claude Code

## Prosjektoversikt
Familieorientert handleliste-app. Expo (React Native) + Supabase + NativeWind.
- **Repo:** togangsgrill/handleliste-kahyttvegen
- **Supabase:** prosjekt-ref `ofzdcktbdfphytehiwsy`
- **Status:** UI redesignet til Stitch lyst tema. Funksjonstestet 4. april 2026 — kjernefunksjoner fungerer, 1 kritisk bug + 4 medium bugs identifisert.

## Viktigste filer
- `ARCHITECTURE.md` — Full produktspec, DB-skjema, byggerekkefølge med status
- `stitch-export/stitch/` — Google Stitch UI-designs (HTML + PNG) som er mål-designet
- `.env` — API-nøkler (Supabase, Claude, Google Vision). ALDRI commit denne.

## Hva er bygget (fungerer)
- Anonym auth + husholdninger med invite-koder
- Handlelister med CRUD, avhuking, kategorier, sanntid (Supabase Realtime)
- Historikk med live `list_activity`, søk, dato-gruppering, topp-varer-chart
- Innstillinger: vis medlemmer, invitasjonskode, bytt/opprett husholdning via modal
- Strekkodeskanning (html5-qrcode)
- Butikkvelger med geolokasjon, nærmeste butikk, kjedelogoer (favicon-URLer)
- Prishistorikk-hook + estimert total på handlelisten
- Smart forslag (useSmartSuggestions), kurv-forslag (useBasketSuggestions)
- Claude API wrapper + Google Vision OCR (stubs, nøkler konfigurert i .env)
- 18 Supabase-tabeller med RLS, seed-data, updated_at triggers

## Stylingregler — VIKTIG

### NativeWind fungerer IKKE for custom farger på web
`react-native-css-interop/.cache/web.css` genereres fra gammel cache og bruker feil farger.
**Bruk ALLTID inline styles med `C`-konstantobjekt:**

```tsx
const C = {
  bg: '#d8fff0', white: '#ffffff', low: '#bffee7', container: '#b2f6de',
  high: '#a7f1d8', highest: '#9decd2', primary: '#006947',
  primaryContainer: '#00feb2', onPrimaryFixed: '#00472f',
  text: '#00362a', textSec: '#2f6555', outline: '#81b8a5',
  secondaryContainer: '#5afcd2', onSecContainer: '#005d4a', tertiary: '#006575',
  font: "'Plus Jakarta Sans', system-ui, sans-serif",
  fontBody: "'Manrope', system-ui, sans-serif",
};
```

### CSS-effekter (kun web)
```tsx
style={[
  { borderRadius: 24, padding: 24, backgroundColor: C.white },
  Platform.OS === 'web' ? {
    boxShadow: '0px 10px 30px rgba(0,54,42,0.04)',
    backdropFilter: 'blur(24px)',
  } as any : {},
]}
```

### Sticky header (web)
```tsx
style={{
  backgroundColor: 'rgba(236,253,245,0.8)',
  paddingTop: insets.top + 8,
  ...(Platform.OS === 'web' ? {
    backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
    boxShadow: '0px 10px 30px rgba(0,54,42,0.06)',
    position: 'sticky', top: 0,
  } as any : {}),
}}
```

### FAB-knapp (gradient på web)
```tsx
style={{
  position: 'absolute', bottom: 96 + insets.bottom, right: 24,
  borderRadius: 9999, padding: 20, backgroundColor: C.primary,
  ...(Platform.OS === 'web' ? {
    background: 'linear-gradient(135deg, #006947, #00feb2)',
    boxShadow: '0px 20px 50px rgba(0,105,71,0.3)',
  } as any : {}),
}}
```

### NativeWind — hva som faktisk fungerer
- Layout-klasser (`flex-1`, `flex-row`, `gap-*`, `items-center`) via `className` KAN fungere
- Custom farger (`bg-background`, `text-primary`) fungerer IKKE — bruk inline styles
- CSS-utilities fra `global.css` (`glass-header`, `fab-glow` etc.) fungerer bare som ren CSS på web
- **Ikke kast tid på å feilsøke NativeWind farger** — gå rett til inline styles

### app.json
- `userInterfaceStyle: "light"` — appen er kun lyst tema

## Komponenter

### Eksisterende komponenter
- `components/stitch-app-bar.tsx` — Header med tilbakepil/tittel/søk. Bruker BlurView på native, CSS glass på web
- `components/stitch-card.tsx` — Kortkomponent med varianter (lowest/low/container/high/highest)
- `components/store-picker.tsx` — Butikkvelger med geolokasjon og kjedelogoer (inline styles)
- `components/barcode-scanner.tsx` — Strekkodeskanner
- `components/receipt-scanner.tsx` — Kvitteringsskanner
- `components/category-order-editor.tsx` — Kategorirekkefølge-editor
- `components/draggable-list.tsx` — Drag-and-drop rekkefølge
- `components/item-detail-sheet.tsx` — Bottom sheet for varedetaljer

### Eksisterende hooks
- `hooks/useShoppingLists` — CRUD for lister
- `hooks/useListItems` — CRUD + toggle for varer
- `hooks/useListItemCounts` — Antall varer per liste
- `hooks/useCategories` — Kategorier med emoji
- `hooks/usePriceHistory` — Prishistorikk + estimert total
- `hooks/useSmartSuggestions` — AI-baserte forslag
- `hooks/useBasketSuggestions` — "Glemte du?"-forslag
- `hooks/useCategoryOrder` — Rekkefølge per butikk
- `hooks/useNearbyStores` — Geolokasjon + butikker fra `store_locations`-tabell
- `hooks/useEnrichItems` — Beriker varer med EAN via Kassal API
- `hooks/useExpectedList` — Auto-kategoriserer varer via keyword-regler
- `hooks/useItemSearch` — Søk i handleliste-varer
- `hooks/useSortedItems` — Sorteringslogikk for varer
- `hooks/useReceiptScanner` — Kvitteringsskanning-tilstand

### Kjedelogoer
`constants/chains.ts` inneholder `CHAINS`-record med `logoUrl` (favicon-URL) per kjede.
`ChainLogo`-komponent i `store-picker.tsx` viser logo med fallback til fargeikon.
- Kiwi: kiwi.no/favicon.ico
- Meny: meny.no/favicon-32x32.png
- Spar/Eurospar: spar.no/favicon-32x32.png
- Joker: joker.no/favicon-32x32.png
- Coop: coop.no/favicon.ico
- Rema: rema.no/favicon.ico

## Husholdning
- `lib/household.ts` har `createHousehold()` og `joinHousehold(code)` — bruk disse
- Settings-skjermen har modal for bytte/opprett husholdning

## Stitch-designfiler (lyst tema er primær)
- `stitch-export/stitch/mine_lister_hovedoversikt/` — Hovedskjerm (kode.html + screen.png)
- `stitch-export/stitch/aktiv_handleliste/` — Handleliste-detalj
- `stitch-export/stitch/historikk_innsikt/` — Historikk
- `stitch-export/stitch/husholdning_deling/` — Innstillinger/husholdning
- `stitch-export/stitch/import_r_oppskrift_ai/` — Oppskriftsimport

## Funksjonstest — 4. april 2026

Fullstendig funksjonstest utført via Chrome MCP på localhost:8082 (Expo Web).

### ✅ Verifisert og fungerer
- **Navigasjon:** Forside `/lists`, liste-detalj `/lists/[id]`, bunntabs (Lists/History/Statistics/Settings), tilbake-pil
- **Handleliste kjerneflyt:** Avhuking → vare flyttes til "KJØPT"-seksjon med strikethrough, fremgangsbadge oppdateres (0%→5%→10%…)
- **Legge til vare:** Søkefelt + +-knapp, teller oppdateres umiddelbart
- **Autocomplete/historikk-søk:** Klokke-ikon forslag, raskt og responsivt
- **"GLEMTE DU?"-seksjon:** Smarte anbefalinger med kjøpshistorikk ("218×") og vanlig antall ("vanligvis 2 stk")
- **Edit item-modal:** Produktnavn, kategori-chips, antall-stepper, notatfelt, Cancel/Save
- **Sortering:** A–Å fungerer korrekt. Kategori/Butikk/Lagt til-tabs aktiveres visuelt
- **Historikk:** Dato-gruppering, "Mest handlet"-chart, aktivitetsfeed med ikoner (Slettet/Lagt til/Handlet), tidsstempel
- **Statistikk:** Streak-kort, sammenligning vs. forrige måned, billigste tur, flest varer, achievement-badges, utgifter/mnd bar-chart, butikk-rangering, mest kjøpte varer, live-tellere
- **Innstillinger:** Husholdningsnavn med "Bytt", medlemmer, invitasjonskode (8-tegn, 24t utløp), del-ikon, siste aktivitet-feed
- **Kvitteringsskann-modal:** Åpner, drag-and-drop upload, butikk-advarsel vises

### 🐛 Bugs — MÅ fikses

#### Kritisk
| Bug | Beskrivelse | Sted |
|-----|-------------|------|
| "..."-knappen sletter direkte | Klikk på tre-prikk-meny sletter vare umiddelbart uten bekreftelse/undo. Data tapt under test. | Handleliste `[id].tsx` |

#### Medium
| Bug | Beskrivelse | Sted |
|-----|-------------|------|
| Butikkvelger liten klikkflate | `<div>` i stedet for `<button>`, upresis hit-area | Handleliste-header |
| Butikk bytter uventet | Z-index/overlap mellom "Bytt butikk"-overlay og History-tab | Handleliste → History-tab |
| History-søk krever Enter | Filtrerer ikke live mens man skriver | `/history` (`app/(tabs)/history.tsx`) |
| Profil-knapp fungerer ikke | Profil-ikonet i header reagerer ikke på klikk | Header (alle sider) |

#### Lav
| Bug | Beskrivelse | Sted |
|-----|-------------|------|
| QR-scan uten respons på web | Forventet — krever kamera-API | Handleliste |
| "Anonym bruker"-navn | Mangler display name i testmiljø | `/settings` |
| "Kopier"-knapp ingen feedback | Bør vise "Kopiert!" etter klikk | `/settings` |
| Sortering effekt uklar | Kategori/Lagt til vanskelig å verifisere med lite testdata | Handleliste |

### ⚠️ Ikke implementert / ikke testet
| Funksjon | Status |
|----------|--------|
| QR/barcode-scan | Kun mobil — ikke testbart på web |
| Kvitteringsskann AI-tolkning | Modal åpner, upload-flyt ikke fulltestet |
| Drag-and-drop egendefinert sortering | Tab aktiveres, dnd ikke testet |
| Bytt husholdning | Knapp finnes, ikke testet |
| Invitasjonsflyt (joining) | Kode genereres, innløsning ikke testet |
| Eksport CSV | Ikke startet |
| Gamification | Delvis — badges/streak vises i statistikk, men ingen gamification-logikk |

## Features som gjenstår
| Steg | Status |
|------|--------|
| 6. Geolokasjon + butikkvalg | ✅ Bygget og verifisert |
| 7. Sanntid aktivitetslogg | ✅ Fungerer — historikk + settings viser live data |
| 8. Kvitteringsskanning | Modal klar, AI-tolkning ikke ferdig |
| 9. Prishistorikk | ✅ Hook klar, Trumf-data importert |
| 10. AI-forslag | ✅ Fungerer — "Glemte du?" vises med historikkdata |
| 11. Oppskrifter | ✅ Fungerer — bilde → Claude → ingrediensliste verifisert |
| 12. Ukesmeny / planlegging | ✅ Bygget — `meal-plan.tsx`, velg oppskrift per dag, generer handleliste |
| 13. Kassal produktdata | ✅ `lib/kassal.ts` + `useEnrichItems` — EAN-berikelse av varer |
| 14. Eksport CSV | Ikke startet |
| 15. Gamification | Delvis — UI i statistikk, mangler logikk |

## Fikset — 4. april 2026 (sesjon 2)

### Bugs fikset
- **"..." slett-knapp** — bekreftelsesdialog implementert (var allerede på plass ved sesjon 2)
- **History live-søk** — fungerer med 300ms debounce (var allerede på plass)
- **Kopier-feedback** — viser "Kopiert!" i 2 sek (var allerede på plass)
- **Profil-knapp** — modal implementert med "Anonym bruker"-info

### UI-forbedringer
- **Rolle-badges** i Innstillinger — Admin/Gjest-badge på hvert husholdningsmedlem (eldste = Admin)
- **"Did you shop?"-kort** i Historikk — viser pending `detected_visits`, Ja/Nei oppdaterer status i DB
- **`StitchAppBar`** — alle NativeWind-klasser erstattet med inline styles (header vises nå korrekt på web)

### Bugs fikset (teknisk)
- **Claude modell-ID** — `claude-sonnet-4-20250514` → `claude-sonnet-4-5` (ugyldig → gyldig ID)
- **`CLAUDE_API_KEY`** — lagt til som Supabase Edge Function secret (oppskriftsimport fungerer nå)

### Trumf.no dataimport
Se `COWORK-TRUMF-INSTRUKSJON.md` for instruksjoner om å importere handlehistorikk fra Trumf via Chrome MCP. Dette fyller `price_history`-tabellen og aktiverer prisestimater. **Trumf-import er utført** — kvitteringsdata ligger i `trumf-kvitteringer.json`.

## Fikset / Bygget etter sesjon 2 (2026-04-04)

### Nye filer og funksjoner
- **`app/(app)/lists/meal-plan.tsx`** — Ukesmeny med 7-dagers kalender. Velg oppskrift per dag (eller skriv egendefinert), juster antall porsjoner. Knapp for å generere handleliste fra uken. Støtter bilde-import av ukesplan via Claude (`parseMealPlanFromImage`).
- **`app/(app)/lists/recipes-list.tsx`** — Oppskriftsoversikt. Vis alle oppskrifter, klikk for å gå til detalj.
- **`lib/kassal.ts`** — Kassal.app API-integrasjon for norsk produktdatabase (EAN-søk, produktinfo, priser). Cache 7 dager. Bruker `EXPO_PUBLIC_KASSAL_API_KEY`.
- **`hooks/useEnrichItems.ts`** — Beriker varer som mangler EAN ved å søke på navn mot Kassal. Maks 1 kall/sek (rate-limit).
- **`hooks/useExpectedList.ts`** — Auto-kategorisering av varer via keyword-regler (regex mot varenavn → kategori-ID). Hardkodede kategori-UUID-er fra DB.
- **`hooks/useItemSearch.ts`** — Søk i varer på en handleliste.
- **`hooks/useSortedItems.ts`** — Sorteringslogikk for handleliste-varer.
- **`components/draggable-list.tsx`** — Drag-and-drop rekkefølge for lister.
- **`components/item-detail-sheet.tsx`** — Bottom sheet for varederaljer (erstatter/supplerer edit-modal).

## Gjenstår å bygge

| Funksjon | Prioritet | Notater |
|----------|-----------|---------|
| **Kvitteringsskanning** | Høy | OCR-flyt via Google Vision → Claude er delvis bygget. Modal og upload-UI finnes. Mangler: faktisk parsing av OCR-resultat og lagring til `price_history`. |
| **Handledeteksjon** | Medium | `detected_visits`-tabell og pending-visit-UI i historikk finnes. Mangler: selve deteksjonslogikken (geofencing eller manuell trigger). |
| **Eksport CSV** | Lav | Ikke startet. |

## Tekniske notater
- Supabase MCP er konfigurert — bruk `mcp__plugin_supabase_supabase__execute_sql` for SQL
- Anonym auth: RLS-policy for `households` INSERT er `WITH CHECK (true)`
- `expo-localization` detekterer ikke alltid norsk på web — fallback sjekker `navigator.language`
- `store_locations`-tabellen brukes av `useNearbyStores` — må ha koordinater (lat/lng)
- Metro cache for NativeWind: slett `node_modules/react-native-css-interop/.cache/` og start med `--reset-cache` ved styling-problemer
- **Kassal API:** `EXPO_PUBLIC_KASSAL_API_KEY` i `.env`. Rate-limit 1 kall/sek. Cache 7 dager i Supabase. Bruk `lib/kassal.ts` → `searchProducts(name)` eller `getProductByEan(ean)`.

---

## UI-designvurdering — Stitch-prototyper (2026-04-04)

Vurdering basert på skjermbilder i `stitch-export/stitch/*/screen.png`. Prototypene er HTML/Tailwind og viser **målbildet** — ikke nødvendigvis hva som er implementert i Expo.

### Mine lister (Hovedoversikt)
- Hardkodet husholdsname ("The Bjørnstads") og melding ("2 lists need attention") — må kobles til ekte data
- Avatarer er placeholder-bilder, ikke brukerprofiler
- "VIEW PRIORITY" / "VIEW READY"-knapper mangler implementert navigasjon

### Aktiv handleliste
- Prisestimering skal vise "ca. X kr (Y av Z varer har kjent pris)" — se arkitekturkrav
- Rediger antall per vare er ikke synlig i prototypen
- Mørkt tema: lav kontrast på sekundærtekster

### Historikk & Innsikt
- All data er hardkodet/demo — ingen kobling til faktisk handlehistorikk i prototypen
- "12% less than average"-indikatoren mangler grafisk kontekst
- Upcoming List er avskåret i prototypen

### Husholdning & Deling
- Recent Activity mangler klikkbare lenker inn til listene
- Ingen synlig måte å fjerne medlem eller endre rolle
- "INVITE EXPIRES IN 24 HOURS" er statisk tekst — bør være dynamisk

### Oppskriftsimport (AI)
- Ingen redigeringsmulighet per ingredienslinje (kun FJERN)
- "Av AI-fritenket" er placeholder-tekst — ikke norsk, må erstattes
- Ingen synlig kategoritildeling til ingrediensene
- Legg til-knappen er avskåret i prototypen

### Prioriterte mangler (til korrigering)
| # | Problem | Alvorlighet |
|---|---------|-------------|
| 1 | "..." slett-knapp sletter direkte uten bekreftelse | 🔴 Kritisk (bug fra funksjonstest) |
| 2 | Oppskriftsimport: placeholder-tekst "Av AI-fritenket" | 🔴 Høy |
| 3 | Prisestimering viser ikke datagrunnlag (X av Y varer) | 🔴 Høy |
| 4 | Historikk: all data er hardkodet/demo | 🟡 Middels |
| 5 | Redigering av mengder i oppskriftsimport | 🟡 Middels |
| 6 | Lav kontrast grå tekst i mørkt tema | 🟡 Middels |
| 7 | Aktivitetsfeed mangler klikkbare lenker | 🟢 Lav |
| 8 | Invite expires er statisk tekst | 🟢 Lav |
