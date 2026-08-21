// Lädt die Rohdaten einer Wahl nach data/quellen/<id>/ herunter.
//
//   node scripts/hole.mjs kommunalwahl2026-freising
//
// Die Abzüge bleiben unverändert im Repo liegen: die Wahlleitungen räumen ihre
// Seiten irgendwann ab, und ohne das Rohmaterial ließe sich nicht mehr prüfen,
// woher eine Zahl kommt. Aufbereitet wird erst in baue.mjs.

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { genesis, leseAkdb, leseGewaehlte, leseVergleich, zaehleSitze } from "./quellen.mjs";

const wurzel = new URL("../", import.meta.url);
const register = JSON.parse(await readFile(new URL("data/register.json", wurzel), "utf8"));

const id = process.argv[2];
const wahl = register[id];
if (!wahl) {
  console.error(`Unbekannt: ${id ?? "(nichts angegeben)"}\nBekannt: ${Object.keys(register).join(", ")}`);
  process.exit(1);
}

const ordner = new URL(`data/quellen/${id}/`, wurzel);
await mkdir(ordner, { recursive: true });

let sitzCsv;
for (const [zweck, tabelle] of Object.entries(wahl.genesis)) {
  const csv = await genesis(tabelle, `${wahl.kreis}*`);
  await writeFile(new URL(`genesis-${zweck}.csv`, ordner), csv, "utf8");
  if (zweck === "sitze") sitzCsv = csv;
  console.log(`genesis-${zweck}.csv  ${tabelle}`);
}

// Die Kreistagswahl liegt für jede Gemeinde beim Landratsamt — dieselben Listen
// überall, damit als einzige Wahl über Gemeindegrenzen hinweg vergleichbar.
const gemeinden = ergebnisSchluessel(sitzCsv);
const kreistag = {};
for (const ags of gemeinden) {
  const html = await hole(wahl.kreistag.replace("{ags}", ags));
  // Die Vergleichsgrafik trägt beide Wahlen als Zahl. Sie ist die einzige
  // belastbare Quelle für Gewinn und Verlust: die Spalte in der Übersicht
  // daneben weicht bei zwei Dritteln der Listen davon ab.
  kreistag[ags] = { ...leseAkdb(html), vergleich: leseVergleich(html) };
  const v = kreistag[ags].vergleich;
  console.log(`kreistag  ${ags}  ${kreistag[ags].gebiet}  ${kreistag[ags].listen.length} Listen  ${v ? `Vergleich: ${v.vergleichswahl}` : "ohne Vergleich"}`);
}
await writeFile(new URL("kreistag.json", ordner), JSON.stringify(kreistag, null, 2), "utf8");

// Die Gemeindewahlleitungen nennen ihre örtlichen Listen beim Namen. Sie decken
// jeweils nur ihr eigenes Gebiet ab; was fehlt, bleibt bei den GENESIS-Sammeltöpfen.
const oertlich = {};
for (const [ags, url] of Object.entries(wahl.gemeinden ?? {})) {
  try {
    const html = await hole(url);
    const gewaehlte = leseGewaehlte(html);
    oertlich[ags] = { quelle: url, ...leseAkdb(html), gewaehlte, sitze: zaehleSitze(gewaehlte) };
    const summe = Object.values(oertlich[ags].sitze).reduce((a, b) => a + b, 0);
    console.log(`gemeinde  ${ags}  ${oertlich[ags].gebiet}  ${summe} Sitze auf ${Object.keys(oertlich[ags].sitze).length} Listen`);
  } catch (e) {
    console.error(`gemeinde  ${ags}  FEHLER: ${e.message}`);
  }
}
await writeFile(new URL("gemeinden.json", ordner), JSON.stringify(oertlich, null, 2), "utf8");

// Zwei Dutzend Abrufe hintereinander sind für manche Gemeindeserver zu viel;
// Kranzberg bricht dann die Verbindung ab und antwortet einen Atemzug später
// wieder anstandslos. Ein zweiter Versuch ist billiger als eine Lücke.
async function hole(url, versuche = 3) {
  for (let i = 1; ; i++) {
    try {
      const antwort = await fetch(url);
      if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
      return await antwort.text();
    } catch (e) {
      if (i >= versuche) throw e;
      await new Promise((fertig) => setTimeout(fertig, 1000 * i));
    }
  }
}

/** Achtstellige Gemeindeschlüssel aus einer GENESIS-CSV, ohne den Kreis selbst. */
function ergebnisSchluessel(csv) {
  return csv
    .split(/\r?\n/)
    .map((z) => z.match(/^(\d{8});/)?.[1])
    .filter(Boolean);
}
