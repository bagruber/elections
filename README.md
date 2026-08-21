# Wahlkarten

Kommunalwahlergebnisse als Hexagon-Kartogramm: jede Gemeinde bekommt so viele
Sechsecke, wie ihr Gemeinderat Sitze hat. Die Fläche zeigt damit das Gewicht des
Gremiums statt der Quadratkilometer, und der Landkreis bleibt trotzdem
wiedererkennbar.

Die Aufteilung selbst rechnet das Schwesterprojekt
[hexagonalmap](https://github.com/bagruber/hexagonalmap); hier liegt, was daraus
eine Wahlkarte macht — Datenbeschaffung, Listen, Farben, Ansichten.

**[Live ausprobieren](https://bagruber.github.io/elections/)**

## Drei Ansichten, ein Layout

Das Layout wird einmal je Wahl gerechnet und bleibt über alle Ansichten stehen.
Nur die Färbung wechselt — sonst verschöbe sich die Karte beim Umschalten unter
dem Blick weg und ließe sich nicht mehr vergleichen.

**Stärkste Liste** färbt jede Gemeinde einfarbig nach der Liste mit den meisten
Sitzen. Bei Gleichstand entscheidet der Stimmenanteil — in Freising etwa liegen
Grüne und FSM bei je neun Sitzen, FSM hat 23,5 gegen 23,3 Prozent.

**Sitzverteilung** färbt die einzelnen Felder: ein Sechseck ist ein Sitz, 440 im
ganzen Landkreis. Jede Fraktion wächst als Klumpen von einem eigenen Randpunkt
aus, damit sie zusammenhängt. Die Ansicht ist zwangsläufig dicht; die
Gemeindeumrisse sind hier deshalb deutlich kräftiger gezeichnet.

**Eine Liste** wählt eine Liste aus und zeigt ihre Stärke als Sättigung der
Fläche. Die Skala läuft von null bis zum Spitzenwert dieser Liste, nicht bis
hundert Prozent — sonst wäre alles außer der stärksten Partei blass. Der
Spitzenwert steht in der Bildunterschrift.

Wo eine Liste **nicht angetreten** ist, steht eine Schraffur statt einer blassen
Fläche. Das ist kein kleiner Wert, sondern gar keiner, und am unteren Ende
derselben Skala wäre es von einem schwachen Ergebnis nicht zu unterscheiden.

## Woher die Zahlen kommen

Für Gemeinderatswahlen gibt es keine einzige Quelle, die alles hat. Es gibt zwei,
die sich ergänzen:

**Die amtliche Statistik** — GENESIS-Online des Bayerischen Landesamts für
Statistik, Tabellen `14431-005r` (Sitze) und `14431-003r` (gewichtete Stimmen).
Sie deckt jede der 2 056 bayerischen Gemeinden ab, ohne Anmeldung als CSV
abrufbar, zurück bis 1978. Ihre Grenze: sie kennt nur 48 feste
Wahlvorschlags-Kategorien. Örtliche Listen fallen in „Gemeinsame
Wahlvorschläge" und „Wählergruppen" — im Landkreis Freising sind das zusammen
242 von 440 Sitzen. In Wang und Wolfersdorf machen sie 100 Prozent aus.

**Die Wahlleitungen der Gemeinden** nennen ihre Listen beim Namen. Sie decken
dafür jeweils nur ihr eigenes Gebiet ab, und sie sitzen auf unterschiedlicher
Software an unterschiedlichen Adressen. Wo eine erreichbar ist, steht sie in
[`data/register.json`](data/register.json) und tritt an die Stelle der
Sammelkategorien — als vollständiges Ergebnis, nicht als Aufteilung des
Sammeltopfs.

Geprüft wird beides gegeneinander: stimmt die Sitzsumme einer Gemeinde nicht mit
der amtlichen überein, bricht `baue.mjs` ab. Die Karte weist außerdem aus,
welche Gemeinden nur mit Sammelkategorien vorliegen.

Für Gemeinden ohne abrufbare Quelle gibt es
[`data/listen/`](data/listen/README.md): eine CSV je Wahl, von Hand gepflegt,
gleiches Prüfverfahren.

**Die Kreistagswahl** liegt vollständig vor — beim Landratsamt je Gemeinde
aufgeschlüsselt. Sie ist die einzige Wahl, bei der alle Gemeinden über dieselben
Listen abgestimmt haben, und damit die einzige, die sich zwischen ihnen ohne
Vorbehalt vergleichen lässt. Für die Ansicht „Eine Liste" ist sie deshalb als
zweite Ebene wählbar.

## Ablauf

```
node scripts/hole.mjs kommunalwahl2026-freising        # Rohdaten nach data/quellen/
node scripts/baue.mjs kommunalwahl2026-freising        # normalisiert nach data/wahlen/
node scripts/kartogramm.mjs kommunalwahl2026-freising  # Geometrie nach data/kartogramm/
node scripts/vorschau.mjs kommunalwahl2026-freising-gemeinderat CSU
npx serve .
```

`kartogramm.mjs` rechnet die Aufteilung einmal aus und legt reine Zeichenware ab:
Mittelpunkte, Umrisse, Beschriftungsanker, alles schon im Koordinatenraum der
viewBox, dazu je Gemeinde die Wabe ihres Rats. Wer die Karte einbindet, muss
damit weder projizieren noch das Transportproblem lösen — der
[Data Hub](https://github.com/bagruber/datahub) zeichnet sie in unter zehn
Kilobyte Code.

Die Abzüge in `data/quellen/` bleiben unverändert im Repo. Wahlleitungen räumen
ihre Seiten irgendwann ab; ohne das Rohmaterial ließe sich später nicht mehr
prüfen, woher eine Zahl kommt.

Eine weitere Wahl braucht einen Eintrag in `data/register.json` und die
Geometrie ihres Gebiets unter `data/geo/`.

## Farben

Parteifarben sind Konvention, keine freie Entscheidung: eine CSU in Blau oder
eine SPD in Grün macht die Karte schlechter lesbar, nicht besser. Damit ist eine
durchgehend farbfehlsichtigkeitssichere Palette ausgeschlossen — SPD-Rot und
Grünen-Grün liegen bei Deuteranopie ΔE 5,1 auseinander (OKLab ×100, Ziel ≥ 8),
und daran ändert keine Abstufung etwas. Die Karte trägt deshalb Beschriftung,
Legende, Ablesung beim Zeigen und eine vollständige Tabelle. Die Farbe ist nie
das einzige Unterscheidungsmerkmal.

Örtliche Listen bekommen Farben aus einer Leiter, die keine Parteifarbe belegt.
Vergeben werden sie per Graphfärbung über drei Arten von Konflikt: Listen im
selben Gemeinderat liegen in der Sitzansicht Feld an Feld; die stärksten Listen
zweier benachbarter Gemeinden bilden in der Übersicht zwei aneinanderstoßende
Blöcke; und was in derselben Legende steht, muss sich dort unterscheiden lassen.
Zwei weit auseinanderliegende Wählergruppen dürfen sich eine Farbe teilen — die
Legende nennt dann die Gemeinde dazu.

Die Sättigungsskala der Listenansicht mischt in OKLab, nicht in sRGB. Eine
sRGB-Blende von Beige nach Grün läuft über ein schlammiges Oliv, weil sich
Helligkeit und Buntheit ungleichmäßig ändern; in OKLab sehen die Stufen gleich
weit auseinander aus, wie es eine Wertskala verlangt.

## Einbinden

Kein Framework, kein Build, reine ES-Module. Der Kern kommt zur Laufzeit über
eine Import-Map von GitHub Pages — dort steht
`Access-Control-Allow-Origin: *`, der Import aus fremden Seiten funktioniert
also.

```js
import { layout, zeichne } from "./src/kern/karte.js";

const raster = layout({ gebiete, grenze, wahl });          // einmal je Wahl
const svg = zeichne(raster, wahl, { ansicht: "stärkste" }); // je Ansicht
```

`wahl` ist eine Datei aus `data/wahlen/`. Aufbau:

```jsonc
{
  "id": "kommunalwahl2026-freising-gemeinderat",
  "ebene": "gemeinderat",
  "gebiet": { "schluessel": "09178", "name": "Landkreis Freising", "datensatz": "freising" },
  "listen":   [{ "id": "CSU", "name": "CSU", "art": "partei", "farbe": "#1c1b1f", "sitze": 94 }],
  "gemeinden": [{
    "ags": "09178143",
    "name": "Moosburg a.d.Isar",
    "sitze": 24,
    "genauigkeit": "listen",          // oder "sammel": nur amtliche Sammelkategorien
    "ergebnis": [{ "id": "CSU", "sitze": 8, "stimmen": 2840, "anteil": 32.9, "farbe": "#1c1b1f" }],
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
