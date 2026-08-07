# Reisplanner — Implementatieplan

Webapp voor het plannen van één reis. Split-view: kaart links, dagindeling rechts.

## Scope v1

- Eén reis (geen overzichtsscherm met meerdere reizen)
- Dagen afgeleid uit start- en einddatum van de reis
- Per dag: dagdelen met tijd, titel, notitie en eventueel een locatie; de dagdelen met locatie vormen de markers en de route
- Geen login, data lokaal in de browser — architectuur wel voorbereid op SSO en database

Bewust buiten scope: budget/kostenregistratie, AI-suggesties, weer, delen met medereizigers.

## Stack

| Onderdeel | Keuze | Reden |
|---|---|---|
| Framework | Next.js 16 (App Router) + TypeScript | Route handlers nodig als proxy, en `proxy.ts` voor latere auth-guard |
| Styling | Tailwind + TypeUI-spec `professional` | Ontwerprichtlijnen komen uit `npx typeui.sh pull professional` |
| Kaart | `maplibre-gl@5` + `react-map-gl/maplibre` | Open source, geen API-key. Vastgezet op v5: met `maplibre-gl@6` haalt react-map-gl 8.1.2 geen tegels op en negeert het camera-opdrachten, zonder foutmelding |
| Basemap | CARTO Positron (`basemaps.cartocdn.com`) | Gratis, geen key, neutraal grijs. MapLibre-demotiles zijn te kaal |
| Zoeken | Photon (`photon.komoot.io`) | Gratis geocoding, geen key, geen account |
| Routing | OSRM demo (`router.project-osrm.org`) | Echte wegroutes en rijtijd, gratis. Publieke demo-server zonder uptime-garantie |
| Slepen | `@dnd-kit/core` + `@dnd-kit/sortable` | Dagdelen herordenen binnen een dag |
| State | Zustand (zonder `persist`) | Alle opslag loopt via de repository; `persist` zou een tweede schrijfpad naar localStorage maken en de repository omzeilbaar maken |

## Layout

```
┌──────────────────┬──────────────────────┬─────────────────┐
│                  │  Dag-selector        │  Titel + tijd   │
│                  ├──────────────────────┤                 │
│      Kaart       │  Dagplanning:        │  Locatie        │
│   (vult de rest) │  dagdelen (sleepbaar)├─────────────────┤
│                  ├──────────────────────┤  Notitie bij    │
│                  │  Notitie bij de dag  │  dat dagdeel    │
└──────────────────┴──────────────────────┴─────────────────┘
      flexibel              420 px               360 px
```

## Mobiel

Desktop is om te plannen, mobiel om onderweg op te zoeken. Onder de `lg`-breekpunt (1024 px) staat er daarom één paneel tegelijk op het scherm, met een tabbalk onderaan: **Dag**, **Kaart**, **Dagdeel**. De app opent op Dag, want dat is wat je onderweg leest.

De verborgen panelen krijgen `hidden` in plaats van dat ze uit de DOM verdwijnen. Zo houdt de kaart zijn positie en zoomniveau bij het wisselen van tabblad, en blijft de tekst in de editors staan.

Twee dingen die daarbij fout gingen en verholpen zijn:

- MapLibre meet zijn container op bij het aanmaken. Start de kaart in een verborgen tabblad, dan is die container 0 px hoog en blijft het canvas op 300 px steken. `MapView` roept daarom `resize()` aan zodra het kaarttabblad opent.
- Met `min-h-full` op de `body` kon de tabbalk buiten beeld vallen. Dat is nu `h-full` met `overflow-hidden`, zodat het scherm exact de viewport vult en de balk altijd bereikbaar is.

Een dagdeel aantikken — in de planning of als marker op de kaart — springt op mobiel meteen naar het Dagdeel-tabblad.

Een punt op de kaart aanwijzen werkt ook op mobiel: de kiesknop schakelt naar het kaarttabblad, en na de klik ben je terug waar je vandaan kwam. Eerder vroeg dat ⌘ of Ctrl bij de klik — toetsen die een touchscreen niet heeft.

## Datamodel

```ts
type Trip = {
  id: string          // crypto.randomUUID()
  ownerId: string
  name: string
  startDate: string   // ISO datum
  endDate: string
  createdAt: string
  updatedAt: string
}

type Day = {
  id: string
  tripId: string
  date: string
  notes: string
  updatedAt: string
}

type ActivityLocation = {
  name: string
  lat: number
  lng: number
}

// Dagdeel: de enige bouwsteen van de planning
type Activity = {
  id: string
  dayId: string
  time: string       // vrije tekst: "09:00 - 11:00", "Namiddag", "na de lunch"
  title: string
  notes: string      // HTML uit de Tiptap-editor
  location: ActivityLocation | null
  order: number
  updatedAt: string
}
```

De planning is leidend. Een dagdeel mét locatie is tegelijk de marker op de kaart en een punt in de dagroute; de volgorde in de planning is de volgorde van de route. Een dagdeel zonder locatie ("ontbijten", "inpakken") staat alleen in de lijst. Er is dus één lijst per dag en één volgorde, in plaats van een aparte stops-lijst naast de planning.

UUID's in plaats van oplopende getallen, zodat records bij een migratie naar Postgres hun identiteit houden. `updatedAt` overal, nodig zodra twee apparaten dezelfde reis synchroniseren.

## SSO-voorbereiding

Er wordt nu geen authenticatie gebouwd. Wel wordt alles zo opgezet dat SSO later ingeplugd kan worden zonder herbouw.

### 1. Data-laag als async interface

```ts
interface TripRepository {
  getTrip(userId: string): Promise<Trip | null>
  getDays(userId: string, tripId: string): Promise<Day[]>
  saveActivity(userId: string, activity: Activity): Promise<Activity>
  deleteActivity(userId: string, activityId: string): Promise<void>
  // enz. — alles async, alles met userId
}
```

`LocalRepository` (localStorage) nu, `SupabaseRepository` later. Componenten kennen alleen de interface en raken localStorage nooit direct aan.

Alle methodes zijn vanaf het begin async, ook al is localStorage synchroon. Zou dat niet zo zijn, dan breekt bij de overstap naar een database alsnog elk component dat data ophaalt.

### 2. Sessie-hook vanaf het begin

```ts
useSession(): {
  user: { id: string; name: string; email?: string }
  status: 'authenticated' | 'loading' | 'unauthenticated'
}
```

Levert nu een vaste lokale gebruiker met een UUID uit localStorage. Later komt Auth.js of Supabase Auth erachter met dezelfde returnvorm; componenten veranderen niet.

### 3. Externe calls via eigen route handlers

`/api/geocode` en `/api/route` proxyen naar Photon en OSRM, in plaats van rechtstreeks fetchen vanuit de browser. Later kan op één plek een sessiecheck en rate-limit per gebruiker toegevoegd worden. Kost nu ongeveer twintig regels.

### 4. Route-structuur en proxy

Pagina's in routegroep `src/app/(app)/`. Een `src/proxy.ts` die nu alles doorlaat. Later komt daar de guard in, zonder pagina's te verplaatsen.

In Next.js 16 heet `middleware.ts` voortaan `proxy.ts`; de functionaliteit is ongewijzigd.

### 5. Secrets server-side

Geen `NEXT_PUBLIC_`-variabelen voor iets dat later een key krijgt. CARTO, Photon en OSRM vragen er geen, dus dit speelt nu nog niet.

### Keuze die later gemaakt moet worden

Twee smaken SSO:

- **Sociale login** (Google, Microsoft) — gratis, via Auth.js of Supabase Auth
- **SAML-SSO voor organisaties** — bij Supabase pas op het Pro-plan, bij Auth.js zelf inrichten

Het plan blijft provider-neutraal, dus deze keuze kan later vallen. Wel goed om te weten dat SAML geld kost.

## Stappen

Elke stap heeft een controle waarmee vastgesteld wordt dat hij af is.

**1. Fundament** — *afgerond*
Scaffold Next.js + TypeScript + Tailwind in `~/Dev/reisplanner`. Design-spec opgehaald met `npx typeui.sh pull professional --format skill --providers claude-code` (zonder die vlaggen vraagt de CLI interactief door), tokens vastgelegd in `src/app/globals.css`. Daarna de repository-interface, `LocalRepository`, de `useSession`-stub en `src/proxy.ts` toegevoegd.
→ *Controle:* `npm run build` slaagt, dev-server draait, tokens staan in de geserveerde CSS, split-view rendert.

**2. Kaart** — *afgerond*
Kaartcomponent met CARTO-basemap, pins uit de store. Geladen via `next/dynamic` met `ssr: false`, want MapLibre heeft `window` nodig. `fitBounds` wacht op de `load`-event van de kaart; daarvoor negeert MapLibre camera-opdrachten.
→ *Controle:* drie geseede stops in Rome verschijnen als genummerde pins op de juiste plek, kaart zoomt er automatisch op in.

**3. Stops toevoegen** — *afgerond*
Photon-zoekveld plus ⌘-klik (Mac) of Ctrl-klik (Windows) op de kaart voegt een stop toe aan de actieve dag. Een gewone klik navigeert alleen, zodat pannen en zoomen geen stops aanmaakt.

Een bestaande stop verplaatsen gaat in twee stappen: ⌘- of Ctrl-klik op de pin zet hem klaar (pin pulseert, aanwijzing in het paneel), de volgende gewone kaartklik bepaalt de nieuwe plek. Escape of nogmaals ⌘-klikken annuleert. De naam blijft staan; alleen de coördinaten wijzigen. Beide lopen via eigen route handlers: `/api/geocode` (zoeken) en `/api/geocode/reverse` (naam bij coördinaten). Zoeken start vanaf drie tekens, met 300 ms wachttijd en het afbreken van verouderde verzoeken.
→ *Controle:* zoeken op "Colosseo Roma" en het eerste resultaat kiezen plaatst pin 1 op het Colosseum; een klik op de kaart plaatst pin 2 met de naam uit reverse geocoding. Beide staan na een refresh nog in localStorage.

**4. Dagpaneel** — *afgerond*
Dagen afgeleid uit de reisdatums, stops-lijst per dag, herordenen met dnd-kit. Het genummerde bolletje is de sleepgreep en tegelijk de toetsenbordbediening (spatie om op te tillen, pijltjes om te verplaatsen, spatie om te laten vallen). De verwijderknop blijft daardoor gewoon klikbaar.
→ *Controle:* met de muis stop 1 naar plek 3 slepen en met het toetsenbord er één omlaag verplaatsen wijzigen beide de volgorde; na een refresh staat de nieuwe volgorde er nog.

**5. Route** — *afgerond*
OSRM-route voor de actieve dag als GeoJSON-lijn op de kaart, rijtijd per traject in het dagpaneel. Loopt via `/api/route`. Reageert de demo-server niet, dan komen er rechte lijnen terug met `fallback: true`; die worden gestreept getekend en tonen alleen de hemelsbrede afstand.
→ *Controle:* drie stops in Rome geven een lijn die de straten volgt, met "7 min · 3,5 km" en "8 min · 2,9 km" tussen de stops. Met de OSRM-host tijdelijk op een onbereikbaar adres kwam er `fallback: true` met een hemelsbrede afstand terug, zonder foutmelding in de UI.

Beperking: de publieke OSRM-demoserver biedt alleen het `driving`-profiel. In een historisch centrum met eenrichtingsverkeer levert dat omwegen op die je te voet niet zou lopen. Wandel- of fietsprofielen vragen een eigen OSRM-instantie of een andere dienst.

**6. Koppeling kaart en lijst** — *afgerond*
Hover over een stop licht de bijbehorende pin op, en andersom. Eén veld `hoveredStopId` in de store; beide kanten zetten en lezen hetzelfde veld. Toetsenbordfocus op een pin markeert de rij ook.
→ *Controle:* hover op rij 2 vergroot pin 2; hover op pin 3 markeert rij 3; focus op pin 1 markeert rij 1. In rust is niets gemarkeerd.

**7. Notities per dag** — *afgerond, daarna vervangen*
Oorspronkelijk boekingen (vlucht, hotel, ticket, overig) plus een vrij notitieveld per dag. De boekingen zijn er later op verzoek weer uit gehaald; het notitieveld is opgegaan in de dagplanning hieronder.
→ *Controle destijds:* notitie invullen op dag 1, dag 2 blijft leeg, en na een refresh staat hij er nog.

## Dagplanning

Eerder waren dit twee lijsten naast elkaar: stops voor de kaart, tijdsloten voor de indeling van de dag. Twee volgordes die uit de pas liepen, en je plande je dag op de ene plek terwijl je route op de andere ontstond. Nu is er per dag één lijst: de dagdelen. Kaart en route zijn afgeleid.

De dagkolom bevat de dagplanning en daaronder de notitie bij de dag. Elk dagdeel toont zijn tijd, zijn titel en — als het er een heeft — de naam van zijn locatie. Het bolletje links is de sleepgreep én het nummer dat op de kaart staat; dagdelen zonder locatie krijgen een leeg bolletje en slaan geen nummer op. Tussen twee genummerde dagdelen staat de reistijd van dat traject.

De derde kolom bevat alles van het aangeklikte dagdeel: titel, tijd, locatie en notitie. Die kolom verschijnt pas zodra je een dagdeel opent en verdwijnt weer met de sluitknop. Op mobiel bestaat het Dagdeel-tabblad om dezelfde reden alleen zolang er een dagdeel open is.

Titel, tijd en notitie worden 600 ms na de laatste toetsaanslag opgeslagen. Een lege titel wordt niet bewaard — het dagdeel staat ook in de planning — en het veld valt bij het wegklikken terug op de opgeslagen titel.

Kolomvolgorde: kaart, dagplanning, dagdeel.

**Locatie** — optioneel, en op twee manieren te kiezen: met het zoekveld, of door op de kaart een punt aan te wijzen. Dat laatste gaat via de knop met de speld ("Kies op kaart"). Die zet de kaart in kiesmodus: het dradenkruis verschijnt, een melding legt uit wat er verwacht wordt, en de volgende gewone kaartklik is het antwoord. Escape — of nogmaals op de knop — annuleert en brengt je terug.

Wat er met het punt gebeurt hangt af van waar je de knop indrukte, en dat is het enige wat de store bijhoudt (`mapPick`):

| Vanaf | Modus | Resultaat |
|---|---|---|
| Toevoegformulier | `nieuw` | Het punt wordt de locatie in het formulier; zonder eigen titel is de plaatsnaam de titel |
| Dagdeelpaneel zonder locatie | `locatie` | Het punt wordt de locatie van dat dagdeel |
| Dagdeelpaneel met locatie | `verplaatsen` | Alleen de coördinaten wijzigen; de naam blijft |

Er is bewust geen modificatietoets meer: eerst deed ⌘- of Ctrl-klik dit werk, wat op een touchscreen onmogelijk is en nergens in beeld stond. Een gewone klik op de kaart doet nu niets zolang er geen kiesmodus loopt, zodat pannen en zoomen geen punten aanwijst.

De locatie van het nieuwe dagdeel staat in de store (`draftLocation`) en niet in het formulier, omdat de kaart hem ook zet en de kaart dat formulier niet kent. Bij het wisselen van dag wordt hij leeggemaakt, samen met een openstaande kiesmodus.

Loskoppelen kan in het paneel: het dagdeel blijft, de marker verdwijnt.

**Tijd** — vrije tekst, zodat zowel "09:00 - 11:00" als "Namiddag" of "na de lunch" kan. Daardoor is er geen sortering op tijd: de volgorde is die van de planning, en die versleep je zelf.

**Twee notities** — de dag heeft er één, onder de planning in de dagkolom, en elk dagdeel heeft er één in de derde kolom. Beide gebruiken dezelfde Tiptap-editor met vet, cursief, kopje en beide lijstsoorten.

De HTML wordt alleen door Tiptap zelf weer weergegeven, nooit met `dangerouslySetInnerHTML` elders ingevoegd. Verandert dat ooit, dan moet er eerst gesaneerd worden.

Toolbarknoppen doen `preventDefault` op `mousedown`. Zonder dat pakt de knop de focus uit de editor en verliest de gebruiker zijn cursorpositie, waardoor tekst na een klik op **B** nergens terechtkomt.

**Geen migratie naar dagdelen** — de oude stops en tijdsloten zijn niet omgezet. Een stop kent geen tijd, een tijdslot geen locatie, en de twee volgordes zijn niet betrouwbaar in elkaar te schuiven; wat eruit komt is half werk dat je alsnog moet nalopen. `normalize` laat records zonder `location` daarom vallen: de reis, de dagen en de dagnotities blijven, de planning begint leeg. Hetzelfde geldt voor een geïmporteerd bestand van vóór deze versie. Het uitwisselformaat staat nu op `SCHEMA_VERSION = 2`, zodat een oudere app een nieuw bestand netjes weigert.

## Aannames

- Reisnaam en datums zijn instelbaar; dagen worden daaruit afgeleid
- OSRM-profiel `driving`
- De OSRM-demoserver kan traag of onbereikbaar zijn — bij een fout valt de kaart terug op een rechte lijn met hemelsbrede afstand
- Geen testsuite in v1, tenzij alsnog gewenst
- Blijkt de `professional`-spec donker te zijn, dan wisselt de basemap van CARTO Positron naar Dark Matter (zelfde bron, ook gratis)
