// Rendert die Ansichten einer Wahl nach vorschau/ — zum Anschauen und Prüfen.
//
//   node scripts/vorschau.mjs kommunalwahl2026-freising-gemeinderat [liste]

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { layout, zeichne, stärkste, spanne } from "../src/kern/karte.js";

const wurzel = new URL("../", import.meta.url);
const daten = new URL("node_modules/hexagonalmap/data/", wurzel);

const id = process.argv[2] ?? "kommunalwahl2026-freising-gemeinderat";
const wahl = JSON.parse(await readFile(new URL(`data/wahlen/${id}.json`, wurzel), "utf8"));
const sitzWahl = id.endsWith("-kreistag")
  ? JSON.parse(await readFile(new URL(`data/wahlen/${id.replace("-kreistag", "-gemeinderat")}.json`, wurzel), "utf8"))
  : wahl;

const satz = wahl.gebiet.datensatz;
const gebiete = JSON.parse(await readFile(new URL(`${satz}/teile.geojson`, daten), "utf8"));
const grenze = JSON.parse(await readFile(new URL(`${satz}/grenze.geojson`, daten), "utf8"));

const ordner = new URL("vorschau/", wurzel);
await mkdir(ordner, { recursive: true });

console.time("layout");
const raster = layout({ gebiete, grenze, wahl: sitzWahl });
console.timeEnd("layout");
console.log(`${raster.cells.length} Felder auf ${raster.regions.filter((r) => r.count).length} Gemeinden`);

const abweichend = raster.regions.filter((r) => r.count !== r.target);
if (abweichend.length) console.warn(`Zuteilung ungenau: ${abweichend.map((r) => `${r.name} ${r.count}/${r.target}`).join(", ")}`);

const liste = process.argv[3] ?? wahl.listen[0].id;
const ansichten = [
  ["staerkste", { ansicht: "stärkste" }],
  ["sitze", { ansicht: "sitze" }],
  ["liste", { ansicht: "liste", liste }],
];

for (const [name, optionen] of ansichten) {
  const svg = zeichne(raster, wahl, { ...optionen, breite: 1200 });
  await writeFile(new URL(`${id}-${name}.svg`, ordner), svg, "utf8");
  console.log(`${id}-${name}.svg  ${(svg.length / 1024).toFixed(0)} kB`);
}

console.log(`\nStärkste Liste je Gemeinde:`);
for (const gemeinde of [...wahl.gemeinden].sort((a, b) => b.sitze - a.sitze)) {
  const s = stärkste(gemeinde);
  const name = wahl.listen.find((l) => l.id === s.id)?.name ?? s.id;
  console.log(
    `  ${gemeinde.name.padEnd(22)} ${String(gemeinde.sitze ?? "").padStart(3)} Sitze  ` +
      `${name.padEnd(28)} ${String(s.sitze ?? "").padStart(3)}  ${String(s.anteil ?? "").padStart(5)} %` +
      `${gemeinde.genauigkeit === "sammel" ? "   (Sammelkategorie)" : ""}`
  );
}

const { höchster, gemeinden } = spanne(wahl, liste);
console.log(`\nAnsicht „liste": ${liste}, angetreten in ${gemeinden} von ${wahl.gemeinden.length}, Spitzenwert ${höchster} %`);
