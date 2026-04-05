# Funksjonstest #2 — Handleappen på Vercel

**URL:** https://handleliste-azure.vercel.app/
**Dato:** 5. april 2026
**Tester:** Claude via Chrome MCP
**Forrige test:** 4. april 2026 på localhost:8082

---

## Mål

Verifisere at appen fungerer i produksjonsmiljø (Vercel), reteste tidligere bugs, og teste nye funksjoner som er lagt til etter forrige test.

---

## DEL 1: Regresjonstest — verifiser bugfikser

Disse ble rapportert som fikset. Må bekreftes i produksjon.

| # | Bug | Forventet | Status |
|---|-----|-----------|--------|
| R1 | "..." meny-knapp åpner bekreftelsesdialog (ikke direkte slett) | Klikk "..." → meny/dialog vises, ikke slett | |
| R2 | History-søk filtrerer live (ikke kreve Enter) | Skriv i søkefelt → resultater filtreres mens man skriver | |
| R3 | "Kopier"-knapp viser "Kopiert!" feedback | Klikk kopier → tekst endres til "Kopiert!" i ~2 sek | |
| R4 | Profil-knapp i header fungerer | Klikk profil-ikon → modal åpnes | |

---

## DEL 2: Nye funksjoner (ikke testet før)

### Oppskrifter & import
| # | Test | Forventet | Status |
|---|------|-----------|--------|
| N1 | Naviger til oppskriftslisten (`/lists/recipes-list`) | Side laster, viser oppskrifter eller tom tilstand | |
| N2 | Åpne en oppskrift (`/lists/recipe`) | Oppskriftsdetaljer vises med ingredienser | |
| N3 | Oppskriftsimport (`/lists/import`) — last opp bilde | Claude API leser bilde og foreslår ingrediensliste | |
| N4 | Legg ingredienser fra oppskrift på handleliste | Varer legges til med oppskriftskobling | |

### Ukesmeny / måltidsplanlegging
| # | Test | Forventet | Status |
|---|------|-----------|--------|
| N5 | Naviger til ukesmeny (`/lists/meal-plan`) | Kalendervisning med ukedager vises | |
| N6 | Velg oppskrift for en dag | Oppskrift kobles til valgt dag | |
| N7 | Generer handleliste fra ukesmeny | Ingredienser fra valgte oppskrifter legges på liste | |

### Trumf-import
| # | Test | Forventet | Status |
|---|------|-----------|--------|
| N8 | Naviger til Trumf-import (`/settings/trumf-import`) | Side laster med importfunksjon | |

### Rolle-badges (innstillinger)
| # | Test | Forventet | Status |
|---|------|-----------|--------|
| N9 | Sjekk admin/gjest-badges på medlemmer | Eldste bruker har "Admin"-badge, nyere har "Gjest" | |

### "Did you shop?"-kort (historikk)
| # | Test | Forventet | Status |
|---|------|-----------|--------|
| N10 | Sjekk om "Handlet du?"-kort vises i historikk | Pending butikkbesøk vises med Ja/Nei-valg | |

---

## DEL 3: Kjernefunksjoner — fulltest

### Navigasjon
| # | Test | Forventet | Status |
|---|------|-----------|--------|
| K1 | Laste forside `/lists` | Husholdningsoversikt med lister og sync-status | |
| K2 | Bunntabs: Lists → History → Statistics → Settings | Alle navigerer korrekt | |
| K3 | Klikk inn på en liste → `/lists/[id]` | Liste-detalj laster med varer | |
| K4 | Tilbake-pil fra liste-detalj | Returnerer til forside | |
| K5 | FAB-knapp (+) på forsiden | Oppretter ny liste eller åpner modal | |

### Handleliste — kjerneflyt
| # | Test | Forventet | Status |
|---|------|-----------|--------|
| K6 | Huke av vare | Vare flyttes til KJØPT-seksjon, strikethrough, badge oppdateres | |
| K7 | Fjerne avhuking | Vare flyttes tilbake til aktive | |
| K8 | Legge til vare via søkefelt + +-knapp | Vare legges til, teller oppdateres | |
| K9 | Autocomplete/historikk-søk | Forslag med klokke-ikon vises mens man skriver | |
| K10 | Klikke på varenavn → edit modal | Modal med produktnavn, kategori-chips, antall, notat, Save/Cancel | |
| K11 | Endre antall i edit modal | Antall oppdateres etter Save | |
| K12 | Endre kategori i edit modal | Kategori oppdateres, emoji endres | |
| K13 | "GLEMTE DU?"-forslag vises | Smarte anbefalinger med kjøpshistorikk | |
| K14 | Legg til forslag fra "GLEMTE DU?" | Vare legges til listen | |
| K15 | Estimert total vises | "ca. X kr" basert på prishistorikk | |

### Sortering
| # | Test | Forventet | Status |
|---|------|-----------|--------|
| K16 | Sortering: A–Å | Varer sorteres alfabetisk | |
| K17 | Sortering: Kategori | Varer grupperes etter kategori | |
| K18 | Sortering: Butikk | Varer sorteres etter butikk-rekkefølge | |
| K19 | Sortering: Lagt til | Varer sorteres kronologisk | |

### Butikkvelger
| # | Test | Forventet | Status |
|---|------|-----------|--------|
| K20 | "Bytt butikk"-knapp åpner butikkvelger | Sheet/modal med butikkliste | |
| K21 | Velge butikk fra listen | Butikk endres i header | |
| K22 | Geolokasjon foreslår nærmeste butikk | Nærmeste butikker vises først (krever lokasjon) | |

### Historikk
| # | Test | Forventet | Status |
|---|------|-----------|--------|
| K23 | Historikksiden laster | Viser "Handlehistorikk" med søk og feed | |
| K24 | "Mest handlet"-seksjon | Horisontale fremdriftslinjer med antall | |
| K25 | Aktivitetsfeed med ikoner og tidsstempel | Slettet (rød), Lagt til (grønn), Handlet (hake) | |
| K26 | Søk i historikk (live-filter) | Filtrerer mens man skriver | |

### Statistikk
| # | Test | Forventet | Status |
|---|------|-----------|--------|
| K27 | Statistikksiden laster | Streak, sammenligning, badges | |
| K28 | Utgifter per måned bar-chart | Viser kr og antall turer per mnd | |
| K29 | Butikk-rangering | Alle butikker med besøk og total | |
| K30 | Mest kjøpte varer | Rangliste med antall og totalkostnad | |
| K31 | Live-tellere (lister/varer/fullført) | Korrekte tall | |

### Innstillinger
| # | Test | Forventet | Status |
|---|------|-----------|--------|
| K32 | Husholdningsnavn vises | Navn + "Bytt"-knapp | |
| K33 | Medlemsliste med rolle-badges | Admin/Gjest vises | |
| K34 | Invitasjonskode genereres | 8-tegns kode, "Kopier"-knapp, 24t utløp | |
| K35 | Del-ikon ved invitasjon | Share-funksjon aktiveres | |
| K36 | Siste aktivitet-feed | Live feed med handling og tidsstempel | |

### Kvitteringsskanning
| # | Test | Forventet | Status |
|---|------|-----------|--------|
| K37 | Kvitterings-ikon åpner modal | "Skann kvittering"-modal vises | |
| K38 | Upload-flyt i modal | Drag-and-drop eller klikk for bilde | |

---

## DEL 4: Vercel-spesifikt

| # | Test | Forventet | Status |
|---|------|-----------|--------|
| V1 | Sidelasting hastighet | Rimelig rask firstload (<3 sek) | |
| V2 | Deep-linking | Direkte URL til `/history` etc. fungerer | |
| V3 | Supabase-tilkobling | Data laster fra sky-DB, ikke bare mock | |
| V4 | HTTPS/cookies | Auth fungerer via Vercel HTTPS | |
| V5 | Console errors | Sjekk for JS-feil i konsollen | |

---

## DEL 5: Visuell inspeksjon

| # | Sjekk | Status |
|---|-------|--------|
| D1 | Grønt fargepalett konsistent på alle sider | |
| D2 | Fonter (Plus Jakarta Sans / Manrope) laster | |
| D3 | Klikkflater store nok for touch | |
| D4 | Bunntabs synlige og tydelige | |
| D5 | Glass-effekt header fungerer | |
| D6 | FAB-knapp gradient og shadow | |
| D7 | Appnavn i header — hva vises? | |

---

## Testprosedyre

1. Åpne URL i Chrome (430px bredde for mobil-simulering)
2. Ta screenshot av hver side/tilstand
3. Logg resultat i tabellene over
4. Oppsummer funn og oppdater CLAUDE.md

## Estimert tid: ~30 min
