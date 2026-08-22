// Abruf und Auswertung der Quellen. Jede Quelle liefert dieselbe Struktur:
// je Gebiet ein Eintrag mit Kennzahlen und einem Ergebnis je Wahlvorschlag.
//
// GENESIS ist die amtliche Vollquelle. Sie kennt jede Gemeinde, aber nur 48
// feste Wahlvorschlags-Kategorien: örtliche Listen fallen in „Gemeinsame
// Wahlvorschläge" und „Wählergruppen". Die Wahlleitungen der Gemeinden nennen
// die Listen beim Namen, decken aber jeweils nur ihr eigenes Gebiet ab.

const GENESIS = "https://www.statistikdaten.bayern.de/genesis/online";

/**
 * Ruft eine GENESIS-Tabelle als CSV ab. Ohne Anmeldung, ohne Sitzung.
 *
 * @param {string} tabelle   Tabellencode, etwa "14431-005r"
 * @param {string} schluessel Regionalschlüssel, "*" am Ende für alles darunter
 * @param {string} ebene     GEMEIN | KREISE | REGBEZ
 */
export async function genesis(tabelle, schluessel, ebene = "GEMEIN") {
  const url =
    `${GENESIS}?language=de&sequenz=tabelleDownload&format=csv&selectionname=${tabelle}` +
    `&regionalmerkmal=${ebene}&regionalschluessel=${schluessel}` +
    `&sachmerkmal=PARTG2&sachschluessel=*&zeitscheiben=1`;

  const antwort = await fetch(url);
  if (!antwort.ok) throw new Error(`GENESIS ${tabelle}: HTTP ${antwort.status}`);
  // GENESIS liefert Latin-1, unabhängig davon, was der Content-Type behauptet.
  return new TextDecoder("iso-8859-1").decode(await antwort.arrayBuffer());
}

/**
 * Zerlegt eine GENESIS-CSV. Der Kopf ist mehrzeilig und in der Höhe nicht
 * festgelegt, deshalb wird er von den Datenzeilen her gesucht: die letzte
 * Zeile davor, die mit zwei Trennzeichen beginnt, trägt die Spaltennamen.
 *
 * @returns {{ stichtag: string, spalten: string[], zeilen: Array<{schluessel, name, werte}> }}
 */
export function leseGenesis(csv) {
  const zeilen = csv.split(/\r?\n/);
  const istDaten = (z) => /^\d{3,9};/.test(z);
  const erste = zeilen.findIndex(istDaten);
  if (erste < 0) throw new Error("Keine Datenzeilen gefunden.");

  let kopf = -1;
  for (let i = erste - 1; i >= 0; i--) {
    if (zeilen[i].startsWith(";;")) {
      kopf = i;
      break;
    }
  }
  if (kopf < 0) throw new Error("Keine Kopfzeile gefunden.");

  const spalten = zeilen[kopf].split(";").slice(2);
  const stichtag = zeilen
    .slice(0, kopf)
    .reverse()
    .find((z) => /^\d{2}\.\d{2}\.\d{4};?$/.test(z.replace(/;+$/, "")))
    ?.replace(/;+$/, "");

  const daten = [];
  for (let i = erste; i < zeilen.length && istDaten(zeilen[i]); i++) {
    const felder = zeilen[i].split(";");
    daten.push({
      schluessel: felder[0].trim(),
      name: felder[1].trim(),
      // „-" heißt: nicht angetreten. Das ist etwas anderes als null Stimmen und
      // bleibt deshalb als null erhalten, statt zu 0 zu werden.
      werte: felder.slice(2).map((v) => (v.trim() === "-" ? null : Number(v.replace(/\./g, "").replace(",", ".")))),
    });
  }

  return { stichtag: stichtag ? datum(stichtag) : null, spalten, zeilen: daten };
}

const datum = (d) => d.split(".").reverse().join("-");

/**
 * Ergebnistabelle einer Wahlleitung im Format der AKDB beziehungsweise elect iT.
 * Die Seiten liefern fertiges HTML: der CSV-Knopf dort baut seine Datei erst
 * im Browser aus derselben Tabelle.
 *
 * @returns {{ gebiet: string, listen: Array<{name, stimmen, anteil, veraenderung}>, kennzahlen: object }}
 */
export function leseAkdb(html) {
  const uebersicht = [...html.matchAll(/<table[\s\S]*?<\/table>/g)]
    .map((m) => m[0])
    .find((t) => /^(Übersicht|Stimmen tabellarisch)/.test(titel(t)));
  if (!uebersicht) throw new Error("Keine Übersichtstabelle gefunden.");

  const gebiet = text(html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? "");
  const KENNZAHLEN = { Stimmberechtigte: "stimmberechtigte", Wähler: "waehler", "Gültige Stimmen": "gueltige" };

  const listen = [];
  const kennzahlen = {};
  for (const zeile of ohneWaehlerbenannte([...uebersicht.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((m) => m[0]))) {
    const felder = [...zeile.matchAll(/<(?:th|td)[\s\S]*?<\/(?:th|td)>/g)].map((m) => text(m[0]));
    if (felder.length < 3 || !/\d/.test(felder[1])) continue;

    const [bezeichnung, anzahl, anteil, veraenderung] = felder;
    if (KENNZAHLEN[bezeichnung]) {
      kennzahlen[KENNZAHLEN[bezeichnung]] = zahl(anzahl);
      if (bezeichnung === "Wähler") kennzahlen.wahlbeteiligung = zahl(anteil);
    } else if (!/Ungültige/.test(bezeichnung)) {
      // Hinter dem Kürzel steht der ausgeschriebene Name im abbr-Titel. Ohne ihn
      // wäre „FWI" nicht von „FWO" zu unterscheiden, und nicht zu entscheiden,
      // ob beide zu den Freien Wählern gehören.
      const lang = text(zeile.match(/<abbr title="([^"]*)"/)?.[1] ?? "") || null;
      listen.push({
        name: bezeichnung,
        lang: lang === bezeichnung ? null : lang,
        stimmen: zahl(anzahl),
        anteil: zahl(anteil),
        veraenderung: zahl(veraenderung),
      });
    }
  }

  return { gebiet, listen, kennzahlen };
}

/**
 * Das Ergebnis der Vergleichswahl, aus der Vergleichsgrafik derselben Seite.
 *
 * Warum nicht aus der Spalte „Gewinn und Verlust in %-Punkten" der
 * Übersichtstabelle: die stimmt nicht. In Allershausen etwa führt die Tabelle
 * für die AfD −16,8 Punkte, während dieselbe Seite in der Grafik 4,1 % für 2020
 * und 10,4 % für 2026 ausweist, also +6,3. Für CSU, SPD und Die Linke passt
 * die Spalte, für die übrigen sechs Listen nicht. Die Grafik trägt beide
 * Ergebnisse als Zahl; daraus lässt sich die Veränderung selbst ausrechnen und
 * gegen die Anteile prüfen, statt einer Spalte zu glauben.
 *
 * @returns {{ vergleichswahl: string, listen: Array<{name, anteil, vorher, veraenderung}> }|null}
 */
export function leseVergleich(html) {
  for (const treffer of html.matchAll(/data-chartdata="([^"]*)"\s+data-chartoptions="([^"]*)"/g)) {
    const titel = entwerte(treffer[2]).match(/"title":"([^"]*)"/)?.[1] ?? "";
    if (!/^Vergleich\s*[-–]\s*\S/.test(titel)) continue;

    const reihen = JSON.parse(entwerte(treffer[1])).dataSeries ?? [];
    const [jetzt, vorher] = reihen.map((r) => r.dataSets);
    if (!jetzt || !vorher) continue;

    const alt = new Map(vorher.map((d) => [d.label, d.value]));
    return {
      vergleichswahl: titel.replace(/^Vergleich\s*[-–]\s*/, ""),
      listen: jetzt.map((d) => ({
        name: d.label,
        anteil: runde(d.value),
        vorher: alt.has(d.label) ? runde(alt.get(d.label)) : null,
        // Wer neu antritt, hat keinen Vorwert: das ist etwas anderes als null
        // Veränderung und bleibt deshalb leer.
        veraenderung: alt.has(d.label) ? runde(d.value - alt.get(d.label)) : null,
      })),
    };
  }
  return null;
}

const runde = (v) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : null);

/** Entschlüsselt einen Attributwert, ohne ihn sonst anzurühren. */
function entwerte(wert) {
  return wert
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&(\w+);/g, (m, n) => ENTITAETEN[n] ?? m);
}

/**
 * Nimmt die wählerbenannten Personen aus der Übersicht. Wo nur ein einziger
 * Wahlvorschlag antritt, in Hörgertshausen einer für alle zwölf Sitze,
 * schreiben Wählerinnen und Wähler eigene Namen auf den Zettel. Die Software
 * führt jeden davon als eigene Zeile, unmittelbar vor der Summenzeile der
 * Gruppe. Wahlvorschläge sind das nicht: sie bekämen keinen Sitz und stünden
 * mit drei Stimmen als eigene Liste in der Legende.
 */
function ohneWaehlerbenannte(zeilen) {
  const summe = zeilen.findIndex((z) => text(z).startsWith("Wählerbenannte Personen"));
  if (summe < 0) return zeilen;

  // Die Einzelnamen tragen dasselbe neutrale Listenzeichen wie ihre Summenzeile,
  // echte Wahlvorschläge ihre eigene Farbe. Daran hängt die Blockgrenze.
  const zeichen = (z) => z.match(/partei__farbe[^>]*color:\s*(#[0-9a-fA-F]{3,6})/)?.[1]?.toLowerCase() ?? null;
  const neutral = zeichen(zeilen[summe]);
  let erste = summe;
  while (neutral && erste > 0 && zeichen(zeilen[erste - 1]) === neutral) erste--;

  return [...zeilen.slice(0, erste), ...zeilen.slice(summe + 1)];
}

/**
 * Die Gewählten, je Eintrag mit Wahlvorschlag und Stimmenzahl. Die Software tut
 * das in zwei Fassungen: entweder eine Tabelle „Gewählte" über alle Listen, oder
 * je Liste eine Kandidatentabelle mit einer Spalte Gewählt/Nachrücker.
 *
 * @returns {Array<{ name: string, liste: string, stimmen: number|null }>}
 */
export function leseGewaehlte(html) {
  const tabellen = [...html.matchAll(/<table[\s\S]*?<\/table>/g)];
  const gewaehlte = [];

  const gesamt = tabellen.find((m) => titel(m[0]).startsWith("Gewählte"));
  if (gesamt) {
    const zeilen = [...gesamt[0].matchAll(/<tr[\s\S]*?<\/tr>/g)].map((m) =>
      [...m[0].matchAll(/<(t[hd])[\s\S]*?<\/\1>/g)].map((c) => text(c[0]))
    );
    // Die Spalten stehen nicht überall an derselben Stelle, manche Fassungen
    // schieben eine leere Spalte für das Listenzeichen dazwischen.
    const kopf = zeilen.findIndex((z) => z.some((f) => /^(Partei|Wahlvorschlag|Liste)$/.test(f)));
    if (kopf < 0) throw new Error("Keine Spalte mit dem Wahlvorschlag gefunden.");
    const spalte = {
      name: zeilen[kopf].findIndex((f) => /^(Bewerber|Name)/.test(f)),
      liste: zeilen[kopf].findIndex((f) => /^(Partei|Wahlvorschlag|Liste)$/.test(f)),
      stimmen: zeilen[kopf].findIndex((f) => /^Stimmen$/.test(f)),
    };

    for (const zeile of zeilen.slice(kopf + 1)) {
      const liste = zeile[spalte.liste];
      if (!liste) continue;
      gewaehlte.push({
        name: zeile[spalte.name] ?? "",
        liste,
        stimmen: zahl(zeile[spalte.stimmen]),
      });
    }
    return gewaehlte;
  }

  for (const tabelle of tabellen) {
    // Dieselbe Tabelle heißt je nach Fassung „Kandidatenstimmen" oder
    // „Ergebnisse aller Bewerberinnen und Bewerber".
    if (!/^(Kandidatenstimmen|Ergebnisse aller Bewerber)/.test(titel(tabelle[0]))) continue;
    // Der Listenname steht nicht in der Tabelle, sondern in der Überschrift davor.
    const davor = html.slice(Math.max(0, tabelle.index - 1500), tabelle.index);
    const liste = text([...davor.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/g)].at(-1)?.[1] ?? "");
    if (!liste) continue;

    const zeilen = [...tabelle[0].matchAll(/<tr[\s\S]*?<\/tr>/g)].map((m) =>
      [...m[0].matchAll(/<(t[hd])[\s\S]*?<\/\1>/g)].map((c) => text(c[0]))
    );
    // Die Zeilen mischen th und td: der Name steht je nach Fassung im einen
    // oder im anderen. Deshalb über die Kopfzeile gehen statt über feste Stellen.
    const kopf = zeilen.findIndex((z) => z.includes("Gewählt"));
    if (kopf < 0) continue;
    const spalte = {
      name: zeilen[kopf].findIndex((f) => /^Name/.test(f)),
      stimmen: zeilen[kopf].findIndex((f) => /^Stimmen$/.test(f)),
      status: zeilen[kopf].indexOf("Gewählt"),
    };

    for (const zeile of zeilen.slice(kopf + 1)) {
      if (zeile[spalte.status] !== "Gewählt") continue;
      gewaehlte.push({ name: zeile[spalte.name] ?? "", liste, stimmen: zahl(zeile[spalte.stimmen]) });
    }
  }

  if (!gewaehlte.length) throw new Error("Keine Gewählten gefunden.");
  return gewaehlte;
}

/** Sitze je Wahlvorschlag, aus den Gewählten gezählt. */
export function zaehleSitze(gewaehlte) {
  const sitze = {};
  for (const person of gewaehlte) sitze[person.liste] = (sitze[person.liste] ?? 0) + 1;
  return sitze;
}

/** Überschrift einer Tabelle. Sie steht als h3 innerhalb der caption. */
function titel(tabelle) {
  const caption = tabelle.match(/<caption[\s\S]*?<\/caption>/)?.[0] ?? "";
  return text(caption.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/)?.[1] ?? "");
}

// prettier-ignore
const ENTITAETEN = {
  auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß",
  amp: "&", nbsp: " ", quot: '"', lt: "<", gt: ">", ndash: "–", mdash: "—", shy: "",
};

function text(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&(\w+);/g, (m, n) => ENTITAETEN[n] ?? m)
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/\s+/g, " ")
    .trim();
}

/** Deutsche Zahlschreibweise; „-" und Leeres werden zu null. */
function zahl(s) {
  if (s === undefined) return null;
  const rein = String(s).replace(/[%\s]/g, "").replace(/\./g, "").replace(",", ".");
  if (!rein || rein === "-") return null;
  const n = Number(rein);
  return Number.isFinite(n) ? n : null;
}
