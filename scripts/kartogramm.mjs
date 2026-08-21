// Rechnet die Geometrie einmal vor und legt sie als Datei ab.
//
//   node scripts/kartogramm.mjs kommunalwahl2026-freising
//
// Die Aufteilung ist teuer (Projektion, Transportproblem, Verschiebeschritte)
// und für eine Wahl unveränderlich. Wer sie einbindet — die Standalone-Seite
// wie der Datahub — soll nicht die halbe Bibliothek mitziehen müssen, nur um
// dieselben Sechsecke noch einmal auszurechnen. Herauskommt reine Zeichenware:
// Mittelpunkte, Umrisse, Beschriftungsanker, alles im Koordinatenraum der
// fertigen viewBox.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { hexmap } from "hexagonalmap";
import { split } from "hexagonalmap/parts";

const wurzel = new URL("../", import.meta.url);
const BREITE = 1000;
const RAND = 3; // Prozent der Kartenbreite

const id = process.argv[2];
if (!id) {
  console.error("Aufruf: node scripts/kartogramm.mjs <wahl-id>");
  process.exit(1);
}

const wahl = JSON.parse(await readFile(new URL(`data/wahlen/${id}-gemeinderat.json`, wurzel), "utf8"));
const satz = wahl.gebiet.datensatz;
const gebiete = JSON.parse(await readFile(new URL(`data/geo/${satz}/teile.geojson`, wurzel), "utf8"));
const grenze = JSON.parse(await readFile(new URL(`data/geo/${satz}/grenze.geojson`, wurzel), "utf8"));

const sitze = new Map(wahl.gemeinden.map((g) => [g.ags, g]));

const raster = hexmap({
  areas: gebiete,
  outline: grenze,
  value: (props) => sitze.get(String(props.ags))?.sitze ?? 0,
  valuePerHex: 1,
  key: "ags",
  fidelity: 0.6,
  orientation: "pointy",
});

const fraktion = split(
  raster,
  (region) => (sitze.get(String(region.id))?.ergebnis ?? []).map((e) => ({ key: e.id, value: e.sitze ?? 0 })),
  "blocks"
);

const { nach, höhe, maß } = rahmen(raster);

const kartogramm = {
  id,
  viewBox: [0, 0, BREITE, höhe],
  hex: { radius: runde(raster.size * maß.faktor), orientierung: raster.orientation },
  gemeinden: raster.regions
    .filter((region) => region.cells.length)
    .map((region) => {
      const gemeinde = sitze.get(String(region.id));
      return {
        ags: String(region.id),
        name: region.name,
        // Je Sitz ein Mittelpunkt und die Fraktion, die darauf sitzt.
        felder: region.cells.map((c) => {
          const [x, y] = nach(raster.cells[c]);
          return [runde(x), runde(y), fraktion[c]];
        }),
        umriss: (raster.outline[raster.regions.indexOf(region)] ?? [])
          .map((ring) => "M" + ring.map((p) => nach({ x: p[0], y: p[1] }).map(runde).join(",")).join("L") + "Z")
          .join(""),
        beschriftung: anker(region, raster, nach, maß),
        sitze: gemeinde?.sitze ?? region.cells.length,
      };
    }),
  gremien: Object.fromEntries(
    wahl.gemeinden.filter((g) => g.gewaehlte.length).map((g) => [g.ags, gremium(g)])
  ),
};

const ziel = new URL("data/kartogramm/", wurzel);
await mkdir(ziel, { recursive: true });
await writeFile(new URL(`${id}.json`, ziel), JSON.stringify(kartogramm) + "\n", "utf8");

const felder = kartogramm.gemeinden.reduce((a, g) => a + g.felder.length, 0);
const größe = JSON.stringify(kartogramm).length / 1024;
console.log(
  `${id}.json  ${kartogramm.gemeinden.length} Gemeinden  ${felder} Felder  ` +
    `${Object.keys(kartogramm.gremien).length} Gremien  ${größe.toFixed(0)} kB`
);

/**
 * Umrechnung vom Projektionsraum in die viewBox. Die Projektion zählt nach
 * Norden, SVG nach unten — deshalb wird y gespiegelt.
 */
function rahmen(raster) {
  const breite = raster.orientation === "pointy" ? Math.sqrt(3) * raster.size : 2 * raster.size;
  const höheHex = raster.orientation === "pointy" ? 2 * raster.size : Math.sqrt(3) * raster.size;

  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const zelle of raster.cells) {
    minX = Math.min(minX, zelle.x - breite / 2);
    maxX = Math.max(maxX, zelle.x + breite / 2);
    minY = Math.min(minY, zelle.y - höheHex / 2);
    maxY = Math.max(maxY, zelle.y + höheHex / 2);
  }

  const rand = ((maxX - minX) * RAND) / 100;
  [minX, minY, maxX, maxY] = [minX - rand, minY - rand, maxX + rand, maxY + rand];
  const faktor = BREITE / (maxX - minX);

  return {
    nach: ({ x, y }) => [(x - minX) * faktor, (maxY - y) * faktor],
    höhe: Math.round((maxY - minY) * faktor),
    maß: { faktor, breite, höheHex },
  };
}

/**
 * Wohin der Gemeindename gehört: in die längste ununterbrochene waagerechte
 * Reihe, nicht auf den Schwerpunkt. Bei einer gebogenen Gemeinde liegt der
 * Schwerpunkt außerhalb der Fläche, und die Schrift stünde im Nichts.
 */
function anker(region, raster, nach, maß) {
  const reihen = new Map();
  const reihenhöhe = raster.orientation === "pointy" ? maß.höheHex * 0.75 : maß.höheHex;
  const schritt = raster.orientation === "pointy" ? maß.breite : maß.breite * 0.75;

  for (const c of region.cells) {
    const zelle = raster.cells[c];
    const schlüssel = Math.round(zelle.y / reihenhöhe);
    if (!reihen.has(schlüssel)) reihen.set(schlüssel, []);
    reihen.get(schlüssel).push(zelle);
  }

  let beste = null;
  for (const zellen of reihen.values()) {
    zellen.sort((a, b) => a.x - b.x);
    let start = 0;
    for (let i = 1; i <= zellen.length; i++) {
      if (i < zellen.length && zellen[i].x - zellen[i - 1].x <= schritt * 1.05) continue;
      const [erste, letzte] = [zellen[start], zellen[i - 1]];
      const spanne = letzte.x - erste.x + maß.breite;
      if (!beste || spanne > beste.spanne) {
        beste = { spanne, x: (erste.x + letzte.x) / 2, y: (erste.y + letzte.y) / 2 };
      }
      start = i;
    }
  }
  if (!beste) return null;

  const [x, y] = nach(beste);
  return { x: runde(x), y: runde(y), platz: runde(beste.spanne * maß.faktor) };
}

/**
 * Das Gremium einer Gemeinde als eigene Wabe: ein Sechseck je Sitz, im
 * Sechseckraster von innen nach außen gelegt und dann als Tortenstücke auf die
 * Fraktionen verteilt — im Uhrzeigersinn ab zwölf Uhr, Fraktionen in der
 * Reihenfolge ihrer Größe. Jedes Feld trägt den Namen der gewählten Person.
 */
function gremium(gemeinde) {
  const felder = spirale(gemeinde.sitze);

  // split() erwartet ein Layout und liefert je Feld die Fraktion. Hier ist das
  // Layout keine Landkarte, sondern eine einzelne Wabe — die Aufteilung selbst
  // ist dieselbe Aufgabe und arbeitet mit demselben Verfahren: jede Fraktion
  // wächst als Klumpen von einem eigenen Randpunkt aus. Nach Winkel zu sortieren
  // ergäbe zwar Tortenstücke, aber ausgefranste: ein Sechseckraster verteilt
  // seine Felder nicht gleichmäßig über die Winkel.
  const layout = {
    size: 1,
    orientation: "pointy",
    cells: felder.map(([q, r, x, y]) => ({ q, r, x, y })),
    regions: [{ cells: felder.map((_, i) => i) }],
  };

  const fraktionen = split(layout, () => gemeinde.ergebnis.map((e) => ({ key: e.id, value: e.sitze ?? 0 })), "blocks");

  // Innerhalb einer Fraktion bekommen die stimmstärksten Gewählten die Felder
  // zuerst — die Reihenfolge ist dieselbe wie auf dem Wahlzettel danach.
  const offen = new Map(
    gemeinde.ergebnis.map((e) => [e.id, gemeinde.gewaehlte.filter((p) => p.liste === e.id).slice()])
  );

  const radius = 1;
  const spanne = felder.reduce((a, [, , x, y]) => Math.max(a, Math.abs(x) + 1, Math.abs(y) + 1), 0);
  return {
    viewBox: [-spanne, -spanne, 2 * spanne, 2 * spanne],
    hex: { radius, orientierung: "pointy" },
    sitze: felder.map(([, , x, y], i) => {
      const liste = fraktionen[i];
      const person = offen.get(liste)?.shift();
      return [runde(x), runde(y), liste, person?.name ?? null];
    }),
  };
}

/** n Felder eines Sechseckrasters, von der Mitte nach außen. */
function spirale(n) {
  // Die Reihenfolge ist nicht beliebig: der Ring beginnt in der Ecke, auf die
  // Richtung 4 zeigt, und wird von dort aus in der Reihenfolge 0…5 abgelaufen.
  const richtungen = [
    [1, 0],
    [1, -1],
    [0, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
  ];
  const felder = [[0, 0]];
  for (let ring = 1; felder.length < n + 6 * ring; ring++) {
    let [q, r] = [-ring, ring];
    for (const [dq, dr] of richtungen) {
      for (let schritt = 0; schritt < ring; schritt++) {
        felder.push([q, r]);
        q += dq;
        r += dr;
      }
    }
  }
  // Axiale Rasterkoordinaten samt Bildkoordinaten, Ecke oben. Die Spirale wird
  // nicht einfach abgeschnitten, sondern nach Abstand zur Mitte sortiert: sonst
  // hinge bei einer Zahl, die keinen Ring füllt, ein Feld allein am Rand.
  return felder
    .map(([q, r]) => [q, r, Math.sqrt(3) * (q + r / 2), 1.5 * r])
    .sort((a, b) => Math.hypot(a[2], a[3]) - Math.hypot(b[2], b[3]))
    .slice(0, n);
}

function runde(v) {
  return Math.round(v * 100) / 100;
}
