# Wahlkarten

Kommunalwahlergebnisse als Hexagon-Kartogramm: jede Gemeinde bekommt so viele
Sechsecke, wie ihr Gemeinderat Sitze hat. Die Fläche zeigt damit das Gewicht des
Gremiums statt der Quadratkilometer, und der Landkreis bleibt trotzdem
wiedererkennbar.

Die Aufteilung selbst rechnet das Schwesterprojekt
[hexagonalmap](https://github.com/bagruber/hexagonalmap); hier liegt, was daraus
eine Wahlkarte macht, Datenbeschaffung, Listen, Farben, Ansichten.

**[Live ausprobieren](https://bagruber.github.io/elections/)**

## Zwei Karten

Wonach sich die Fläche einer Gemeinde bemisst, ist umschaltbar, und der
Unterschied zwischen beidem ist die eigentliche Auskunft.

**Sitze**, ein Sechseck ist ein Ratssitz, 440 im Landkreis. Die Karte zeigt,
wie das Gewicht in den Gremien verteilt ist.

**Einwohner**, ein Sechseck sind 500 Einwohner, 369 im Landkreis. Die Karte
zeigt, wie die Menschen verteilt sind.

Auf einen Sitz kommen in Freising 1223 Einwohner und in Gammelsdorf 133. Beim
Umschalten schrumpfen die kleinen Gemeinden also auf ein Neuntel ihres Gewichts,
und Freising wächst von einem Fünftel auf ein Viertel der Karte. Das ist keine
Verzerrung, sondern der Punkt: die Sitzkarte bildet ab, wer im Rat sitzt, die
Einwohnerkarte, für wen dort gesessen wird.

Die 500 sind gewählt, weil sie sich sagen lassen und weil die Karte damit
ähnlich dicht bleibt wie die Sitzkarte. Bei 1000 fiele die kleinste Gemeinde auf
zwei Felder und verlöre jede Form; bei 250 wäre Freising ein Block von 196
Sechsecken und der Rest Streusel.

Auf der Einwohnerkarte hat ein Feld keine Entsprechung im Gremium. Die
Sitzansicht heißt dort deshalb **Stimmenverteilung** und verteilt die Felder
nach Stimmenanteil, gerundet, und die Bildunterschrift sagt das.

## Vier Ansichten, ein Layout

Das Layout wird einmal je Bezugsgröße gerechnet und bleibt über alle Ansichten
stehen. Nur die Färbung wechselt, sonst verschöbe sich die Karte beim
Umschalten der Ansicht unter dem Blick weg und ließe sich nicht mehr
vergleichen. Beim Umschalten der Bezugsgröße verschiebt sie sich sehr wohl.

**Stärkste Liste** färbt jede Gemeinde einfarbig nach der Liste mit den meisten
Sitzen. Bei Gleichstand entscheidet der Stimmenanteil, in Freising etwa liegen
Grüne und FSM bei je neun Sitzen, FSM hat 23,5 gegen 23,3 Prozent.

**Sitzverteilung** färbt die einzelnen Felder: ein Sechseck ist ein Sitz, 440 im
ganzen Landkreis. Jede Fraktion wächst als Klumpen von einem eigenen Randpunkt
aus, damit sie zusammenhängt. Die Ansicht ist zwangsläufig dicht; die
Gemeindeumrisse sind hier deshalb deutlich kräftiger gezeichnet.

**Eine Liste** wählt eine Liste aus und zeigt ihre Stärke als Sättigung der
Fläche.

Wo die Skala endet, ist die eigentliche Entscheidung dieser Ansicht. Endet sie
beim Spitzenwert der gewählten Liste, sieht eine FDP mit sieben Prozent so satt
aus wie eine CSU mit zweiundvierzig: der Vergleich zwischen Listen ist dahin.
Endet sie beim stärksten Wert der Karte, bleibt die FDP überall gleich blass —
der Vergleich zwischen Gemeinden ist dahin. Sie endet deshalb dazwischen, beim
geometrischen Mittel aus beidem. Die FDP erreicht damit an ihrer besten Stelle
gut die Hälfte der Skala statt eines Fünftels oder des Ganzen: als schwach
erkennbar, aber innerlich noch abgestuft.

Der obere Bezugswert ist nicht das Maximum, sondern der Wert, den nur jedes
zehnte Gemeindeergebnis übertrifft. In Hörgertshausen tritt eine einzige Liste
an und holt 99,8 Prozent; als Maximum zöge dieser eine Sonderfall jede Skala so
weit hoch, dass nirgends mehr etwas sättigt. Was darüber liegt, läuft ans obere
Ende, ganz oben ist ganz oben.

**Gewinn und Verlust** färbt dieselbe Auswahl nach der Veränderung gegenüber der
Wahl davor: Zugewinn in Petrol, Verlust in Braun, die Mitte im Grundton. Das
Paar ist so gewählt, dass es bei Rot-Grün-Blindheit auseinanderbleibt, die
naheliegende Ampel aus Rot und Grün täte das nicht. Weil die Richtung damit
nicht mehr von selbst spricht, trägt die Legende Vorzeichen und die Ablesung die
Zahl. Die Ansicht steht nur für die Kreistagswahl zur Verfügung; warum, steht
unten.

Wo eine Liste **nicht angetreten** ist, steht eine Schraffur statt einer blassen
Fläche. Das ist kein kleiner Wert, sondern gar keiner, und am unteren Ende
derselben Skala wäre es von einem schwachen Ergebnis nicht zu unterscheiden.

Ausgewählt wird immer eine Gruppe der Kreislegende. Wo eine Gemeinde mehrere
Listen derselben Gruppe hat, Langenbach hat FW und FWO —, zählt die Karte sie
zusammen.

## Woher die Zahlen kommen

Für Gemeinderatswahlen gibt es keine einzige Quelle, die alles hat. Es gibt zwei,
die sich ergänzen:

**Die amtliche Statistik**, GENESIS-Online des Bayerischen Landesamts für
Statistik, Tabellen `14431-005r` (Sitze) und `14431-003r` (gewichtete Stimmen).
Sie deckt jede der 2 056 bayerischen Gemeinden ab, ohne Anmeldung als CSV
abrufbar, zurück bis 1978. Ihre Grenze: sie kennt nur 48 feste
Wahlvorschlags-Kategorien. Örtliche Listen fallen in „Gemeinsame
Wahlvorschläge" und „Wählergruppen", im Landkreis Freising sind das zusammen
242 von 440 Sitzen.

**Die Wahlleitungen der Gemeinden** nennen ihre Listen beim Namen. Sie decken
dafür jeweils nur ihr eigenes Gebiet ab, und sie sitzen auf unterschiedlicher
Software an unterschiedlichen Adressen. Wo eine erreichbar ist, steht sie in
[`data/register.json`](data/register.json) und tritt an die Stelle der
Sammelkategorien, als vollständiges Ergebnis, nicht als Aufteilung des
Sammeltopfs.

Geprüft wird beides gegeneinander: stimmt die Sitzsumme einer Gemeinde nicht mit
der amtlichen überein, bricht `baue.mjs` ab.

Für Gemeinden ohne abrufbare Quelle gibt es
[`data/listen/`](data/listen/README.md): eine CSV je Wahl, von Hand gepflegt,
gleiches Prüfverfahren.

**Die Kreistagswahl** liegt vollständig vor, beim Landratsamt je Gemeinde
aufgeschlüsselt. Sie ist die einzige Wahl, bei der alle Gemeinden über dieselben
Listen abgestimmt haben, und damit die einzige, die sich zwischen ihnen ohne
Vorbehalt vergleichen lässt. Für „Eine Liste" ist sie deshalb als zweite Ebene
wählbar, für „Gewinn und Verlust" als einzige.

### Welche Angabe woher kommt

Die Seite führt das unter „Woher die Zahlen kommen" mit; hier dieselbe Auskunft
für den Landkreis Freising, Stand dieses Datensatzes:

| Angabe | Quelle | Reichweite |
|---|---|---|
| Sitze, gewichtete Stimmen | GENESIS-Online | alle 24 Gemeinden; jede Gemeindequelle wird dagegen geprüft |
| Listennamen | Wahlleitungen der Gemeinden | 21 von 24: es fehlen Allershausen, Neufahrn, Paunzhausen |
| Gewählte namentlich | Wahlleitungen der Gemeinden | dieselben 21 |
| Gewinn und Verlust | Vergleichsgrafik des Landratsamts | 24 von 24, aber nur für die Kreistagswahl |

Der letzte Punkt hat einen Grund, der Erklärung verdient. Die Ergebnisseiten
führen alle eine Spalte „Gewinn und Verlust in %-Punkten", und die stimmt
nicht. In Allershausen etwa steht dort für die AfD −16,8 Punkte, während
dieselbe Seite in ihrer Vergleichsgrafik 4,1 Prozent für 2020 und 10,4 Prozent
für 2026 ausweist; das sind +6,3. Für CSU, SPD und Die Linke passt die Spalte,
für die anderen sechs Listen nicht. Die Grafik trägt beide Wahlergebnisse als
Zahl, also wird die Veränderung daraus gerechnet und der Anteil aus der Grafik
gegen den aus der Tabelle geprüft, weicht er ab, bricht der Lauf ab.

Die Gemeindeseiten führen dieselbe Spalte, aber keine Vergleichsgrafik. Dort
lässt sich also nichts nachrechnen, und deshalb steht für Gemeinderatswahlen
gar keine Veränderung im Datensatz. Eine Zahl, die man nicht prüfen kann, ist
hier keine Zahl.

## Ablauf

```
node scripts/hole.mjs kommunalwahl2026-freising        # Rohdaten nach data/quellen/
node scripts/baue.mjs kommunalwahl2026-freising        # normalisiert nach data/wahlen/
node scripts/kartogramm.mjs kommunalwahl2026-freising  # Geometrie nach data/kartogramm/
node scripts/vorschau.mjs kommunalwahl2026-freising-gemeinderat CSU
npm test                                               # Parser gegen die Abzüge
npx serve .
```

`kartogramm.mjs` rechnet beide Aufteilungen einmal aus und legt reine
Zeichenware ab: Mittelpunkte, Umrisse, Beschriftungsanker, alles schon im
Koordinatenraum der viewBox, dazu je Gemeinde die Wabe ihres Rats. Das Format
ist das von `flatten()` aus hexagonalmap, und gezeichnet wird mit dessen
`toSVG()`. Weder diese Seite noch der
[Data Hub](https://github.com/bagruber/datahub) projiziert oder löst ein
Transportproblem; beide malen nur noch.

`npm test` prüft die Parser gegen die abgelegten Seiten. Das sind sechs
HTML-Varianten von sechs Wahlsoftware-Installationen, und keine davon hat je
versprochen, so zu bleiben.

Die Abzüge in `data/quellen/` bleiben unverändert im Repo, die geparsten Daten
wie die abgerufenen Seiten selbst. Wahlleitungen räumen ihre Seiten irgendwann
ab; ohne das Rohmaterial ließe sich später nicht mehr prüfen, woher eine Zahl
kommt. Als sich herausstellte, dass die Übersichtstabellen den ausgeschriebenen
Listennamen im abbr-Titel führen, mussten alle einundzwanzig Seiten neu
abgerufen werden, weil im Repo nur noch das Ergebnis des Parsers lag.

`hole.mjs` überschreibt außerdem kein Ergebnis mit einem Fehlschlag. Antwortet
ein Server nicht, bleibt der vorige Abzug stehen und der Lauf meldet es. Ohne
das fiele `baue.mjs` still auf die amtlichen Sammelkategorien zurück: die
Sitzsumme ginge weiter auf, und der Gemeinde fehlten ohne jede Fehlermeldung
ihre Listennamen.

Eine weitere Wahl braucht einen Eintrag in `data/register.json` und die
Geometrie ihres Gebiets unter `data/geo/`.

## Farben

Parteifarben sind Konvention, keine freie Entscheidung: eine CSU in Blau oder
eine SPD in Grün macht die Karte schlechter lesbar, nicht besser. Damit ist eine
durchgehend farbfehlsichtigkeitssichere Palette ausgeschlossen, SPD-Rot und
Grünen-Grün liegen bei Deuteranopie ΔE 5,1 auseinander (OKLab ×100, Ziel ≥ 8),
und daran ändert keine Abstufung etwas. Die Karte trägt deshalb Beschriftung,
Legende, Ablesung beim Zeigen und eine vollständige Tabelle. Die Farbe ist nie
das einzige Unterscheidungsmerkmal.

Die Parteifarben sind die des Ratsinformationsprojekts
[council](https://github.com/bagruber/council), damit dieselbe Partei in beiden
Projekten dieselbe Farbe trägt. Zwei mussten für die Karte weichen. Das Grün der
Grünen war dort ein gelbliches `#64a12d`; gegen das Orange der Freien Wähler
bleiben davon bei Protanopie ΔE 1,3 übrig, und beides sind hier große Flächen,
die aneinandergrenzen: das kühlere `#3d8b37` hält 8,8. Das Gelb der FDP war
reines `#ffed00`; auf Creme ergibt das einen Kontrast von 1,1:1, die Fläche
verschwindet. Tiefer als `#e5c800` geht es allerdings auch nicht, da kippt das
Gelb ins Orange der Freien Wähler.

### Wie viel Platz übrig bleibt

Das ist ausgerechnet und nicht geschätzt. Neben den neun gesetzten Parteifarben
lassen sich auf cremefarbenem Grund noch **vier** weitere Farben unterbringen,
die sich von allen anderen und voneinander zuverlässig unterscheiden, ΔE ≥ 8
unter Farbfehlsichtigkeit, ≥ 15 bei normalem Sehen, gemessen in OKLab ×100. Vier.
Im Landkreis Freising treten 31 örtliche Listen an.

Daraus folgen zwei Dinge. Erstens fasst die Kreislegende zusammen, was
zusammengehört: die Freien Wähler zu einer Liste, die gemeinsamen Wahlvorschläge
zu einer, und Wählergruppen mit einem einzigen Sitz in einer einzigen Gemeinde
zu einer. Die beiden letzten Gruppen sind genau die Sammelkategorien der
amtlichen Statistik: die Zusammenfassung fällt dort also mit ihr zusammen,
statt ihr zu widersprechen.

Zweitens sind die Farben, die dann noch für örtliche Listen bleiben, per
Graphfärbung vergeben, und zwar über zwei verschieden schwere Bedingungen.
Hart: Listen im selben Gemeinderat liegen in der Sitzansicht Feld an Feld, und
die stärksten Listen zweier benachbarter Gemeinden bilden in der Übersicht zwei
aneinanderstoßende Blöcke. Teilen sie eine Farbe, verschmelzen sie, und die
Karte behauptet eine Mehrheit, die es nicht gibt, `baue.mjs` prüft das und
bricht ab. Weich: was in derselben Legende steht, sollte sich unterscheiden.
Bei vier Farben und 31 Listen geht das nicht immer, und dann gewinnt die harte
Bedingung. Fünf Zeilen der Übersichtslegende stehen deshalb im selben Blau; auf
der Karte berühren sie sich nirgends, und in der Legende steht die Gemeinde
daneben.

### Freie Wähler

Die Freien Wähler sind keine Partei mit Ortsvereinen, sondern ein Verband
eigenständiger Wählergemeinschaften. Die Karte zeigt sie trotzdem einheitlich in
einem Orange und zählt sie in der Kreislegende als eine Liste: 70 Sitze aus zwölf
örtlichen Wahlvorschlägen, die den Namen führen.

Die amtliche Statistik zählt anders, unter „FREIE WÄHLER Bayern" stehen dort
neun Sitze. Die übrigen liegen als eigenständige Wählergemeinschaften in
„Wählergruppen" und „Gemeinsame Wahlvorschläge". Beides ist richtig; die Zahlen
sind nur nicht dasselbe, und die Karte sagt das dazu, statt es auf sich beruhen
zu lassen.

Wo zwei dieser Listen in einem Rat sitzen, Langenbach hat FW und FWO, Wang FWI
und FWV —, bekommt die zweite eine dunklere Stufe desselben Orange. Ohne das
wären sie in der Sitzansicht ein Block statt zwei. Die dunklere Stufe kommt der
ÖDP nahe; dass die beiden nirgends im selben Rat sitzen, prüft der Build.

Die Sättigungsskala der Listenansicht mischt in OKLab, nicht in sRGB. Eine
sRGB-Blende von Beige nach Grün läuft über ein schlammiges Oliv, weil sich
Helligkeit und Buntheit ungleichmäßig ändern; in OKLab sehen die Stufen gleich
weit auseinander aus, wie es eine Wertskala verlangt.

## Aufbau

```
src/kern/listen.js    Schreibweisen, Gruppen, Farben
src/kern/skala.js     die Skalen, im Build gerechnet und in den Datensatz geschrieben
src/kern/farbe.js     Mischung in OKLab
src/kern/karte.js     Bezugsgrößen und das Layout, nur für den Build
src/kern/zeichne.js   welche Farbe wohin gehört; gezeichnet wird von hexagonalmap
src/ui/               die Seite: app, legende, tabelle, ablesung, herkunft, format
```

Die Skalen stehen bewusst nicht im Renderer. Sie hängen allein an den Daten,
also rechnet `baue.mjs` sie aus und schreibt sie zu jeder Legendenzeile. Vorher
stand dieselbe Formel zweimal da, einmal hier und einmal in TypeScript im Data
Hub, und zwei Fassungen einer Formel laufen irgendwann auseinander.

## Einbinden

Kein Framework, kein Build, reine ES-Module. Der Kern kommt zur Laufzeit über
eine Import-Map von GitHub Pages: dort steht
`Access-Control-Allow-Origin: *`, der Import aus fremden Seiten funktioniert
also.

```js
import { layout, zeichne } from "./src/kern/karte.js";

const raster = layout({ gebiete, grenze, wahl, grundlage: "sitze" }); // einmal je Bezugsgröße
const svg = zeichne(raster, wahl, { ansicht: "stärkste" });          // je Ansicht
```

`wahl` ist eine Datei aus `data/wahlen/`. Aufbau:

```jsonc
{
  "id": "kommunalwahl2026-freising-gemeinderat",
  "ebene": "gemeinderat",
  "gebiet": { "schluessel": "09178", "name": "Landkreis Freising", "datensatz": "freising" },

  // Die Geometrie liegt in data/kartogramm/<id>.json daneben, mit einem Raster
  // je Bezugsgröße:
  //   raster.sitze    , ein Feld ist ein Ratssitz, Aufteilung nach Sitzen
  //   raster.einwohner, ein Feld sind 500 Einwohner, Aufteilung nach Stimmenanteil
  //   gremien         , je Gemeinde die Wabe ihres Rats, ein Feld je Person

  // Wie viele Gemeinden welche Art von Angabe tragen, für die Herkunftsauskunft.
  "herkunft": { "listen": { "gemeinden": 21, "sitze": 378 }, "sammel": { "gemeinden": 3, "sitze": 62 },
                "veraenderung": 0, "gewaehlte": 21 },
  // Vorbehalte, die zum Gezeigten gehören und nicht in die Fußnote dürfen.
  "hinweise": [{ "liste": "FW", "text": "Die Freien Wähler sind hier als eine Liste gezählt …" }],

  // Die Gruppen der Kreislegende, nicht die Einzellisten.
  "listen": [
    { "id": "CSU", "name": "CSU", "art": "partei", "farbe": "#0a0a0a", "sitze": 94, "gemeinden": 17, "anteil": 22.4 },
    { "id": "FW", "name": "Freie Wähler", "art": "familie", "farbe": "#f28c15", "sitze": 70, "gemeinden": 13,
      // Woraus die Gruppe besteht, und wie viel davon in der amtlichen Statistik
      // gar keinen Listennamen trägt.
      "teile": [{ "name": "FW", "sitze": 21 }, { "name": "FWG Kirchdorf", "sitze": 5 }],
      "unbenannt": 0 }
  ],

  "gemeinden": [{
    "ags": "09178143",
    "name": "Moosburg a.d.Isar",
    "sitze": 24,
    "genauigkeit": "listen",          // oder "sammel": nur amtliche Sammelkategorien
    "quelle": "https://wahlen.osrz-akdb.de/…",
    // Hier stehen die Einzellisten. `gruppe` verweist auf die Zeile in `listen`;
    // `farbe` ist die der Gruppe, außer bei der zweiten Stufe der Freien Wähler.
    "ergebnis": [{ "id": "FREIE WÄHLER, FW Moosburg", "gruppe": "FW", "art": "örtlich",
                   "lang": "FREIE WÄHLER Bayern, Der Freie Wähler Moosburg e.V.",
                   "sitze": 4, "stimmen": 1554, "anteil": 18, "farbe": "#f28c15" }],
    // Wo die Wahlleitung sie ausweist: jeder Sitz mit Namen. Damit wird in einer
    // Detailansicht aus einem Sechseck je Sitz ein Sechseck je Ratsmitglied.
    "gewaehlte": [{ "name": "Mader Maximilian", "liste": "CSU", "stimmen": 6657 }]
  }]
}
```

`stimmen` sind durchgehend **gewichtete** Stimmen: die Wahlleitungen zählen
absolute Stimmen, was bei bis zu vierzig Stimmen je Wahlzettel zwischen
Gemeinden nichts aussagt. Die amtliche Statistik rechnet stattdessen mit
gewichteten Stimmen und gleicht dabei aus, dass eine Liste weniger Bewerber
aufstellen kann, als Sitze zu vergeben sind. Anteile aus Gemeindequellen werden
darauf zurückgerechnet, damit die Karte eine einzige Einheit kennt.

## Datenquellen

Ergebnisse: Bayerisches Landesamt für Statistik, GENESIS-Online, sowie die
Wahlleitungen der Gemeinden und des Landkreises Freising. Die vollständigen
Adressen führt jede Datei in `data/wahlen/` unter `quellen` mit; die Seite zeigt
sie in der Fußzeile.

Geometrie: Verwaltungsgebiete 1:250 000 mit Einwohnerzahlen (VG250-EW), Stand
31.12. © GeoBasis-DE / BKG 2026,
[dl-de/by-2-0](https://www.govdata.de/dl-de/by-2-0). Die Angabe muss jede
Veröffentlichung mitführen, die diese Geometrien zeigt.
