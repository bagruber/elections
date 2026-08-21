// Rohdaten aus data/quellen/ zu einem Wahldatensatz je Ebene verdichten.
//
//   node scripts/baue.mjs kommunalwahl2026-freising
//
// Die amtliche Statistik deckt jede Gemeinde ab, kennt örtliche Listen aber nur
// als „Wählergruppen" und „Gemeinsame Wahlvorschläge". Wo die Wahlleitung einer
// Gemeinde ihre Listen selbst veröffentlicht, tritt deren Ergebnis an die Stelle
// des Sammeltopfs — als Ganzes, nicht als Aufteilung: der Sammeltopf wäre sonst
// die Zwischenstufe, über die zwei Quellen gegeneinander gerechnet würden.
//
// Geprüft wird beides gegeneinander. Weicht die Sitzsumme einer Gemeinde von der
// amtlichen ab, bricht der Lauf ab, statt eine stille Abweichung auszuliefern.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { leseGenesis } from "./quellen.mjs";
import { normalisiere, faerbeÖrtliche, farbe } from "../src/kern/listen.js";

const wurzel = new URL("../", import.meta.url);
const register = JSON.parse(await readFile(new URL("data/register.json", wurzel), "utf8"));

const id = process.argv[2];
const wahl = register[id];
if (!wahl) {
  console.error(`Unbekannt: ${id ?? "(nichts angegeben)"}\nBekannt: ${Object.keys(register).join(", ")}`);
  process.exit(1);
}

const quellen = new URL(`data/quellen/${id}/`, wurzel);
const lies = async (datei) => readFile(new URL(datei, quellen), "utf8");

const sitzTabelle = leseGenesis(await lies("genesis-sitze.csv"));
const stimmTabelle = leseGenesis(await lies("genesis-stimmen.csv"));
const örtlicheQuellen = JSON.parse(await lies("gemeinden.json"));
// Von Hand gepflegte Ergebnisse für Gemeinden, deren Wahlleitung nichts
// Maschinenlesbares veröffentlicht. Sie gehen den abgerufenen Quellen vor:
// wer hier etwas einträgt, hat einen Grund dazu.
const nachgepflegt = await lieseNachpflege();
const nachbarschaft = await lieseNachbarschaft();
const kreistagQuellen = JSON.parse(await lies("kreistag.json"));

const ziel = new URL("data/wahlen/", wurzel);
await mkdir(ziel, { recursive: true });

const abweichungen = [];
await schreibe(gemeinderat(), "gemeinderat");
await schreibe(kreistag(), "kreistag");
await schreibeVerzeichnis(["gemeinderat", "kreistag"]);

if (abweichungen.length) {
  console.error(`\n${abweichungen.length} Abweichung(en):\n  ${abweichungen.join("\n  ")}`);
  process.exit(1);
}

/** Verzeichnis aller Wahlen, aus dem die Oberfläche ihre Auswahl baut. */
async function schreibeVerzeichnis(ebenen) {
  const eintrag = { id, name: wahl.name, datum: wahl.datum, gebiet: wahl.kreisname, ebenen };
  let bisher = [];
  try {
    bisher = JSON.parse(await readFile(new URL("index.json", ziel), "utf8"));
  } catch {}

  const alle = [...bisher.filter((w) => w.id !== id), eintrag].sort((a, b) => b.datum.localeCompare(a.datum) || a.name.localeCompare(b.name));
  await writeFile(new URL("index.json", ziel), JSON.stringify(alle, null, 2) + "\n", "utf8");
  console.log(`index.json  ${alle.length} Wahl(en)`);
}

async function schreibe(datensatz, ebene) {
  const datei = new URL(`${id}-${ebene}.json`, ziel);
  await writeFile(datei, JSON.stringify(datensatz, null, 2) + "\n", "utf8");
  const sitze = datensatz.gemeinden.reduce((a, g) => a + (g.sitze ?? 0), 0);
  console.log(
    `${id}-${ebene}.json  ${datensatz.gemeinden.length} Gemeinden` +
      `  ${datensatz.listen.length} Listen${sitze ? `  ${sitze} Sitze` : ""}`
  );
}

/** Gemeinde- und Stadtratswahlen: amtliche Basis, örtliche Quellen wo vorhanden. */
function gemeinderat() {
  const gemeinden = [];

  for (const zeile of sitzTabelle.zeilen) {
    if (zeile.schluessel.length !== 8) continue; // die Kreiszeile überspringen
    const amtlich = spalten(sitzTabelle, zeile);
    const stimmen = spalten(stimmTabelle, stimmTabelle.zeilen.find((z) => z.schluessel === zeile.schluessel));
    const sitzeGesamt = amtlich.Insgesamt;

    const örtlich = nachgepflegt[zeile.schluessel] ?? örtlicheQuellen[zeile.schluessel];
    const ergebnis = örtlich ? ausQuelle(örtlich, stimmen.Insgesamt) : ausAmtlich(amtlich, stimmen);

    const summe = ergebnis.reduce((a, e) => a + e.sitze, 0);
    if (summe !== sitzeGesamt) {
      abweichungen.push(`${zeile.schluessel} ${zeile.name.trim()}: ${summe} Sitze statt amtlich ${sitzeGesamt}`);
    }

    gemeinden.push({
      ags: zeile.schluessel,
      name: zeile.name.trim().replace(/,\s*(M|St|GKSt)$/, ""),
      sitze: sitzeGesamt,
      genauigkeit: örtlich ? "listen" : "sammel",
      quelle: örtlich?.quelle ?? "genesis",
      ergebnis: ergebnis.sort((a, b) => b.sitze - a.sitze || b.anteil - a.anteil),
      // Wo die Wahlleitung sie ausweist, ist jeder Sitz eine Person mit Namen.
      // Für die Detailansicht ist das der eigentliche Inhalt: ein Sechseck je
      // Sitz wird damit zu einem Sechseck je Ratsmitglied.
      gewaehlte: (örtlich?.gewaehlte ?? [])
        .map((person) => ({ name: person.name, liste: normalisiere(person.liste).id, stimmen: person.stimmen }))
        .sort((a, b) => (b.stimmen ?? 0) - (a.stimmen ?? 0)),
    });
  }

  return fertig("gemeinderat", "Gemeinde- und Stadtratswahlen", gemeinden, [
    "Bayerisches Landesamt für Statistik, GENESIS-Online, Tabellen 14431-005r und 14431-003r",
    ...Object.values(örtlicheQuellen).map((q) => q.quelle),
  ]);
}

/**
 * Kreistagswahl, je Gemeinde. Die einzige Wahl, bei der alle Gemeinden über
 * dieselben Listen abgestimmt haben — und damit die einzige, die sich zwischen
 * ihnen ohne Vorbehalt vergleichen lässt. Sitze fallen im Kreistag an, nicht in
 * der Gemeinde; hier steht deshalb nur der Stimmenanteil.
 */
function kreistag() {
  const gemeinden = Object.entries(kreistagQuellen).map(([ags, quelle]) => ({
    ags,
    name: quelle.gebiet.replace(/^\d{8} - /, ""),
    sitze: null,
    genauigkeit: "listen",
    quelle: "kreistagswahl.kreis-freising.de",
    wahlbeteiligung: quelle.kennzahlen.wahlbeteiligung,
    ergebnis: quelle.listen
      .map((l) => ({ ...normalisiere(l.name), quellname: l.name, sitze: null, stimmen: l.stimmen, anteil: l.anteil }))
      .sort((a, b) => b.anteil - a.anteil),
  }));

  return fertig("kreistag", "Kreistagswahl", gemeinden, [wahl.kreistag.replace("{ags}", "<ags>")]);
}

/** Ergebnis einer Gemeinde aus der amtlichen Statistik. */
function ausAmtlich(sitze, stimmen) {
  const gesamt = stimmen.Insgesamt;
  return Object.keys(sitze)
    .filter((spalte) => spalte !== "Insgesamt" && sitze[spalte] > 0)
    .map((spalte) => ({
      ...normalisiere(spalte),
      quellname: spalte,
      sitze: sitze[spalte],
      stimmen: stimmen[spalte] ?? null,
      anteil: runde((100 * (stimmen[spalte] ?? 0)) / gesamt),
    }));
}

/**
 * Ergebnis einer Gemeinde aus der Veröffentlichung ihrer Wahlleitung.
 *
 * Die Wahlleitungen zählen absolute Stimmen — bei bis zu vierzig Stimmen je
 * Wahlzettel sind das Zahlen, die sich zwischen Gemeinden nicht vergleichen
 * lassen. Die amtliche Statistik rechnet stattdessen mit gewichteten Stimmen und
 * gleicht dabei aus, dass eine Liste weniger Bewerber aufstellen kann als Sitze
 * zu vergeben sind. Damit die Karte eine einzige Einheit kennt, wird der Anteil
 * aus der Gemeindequelle auf die amtliche Gesamtsumme zurückgerechnet.
 */
function ausQuelle(quelle, gewichtetGesamt) {
  const anteile = new Map(quelle.listen.map((l) => [l.name, l]));
  return Object.entries(quelle.sitze).map(([name, sitze]) => {
    const anteil = anteile.get(name)?.anteil ?? null;
    return {
      ...normalisiere(name),
      quellname: name,
      sitze,
      stimmen: anteil === null ? null : Math.round((anteil / 100) * gewichtetGesamt),
      anteil,
      veraenderung: anteile.get(name)?.veraenderung ?? null,
    };
  });
}

/** Farben vergeben, Landkreissummen bilden, Kopfdaten anhängen. */
function fertig(ebene, titel, gemeinden, quellenangaben) {
  // Zwei Arten von Farbkonflikt: Listen im selben Gremium liegen in der
  // Sitzansicht Feld an Feld, und die stärkste Liste zweier benachbarter
  // Gemeinden bildet in der Übersicht zwei aneinanderstoßende Blöcke. Beides
  // muss sich unterscheiden — sonst sähen zwei verschiedene Wählergruppen wie
  // eine einzige über die Gemeindegrenze hinweg aus.
  const stärksteVon = new Map(gemeinden.map((g) => [g.ags, stärksteListe(g)]));
  const örtliche = faerbeÖrtliche([
    ...gemeinden.map((g) => g.ergebnis.map((e) => e.id)),
    ...nachbarschaft.map(([a, b]) => [stärksteVon.get(a), stärksteVon.get(b)].filter(Boolean)),
    // Und alles, was in der Übersicht stärkste Liste ist, steht in derselben
    // Legende untereinander — dort fällt eine doppelte Farbe erst recht auf.
    [...new Set(stärksteVon.values())].filter(Boolean),
  ]);

  const summen = new Map();
  for (const gemeinde of gemeinden) {
    for (const eintrag of gemeinde.ergebnis) {
      eintrag.farbe = farbe(eintrag.id, örtliche);
      const bisher = summen.get(eintrag.id) ?? { ...eintrag, sitze: 0, stimmen: 0, gemeinden: 0 };
      bisher.sitze += eintrag.sitze ?? 0;
      bisher.stimmen += eintrag.stimmen ?? 0;
      bisher.gemeinden += 1;
      summen.set(eintrag.id, bisher);
      delete eintrag.quellname;
      delete eintrag.name;
    }
  }

  const stimmenGesamt = [...summen.values()].reduce((a, l) => a + l.stimmen, 0);
  const listen = [...summen.values()]
    .map(({ anteil, ...l }) => ({ ...l, anteil: runde((100 * l.stimmen) / stimmenGesamt) }))
    .sort((a, b) => b.sitze - a.sitze || b.stimmen - a.stimmen);

  return {
    id: `${id}-${ebene}`,
    titel: `${titel} ${wahl.datum.slice(0, 4)}`,
    datum: wahl.datum,
    ebene,
    gebiet: { schluessel: wahl.kreis, name: wahl.kreisname, datensatz: wahl.datensatz },
    quellen: quellenangaben,
    listen,
    gemeinden,
  };
}

/**
 * data/listen/<id>.csv — ags;liste;sitze;anteil, eine Zeile je Liste. Ergänzt
 * die Gemeinden, für die es keine abrufbare Quelle gibt. Die Datei ist optional.
 */
async function lieseNachpflege() {
  let csv;
  try {
    csv = await readFile(new URL(`data/listen/${id}.csv`, wurzel), "utf8");
  } catch {
    return {};
  }

  const gemeinden = {};
  for (const zeile of csv.split(/\r?\n/).slice(1)) {
    if (!zeile.trim() || zeile.startsWith("#")) continue;
    const [ags, liste, sitze, anteil] = zeile.split(";").map((f) => f.trim());
    const eintrag = (gemeinden[ags] ??= { quelle: `data/listen/${id}.csv`, listen: [], sitze: {} });
    eintrag.sitze[liste] = Number(sitze);
    eintrag.listen.push({ name: liste, stimmen: null, anteil: anteil ? Number(anteil.replace(",", ".")) : null });
  }
  return gemeinden;
}

/** Die Liste mit den meisten Sitzen, bei Gleichstand nach Stimmenanteil. */
function stärksteListe(gemeinde) {
  return gemeinde.ergebnis.reduce(
    (a, b) =>
      (b.sitze ?? 0) > (a.sitze ?? 0) || ((b.sitze ?? 0) === (a.sitze ?? 0) && (b.anteil ?? 0) > (a.anteil ?? 0)) ? b : a,
    gemeinde.ergebnis[0]
  )?.id;
}

/**
 * Welche Gemeinden aneinandergrenzen. Die Verwaltungsgrenzen des BKG teilen sich
 * an gemeinsamen Kanten dieselben Stützpunkte, deshalb genügt der Vergleich der
 * Koordinaten; ein einzelner gemeinsamer Punkt wäre nur eine Ecke, erst zwei
 * sind eine Kante.
 */
async function lieseNachbarschaft() {
  const datei = new URL(`node_modules/hexagonalmap/data/${wahl.datensatz}/teile.geojson`, wurzel);
  const geo = JSON.parse(await readFile(datei, "utf8"));

  const punkte = geo.features.map((f) => {
    const menge = new Set();
    const teile = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const polygon of teile) for (const ring of polygon) for (const [x, y] of ring) menge.add(`${x},${y}`);
    return menge;
  });

  const paare = [];
  for (let i = 0; i < punkte.length; i++) {
    for (let j = i + 1; j < punkte.length; j++) {
      let gemeinsam = 0;
      for (const punkt of punkte[i]) if (punkte[j].has(punkt) && ++gemeinsam > 1) break;
      if (gemeinsam > 1) paare.push([geo.features[i].properties.ags, geo.features[j].properties.ags]);
    }
  }
  return paare;
}

/** Wertezeile einer GENESIS-Tabelle als Objekt über den Spaltennamen. */
function spalten(tabelle, zeile) {
  return Object.fromEntries(tabelle.spalten.map((s, i) => [s, zeile.werte[i]]));
}

function runde(v) {
  return Number.isFinite(v) ? Math.round(v * 10) / 10 : null;
}
