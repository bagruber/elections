// Rechnet die Geometrie einmal vor und legt sie als Datei ab.
//
//   node scripts/kartogramm.mjs kommunalwahl2026-freising
//
// Die Aufteilung ist teuer (Projektion, Transportproblem, Verschiebeschritte)
// und für eine Wahl unveränderlich. Weder die Standalone-Seite noch der Datahub
// sollen die halbe Bibliothek mitziehen müssen, nur um dieselben Sechsecke noch
// einmal auszurechnen. Herauskommt reine Zeichenware: Mittelpunkte, Umrisse,
// Beschriftungsanker, alles im Koordinatenraum der fertigen viewBox.
//
// Gerechnet werden zwei Karten, und der Unterschied zwischen ihnen ist die
// eigentliche Auskunft. Auf der einen ist ein Sechseck ein Ratssitz: sie zeigt,
// wie das Gewicht im Gremium verteilt ist. Auf der anderen ist ein Sechseck
// eine Zahl Einwohner: sie zeigt, wie die Menschen verteilt sind. Im Landkreis
// Freising kommen auf einen Sitz in Freising 1223 Einwohner und in Gammelsdorf
// 133; die kleinen Gemeinden schrumpfen beim Umschalten also auf ein Neuntel.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { split } from "hexagonalmap/parts";
import { flatten } from "hexagonalmap/flatten";
import { GRUNDLAGEN, layout } from "../src/kern/karte.js";

const wurzel = new URL("../", import.meta.url);
const BREITE = 1000;

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

const kartogramm = {
  id,
  raster: Object.fromEntries(Object.values(GRUNDLAGEN).map((g) => [g.id, baueRaster(g)])),
  gremien: Object.fromEntries(wahl.gemeinden.filter((g) => g.gewaehlte.length).map((g) => [g.ags, gremium(g)])),
};

const ziel = new URL("data/kartogramm/", wurzel);
await mkdir(ziel, { recursive: true });
await writeFile(new URL(`${id}.json`, ziel), JSON.stringify(kartogramm) + "\n", "utf8");

const größe = JSON.stringify(kartogramm).length / 1024;
console.log(
  `${id}.json  ` +
    Object.values(GRUNDLAGEN).map((g) => {
      const r = kartogramm.raster[g.id];
      return `${g.label}: ${r.regions.reduce((a, x) => a + x.cells.length, 0)} Felder`;
    }).join("  ") +
    `  ${Object.keys(kartogramm.gremien).length} Gremien  ${größe.toFixed(0)} kB`
);

/**
 * Ein vollständiges Kartogramm für eine Bezugsgröße.
 *
 * Gerechnet wird mit derselben layout() wie im Browser und flach gemacht mit
 * flatten() aus hexagonalmap. Rahmen und Beschriftungsanker standen hier früher
 * noch einmal, obwohl die Bibliothek beides schon konnte.
 */
function baueRaster(grundlage) {
  const raster = layout({ gebiete, grenze, wahl, grundlage: grundlage.id });

  // Welche Liste auf welchem Feld liegt. Auf der Sitzkarte ist das exakt, auf
  // der Einwohnerkarte nach Stimmenanteil gerundet.
  const fraktion = split(
    raster,
    (region) =>
      (sitze.get(String(region.id))?.ergebnis ?? []).map((e) => ({ key: e.id, value: grundlage.teilung(e) })),
    "blocks"
  );

  return {
    grundlage: {
      id: grundlage.id,
      label: grundlage.label,
      je: grundlage.je,
      einheit: grundlage.einheit,
      genau: grundlage.genau,
    },
    ...flatten(raster, { width: BREITE, cell: (c) => fraktion[c] }),
  };
}

/**
 * Das Gremium einer Gemeinde als eigene Wabe: ein Sechseck je Sitz, im
 * Sechseckraster von innen nach außen gelegt und dann als Tortenstücke auf die
 * Fraktionen verteilt, im Uhrzeigersinn ab zwölf Uhr und in der Reihenfolge
 * ihrer Größe. Jedes Feld trägt den Namen der gewählten Person.
 */
function gremium(gemeinde) {
  const felder = spirale(gemeinde.sitze);

  // split() erwartet ein Layout und liefert je Feld die Fraktion. Hier ist das
  // Layout keine Landkarte, sondern eine einzelne Wabe. Die Aufteilung selbst
  // ist dieselbe Aufgabe und arbeitet mit demselben Verfahren: jede Fraktion
  // wächst als Klumpen von einem eigenen Randpunkt aus. Nach Winkel zu sortieren
  // ergäbe zwar Tortenstücke, aber ausgefranste: ein Sechseckraster verteilt
  // seine Felder nicht gleichmäßig über die Winkel.
  const wabe = {
    size: 1,
    orientation: "pointy",
    cells: felder.map(([q, r, x, y]) => ({ q, r, x, y })),
    regions: [{ cells: felder.map((_, i) => i) }],
  };

  const fraktionen = split(wabe, () => gemeinde.ergebnis.map((e) => ({ key: e.id, value: e.sitze ?? 0 })), "blocks");

  // Innerhalb einer Fraktion bekommen die stimmstärksten Gewählten die Felder
  // zuerst; die Reihenfolge ist dieselbe wie auf dem Wahlzettel danach.
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
