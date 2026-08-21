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
import {
  normalisiere,
  faerbeÖrtliche,
  faerbeFreieWaehler,
  gruppeVon,
  gruppenfarbe,
  farbe,
  PARTEIEN,
  SAMMEL,
} from "../src/kern/listen.js";

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
    // Die Gewählten führen nur das Kürzel; der ausgeschriebene Name steht in der
    // Übersichtstabelle derselben Seite.
    const langVon = new Map((örtlich?.listen ?? []).map((l) => [l.name, l.lang]));

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
        .map((person) => ({
          name: person.name,
          liste: normalisiere(person.liste, langVon.get(person.liste)).id,
          stimmen: person.stimmen,
        }))
        .sort((a, b) => (b.stimmen ?? 0) - (a.stimmen ?? 0)),
    });
  }

  const datensatz = fertig("gemeinderat", "Gemeinde- und Stadtratswahlen", gemeinden, [
    "Bayerisches Landesamt für Statistik, GENESIS-Online, Tabellen 14431-005r und 14431-003r",
    ...Object.values(örtlicheQuellen).map((q) => q.quelle),
  ]);
  return { ...datensatz, hinweise: [freieWaehlerHinweis(datensatz)].filter(Boolean) };
}

/**
 * Die Karte fasst die Freien Wähler zusammen, die amtliche Statistik tut das
 * nicht — und der Unterschied ist groß genug, dass er dastehen muss.
 *
 * Die Freien Wähler sind keine Partei mit Ortsvereinen, sondern ein Verband
 * eigenständiger Wählergemeinschaften. Für die Statistik heißt das: eine
 * örtliche Wählergemeinschaft zählt als Wählergruppe, ein gemeinsamer
 * Wahlvorschlag mit der Landesvereinigung als gemeinsamer Wahlvorschlag. Unter
 * „FREIE WÄHLER Bayern" bleibt fast nichts übrig.
 */
function freieWaehlerHinweis(datensatz) {
  const gruppe = datensatz.listen.find((l) => l.id === "FW");
  if (!gruppe) return null;

  const spalte = sitzTabelle.spalten.findIndex((s) => /^FREIE WÄHLER/i.test(s));
  const amtlich = sitzTabelle.zeilen
    .filter((z) => z.schluessel.length === 8)
    .reduce((a, z) => a + (z.werte[spalte] ?? 0), 0);
  if (amtlich >= gruppe.sitze) return null;

  return {
    liste: "FW",
    text:
      `Die Freien Wähler sind hier als eine Liste gezählt: ${gruppe.sitze} Sitze aus ` +
      `${gruppe.teile?.length ?? 0} örtlichen Wahlvorschlägen, die den Namen führen. Die amtliche Statistik ` +
      `zählt anders — unter „FREIE WÄHLER Bayern“ stehen dort nur ${amtlich} Sitze. Die übrigen sind ` +
      `eigenständige Wählergemeinschaften und liegen in den Kategorien „Wählergruppen“ und „Gemeinsame ` +
      `Wahlvorschläge“. Beides ist richtig; die Zahlen sind nur nicht dasselbe.`,
  };
}

/**
 * Kreistagswahl, je Gemeinde. Die einzige Wahl, bei der alle Gemeinden über
 * dieselben Listen abgestimmt haben — und damit die einzige, die sich zwischen
 * ihnen ohne Vorbehalt vergleichen lässt. Sitze fallen im Kreistag an, nicht in
 * der Gemeinde; hier steht deshalb nur der Stimmenanteil.
 */
function kreistag() {
  const gemeinden = Object.entries(kreistagQuellen).map(([ags, quelle]) => {
    // Gewinn und Verlust kommen aus der Vergleichsgrafik, nicht aus der Spalte
    // daneben — siehe leseVergleich(). Geprüft wird beides gegeneinander: weicht
    // der Anteil der Grafik vom Anteil der Tabelle ab, stimmt eine Annahme nicht.
    const vorwahl = new Map((quelle.vergleich?.listen ?? []).map((l) => [l.name, l]));
    for (const l of quelle.listen) {
      const v = vorwahl.get(l.name);
      if (v && Math.abs(v.anteil - l.anteil) > 0.15) {
        abweichungen.push(`${ags} Kreistag ${l.name}: Grafik ${v.anteil} %, Tabelle ${l.anteil} %`);
      }
    }

    return {
      ags,
      name: quelle.gebiet.replace(/^\d{8} - /, ""),
      sitze: null,
      genauigkeit: "listen",
      quelle: wahl.kreistag.replace("{ags}", ags),
      wahlbeteiligung: quelle.kennzahlen.wahlbeteiligung,
      ergebnis: quelle.listen
        .map((l) => ({
          ...normalisiere(l.name, l.lang),
          quellname: l.name,
          lang: l.lang ?? null,
          sitze: null,
          stimmen: l.stimmen,
          anteil: l.anteil,
          vorher: vorwahl.get(l.name)?.vorher ?? null,
          veraenderung: vorwahl.get(l.name)?.veraenderung ?? null,
        }))
        .sort((a, b) => b.anteil - a.anteil),
    };
  });

  const vergleichswahl = Object.values(kreistagQuellen).find((q) => q.vergleich)?.vergleich.vergleichswahl ?? null;
  const datensatz = fertig("kreistag", "Kreistagswahl", gemeinden, [wahl.kreistag.replace("{ags}", "<ags>")]);
  return { ...datensatz, vergleichswahl };
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
      ...normalisiere(name, anteile.get(name)?.lang),
      quellname: name,
      lang: anteile.get(name)?.lang ?? null,
      sitze,
      stimmen: anteil === null ? null : Math.round((anteil / 100) * gewichtetGesamt),
      anteil,
      // Gewinn und Verlust stehen hier bewusst nicht. Die Gemeindeseiten führen
      // zwar eine Spalte dafür, aber keine Vergleichsgrafik, an der sie sich
      // prüfen ließe — und auf den Kreistagsseiten derselben Software weicht
      // genau diese Spalte bei sechs von neun Listen vom tatsächlichen Wert ab.
      // Eine Zahl, die man nicht nachrechnen kann, ist hier keine Zahl.
    };
  });
}

/** Farben vergeben, gruppieren, Landkreissummen bilden, Kopfdaten anhängen. */
function fertig(ebene, titel, gemeinden, quellenangaben) {
  const gremien = gemeinden.map((g) => g.ergebnis.map((e) => e.id));
  const familie = new Set();
  for (const gemeinde of gemeinden) {
    for (const eintrag of gemeinde.ergebnis) if (eintrag.familie === "FW") familie.add(eintrag.id);
  }

  // Erst die Einzelsummen, denn die Gruppenzuordnung hängt an Sitzen und
  // Gemeindezahl — und erst die Gruppe entscheidet, welche Farbe eine Liste
  // bekommt. Was in einer Gruppe aufgeht, trägt deren Farbe, sonst widersprächen
  // sich Karte und Legende: die Legende zeigte ein Grau für „Gemeinsame
  // Wahlvorschläge“, die Karte dafür ein Violett.
  const einzeln = new Map();
  for (const gemeinde of gemeinden) {
    for (const eintrag of gemeinde.ergebnis) {
      const bisher = einzeln.get(eintrag.id) ?? { ...eintrag, sitze: 0, stimmen: 0, gemeinden: 0 };
      bisher.sitze += eintrag.sitze ?? 0;
      bisher.stimmen += eintrag.stimmen ?? 0;
      bisher.gemeinden += 1;
      einzeln.set(eintrag.id, bisher);
    }
  }
  const gruppeFür = new Map([...einzeln.values()].map((l) => [l.id, gruppeVon(l)]));

  const fwFarben = faerbeFreieWaehler(gremien, familie);
  const vorbelegt = {};
  for (const [id, gruppe] of gruppeFür) {
    if (familie.has(id)) vorbelegt[id] = fwFarben[id];
    else if (gruppenfarbe(gruppe)) vorbelegt[id] = gruppenfarbe(gruppe);
  }

  // Zwei Arten von Farbkonflikt: Listen im selben Gremium liegen in der
  // Sitzansicht Feld an Feld, und die stärkste Liste zweier benachbarter
  // Gemeinden bildet in der Übersicht zwei aneinanderstoßende Blöcke. Beides
  // muss sich unterscheiden — sonst sähen zwei verschiedene Wählergruppen wie
  // eine einzige über die Gemeindegrenze hinweg aus.
  const stärksteVon = new Map(gemeinden.map((g) => [g.ags, stärksteListe(g)]));
  const örtliche = faerbeÖrtliche(
    {
      hart: [
        ...gremien,
        ...nachbarschaft.map(([a, b]) => [stärksteVon.get(a), stärksteVon.get(b)].filter(Boolean)),
      ],
      // Was in der Übersicht stärkste Liste ist, steht in derselben Legende
      // untereinander. Schön wäre eine eigene Farbe, nötig ist sie nicht — der
      // Name steht daneben.
      weich: [[...new Set(stärksteVon.values())].filter(Boolean)],
    },
    vorbelegt
  );

  const farbeVon = (id) => vorbelegt[id] ?? farbe(id, örtliche);
  for (const gemeinde of gemeinden) for (const eintrag of gemeinde.ergebnis) eintrag.farbe = farbeVon(eintrag.id);
  for (const l of einzeln.values()) l.farbe = farbeVon(l.id);

  pruefeOrangetopf(gemeinden, fwFarben);
  pruefeNachbarfarben(gemeinden, stärksteVon, farbeVon);

  // Die Gruppen selbst. Sie tragen die Kreislegende; die Gemeinden
  // behalten ihre Einzellisten, denn dort ist der Name die Information.
  const gruppen = new Map();
  for (const gemeinde of gemeinden) {
    for (const eintrag of gemeinde.ergebnis) {
      const gruppe = gruppeFür.get(eintrag.id);
      eintrag.gruppe = gruppe;
      const bisher =
        gruppen.get(gruppe) ??
        ({ ...einzeln.get(eintrag.id), id: gruppe, ...beschreibeGruppe(gruppe, einzeln.get(eintrag.id)), sitze: 0, stimmen: 0, orte: new Set(), teile: new Map(), unbenannt: 0 });
      bisher.sitze += eintrag.sitze ?? 0;
      bisher.stimmen += eintrag.stimmen ?? 0;
      bisher.orte.add(gemeinde.ags);
      // Woraus die Gruppe besteht. Was in der amtlichen Statistik im Sammeltopf
      // liegt, hat keinen Listennamen, den man nennen könnte — das wird gezählt,
      // nicht benannt, damit die Legende nicht mehr behauptet, als sie weiß.
      // Eine Parteispalte dagegen ist benannt, auch wenn sie aus GENESIS kommt.
      if (eintrag.art === "sammel") bisher.unbenannt += eintrag.sitze ?? 0;
      else bisher.teile.set(eintrag.id, (bisher.teile.get(eintrag.id) ?? 0) + (eintrag.sitze ?? 0));
      gruppen.set(gruppe, bisher);
      delete eintrag.quellname;
      delete eintrag.name;
      delete eintrag.familie;
      delete eintrag.teile;
    }
  }

  const stimmenGesamt = [...gruppen.values()].reduce((a, l) => a + l.stimmen, 0);
  const listen = [...gruppen.values()]
    .map(({ anteil, orte, teile, unbenannt, quellname, lang, veraenderung, ...l }) => ({
      ...l,
      gemeinden: orte.size,
      anteil: runde((100 * l.stimmen) / stimmenGesamt),
      // Die Legende soll auf Nachfrage sagen können, wer sich hinter „Freie
      // Wähler" verbirgt — aber nur, wo es mehr als einen Namen zu nennen gibt.
      ...(teile.size > 1 || unbenannt
        ? { teile: [...teile].sort((a, b) => b[1] - a[1]).map(([name, sitze]) => ({ name, sitze })) }
        : {}),
      ...(unbenannt ? { unbenannt } : {}),
    }))
    .sort((a, b) => b.sitze - a.sitze || b.stimmen - a.stimmen);

  return {
    id: `${id}-${ebene}`,
    titel: `${titel} ${wahl.datum.slice(0, 4)}`,
    datum: wahl.datum,
    ebene,
    gebiet: { schluessel: wahl.kreis, name: wahl.kreisname, datensatz: wahl.datensatz },
    quellen: quellenangaben,
    herkunft: herkunft(gemeinden),
    listen,
    gemeinden,
  };
}

/** Name, Art und Farbe einer Gruppe. Eigenständige Listen bleiben, was sie sind. */
function beschreibeGruppe(gruppe, vorlage) {
  if (gruppe === "FW") return { name: PARTEIEN.FW.name, art: "familie", farbe: PARTEIEN.FW.farbe };
  if (SAMMEL[gruppe]) return { name: SAMMEL[gruppe].name, art: "sammel", farbe: SAMMEL[gruppe].farbe };
  return { name: vorlage.name, art: vorlage.art, farbe: vorlage.farbe };
}

/**
 * Die zweite Stufe des FW-Orange liegt der ÖDP nahe — näher, als zwei Farben
 * nebeneinander liegen dürfen. Im Landkreis Freising stört das nicht, weil
 * beide nirgends im selben Rat sitzen. Das ist aber eine Eigenschaft dieser
 * Daten und keine des Verfahrens, also wird sie geprüft.
 */
function pruefeOrangetopf(gemeinden, fwFarben) {
  const gestuft = new Set(Object.entries(fwFarben).filter(([, f]) => f !== PARTEIEN.FW.farbe).map(([id]) => id));
  for (const gemeinde of gemeinden) {
    const ids = gemeinde.ergebnis.map((e) => e.id);
    if (ids.includes("ÖDP") && ids.some((i) => gestuft.has(i))) {
      abweichungen.push(`${gemeinde.ags} ${gemeinde.name}: zweite FW-Stufe trifft auf die ÖDP — die Farben liegen zu nah beieinander`);
    }
  }
}

/**
 * Zwei aneinandergrenzende Gemeinden, deren stärkste Listen verschieden sind,
 * aber gleich aussehen, verschmelzen in der Übersicht zu einem Klumpen — die
 * Karte behauptet dann eine Mehrheit, die es nicht gibt. Vier Farben für
 * einunddreißig örtliche Listen sind knapp genug, dass die Graphfärbung
 * scheitern kann; deshalb wird das Ergebnis geprüft und nicht angenommen.
 */
function pruefeNachbarfarben(gemeinden, stärksteVon, farbeVon) {
  const nach = new Map(gemeinden.map((g) => [g.ags, g]));

  for (const [a, b] of nachbarschaft) {
    const [x, y] = [stärksteVon.get(a), stärksteVon.get(b)];
    if (!x || !y || x === y) continue;
    if (farbeVon(x) !== farbeVon(y)) continue;
    abweichungen.push(
      `${nach.get(a)?.name} (${x}) und ${nach.get(b)?.name} (${y}) grenzen aneinander und tragen dieselbe Farbe ${farbeVon(x)}`
    );
  }
}

/**
 * Welche Zahl aus welcher Quelle stammt. Die Sitzverteilung ist überall
 * amtlich gedeckt — sie wird gegen GENESIS geprüft, sonst bricht der Lauf ab.
 * Listennamen, Gewählte und Veränderungen gibt es nur dort, wo die Wahlleitung
 * der Gemeinde sie selbst veröffentlicht.
 */
function herkunft(gemeinden) {
  const nach = (art) => gemeinden.filter((g) => g.genauigkeit === art);
  const sitze = (menge) => menge.reduce((a, g) => a + (g.sitze ?? 0), 0);
  return {
    listen: { gemeinden: nach("listen").length, sitze: sitze(nach("listen")) },
    sammel: { gemeinden: nach("sammel").length, sitze: sitze(nach("sammel")) },
    veraenderung: gemeinden.filter((g) => g.ergebnis.some((e) => e.veraenderung != null)).length,
    gewaehlte: gemeinden.filter((g) => g.gewaehlte?.length).length,
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
