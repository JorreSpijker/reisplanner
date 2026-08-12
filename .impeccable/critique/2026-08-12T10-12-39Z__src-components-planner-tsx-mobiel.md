---
target: mobiele weergave (planner.tsx)
total_score: 27
p0_count: 0
p1_count: 3
timestamp: 2026-08-12T10-12-39Z
slug: src-components-planner-tsx-mobiel
---
# Critique — Reisplanner mobiel (`src/components/planner.tsx`)

Tweede meting, na de P0–P3-ronde van vandaag. Scope: mobiele weergave (<`lg`), gemeten in Chrome op 500×701 CSS-px.

## Design Health Score

| # | Heuristic | Score | Was | Key Issue |
|---|-----------|-------|-----|-----------|
| 1 | Visibility of System Status | 3 | 2 | "opgeslagen" en routestatus zijn er nu; geen skeleton bij laden. |
| 2 | Match System / Real World | 4 | 4 | Taal blijft uitstekend. |
| 3 | User Control and Freedom | 2 | 1 | Bevestiging bij elke destructieve actie, maar nog steeds geen undo. |
| 4 | Consistency and Standards | 2 | 2 | De drie tabbladen tonen verschillende dagen. `×` en `TrashIcon` voor dezelfde actie. |
| 5 | Error Prevention | 3 | 1 | Dialogen en 44px raakvlakken; je kunt nog wel een dagdeel van een andere dag bewerken. |
| 6 | Recognition Rather Than Recall | 3 | 2 | Labels onder de icoonknoppen op touch, dagcontext op elk tabblad. |
| 7 | Flexibility and Efficiency | 2 | 2 | Opent op vandaag; geen weg terug naar vandaag, geen dagwissel vanaf de kaart. |
| 8 | Aesthetic and Minimalist Design | 3 | 2 | Chrome van 41% naar 35%; dagenstrip nog 79px, zoekbalk dekt 13% van de kaart. |
| 9 | Error Recovery | 2 | 2 | Ongewijzigd: goede foutschermen, geen herstel na verwijderen. |
| 10 | Help and Documentation | 3 | 2 | Zichtbare labels vervangen de tooltips die op touch niet bestonden. |
| **Totaal** | | **27/40** | **20/40** | **Acceptable, bovenkant** |

## Anti-Patterns Verdict

**LLM-oordeel**: nog steeds geen AI-slop. De ingrepen van vandaag zijn in de bestaande taal geschreven: `pointer-coarse:`-varianten in plaats van een tweede stylesheet, de bestaande `Collapsible` en `ConfirmDialog` hergebruikt, geen nieuwe componenten waar er al een was.

**Deterministische scan (CLI)**: `detect.mjs --json src/components src/app` → `[]`. Nul bevindingen in de bron.

**Deterministische scan (browser, DOM)**: de CLI mist wat pas bij het renderen ontstaat. Overlay geïnjecteerd via `live-server.mjs` op poort 8400, gescand op de Dag- en Kaart-tab, server daarna gestopt. Vijf groepen:

| Bevinding | Element | Oordeel |
|---|---|---|
| `cramped-padding` | `div.border-y…bg-surface-raised…px-6` | **Terecht.** Mijn regressie van vanmiddag. |
| `nested-cards` ×3 | `div.flex items-center gap-3 rounded-md border` | **Vals alarm.** Dat zijn lijstitems met een rand, geen kaarten in kaarten. |
| `nested-cards` ×1 | de Reis-band | **Deels terecht.** Omkaderd vlak met omkaderde knoppen erin. |
| `flat-type-hierarchy` | `body` | **Terecht, met nuance.** 12/13/14/16px, ratio 1.3:1. |
| `positioned child clipped by overflow container` | Kaart-tab | **Vals alarm.** Handmatig getest met "Freiburg": zes resultaten, niets afgeknipt. |

De overlay is niet meer zichtbaar; de live-server draait niet meer.

## Overall Impression

De mobiele weergave is van "desktoplayout die toevallig op een telefoon staat" naar "werkt op een telefoon" gegaan. Zeven punten winst, en de twee blokkerende dingen zijn weg.

Wat overblijft is een andere soort probleem. De eerste ronde ging over maten: te klein, te veel ruimte kwijt, verkeerde viewport-eenheid. Wat er nu ligt gaat over **samenhang**: drie tabbladen die het niet met elkaar eens zijn over welke dag je bekijkt, twee vormen voor dezelfde actie, een kaart die je niet kunt bedienen zonder terug te gaan naar de lijst. Dat is inhoudelijk lastiger en de moeite waard.

Grootste kans: maak de actieve dag de enige waarheid waar alle drie de tabbladen zich aan houden.

## What's Working

1. **De contextregel doet meer dan bedoeld.** "Dag 2 · ma 28 sep · 1 u 54 min · 99,9 km" boven de tabbalk beantwoordt de openingsvraag van het product in één regel, op alle drie de tabbladen. Dat het "opgeslagen" er rechts bij kan zonder de rest weg te duwen is de juiste opbouw.
2. **De scrollhint op de dagenstrip klopt precies.** Gemeten: bij `scrollLeft: 0` alleen rechts transparant, na scrollen alleen links, aan het einde geen fade meer. Geen valse belofte dat er nog dagen zijn.
3. **De raakvlak-aanpak schaalt.** `pointer-coarse:min-h-11` waar het kan, een onzichtbaar `before:`-vlak waar het uiterlijk klein moet blijven. Het nummerbolletje is nog steeds 24px op het scherm en 44px onder je duim, en dat is precies goed: het is ook de marker op de kaart.

## Priority Issues

### [P1] De drie tabbladen zijn het oneens over welke dag je bekijkt

`store.ts:192` — `setActiveDay` wist `mapPick`, maar niet `selectedActivityId`.

Reproductie in de draaiende app: dagdeel "Triberger wasserfall" van Dag 6 openen, terug naar Dag, Dag 1 kiezen. Uitkomst:

- contextregel: `Dag 1 · zo 27 sep · 14 u 7 min · 1.321,1 km`
- dagplanning: de drie dagdelen van Dag 1
- kaart: de punten van Dag 1
- **Dagdeel-tab: "Triberger wasserfall" — een dagdeel van Dag 6, actief en bewerkbaar**

Je kunt daar op "Verplaats op kaart" tikken en een punt van Dag 6 verzetten terwijl de kaart Dag 1 toont. Verwijderen kan ook, met een bevestiging die niet zegt van welke dag het dagdeel is.

Dit bestond al vóór vandaag, maar het is nu beter zichtbaar doordat het tabblad altijd op zijn plek staat.

**Fix**: `selectedActivityId: null` mee in `setActiveDay`, net als `mapPick`. Eén regel. Alternatief als je de selectie wél wilt bewaren: bij het openen van de Dagdeel-tab naar de dag van dat dagdeel springen — maar dan is de dagkeuze niet meer van jou.
→ `/impeccable harden`

### [P1] De uitgeschakelde Dagdeel-tab staat op 1.7:1

`planner.tsx` — `opacity-40` over `text-text-subtle` geeft effectief `rgb(196,199,204)` op wit: **1,7:1 bij 12px**. Gemeten in de pagina.

WCAG zondert uitgeschakelde besturingselementen uit van 1.4.3, dus dit is formeel geen overtreding. Praktisch is het er wel een: dit is een tabblad in de primaire navigatie, op een telefoon, mogelijk in de zon. Op 1,7:1 zie je niet dát er een derde tabblad is, alleen dat er rechts iets grijzigs staat.

Dit is een regressie van mijn eigen fix van vanmiddag: vóór vandaag was het tabblad afwezig, nu is het aanwezig maar onleesbaar.

**Fix**: `opacity-40` eruit, `text-text-subtle` laten staan (4,83:1) en het uit-zijn met `cursor-not-allowed` plus `aria-disabled` overbrengen in plaats van met doorzichtigheid. Of: label naar "Dagdeel" in dezelfde kleur als de inactieve tabs en alleen de interactie blokkeren.
→ `/impeccable polish`

### [P1] Op de kaart is niets groot genoeg om aan te tikken

De `pointer-coarse:`-ronde raakte alleen eigen componenten. De kaart heeft zijn eigen DOM en bleef ongemoeid. Gemeten:

| Element | Grootte | Waarom het telt |
|---|---|---|
| Dagdeelmarkers 1–3 | 28×28 | Primaire ingang naar het dagdeelpaneel vanaf de kaart |
| Verblijfmarker | 28×28 | |
| Zoom in / uit (`.maplibregl-ctrl`) | 29×29 | Enige zoombediening naast knijpen |

De markers zijn het punt: op de kaart-tab is een marker aantikken de manier om bij een dagdeel te komen, en 28px is met een duim mikken op een cirkeltje dat ook nog op een bewegende kaart staat.

**Fix**: markers krijgen hetzelfde `before:`-raakvlak als het nummerbolletje in de lijst — 28px zichtbaar, 44px raakbaar. Voor de zoomknoppen een `@media (pointer: coarse)`-regel op `.maplibregl-ctrl button` in `globals.css`.
→ `/impeccable adapt`

### [P2] De Reis-band heeft geen verticale lucht meer

`day-panel.tsx` — de wrapper is `border-y … px-6`; de verticale ruimte kwam voorheen van `py-2.5` en komt nu van de `py-3` op de `summary` van de `Collapsible`. Dicht klopt dat. Open ligt de inhoud tegen de onderrand aan.

Door de deterministische DOM-scan gevonden (`cramped-padding`), niet door mij. Mijn eigen regressie van vanmiddag.

**Fix**: `pb-2` op de wrapper, of de `Collapsible` zijn eigen ondermarge geven wanneer hij open staat.
→ `/impeccable layout`

### [P2] Vanaf de kaart kun je niet van dag wisselen

De kaart toont de punten van de actieve dag, maar de dagkeuze staat in een ander tabblad. Onderweg is "wat is de volgende etappe" een kaartvraag, en het antwoord kost nu: Dag-tab, horizontaal vegen, pil tikken, Kaart-tab.

De contextregel onderaan zegt al welke dag je ziet. Dat is de logische plek voor een vorige/volgende.

**Fix**: de contextregel wordt links en rechts aanraakbaar — chevron vorige dag, chevron volgende. Werkt meteen op alle drie de tabbladen en lost tegelijk "geen weg terug naar vandaag" op als je de datum zelf naar vandaag laat springen bij een lange druk.
→ `/impeccable adapt`

### [P2] Twee vormen voor dezelfde daad

`day-plan.tsx:382` en `favorites.tsx:199` verwijderen met een `×`-glyph, `activity-panel.tsx` met `TrashIcon`. Dezelfde handeling, twee tekens, in schermen die naast elkaar staan.

De `×` in `activity-panel.tsx:62` (paneel sluiten) en `map-view.tsx:338` (zoekpunt wissen) is wél juist: dat is sluiten, niet verwijderen. Precies dat maakt het huidige gebruik verwarrend — hetzelfde teken betekent op het ene scherm "weg ermee" en op het andere "ik ben klaar met kijken".

**Fix**: `TrashIcon` overal waar iets verdwijnt, `×` overal waar iets dichtgaat.
→ `/impeccable polish`

## Persona Red Flags

**Casey (afgeleide mobiele gebruiker)**:
- De tabbalk staat stil en de raakvlakken zijn raakbaar; de twee grootste klachten van vanmorgen zijn weg.
- Blijft: na een herlaad ben je je geopende dagdeel kwijt en sta je op vandaag in plaats van waar je was.
- Blijft: op de kaart kun je niets bedienen behalve pannen en knijpen.

**Sam (toegankelijkheidsafhankelijk)**:
- Contrast nagemeten: contextregel 7,23:1, trajectregels 4,83:1, Reis-hint 4,63:1 — alle drie ruim AA op 12px.
- De icoonknoppen hebben nu zichtbare woorden op touch, niet alleen een `aria-label`.
- Blijft: het uitgeschakelde tabblad op 1,7:1.
- Blijft: 28px kaartmarkers falen WCAG 2.5.8 (24×24 is het minimum voor AA — deze halen dat net, maar met een tussenruimte die dat weer opeet zodra twee punten dicht bij elkaar liggen).

**Riley (edge cases)**:
- De dagwissel-bug hierboven is precies zijn soort vondst: alles werkt, tot je twee dingen in een bepaalde volgorde doet.
- Zoeken op "Freiburg" geeft zes resultaten waarvan er vier op elkaar lijken ("Freiburg im Breisgau — Baden-Württemberg" naast "Freiburg — Baden-Württemberg"). Boven de vier van Miller, zonder onderscheidend kenmerk zoals afstand tot je huidige positie.
- De laatste dag heeft "Eindig bij Airbnb" uit staan en een dagdeel "Thuis" — de app rekent daar netjes mee. Goed gedrag op een randgeval.

## Minor Observations

- **Typeschaal 12/13/14/16px.** Door de detector gemeld als vlak. Voor product-UI is een strakke schaal juist goed, maar 12, 13 én 14 zijn drie stappen die je niet uit elkaar houdt. 13px doet geen werk dat 12 of 14 niet al doet.
- **De zoekbalk dekt 13% van de kaart, altijd.** Gemeten: 265×83px op een kaart van 625px hoog. Je zoekt zelden; hij staat er permanent.
- **De dagenstrip is met 79px het grootste vaste blok na de tabbalk.** Twee regels per pil ("DAG 1" boven "zo 27 sep") terwijl de contextregel de datum onderaan al herhaalt.
- **Geen undo.** Blijft de laagste heuristiek. Bevestiging vangt de verkeerde tik, niet de verkeerde beslissing.
- **Geen skeleton bij het laden**, alleen "Bezig met laden…" gecentreerd. Bij een lokale IndexedDB is dat kort genoeg om niemand te storen.

## Questions to Consider

- Als de actieve dag de enige waarheid is, hoort `selectedActivityId` dan niet gewoon een afgeleide van die dag te zijn in plaats van een eigen veld?
- De contextregel is in één ronde van bijschrift tot spil gegroeid. Wat gebeurt er als je hem de dagnavigatie geeft en de dagenstrip op mobiel weglaat? Dat wint 79px en haalt de horizontale veeg weg.
- Twee van de vijf detector-bevindingen waren vals alarm op lijstitems met een rand. Is "kaart" hier wel het goede woord voor wat die rijen zijn?
