---
target: mobiele weergave (planner.tsx)
total_score: 20
p0_count: 2
p1_count: 4
timestamp: 2026-08-12T09-30-23Z
slug: src-components-planner-tsx-mobiel
---
# Critique — Reisplanner mobiel (`src/components/planner.tsx`)

Scope: mobiele weergave (<`lg`). Desktop driekolomsopzet niet beoordeeld.
Gemeten in Chrome op 500×757 CSS-px (Chrome mag op macOS niet smaller dan 500; op 390px worden alle ruimteklachten erger, niet beter).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Autosave is volledig onzichtbaar; verwijderen geeft geen enkele bevestiging. Routestatus ("route berekenen…") is wél goed. |
| 2 | Match System / Real World | 4 | Taal is uitstekend. "Dagdeel", "terug naar Airbnb", mono-cijfers voor tijd/afstand. |
| 3 | User Control and Freedom | 1 | Geen undo. Dagdeel verwijderen is onmiddellijk en onherstelbaar. |
| 4 | Consistency and Standards | 2 | Favoriet verwijderen krijgt `ConfirmDialog`, dagdeel verwijderen niet. Tabbalk verspringt van 2 naar 3 tabs. |
| 5 | Error Prevention | 1 | 20×20px "×" pal naast 24×24px sleepgreep, zonder bevestiging. Tijdveld is vrije tekst zonder validatie. |
| 6 | Recognition Rather Than Recall | 2 | Vier icon-only knoppen in dagdeelpaneel; labels zitten alleen in tooltips, die op touch niet bestaan. Kaart-tab toont niet welke dag. |
| 7 | Flexibility and Efficiency | 2 | Drag-and-drop is sterk op desktop, zwaar op touch (250ms delay). Geen "ga naar vandaag". |
| 8 | Aesthetic and Minimalist Design | 2 | 308 van 757px (41%) is vaste chrome vóór de dagplanning begint. |
| 9 | Error Recovery | 2 | Opslagfoutscherm is goed geschreven. Geen herstel na verwijderen. |
| 10 | Help and Documentation | 2 | Lege staat legt uit; tooltips vallen weg op touch. |
| **Totaal** | | **20/40** | **Acceptable (ondergrens)** |

Desktop scoort duidelijk hoger; dit cijfer is de mobiele weergave.

## Anti-Patterns Verdict

**LLM-oordeel**: geen AI-slop. Eigen kleurkeuze (#FECE14 op zwart), geen kaartenraster, geen eyebrows, geen gradient-tekst, geen glassmorphism. Nederlandse commentaren in de code redeneren over gedrag in plaats van te beschrijven. Dit is met de hand gemaakt en dat is zichtbaar.

**Deterministische scan**: `detect.mjs --json src/components src/app` → `[]`. Nul bevindingen.

**Visuele overlays**: niet geïnjecteerd. Bewijs komt uit directe DOM-metingen in de pagina (raakvlakken, elementhoogtes) plus screenshots.

Vals alarm: de zwarte cirkel met "N" linksonder is de Next.js dev-indicator, geen app-UI.

## Overall Impression

De planning zelf is goed: nummer in de lijst = marker op de kaart, rijtijd tussen elk dagdeel, mono-cijfers. Dat is precies het product.

Er omheen zit een desktoplayout die mobiel niet is bijgesteld. Elk raakvlak, elke marge en de hele verticale verdeling komen van een 420px-brede zijkolom naast een kaart. Op een telefoon is die zijkolom het hele scherm geworden zonder dat er iets aan de maatvoering veranderde.

Grootste kans: mobiel is volgens PRODUCT.md de leesmodus. Behandel het dan ook zo — reisbeheer weg uit de eerste 200 pixels, open op vandaag, en maak wat je wél aanraakt groot genoeg.

## What's Working

1. **Nummerkoppeling lijst ↔ kaart.** `placeIndex` telt alleen dagdelen mét locatie, zodat marker 3 en regel 3 altijd hetzelfde ding zijn. Zeldzaam consequent doorgevoerd.
2. **Trajecten tussen de regels.** "18 min · 13,1 km" tussen twee dagdelen, en "· terug naar Airbnb" op de laatste. Dat is de informatie waarvoor je onderweg kijkt, precies waar je kijkt.
3. **Kaart blijft in leven bij tabwissel.** `hidden` in plaats van unmount plus `mapRef.resize()` — zoomniveau en positie blijven staan. Correct opgelost, inclusief het `offsetParent === null`-geval.

## Priority Issues

### [P0] Tabbalk kan onder de browsertoolbar verdwijnen

`src/app/layout.tsx:37,40` — `html.h-full` + `body.h-full overflow-hidden`. `height:100%` verwijst naar het *large viewport*: de hoogte alsof de browsertoolbars ingeklapt zijn. In Safari en Chrome op iOS/Android staat de toolbar meestal wél uitgeklapt, dus de onderste 60–90px van de body valt erachter. Door `overflow-hidden` kun je er niet naartoe scrollen.

Wat eronder valt: de complete tabbalk. De enige navigatie tussen Dag, Kaart en Dagdeel.

Als geïnstalleerde PWA (`appleWebApp.capable`) speelt dit niet. In de browser wel, en de comment op regel 39 ("zo blijft de tabbalk op mobiel altijd in beeld") belooft juist het tegenovergestelde.

**Fix**: `h-[100dvh]` in plaats van `h-full` op `body`, met `h-full` als fallback voor oudere engines. Voeg `interactive-widget: "resizes-content"` toe aan `viewport` zodat het toetsenbord de layout inkort in plaats van bedekt.
→ `/impeccable adapt`

### [P0] 36 van 42 raakvlakken zijn kleiner dan 44×44px

Gemeten in de pagina. De ergste:

| Element | Grootte | Bestand |
|---|---|---|
| Checkbox "Vertrek vanaf / Eindig bij" | 13×13 | `day-plan.tsx:184,193` |
| "× verwijderen" per dagdeel | 20×20 | `day-plan.tsx:365` |
| Favoriet verwijderen | 16×20 | `favorites.tsx` |
| Sleepgreep (nummerbolletje) | 24×24 | `day-plan.tsx:322` |
| Notitie-werkbalk (B / I / Kop / lijst) | 28×20 | `rich-text.tsx` |
| Exporteren / Importeren / Kaart laden | 82×26 | `trip-transfer.tsx`, `offline-map-panel.tsx` |

Erger dan de losse maten is de combinatie: 20×20 "verwijderen" op 358px afstand van een 24×24 sleepgreep, in dezelfde rij, en verwijderen vraagt niets. Eén misgetikte duim is een verdwenen dagdeel zonder undo.

**Fix**: raakvlak loskoppelen van het uiterlijk. Icoon blijft 20px, klikgebied wordt 44px via padding of een `::after`-overlay. Voor de rij dagdelen: zet verwijderen achter een swipe of een expliciete bewerkstand in plaats van permanent naast de sleepgreep.
→ `/impeccable adapt`

### [P1] 41% van het scherm is vaste chrome

Gemeten op 757px hoogte:

| Blok | Hoogte |
|---|---|
| Zwarte header (reisnaam + datums) | 78px |
| Exporteren / Importeren / Offline kaart | 108px |
| Dagenstrip | 79px |
| Tabbalk | 43px |
| **Chrome totaal** | **308px** |
| Dagplanning (scrollbaar) | 448px |

Die drie bovenste blokken scrollen niet weg — ze zijn siblings van het scrollgebied in `day-panel.tsx:65-131`. Op een echte 390×844-telefoon met browsertoolbar blijft er ±330px over voor de planning: drie dagdelen, dan is het op.

De 108px voor Exporteren/Importeren/Offline kaart is het pijnlijkst. Volgens PRODUCT.md-principe 2 hoort reisbeheer geen bijzaak-band bovenaan te zijn, en zeker niet in de leesmodus.

**Fix**: reisbeheer op mobiel in een `Collapsible` (die heb je al) of achter de reisnaam in de header. Reisnaam + datums naar één regel van ~44px. Dat wint ±140px, oftewel twee dagdelen extra.
→ `/impeccable layout`

### [P1] Opent altijd op dag 1, niet op vandaag

`src/lib/store.ts:175,187` — `activeDayId: data.days[0]?.id`. Bij elke laadbeurt begin je op de eerste reisdag. Op dag 9 van een reis van 14 betekent dat: acht keer horizontaal scrollen door een strip die zelf ook niet naar de actieve dag scrollt (geen `scrollIntoView` in de codebase).

Dit raakt precies de gestelde mobiele taak: "binnen twee tikken weten wat de dag is."

**Fix**: bij het laden de dag kiezen waarvan `day.date` gelijk is aan vandaag; valt vandaag buiten de reis, dan de dichtstbijzijnde. Actieve dagpil met `scrollIntoView({ inline: "center" })` in beeld brengen.
→ `/impeccable adapt`

### [P1] Kaart-tab heeft geen context

De zwarte header met reisnaam en datums staat *binnen* `aside[aria-label="Dagindeling"]` (`day-panel.tsx:70`). Wissel je naar Kaart, dan verdwijnt hij. Je ziet markers 1–3 en een route, maar nergens welke dag of welke reis dat is — terwijl de kaart de markers van de *actieve* dag toont en die keuze in een ander tabblad zit.

**Fix**: dagcontext boven de tabbalk, buiten beide panelen. Één regel: "Dag 1 · zo 27 sep · 6 u 44 min · 673 km". Werkt in alle drie de tabs en is meteen de samenvatting die je onderweg wilt.
→ `/impeccable layout`

### [P1] iOS zoomt in bij elk invoerveld en zoomt niet terug

`globals.css` zet `--text-sm: 0.8125rem` (13px) en `--text-base: 0.875rem` (14px). Alle inputs gebruiken `text-sm`. Safari op iOS zoomt automatisch in zodra een input kleiner dan 16px focus krijgt, en zoomt daarna niet uit. Met `viewportFit: cover` en `overflow-hidden` op de body kom je in een scheve viewport terecht.

**Fix**: `font-size: 16px` op `input`, `textarea` en `select` binnen een `@media (pointer: coarse)`-blok. Visueel blijft de rest van de schaal ongemoeid.
→ `/impeccable adapt`

## Persona Red Flags

**Casey (afgeleide mobiele gebruiker)** — de maatgevende persona hier:
- Primaire actie "Dagdeel toevoegen" staat onder de vouw én onder het toetsenbord zodra het veld focus krijgt.
- Tabbalk verspringt: met twee tabs staat "Dag" op x=124, met drie op x=83. Open je een dagdeel, dan staat "Dag" 41px verder naar links dan waar je duim heen ging.
- Geen toestandsbehoud: na een tabwissel in de browser val je terug op dag 1 met dagdeel gesloten.
- 20×20px verwijderknop met de duim, zonder bevestiging.

**Sam (toegankelijkheidsafhankelijk)**:
- `:focus-visible` is netjes geregeld, `aria-label` staat overal — dat deel is in orde.
- Maar: 13×13px checkboxes falen WCAG 2.5.5 (Target Size) hard.
- Vier icon-only knoppen in het dagdeelpaneel; de tooltip is `aria-hidden` en verschijnt alleen bij `hover`/`focus-within`. Met touch krijg je geen van beide, dus de zichtbare betekenis ontbreekt volledig.
- De verwijder-"×" is een letterlijk `×`-teken, geen icoon; op 20px met `text-text-subtle` is dat nauwelijks te zien.

**Riley (edge cases)**:
- Tijdveld is vrije tekst. "9u", "09.00", "morgen" worden allemaal opgeslagen en later als mono-cijfer getoond alsof het een tijd is.
- Lange dagdeeltitels: `truncate` op de titel, maar het traject eronder ("6 u 44 min · 645,3 km · terug naar Airbnb") kan op 390px over twee regels breken en de rij ongelijk maken.
- Verwijder je het laatste dagdeel met locatie, dan verdwijnt de route stilzwijgend; geen bericht.

## Minor Observations

- **Kaart-zoekbalk klemt.** `map-view.tsx:252` zet `w-72` (288px) naast een 44px logo binnen `max-w-[calc(100%-1.5rem)]`. Op 390px past dat net; op 360px wordt het zoekveld ingedrukt. Maak hem `w-full` binnen de beschikbare ruimte.
- **Twee verwijder-conventies.** Favoriet krijgt `ConfirmDialog`, dagdeel niet. Eén van beide is fout; gezien het ontbreken van undo is het de dagdeelvariant.
- **Dagenstrip mist een scrollhint.** Op mobiel valt dag 5 en verder buiten beeld zonder enige aanwijzing dat er meer is.
- **Slepen op touch kost 250ms indrukken** (`day-panel.tsx:48`). Correcte afweging tegen scrollen, maar zonder visuele terugkoppeling tijdens die 250ms voelt het als niet-reageren.
- **`prefers-reduced-motion` komt nergens voor**, terwijl `transition-colors`, `animate-pulse` en `scale-125` wel gebruikt worden.
- **Autosave met 600ms debounce** (titel, tijd, notitie) heeft geen enkele visuele bevestiging. Onderweg met slecht netwerk weet je niet of je wijziging vaststaat.

## Questions to Consider

- Als mobiel puur leesmodus is — waarom staat de bewerk-UI (sleepgrepen, verwijderknoppen, invoervelden) daar dan permanent in beeld in plaats van achter één "Bewerken"-schakelaar?
- Wat als de kaart de standaardtab was op mobiel, met de dagplanning als opklapbaar vel eroverheen? Onderweg kijk je naar waar je bent, niet naar een lijst.
- De dagenstrip is horizontaal scrollen door 14 pillen. Zou "vorige / vandaag / volgende" onderweg niet sneller zijn?
- Wat is de compactste weergave die de vraag "wat doen we vandaag en hoe ver rijden we" in één blik beantwoordt, zonder scrollen?
