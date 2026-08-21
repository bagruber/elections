// Wahlergebnis auf ein Hexagon-Kartogramm legen.
//
// Die Aufteilung selbst kommt aus hexagonalmap: ein Sechseck je Ratssitz, die
// Fläche einer Gemeinde also proportional zur Größe ihres Gremiums. Dieses
// Layout bleibt über alle Ansichten dasselbe — nur die Färbung wechselt. Sonst
// verschöbe sich beim Umschalten die Karte unter dem Blick weg, und zwei
// Ansichten ließen sich nicht mehr vergleichen.
//
// Drei Ansichten:
//   stärkste — je Gemeinde eine Farbe, die Liste mit den meisten Sitzen
//   sitze    — je Sitz ein Feld, gefärbt nach Fraktion
//   liste    — eine Liste ausgewählt, ihre Stärke als Sättigung der Fläche

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
 * Zeichnet eine Ansicht.
 *
 * @param {object} layout   Ergebnis von layout()
 * @param {object} wahl     Datensatz, der die Farben trägt
 * @param {object} options
 * @param {"stärkste"|"sitze"|"liste"} options.ansicht
 * @param {string} [options.liste]   Listen-ID für die Ansicht „liste"
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
    const farben = new Map(wahl.listen.map((l) => [l.id, l.farbe]));
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
    const werte = wahl.gemeinden.map((g) => g.ergebnis.find((e) => e.id === liste)?.anteil).filter((v) => v != null);
    const höchster = Math.max(...werte, 0);
    const grundfarbe = wahl.listen.find((l) => l.id === liste)?.farbe ?? "#666";

    return mitMuster(
      toSVG(layout, {
        ...gemeinsam,
        fill: (region) => {
          const anteil = gemeindeVon(region)?.ergebnis.find((e) => e.id === liste)?.anteil;
          return anteil == null ? OHNE : mische(GRUND, grundfarbe, höchster ? anteil / höchster : 0);
        },
        labelColour: (region) => {
          const anteil = gemeindeVon(region)?.ergebnis.find((e) => e.id === liste)?.anteil;
          return anteil != null && höchster && anteil / höchster > 0.55 ? "#faf7f0" : "#1b1814";
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

/** Die Bandbreite, die eine Listen-Ansicht abdeckt — die Legende braucht sie. */
export function spanne(wahl, liste) {
  const werte = wahl.gemeinden.map((g) => g.ergebnis.find((e) => e.id === liste)?.anteil).filter((v) => v != null);
  return { höchster: Math.max(...werte, 0), gemeinden: werte.length };
}

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
