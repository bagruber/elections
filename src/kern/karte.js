// Wahlergebnis auf ein Hexagon-Kartogramm legen.
//
// Die Aufteilung selbst kommt aus hexagonalmap: ein Sechseck je Ratssitz, die
// Fläche einer Gemeinde also proportional zur Größe ihres Gremiums. Dieses
// Layout bleibt über alle Ansichten dasselbe — nur die Färbung wechselt. Sonst
// verschöbe sich beim Umschalten die Karte unter dem Blick weg, und zwei
// Ansichten ließen sich nicht mehr vergleichen.
//
// Vier Ansichten:
//   stärkste    — je Gemeinde eine Farbe, die Liste mit den meisten Sitzen
//   sitze       — je Sitz ein Feld, gefärbt nach Fraktion
//   liste       — eine Liste ausgewählt, ihre Stärke als Sättigung der Fläche
//   veränderung — dieselbe Liste, aber Gewinn und Verlust seit der Wahl davor

import { hexmap } from "hexagonalmap";
import { toSVG } from "hexagonalmap/svg";
import { split } from "hexagonalmap/parts";

/**
 * Layout für einen Wahldatensatz. Rechenintensiv — einmal bauen, für alle
 * Ansichten wiederverwenden.
 *
 * @param {object} options
 * @param {object} options.gebiete   FeatureCollection der Gemeinden
 * @param {object} [options.grenze]  FeatureCollection der Kreisgrenze
 * @param {object} options.wahl      Datensatz mit den Sitzzahlen je Gemeinde
 */
export function layout({ gebiete, grenze, wahl, fidelity = 0.6, orientation = "pointy" }) {
  const sitze = new Map(wahl.gemeinden.map((g) => [g.ags, g.sitze]));
  return hexmap({
    areas: gebiete,
    outline: grenze,
    value: (props) => sitze.get(String(props.ags)) ?? 0,
    valuePerHex: 1,
    key: "ags",
    fidelity,
    orientation,
  });
}

/**
 * Der Wert einer Liste in einer Gemeinde. Ausgewählt wird immer eine Gruppe der
 * Kreislegende — „Freie Wähler" etwa —, in der Gemeinde stehen aber die
 * Einzellisten. Wo mehrere davon zur selben Gruppe gehören, werden sie addiert:
 * in Langenbach sitzen FW und FWO, und die Karte soll dort beides zeigen.
 *
 * @param {"anteil"|"veraenderung"|"sitze"} feld
 */
export function wert(gemeinde, liste, feld = "anteil") {
  const treffer = (gemeinde?.ergebnis ?? []).filter((e) => (e.gruppe ?? e.id) === liste);
  if (!treffer.length) return null;
  const werte = treffer.map((e) => e[feld]).filter((v) => v != null);
  return werte.length ? werte.reduce((a, b) => a + b, 0) : null;
}

/** Die Liste mit den meisten Sitzen; bei Gleichstand entscheidet der Stimmenanteil. */
export function stärkste(gemeinde) {
  return gemeinde.ergebnis.reduce((a, b) =>
    (b.sitze ?? 0) > (a.sitze ?? 0) || ((b.sitze ?? 0) === (a.sitze ?? 0) && (b.anteil ?? 0) > (a.anteil ?? 0)) ? b : a
  );
}

const GRUND = "#f2eee4";

// „Nicht angetreten" ist kein kleiner Wert, sondern gar keiner. Als blasse
// Fläche stünde es am unteren Ende derselben Skala und wäre von einem schwachen
// Ergebnis nicht zu unterscheiden — deshalb eine Schraffur: ein anderer Kanal,
// keine andere Stufe.
const OHNE = "url(#ohne-liste)";
const MUSTER = `<defs><pattern id="ohne-liste" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
<rect width="7" height="7" fill="#efebe1"/><line x1="0" y1="0" x2="0" y2="7" stroke="#cfc9bb" stroke-width="2.5"/>
</pattern></defs>`;

/**
 * Wie stark die Skala einer einzelnen Liste an die Karte gekoppelt wird.
 *
 * 0 hieße: jede Liste bekommt ihre eigene Skala, die bei ihrem eigenen
 * Spitzenwert endet. Dann sieht eine FDP mit sieben Prozent genauso satt aus
 * wie eine CSU mit zweiundvierzig, und der Vergleich zwischen Listen ist
 * verloren. 1 hieße: alle Listen teilen sich die Skala bis zum stärksten Wert
 * der ganzen Karte. Dann bleibt die FDP überall gleich blass, und der Vergleich
 * zwischen Gemeinden ist verloren.
 *
 * 0,5 legt die Obergrenze auf das geometrische Mittel aus beidem — aus dem
 * Spitzenwert der Liste und dem stärksten Wert der Karte. Die FDP erreicht
 * damit an ihrer besten Stelle 42 Prozent der Skala statt 18 (absolut) oder 100
 * (dynamisch): schwach erkennbar, aber innerlich noch abgestuft.
 */
export const KOPPLUNG = 0.5;

/** Die Farben für Gewinn und Verlust. */
const GEWINN = "#01665e";
const VERLUST = "#8c510a";

/**
 * Zeichnet eine Ansicht.
 *
 * @param {object} layout   Ergebnis von layout()
 * @param {object} wahl     Datensatz, der die Farben trägt
 * @param {object} options
 * @param {"stärkste"|"sitze"|"liste"|"veränderung"} options.ansicht
 * @param {string} [options.liste]   Listen-ID für „liste" und „veränderung"
 * @param {boolean} [options.beschriftung]
 */
export function zeichne(layout, wahl, { ansicht, liste, breite = 1000, beschriftung = true } = {}) {
  const gemeinden = new Map(wahl.gemeinden.map((g) => [g.ags, g]));
  const gemeindeVon = (region) => gemeinden.get(String(region.id));

  const gemeinsam = {
    width: breite,
    gap: 0.08,
    stroke: "#2b2822",
    strokeWidth: 1.6,
    strokeHalo: "#faf7f0",
    strokeHaloWidth: 5,
    label: beschriftung ? (region) => region.name : null,
  };

  if (ansicht === "sitze") {
    // split() teilt die Felder einer Gemeinde auf die Fraktionen auf, ohne die
    // Zahl der Felder anzurühren — ein Feld bleibt ein Sitz.
    const farbeJeFeld = split(
      layout,
      (region) => (gemeindeVon(region)?.ergebnis ?? []).map((e) => ({ key: e.id, value: e.sitze ?? 0 })),
      "blocks"
    );
    // Die Farben kommen aus den Gemeindeergebnissen, nicht aus wahl.listen:
    // dort stehen die Gruppen der Kreislegende („Freie Wähler“, „Gemeinsame
    // Wahlvorschläge“), split() teilt die Felder aber nach den Einzellisten auf.
    const farben = new Map(wahl.gemeinden.flatMap((g) => g.ergebnis.map((e) => [e.id, e.farbe])));
    return mitMuster(
      toSVG(layout, {
        ...gemeinsam,
        // Jedes Feld trägt hier eine eigene Farbe. Ohne kräftigere Umrisse
        // verschwände dazwischen, wo eine Gemeinde aufhört.
        strokeWidth: 2.6,
        strokeHaloWidth: 7,
        cellFill: (feld) => farben.get(farbeJeFeld[feld]) ?? OHNE,
        labelColour: () => "#1b1814",
        labelHalo: "#faf7f0",
      })
    );
  }

  if (ansicht === "liste") {
    const { decke } = spanne(wahl, liste);
    const grundfarbe = wahl.listen.find((l) => l.id === liste)?.farbe ?? "#666";
    const anteilVon = (region) => wert(gemeindeVon(region), liste, "anteil");

    return mitMuster(
      toSVG(layout, {
        ...gemeinsam,
        fill: (region) => {
          const anteil = anteilVon(region);
          return anteil == null ? OHNE : mische(GRUND, grundfarbe, decke ? anteil / decke : 0);
        },
        labelColour: (region) => {
          const anteil = anteilVon(region);
          return anteil != null && decke && anteil / decke > 0.55 ? "#faf7f0" : "#1b1814";
        },
      })
    );
  }

  if (ansicht === "veränderung") {
    const { ausschlag } = schwankung(wahl, liste);
    const punkteVon = (region) => wert(gemeindeVon(region), liste, "veraenderung");

    return mitMuster(
      toSVG(layout, {
        ...gemeinsam,
        fill: (region) => {
          const punkte = punkteVon(region);
          if (punkte == null) return OHNE;
          // Die Mitte ist der Grundton: keine Veränderung heißt keine Farbe.
          // Nach oben und unten läuft je ein eigener Ton, damit sich Vorzeichen
          // und Betrag getrennt ablesen lassen.
          return mische(GRUND, punkte >= 0 ? GEWINN : VERLUST, ausschlag ? Math.abs(punkte) / ausschlag : 0);
        },
        labelColour: (region) => {
          const punkte = punkteVon(region);
          return punkte != null && ausschlag && Math.abs(punkte) / ausschlag > 0.5 ? "#faf7f0" : "#1b1814";
        },
      })
    );
  }

  return mitMuster(
    toSVG(layout, {
      ...gemeinsam,
      fill: (region) => {
        const gemeinde = gemeindeVon(region);
        return gemeinde ? stärkste(gemeinde).farbe : OHNE;
      },
      labelColour: (region) => {
        const gemeinde = gemeindeVon(region);
        return gemeinde && dunkel(stärkste(gemeinde).farbe) ? "#faf7f0" : "#1b1814";
      },
      labelHalo: null,
    })
  );
}

/** Schiebt die Musterdefinition hinter das öffnende svg-Element. */
function mitMuster(svg) {
  return svg.replace(/(<svg[^>]*>)/, `$1
${MUSTER}`);
}

/**
 * Die Bandbreite, die eine Listen-Ansicht abdeckt — die Legende braucht sie.
 * `decke` ist der Wert, bei dem die Skala endet: nicht der Spitzenwert dieser
 * Liste und nicht der der Karte, sondern das geometrische Mittel aus beidem.
 * Warum, steht bei KOPPLUNG.
 */
export function spanne(wahl, liste) {
  const werte = wahl.gemeinden.map((g) => wert(g, liste, "anteil")).filter((v) => v != null);
  const höchster = Math.max(...werte, 0);
  // Die Referenz zählt Gruppen, nicht Einzellisten — sonst wären die beiden
  // Maßstäbe verschieden und die Skala hinge schief.
  const stark = starkesErgebnis(alleGruppenwerte(wahl, "anteil"));
  return {
    höchster,
    stark,
    decke: höchster > 0 ? höchster ** (1 - KOPPLUNG) * stark ** KOPPLUNG : 0,
    gemeinden: werte.length,
  };
}

/**
 * Was auf dieser Karte als starkes Ergebnis gilt: der Wert, den nur jedes
 * zehnte Gemeindeergebnis übertrifft.
 *
 * Nicht das Maximum — das wäre hier 99,8 Prozent, weil in Hörgertshausen nur
 * eine einzige Liste angetreten ist. Ein solcher Sonderfall zöge jede Skala so
 * weit hoch, dass selbst die CSU nirgends mehr voll sättigt. Werte oberhalb der
 * Grenze laufen einfach ans obere Ende; das ist der Sinn einer robusten Skala
 * und kein Verlust, denn ganz oben ist ganz oben.
 */
/** Alle Gemeindewerte, nach Gruppen zusammengefasst — der Maßstab der Karte. */
function alleGruppenwerte(wahl, feld) {
  return wahl.gemeinden.flatMap((g) => [...new Set(g.ergebnis.map((e) => e.gruppe ?? e.id))].map((id) => wert(g, id, feld)));
}

function starkesErgebnis(werte) {
  const sortiert = werte.filter((v) => v != null).sort((a, b) => a - b);
  return sortiert.length ? sortiert[Math.floor((sortiert.length - 1) * 0.9)] : 0;
}

/**
 * Dasselbe für Gewinn und Verlust. Der Ausschlag ist symmetrisch: eine Skala,
 * die nach oben weiter reicht als nach unten, ließe drei Punkte Verlust
 * kräftiger aussehen als drei Punkte Gewinn.
 */
export function schwankung(wahl, liste) {
  const werte = wahl.gemeinden.map((g) => wert(g, liste, "veraenderung")).filter((v) => v != null);
  if (!werte.length) return { ausschlag: 0, gemeinden: 0, tief: null, hoch: null };

  const eigener = Math.max(...werte.map(Math.abs));
  const stark = starkesErgebnis(alleGruppenwerte(wahl, "veraenderung").map((v) => (v == null ? null : Math.abs(v))));
  return {
    ausschlag: eigener ** (1 - KOPPLUNG) * stark ** KOPPLUNG,
    eigener,
    stark,
    tief: Math.min(...werte),
    hoch: Math.max(...werte),
    gemeinden: werte.length,
  };
}

/** Die Farbe für einen Veränderungswert — Legende und Karte müssen dieselbe zeigen. */
export function farbeVeraenderung(punkte, ausschlag) {
  if (punkte == null) return OHNE;
  return mische(GRUND, punkte >= 0 ? GEWINN : VERLUST, ausschlag ? Math.abs(punkte) / ausschlag : 0);
}

export { GRUND, GEWINN, VERLUST };

/**
 * Mischt zwei Farben in OKLab statt in sRGB. Der Unterschied ist hier keine
 * Feinheit: eine sRGB-Blende von Beige nach Grün läuft über ein schlammiges
 * Oliv, weil sich Helligkeit und Buntheit ungleichmäßig ändern. In OKLab
 * verlaufen beide gleichmäßig, und die Stufen der Skala sehen gleich weit
 * auseinander aus, wie es eine Wertskala verlangt.
 */
export function mische(von, nach, anteil) {
  const t = Math.min(1, Math.max(0, anteil));
  const a = zuOklab(von);
  const b = zuOklab(nach);
  return ausOklab(a.map((v, i) => v + (b[i] - v) * t));
}

function zuOklab(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => linear(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function ausOklab([L, A, B]) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const kanäle = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return "#" + kanäle.map((v) => Math.round(Math.min(1, Math.max(0, gamma(v))) * 255).toString(16).padStart(2, "0")).join("");
}

const linear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const gamma = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

/** Reicht der Untergrund für dunkle Schrift? Schwelle über die OKLab-Helligkeit. */
function dunkel(hex) {
  return zuOklab(hex)[0] < 0.62;
}
