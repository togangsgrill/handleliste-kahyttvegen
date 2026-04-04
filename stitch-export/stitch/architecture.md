# Handleappen — Arkitektur & Produktspesifikasjon

> Denne filen er ment som kontekst for AI-assistenter og utviklere som jobber med prosjektet.
> Den beskriver produktvisjon, tekniske valg, databaseskjema og byggerekkefølge.

**Versjon:** 1.1 · April 2026
**Plattform:** Web (Fase 1) · iOS (Fase 2) · Android (planlagt)
**Stack:** Expo (React Native) · Supabase · Claude API · Google Vision

---

## 1. Produktoversikt

Handleappen er en familieorientert handleliste-app for iOS og web. Den kombinerer sanntidsdeling i husholdningen med kvitteringsskanning, prishistorikk, AI-baserte forslag og oppskriftsimport via bilde.

Designprinsipp: **lavt friksjon** — ingen obligatorisk konto, deling via link, offline-støtte for bruk i butikk.

| Egenskap | Valg |
|----------|------|
| Plattform | iOS + Web. Android via Expo senere |
| Språk | Følger telefonens språkinnstilling (i18n) |
| Tema | Følger systeminnstilling (lyst/mørkt) |
| Auth | Anonym sesjon som standard. Valgfri innlogging med Google/Apple |
| Deling | Husholdning via invite-link. Enkeltlister kan deles med view/edit |
| Offline | Offline-først med synkronisering når tilkoblet |
| GDPR | Bruker kan slette egne data. Aggregert data beholdes anonymisert |

### Avvik fra originalspesifikasjon (besluttet under utvikling)

1. **CNG i stedet for bare workflow** — Start med managed Expo, kjør `prebuild` først i Fase 2 (iOS-widget)
2. **Supabase direkte i stedet for WatermelonDB** — Enklere MVP, offline-lag legges til for iOS-fasen
3. **Zustand kun for UI-state** — Dataflyt via Supabase hooks, Zustand for valgt liste, sync-status etc.

---

## 2. Kjernefunksjoner

### 2.1 Handlelister
- Flere lister per husholdning (f.eks. «Ukeshandel», «Byggevarer»)
- Delte (synlig for hele husholdningen) eller private (kun eieren)
- Varer hukes av underveis — avhukede vises nedtonet nederst
- Kopier liste fra tidligere handleøkt som utgangspunkt
- Del enkeltliste eksternt via unik token-link (view eller edit)

### 2.2 Varer
- Fritekst med autoforslag basert på kjøpshistorikk
- Antall i stykk, notat per vare, kommentar fra husholdningsmedlemmer
- Sist kjente pris vises diskret på varekortet
- Kategori med emoji-ikon
- Strekkodeskanning — skann produkt hjemme for å legge det på listen
- Oppskriftskobling — varer fra en oppskrift viser hvilken de tilhører

### 2.3 Kategorier og rekkefølge
- Globale kategorier med emoji (🥬 Frukt & grønt, 🥛 Meieri, 🥩 Kjøtt)
- Rekkefølge per bruker per butikk — tilpasset rute gjennom butikken
- Varer sorteres alfabetisk innen kategori

### 2.4 Handleturens livssyklus
1. **Planlegg:** Legg til varer, godkjenn AI-forslag
2. **Velg butikk:** Geolokasjon foreslår nærmeste, eller søk manuelt
3. **Handle:** Hak av varer. Estimert totalpris basert på prishistorikk
4. **Avslutt:** Økten arkiveres. Handledeteksjon registrerer butikkbesøket
5. **Neste åpning:** Strava-inspirert banner foreslår å bekrefte og legge til kvittering

### 2.5 Butikkvalg og geolokasjon
- Automatisk forslag til nærmeste butikk via geolokasjon
- Startkjeder: Kiwi, Rema 1000, Meny, Coop Extra, Coop Mega, Spar, Joker, Bunnpris
- Google Places API for lokasjonsoppslag
- Handledeteksjon: geolokasjon registrerer butikkbesøk

### 2.6 Kvitteringsskanning (Strava-inspirert flyt)
- Handledeteksjon via geolokasjon i bakgrunnen
- Banner: «Handlet du på Kiwi Torshov kl. 14:23?»
- Ja → bekreft handel / legg til kvitteringsbilde. Nei → forslaget forsvinner
- Liste og butikk utledes automatisk — brukeren spørres aldri om dette
- OCR prosesseres async: Google Vision → Claude API strukturerer til produktnavn, mengde, pris
- Bruker kan korrigere OCR-feil i etterkant. Korrigerte priser får høyere confidence

### 2.7 Prishistorikk og estimering
- Prishistorikk per varenavn per butikk
- Sist kjente pris vises på varekort
- Estimert totalpris: «ca. 342 kr — basert på 6 av 11 varer»
- Prissammenligning mellom butikker (kun der data finnes)
- Eksport til CSV/Excel

### 2.8 AI-forslag
- Skyggeliste ved siden av aktiv liste: forslag basert på kjøpshistorikk
- Bruker velger aktivt hvilke forslag som legges på listen
- Avviste forslag læres bort
- Kun basert på historikk — ingen sesong- eller dagsforslag
- Drevet av Claude API

### 2.9 Oppskrifter
- Ta bilde/screenshot av oppskrift (Instagram, TikTok, blogg, kokebok)
- Claude API leser bildet, identifiserer kilde, genererer beskrivelse (merket som AI-generert)
- Bruker bekrefter/korrigerer kilde før lagring
- Oppgi antall personer → mengder skaleres automatisk
- Ingredienser legges på aktiv handleliste med oppskriftskobling

### 2.10 Statistikk og historikk
- Mest kjøpte kategorier, total matutgift per måned, hyppigste butikk
- Søk i arkiverte handleøkter («når kjøpte vi sist parmesan?»)
- Aktivitetslogg per delt liste: hvem la til / huket av hva
- Prissammenligning tydelig merket som «basert på dine kvitteringer»

### 2.11 Gamification
Alle elementer basert på data husholdningen selv samler inn. Ingen live priser fra kjedene.

- **Streaks:** «Dere har handlet med liste 4 uker på rad 🔥»
- **Ny rekord-toast:** Billigste handletur, raskeste gjennomføring, flest varer
- **Spareutvikling:** «Denne måneden brukte dere 8% mindre på Kiwi»
- Alle tall merket med datakilde og begrensning

### 2.12 iOS-widget
- Hjemskjerm-widget viser aktiv handleliste
- Krever Expo bare workflow + Swift/SwiftUI WidgetKit

---

## 3. Teknisk arkitektur

### 3.1 Tech stack

| Område | Teknologi |
|--------|-----------|
| Frontend | Expo (React Native) — iOS og web med én codebase |
| Backend/DB | Supabase — PostgreSQL, sanntidssynk, auth, fillagring |
| OCR | Google Vision API — best i klassen for norsk tekst |
| AI | Claude API (claude-sonnet-4-6) — kvitteringstolkning, oppskriftsimport, listeforslag |
| Bilder | Supabase Storage |
| Geolokasjon | Google Places API |
| iOS-widget | Swift/SwiftUI WidgetKit via App Groups |
| Eksport | CSV/Excel generert client-side |

### 3.2 Auth-flyt
1. Bruker åpner appen → anonym Supabase-sesjon opprettes automatisk
2. Husholdningsinvitasjon: åpne invite-link → kobles til husholdningen
3. Valgfri oppgradering til Google/Apple-konto (bevarer all data)

### 3.3 Offline-arkitektur
- **Konfliktstrategi:** Siste-skriv-vinner basert på `updated_at` timestamp
- Aktivitetsloggen beholder begge hendelsene for innsyn
- Fase 1 (web): Supabase direkte. Fase 2 (iOS): WatermelonDB offline-lag

---

## 4. Databaseskjema

Alle tabeller i Supabase (PostgreSQL). RLS aktivert på alle tabeller. `updated_at`-trigger på alle tabeller som deltar i sync.

### 4.1 Husholdninger og brukere

**`households`**

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid PK | |
| name | text | Husholdsnavnet |
| invite_code | text UNIQUE | Unik kode i invite-link |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**`users`** (refererer auth.users)

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid PK | = Supabase auth.uid() |
| household_id | uuid FK | Referanse til households |
| display_name | text | Vises i aktivitetslogg |
| auth_provider | text | 'anonymous' \| 'google' \| 'apple' |
| is_upgraded | bool | false = anonym, true = har konto |
| deleted_at | timestamptz | Soft delete for GDPR |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 4.2 Handlelister og varer

**`shopping_lists`**

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid PK | |
| household_id | uuid FK | |
| created_by | uuid FK | Eier av listen |
| name | text | F.eks. «Ukeshandel» |
| visibility | text | 'shared' \| 'private' |
| is_deleted | bool | Soft delete |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**`list_items`**

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid PK | |
| list_id | uuid FK | |
| name | text | Varenavn (fritekst) |
| category_id | uuid FK | |
| quantity | int | Antall i stykk |
| is_checked | bool | Avhuket eller ikke |
| checked_by | uuid FK | Hvem huket av |
| checked_at | timestamptz | |
| added_by | uuid FK | Hvem la det til |
| note | text | Valgfritt notat |
| barcode | text | EAN-strekkode |
| recipe_id | uuid FK | Null hvis ikke fra oppskrift |
| is_deleted | bool | Soft delete |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**`list_item_comments`** — kommentarer per vare
**`list_activity`** — aktivitetslogg (added, checked, unchecked, removed, edited)
**`list_shares`** — ekstern deling via token med view/edit-tillatelse

### 4.3 Handleøkter

**`shopping_sessions`** — aktiv/arkivert handleøkt per liste/butikk
**`detected_visits`** — Strava-stil butikkdeteksjon (pending/confirmed/dismissed, 24t auto-dismiss)

### 4.4 Kategorier og butikker

**`categories`** — globale kategorier med emoji (12 norske dagligvarekategorier)
**`user_category_order`** — brukerens sortering per butikk
**`store_locations`** — butikker med kjede, navn, adresse, koordinater

### 4.5 Kvitteringer og prishistorikk

**`receipts`** — kvitteringsbilde, totalbeløp, butikk, handleøkt
**`receipt_items`** — OCR-parsede produkter med pris og korrigeringsstatus
**`price_history`** — pris per varenavn (tekst, ikke FK) per butikk med confidence-score

### 4.6 AI-forslag og oppskrifter

**`list_item_suggestions`** — AI/historikk-baserte forslag med confidence og status
**`recipes`** — oppskrifter med kilde, AI-beskrivelse, porsjonering
**`recipe_ingredients`** — ingredienser per oppskrift med enhet og kategori

---

## 5. Byggerekkefølge

### Fase 1 — Web

| Steg | Innhold | Status |
|------|---------|--------|
| 1 | Supabase: tabeller, RLS, seed-data | ✅ Ferdig |
| 2 | Expo-prosjekt: CNG, routing, Supabase-klient, anonym auth | ✅ Ferdig |
| 3 | Husholdning: opprett/join via invite-kode | ✅ Ferdig |
| 4 | Handlelister: CRUD, avhuking, sanntid | ✅ Ferdig |
| 5 | Kategorier: emoji-gruppering, kategori-velger | ✅ Ferdig |
| 6 | Geolokasjon: Google Places, butikkvalg | Ikke startet |
| 7 | Sanntid: aktivitetslogg i UI, badge-teller | Delvis (Realtime fungerer) |
| 8 | Kvitteringsskanning: kamera, OCR, Claude-tolkning | Stubs klare, venter på bruk |
| 9 | Prishistorikk: sist kjent pris, estimat | Hook klar, venter på data |
| 10 | AI-forslag: skyggeliste med pending/accept/dismiss | Stub klar |
| 11 | Oppskrifter: bilde → Claude → ingrediensliste | Ikke startet |
| 12 | Strekkode: html5-qrcode i nettleser | ✅ Ferdig |
| 13 | Statistikk: historikksøk, topp-varer, aktivitetslogg | ✅ Ferdig |
| 14 | Eksport: CSV/Excel | Ikke startet |
| 15 | Gamification: streaks, rekorder, spareutvikling | Ikke startet |

### Fase 2 — iOS

| Steg | Innhold |
|------|---------|
| 16 | iOS-bygg via EAS Build + TestFlight |
| 17 | Native kamera (expo-camera erstatter web-variant) |
| 18 | iOS-widget (WidgetKit, Swift, App Groups) |

---

## 6. Mappestruktur

```
handleappen/
├── app/                       # Expo Router (filbasert routing)
│   ├── (auth)/                # Onboarding og auth-flyt
│   └── (app)/                 # Hoved-app
│       ├── lists/             # Handlelister
│       ├── history/           # Historikk og søk
│       ├── statistics/        # Statistikk
│       └── settings/          # Husholdning og innstillinger
├── components/                # Gjenbrukbare UI-komponenter
├── lib/
│   ├── supabase.ts            # Supabase-klient
│   ├── auth.ts                # Anonym auth
│   ├── household.ts           # Husholdningslogikk
│   ├── claude.ts              # Claude API-wrapper
│   └── vision.ts              # Google Vision OCR
├── stores/                    # Zustand (kun UI-state)
├── hooks/                     # Custom React hooks for datahenting
├── types/                     # TypeScript-typer (speiler DB)
├── i18n/                      # Oversettelser (norsk/engelsk)
└── supabase/
    ├── migrations/            # SQL-migrasjoner
    └── seed/                  # Kategorier og butikkjeder
```

---

## 7. Claude API — bruksområder

| Bruksområde | Input | Output |
|-------------|-------|--------|
| Kvitteringstolkning | Rå OCR-tekst fra Google Vision | JSON: produktnavn, mengde, pris per linje |
| Oppskriftsimport | Bilde (direkte, ikke OCR) | Ingrediensliste, rettens navn, kilde, AI-beskrivelse |
| Handlelisteforslag | Anonymisert kjøpshistorikk (varenavn + frekvens) | Rangert forslagsliste med confidence-score |

**Modell:** claude-sonnet-4-6 · **Max tokens:** 1000 · **Estimert bruk:** ~3 kall per handletur

---

## 8. Viktige tekniske notater

1. **item_name er tekst, ikke FK** — Prishistorikk bruker fritekst. «Helmelk» og «TINE Helmelk» er to varer. Fuzzy matching kan legges til i v2.

2. **Prisestimering er åpen om usikkerhet** — UI viser alltid hvor mange varer estimatet er basert på: «ca. 342 kr (6 av 11 varer har kjent pris)».

3. **GDPR soft delete** — `deleted_at` settes, `display_name` anonymiseres til «Slettet bruker», auth-kobling fjernes. Prishistorikk beholdes aggregert.

4. **updated_at trigger på alle tabeller** — PostgreSQL-trigger oppdaterer automatisk ved UPDATE. Kritisk for offline-sync.

5. **RLS på alle tabeller** — Hjelpefunksjon `get_my_household_id()` brukes i de fleste policies.

---

## 9. Brukertestfunn

| Funn | Konsekvens |
|------|------------|
| ✅ AI-forslag: «Ja, hadde spart mye tid» | AI-forslagslisten er riktig prioritert |
| ✅ Delt liste i sanntid er ukentlig bruk | Sanntidssynk må fungere perfekt fra dag én |
| ⚠️ Kvittering kun hvis under 10 sekunder | OCR-flyten må være ekstremt rask |
| ⚠️ Oppskrifter scorer middels | Bygg etter kjernefeatures er solide |
| 🔄 Sluttet på app pga. manglende funksjoner | Kvalitet over kvantitet |

**Prioritering:** Delt liste i sanntid + AI-forslag er det som får appen brukt. Kvitteringsskanning må være sømløs. Oppskrifter kan vente.
