# Product

## Register

product

## Users

Eén gebruiker: de maker zelf. Twee contexten, met verschillend gewicht:

- **Desktop, vooraf** — de reis samenstellen. Dagen ordenen, dagdelen toevoegen, locaties op de kaart prikken, favorieten beheren, GPX-tracks koppelen. Hier gebeurt het zware werk; drie panelen naast elkaar (kaart, dag, dagdeel).
- **Mobiel, onderweg** — vooral raadplegen. "Wat doen we vandaag, hoe lang rijden we, waar is het." Correcties zijn klein en incidenteel: een tijd bijstellen, een dagdeel schrappen, een favoriet vastleggen. Netwerk is er niet altijd; de offline kaart is daarvoor.

Mobiel is dus geen tweede volwaardige editor. Het is de leesmodus van een planning die elders is gemaakt.

## Product Purpose

Een meerdaagse reis per dag indelen en die indeling op de kaart zien: markers in de volgorde van de dag, de route ertussen, rijtijd en afstand per traject. De planning leeft lokaal in de browser (IndexedDB) en kan geëxporteerd/geïmporteerd worden; kaarttegels kunnen offline op het toestel staan.

Succes: onderweg binnen twee tikken weten wat de dag is en hoe ver het rijden is, zonder netwerk.

## Brand Personality

Nuchter gereedschap. Compact en informatiedicht. De interface mag verdwijnen achter de kaart en de planning.

- Cijfers zijn eersterangs inhoud: tijd, duur, afstand staan in mono en mogen niet wijken voor sier.
- Geen animatie zonder functie. Beweging alleen om een verandering leesbaar te maken.
- Dichtheid boven ruimte, zolang raakvlakken bruikbaar blijven.
- Nederlandse, korte labels. Geen productmarketingtoon.

## Anti-references

- **Booking / TripAdvisor** — banners, badges, promoblokken, stapels identieke kaartjes. Niets in deze app verkoopt iets.
- Verder geen sterke mening: het bestaande ontwerp (geel `#FECE14` op zwart/wit, Poppins + IBM Plex Mono, platte lijstjes) is het uitgangspunt. Verbeteren, niet herpositioneren.

## Design Principles

1. **Mobiel leest, desktop bewerkt.** Bij een conflict tussen leesbaarheid onderweg en bewerkgemak wint mobiel het lezen en desktop het bewerken. Bewerkfuncties mogen op mobiel verderop staan, maar nooit verdwijnen.
2. **De dag is de eenheid.** Elk scherm beantwoordt "wat doen we vandaag" voordat het iets anders beantwoordt. Reisbeheer (exporteren, offline kaart) is bijzaak en hoort niet boven de dagplanning te staan.
3. **Cijfers zijn inhoud.** Rijtijd, afstand en tijdstip zijn de reden dat de app bestaat; ze verdienen contrast en positie, geen subtiel grijs.
4. **Kaart en lijst zijn hetzelfde ding.** Een nummer in de lijst is dezelfde marker op de kaart. Die koppeling mag nergens breken.
5. **Werkt zonder netwerk.** Elke toestand heeft een leesbare variant zonder route-API en zonder tegels; "route berekenen…" is een toestand, geen fout.

## Accessibility & Inclusion

WCAG 2.2 AA. Vastgelegd in `src/app/globals.css`:

- `primary` (#FECE14) haalt op wit ~1.6:1 en is daarom uitsluitend vlakkleur, nooit tekst- of icoonkleur. Tekst erop is `--color-on-primary` (#111827, ~12:1).
- `:focus-visible` is altijd zichtbaar (2px zwart, 2px offset). Keyboard-first blijft gelden.
- Raakvlakken op mobiel minimaal 44×44 CSS-px (WCAG 2.5.5 / Apple HIG).
- `prefers-reduced-motion` respecteren bij elke toegevoegde beweging.
