// Welche Farbe wohin gehört. Gezeichnet wird von hexagonalmap.
//
// Die Arbeitsteilung: die Bibliothek weiß, wie man ein Sechseckraster malt,
// dieses Modul weiß, was eine Wahl bedeutet. Die Geometrie kommt fertig aus
// data/kartogramm/<id>.json, also wird hier weder projiziert noch ein
// Transportproblem gelöst.
//
// Vier Ansichten über derselben Geometrie:
//   stärkste     je Gemeinde eine Farbe, die Liste mit den meisten Sitzen
//   sitze        je Feld eine Farbe, nach der Aufteilung im Kartogramm
//   liste        eine Liste ausgewählt, ihre Stärke als Sättigung der Fläche
//   veränderung  dieselbe Liste, Gewinn und Verlust seit der Wahl davor

import { toSVG } from "hexagonalmap/svg";
import { wert } from "./skala.js";
import { mische, helligkeit } from "./farbe.js";

/** Die Farben für Gewinn und Verlust. Warum dieses Paar, steht in skala.js. */
export const GEWINN = "#01665e";
export const VERLUST = "#8c510a";

const MUSTER = "ohne-liste";
const OHNE = `url(#${MUSTER})`;

/**
 * @param {object} raster   ein Eintrag aus kartogramm.raster
 * @param {object} wahl     Datensatz aus data/wahlen/
 * @param {object} optionen
 * @param {"stärkste"|"sitze"|"liste"|"veränderung"} optionen.ansicht
 * @param {string} [optionen.liste]  Listen-ID für „liste“ und „veränderung“
 * @param {string} optionen.grund    Untergrund der Karte, aus dem die Skala aufsteigt
 * @param {string} [optionen.tinte]     Farbe der Gemeindeumrisse und der Schrift
 * @param {string} [optionen.schraffur] Farbe der Schraffur für „nicht angetreten“
 */
export function zeichneKarte(raster, wahl, { ansicht, liste, grund, tinte = "#1a1a19", schraffur = "#dededa", beschriftung = true }) {
  const gemeinden = new Map(wahl.gemeinden.map((g) => [g.ags, g]));
  const einzeln = ansicht === "sitze";
  const füllung = fülle(ansicht, { wahl, liste, grund });

  const svg = toSVG(raster, {
    fill: (region) => füllung(gemeinden.get(String(region.id))),
    // In der Sitzansicht trägt jedes Feld seine eigene Farbe. Welche Liste auf
    // welchem Feld liegt, steht im Kartogramm.
    cellFill: einzeln ? (feldliste) => farben(wahl).get(feldliste) ?? OHNE : null,
    stroke: tinte,
    // Ohne kräftigere Umrisse verschwände zwischen den Einzelfarben, wo eine
    // Gemeinde aufhört.
    strokeWidth: einzeln ? 2.6 : 1.8,
    strokeHalo: grund,
    strokeHaloWidth: einzeln ? 7 : 5,
    label: beschriftung ? (region) => region.name : null,
    labelColour: (region) => {
      if (einzeln) return tinte;
      const flaeche = füllung(gemeinden.get(String(region.id)));
      return flaeche.startsWith("#") && helligkeit(flaeche) < 0.62 ? grund : tinte;
    },
    // In der Sitzansicht liegt unter dem Namen jede Fraktionsfarbe gleichzeitig.
    // Dort trägt dunkle Schrift auf hellem Rand, statt sich auf eine
    // Flächenhelligkeit zu verlassen, die es nicht gibt.
    labelHalo: einzeln ? grund : null,
  });

  return mitMuster(svg, grund, schraffur);
}

/** Wie eine Gemeindefläche gefüllt wird, je nach Ansicht. */
function fülle(ansicht, { wahl, liste, grund }) {
  const eintrag = wahl.listen.find((l) => l.id === liste);

  if (ansicht === "liste") {
    const decke = eintrag?.skala?.decke ?? 0;
    const farbe = eintrag?.farbe ?? "#666";
    return (gemeinde) => {
      const anteil = wert(gemeinde, liste, "anteil");
      return anteil == null ? OHNE : mische(grund, farbe, decke ? anteil / decke : 0);
    };
  }

  if (ansicht === "veränderung") {
    const ausschlag = eintrag?.wandel?.ausschlag ?? 0;
    return (gemeinde) => {
      const punkte = wert(gemeinde, liste, "veraenderung");
      return punkte == null ? OHNE : farbeVeraenderung(punkte, ausschlag, grund);
    };
  }

  return (gemeinde) => (gemeinde ? stärkste(gemeinde).farbe : OHNE);
}

/**
 * Die Mitte ist der Grundton: keine Veränderung heißt keine Farbe. Nach oben
 * und unten läuft je ein eigener Ton, damit sich Vorzeichen und Betrag getrennt
 * ablesen lassen.
 */
export function farbeVeraenderung(punkte, ausschlag, grund) {
  if (punkte == null) return OHNE;
  return mische(grund, punkte >= 0 ? GEWINN : VERLUST, ausschlag ? Math.abs(punkte) / ausschlag : 0);
}

/** Die Liste mit den meisten Sitzen; bei Gleichstand entscheidet der Stimmenanteil. */
export function stärkste(gemeinde) {
  return gemeinde.ergebnis.reduce((a, b) =>
    (b.sitze ?? 0) > (a.sitze ?? 0) || ((b.sitze ?? 0) === (a.sitze ?? 0) && (b.anteil ?? 0) > (a.anteil ?? 0)) ? b : a
  );
}

/** Farbe je Einzelliste, quer über alle Gemeinden. */
function farben(wahl) {
  return new Map(wahl.gemeinden.flatMap((g) => g.ergebnis.map((e) => [e.id, e.farbe])));
}

// „Nicht angetreten“ ist kein kleiner Wert, sondern gar keiner. Als blasse
// Fläche stünde es am unteren Ende derselben Skala und wäre von einem schwachen
// Ergebnis nicht zu unterscheiden. Eine Schraffur ist ein anderer Kanal.
function mitMuster(svg, grund, schraffur) {
  const defs =
    `<defs><pattern id="${MUSTER}" width="7" height="7" patternTransform="rotate(45)" ` +
    `patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="${grund}"/>` +
    `<line x1="0" y1="0" x2="0" y2="7" stroke="${schraffur}" stroke-width="2.5"/></pattern></defs>`;
  return svg.replace(/(<svg[^>]*>)/, `$1${defs}`);
}
