// Die Parser gegen die abgelegten Seiten.
//
// Sie sind die fragilste Stelle im ganzen Ablauf: sechs HTML-Varianten von
// sechs Wahlsoftware-Installationen, und keine davon hat je versprochen, so zu
// bleiben. Geprüft wird nicht das Wahlergebnis (das prüft baue.mjs gegen die
// amtliche Statistik), sondern dass die Adapter die Struktur noch finden.
//
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { leseAkdb, leseGewaehlte, leseGenesis, leseVergleich, zaehleSitze } from "../scripts/quellen.mjs";

const WAHL = "kommunalwahl2026-freising";
const quellen = new URL(`../data/quellen/${WAHL}/`, import.meta.url);
const seite = (name) => readFileSync(new URL(`seiten/${name}`, quellen), "utf8");
const hat = (name) => existsSync(new URL(`seiten/${name}`, quellen));

/**
 * Je eine Gemeinde für jede Bauart, die im Landkreis vorkommt. Kommt eine
 * siebte dazu, gehört sie hierher, sonst merkt es niemand, wenn sie bricht.
 */
const BAUARTEN = [
  { was: "AKDB, Tabelle „Gewählte“", ags: "09178143", ort: "Moosburg a.d.Isar", sitze: 24, listen: 7 },
  { was: "AKDB, Kandidatentabellen je Liste", ags: "09178124", ort: "Stadt Freising", sitze: 40, listen: 10 },
  { was: "eigene Installation der Gemeinde", ags: "09178144", ort: "Markt Nandlstadt", sitze: 20, listen: 6 },
  { was: "Verwaltungsgemeinschaft", ags: "09178142", ort: "Mauern", sitze: 16, listen: 5 },
  { was: "Tabellen „Ergebnisse aller Bewerber“", ags: "09178133", ort: "Gemeinde Hohenkammer", sitze: 14, listen: 4 },
  { was: "einzige Liste, mit wählerbenannten Personen", ags: "09178132", ort: "Hörgertshausen", sitze: 12, listen: 1 },
];

for (const bauart of BAUARTEN) {
  const datei = `gemeinde-${bauart.ags}.html`;
  test(`${bauart.ort}: ${bauart.was}`, { skip: hat(datei) ? false : "kein Abzug abgelegt" }, () => {
    const html = seite(datei);

    const { gebiet, listen, kennzahlen } = leseAkdb(html);
    assert.equal(gebiet, bauart.ort);
    assert.equal(listen.length, bauart.listen);
    assert.ok(kennzahlen.stimmberechtigte > 0, "Stimmberechtigte gelesen");
    assert.ok(
      listen.every((l) => typeof l.anteil === "number"),
      "jede Liste hat einen Stimmenanteil"
    );

    const gewaehlte = leseGewaehlte(html);
    assert.equal(gewaehlte.length, bauart.sitze);
    assert.equal(
      Object.values(zaehleSitze(gewaehlte)).reduce((a, b) => a + b, 0),
      bauart.sitze
    );
    assert.ok(
      gewaehlte.every((p) => p.name && p.liste),
      "jeder Sitz hat Name und Liste"
    );

    // Jede gewählte Person muss zu einer Liste aus der Übersicht gehören. Ohne
    // das liefe eine Umbenennung in der Quelle unbemerkt durch.
    const bekannt = new Set(listen.map((l) => l.name));
    for (const person of gewaehlte) assert.ok(bekannt.has(person.liste), `unbekannte Liste: ${person.liste}`);
  });
}

test("Hörgertshausen: wählerbenannte Personen sind keine Wahlvorschläge", { skip: hat("gemeinde-09178132.html") ? false : "kein Abzug abgelegt" }, () => {
  const { listen } = leseAkdb(seite("gemeinde-09178132.html"));
  assert.deepEqual(
    listen.map((l) => l.name),
    ["WH"]
  );
});

test("Moosburg: der ausgeschriebene Name kommt aus dem abbr-Titel", { skip: hat("gemeinde-09178143.html") ? false : "kein Abzug abgelegt" }, () => {
  const { listen } = leseAkdb(seite("gemeinde-09178143.html"));
  const fw = listen.find((l) => l.name.startsWith("FREIE WÄHLER"));
  assert.equal(fw.lang, "FREIE WÄHLER Bayern, Der Freie Wähler Moosburg e.V.");
});

test("Kreistag: die Veränderung stammt aus der Vergleichsgrafik, nicht aus der Tabellenspalte", { skip: hat("kreistag-09178113.html") ? false : "kein Abzug abgelegt" }, () => {
  const html = seite("kreistag-09178113.html");
  const vergleich = leseVergleich(html);
  assert.equal(vergleich.vergleichswahl, "Kreistagswahl 2020");

  const afd = vergleich.listen.find((l) => l.name === "AfD");
  assert.equal(afd.anteil, 10.4);
  assert.equal(afd.vorher, 4.1);
  assert.equal(afd.veraenderung, 6.3);

  // Genau hier steckt der Grund für leseVergleich(): die Spalte der
  // Übersichtstabelle führt für dieselbe Liste -16,8 Punkte.
  const spalte = leseAkdb(html).listen.find((l) => l.name === "AfD");
  assert.notEqual(spalte.veraenderung, afd.veraenderung);

  // Der Anteil muss in beiden Quellen derselbe sein, sonst passen Grafik und
  // Tabelle nicht zusammen und keiner von beiden ist zu trauen.
  assert.ok(Math.abs(spalte.anteil - afd.anteil) < 0.15);
});

test("GENESIS: mehrzeiliger Kopf, „-“ bleibt null", () => {
  const { spalten, zeilen, stichtag } = leseGenesis(readFileSync(new URL("genesis-sitze.csv", quellen), "utf8"));
  assert.equal(stichtag, "2026-03-08");
  assert.equal(spalten[0], "Insgesamt");

  const gemeinden = zeilen.filter((z) => z.schluessel.length === 8);
  assert.equal(gemeinden.length, 24);
  assert.equal(
    gemeinden.reduce((a, z) => a + z.werte[0], 0),
    440
  );

  // Wo eine Partei nicht angetreten ist, steht ein Strich. Das ist etwas
  // anderes als null Sitze und muss null bleiben, nicht 0 werden.
  const wang = gemeinden.find((z) => z.name.trim() === "Wang");
  assert.equal(wang.werte[1], null, "CSU in Wang nicht angetreten");
});
