# Reisplanner — Implementatieplan

Webapp voor het plannen van één reis. Split-view: kaart links, dagindeling rechts.

## Scope v1

- Eén reis (geen overzichtsscherm met meerdere reizen)
- Dagen afgeleid uit start- en einddatum van de reis
- Per dag: stops op de kaart, boekingen en notities
- Geen login, data lokaal in de browser — architectuur wel voorbereid op SSO en database

Bewust buiten scope: budget/kostenregistratie, AI-suggesties, weer, delen met medereizigers.

## Stack

| Onderdeel | Keuze | Reden |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | Route handlers nodig als proxy, en middleware voor latere auth-guard |
| Styling | Tailwind + TypeUI-spec `professional` | Ontwerprichtlijnen komen uit `npx typeui.sh pull professional` |
| Kaart | `maplibre-gl` + `react-map-gl/maplibre` | Open source, geen API-key |
| Basemap | CARTO Positron (`basemaps.cartocdn.com`) | Gratis, geen key, neutraal grijs. MapLibre-demotiles zijn te kaal |
| Zoeken | Photon (`photon.komoot.io`) | Gratis geocoding, geen key, geen account |
| Routing | OSRM demo (`router.project-osrm.org`) | Echte wegroutes en rijtijd, gratis. Publieke demo-server zonder uptime-garantie |
| Slepen | `@dnd-kit/core` + `@dnd-kit/sortable` | Stops herordenen binnen een dag |
| State | Zustand + `persist` | Lokale opslag achter één interface, later te vervangen |

## Layout

```
┌─────────────────────────┬──────────────────────┐
│                         │  Dag-selector        │
│                         ├──────────────────────┤
│         Kaart           │  Stops (sleepbaar)   │
│      (~60% breed)       │                      │
│                         ├──────────────────────┤
│                         │  Boekingen + notities│
└─────────────────────────┴──────────────────────┘
```

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

type Stop = {
  id: string
  dayId: string
  name: string
  lat: number
  lng: number
  order: number
  notes: string
  arrivalTime?: string
  updatedAt: string
}

type Booking = {
  id: string
  dayId: string
  type: 'flight' | 'hotel' | 'ticket' | 'other'
  title: string
  confirmation: string
  notes: string
  updatedAt: string
}
```

UUID's in plaats van oplopende getallen, zodat records bij een migratie naar Postgres hun identiteit houden. `updatedAt` overal, nodig zodra twee apparaten dezelfde reis synchroniseren.

## SSO-voorbereiding

Er wordt nu geen authenticatie gebouwd. Wel wordt alles zo opgezet dat SSO later ingeplugd kan worden zonder herbouw.

### 1. Data-laag als async interface

```ts
interface TripRepository {
  getTrip(userId: string): Promise<Trip | null>
  getDays(userId: string, tripId: string): Promise<Day[]>
  saveStop(userId: string, stop: Stop): Promise<Stop>
  deleteStop(userId: string, stopId: string): Promise<void>
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

### 4. Route-structuur en middleware

Pagina's in routegroep `app/(app)/`. Een `middleware.ts` die nu alles doorlaat. Later komt daar de guard in, zonder pagina's te verplaatsen.

### 5. Secrets server-side

Geen `NEXT_PUBLIC_`-variabelen voor iets dat later een key krijgt. CARTO, Photon en OSRM vragen er geen, dus dit speelt nu nog niet.

### Keuze die later gemaakt moet worden

Twee smaken SSO:

- **Sociale login** (Google, Microsoft) — gratis, via Auth.js of Supabase Auth
- **SAML-SSO voor organisaties** — bij Supabase pas op het Pro-plan, bij Auth.js zelf inrichten

Het plan blijft provider-neutraal, dus deze keuze kan later vallen. Wel goed om te weten dat SAML geld kost.

## Stappen

Elke stap heeft een controle waarmee vastgesteld wordt dat hij af is.

**1. Fundament**
Scaffold Next.js + TypeScript + Tailwind in `~/Dev/reisplanner`. Draai `npx typeui.sh pull professional` in de projectroot, lees de gepulde spec en leg de design-tokens (kleuren, typografie, spacing, radius) vast in de Tailwind-config. Voeg daarna de repository-interface, `LocalRepository`, de `useSession`-stub en `middleware.ts` toe.
→ *Controle:* dev-server draait, lege split-view rendert in de tokens uit de spec.

**2. Kaart**
Kaartcomponent met CARTO-basemap, pins uit de store.
→ *Controle:* een handmatig geseede stop verschijnt als pin op de juiste coördinaten.

**3. Stops toevoegen**
Photon-zoekveld plus klikken op de kaart voegt een stop toe aan de actieve dag.
→ *Controle:* zoeken op "Colosseum" plaatst een pin én een regel in de dagkolom.

**4. Dagpaneel**
Dagen afgeleid uit de reisdatums, stops-lijst per dag, herordenen met dnd-kit.
→ *Controle:* slepen wijzigt de volgorde en die volgorde overleeft een refresh.

**5. Route**
OSRM-route voor de actieve dag als GeoJSON-lijn op de kaart, rijtijd per traject.
→ *Controle:* de lijn volgt wegen (geen rechte lijn) en bij elke stop staat een reistijd.

**6. Koppeling kaart ↔ lijst**
Hover over een stop licht de bijbehorende pin op, en andersom.
→ *Controle:* werkt in beide richtingen.

**7. Boekingen en notities**
Per dag boekingen (vlucht, hotel, ticket, overig) en een vrij notitieveld.
→ *Controle:* invullen, refreshen, gegevens staan er nog.

## Aannames

- Reisnaam en datums zijn instelbaar; dagen worden daaruit afgeleid
- OSRM-profiel `driving`
- De OSRM-demoserver kan traag of onbereikbaar zijn — bij een fout valt de kaart terug op een rechte lijn met hemelsbrede afstand
- Geen testsuite in v1, tenzij alsnog gewenst
- Blijkt de `professional`-spec donker te zijn, dan wisselt de basemap van CARTO Positron naar Dark Matter (zelfde bron, ook gratis)
