// Wahlergebnis auf ein Hexagon-Kartogramm legen.
//
// Die Aufteilung selbst kommt aus hexagonalmap: ein Sechseck je Ratssitz, die
// Fläche einer Gemeinde also proportional zur Größe ihres Gremiums. Dieses
// Layout bleibt über alle Ansichten dasselbe, nur die Färbung wechselt. Sonst
// verschöbe sich beim Umschalten die Karte unter dem Blick weg, und zwei
// Ansichten ließen sich nicht mehr vergleichen.
//
// Vier Ansichten:
//   stärkste   , je Gemeinde eine Farbe, die Liste mit den meisten Sitzen
//   sitze      , je Sitz ein Feld, gefärbt nach Fraktion
//   liste      , eine Liste ausgewählt, ihre Stärke als Sättigung der Fläche
//   veränderung: dieselbe Liste, aber Gewinn und Verlust seit der Wahl davor

import { hexmap } from "hexagonalmap";
import { toSVG } from "hexagonalmap/svg";
import { split } from "hexagonalmap/parts";
import { wert } from "./skala.js";
import { mische, helligkeit } from "./farbe.js";

/**
 * Wonach sich die Fläche einer Gemeinde bemisst. Zwei Karten, und der
 * Unterschied zwischen ihnen ist die eigentliche Auskunft: auf der einen ist
 * ein Sechseck ein Ratssitz, auf der anderen sind es 500 Einwohner. Im
 * Landkreis Freising kommen auf einen Sitz in Freising 1223 Einwohner und in
 * Gammelsdorf 133: die kleinen Gemeinden schrumpfen beim Umschalten also auf
 * ein Neuntel.
 *
 * 500 ist gewählt, weil es sich sagen lässt und weil die Karte damit ähnlich
 * dicht bleibt wie die Sitzkarte: 369 Sechsecke gegen 440. Bei 1000 fiele die
 * kleinste Gemeinde auf zwei Felder und verlöre jede Form.
 *
 * `teilung` bestimmt, wie die Felder einer Gemeinde auf die Listen fallen. Auf
 * der Sitzkarte ist das exakt, ein Feld ist ein Sitz. Auf der Einwohnerkarte
 * hat ein Feld keine Entsprechung im Gremium; dort verteilen sich die Felder
 * nach Stimmenanteil und sind gerundet. Die Karte sagt das dazu.
 */
export const GRUNDLAGEN = {
  sitze: {
    id: "sitze",
    label: "Sitze",
    je: 1,
    einheit: "ein Ratssitz",
    genau: true,
    wert: (props, sitzeVon) => sitzeVon.get(String(props.ags)) ?? 0,
    teilung: (e) => e.sitze ?? 0,
  },
  einwohner: {
    id: "einwohner",
    label: "Einwohner",
    je: 500,
    einheit: "500 Einwohner",
    genau: false,
    wert: (props) => props.ewz ?? 0,
    teilung: (e) => e.anteil ?? 0,
  },
};

/**
 * Layout für einen Wahldatensatz. Rechenintensiv, einmal je Bezugsgröße
 * bauen, für alle Ansichten wiederverwenden.
 *
 * @param {object} options
 * @param {object} options.gebiete      FeatureCollection der Gemeinden
 * @param {object} [options.grenze]     FeatureCollection der Kreisgrenze
 * @param {object} options.wahl         Datensatz mit den Sitzzahlen je Gemeinde
 * @param {"sitze"|"einwohner"} [options.grundlage]
 */
export function layout({ gebiete, grenze, wahl, grundlage = "sitze", fidelity = 0.6, orientation = "pointy" }) {
  const art = GRUNDLAGEN[grundlage] ?? GRUNDLAGEN.sitze;
  const sitzeVon = new Map(wahl.gemeinden.map((g) => [g.ags, g.sitze]));
  const raster = hexmap({
    areas: gebiete,
    outline: grenze,
    value: (props) => art.wert(props, sitzeVon),
    valuePerHex: art.je,
    key: "ags",
    fidelity,
    orientation,
  });
  // Die Zeichenfunktion muss wissen, worauf sie schaut, sonst teilte sie die
  // Einwohnerkarte nach Sitzen auf, und die Zahl der Felder ginge nicht auf.
  raster.grundlage = art;
  return raster;
}

/** Die Liste mit den meisten Sitzen; bei Gleichstand entscheidet der Stimmenanteil. */
export function stärkste(gemeinde) {
  return gemeinde.ergebnis.reduce((a, b) =>
    (b.sitze ?? 0) > (a.sitze ?? 0) || ((b.sitze ?? 0) === (a.sitze ?? 0) && (b.anteil ?? 0) > (a.anteil ?? 0)) ? b : a
  );
}

/**
 * Der Grundton, aus dem die Sättigungsskala aufsteigt. Das muss der Untergrund
 * der Karte sein, sonst hebt sich die unterste Stufe von ihm ab und „null
 * Prozent" sieht aus wie ein kleiner Wert. Wer die Karte einbindet, hat einen
 * anderen Untergrund und übergibt ihn.
 */
const GRUND = "#f2eee4";

// „Nicht angetreten" ist kein kleiner Wert, sondern gar keiner. Als blasse
// Fläche stünde es am unteren Ende derselben Skala und wäre von einem schwachen
// Ergebnis nicht zu unterscheiden, deshalb eine Schraffur: ein anderer Kanal,
// keine andere Stufe.
const OHNE = "url(#ohne-liste)";
const MUSTER = `<defs><pattern id="ohne-liste" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
<rect width="7" height="7" fill="#efebe1"/><line x1="0" y1="0" x2="0" y2="7" stroke="#cfc9bb" stroke-width="2.5"/>
</pattern></defs>`;

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
 * @param {string} [options.grund]   Untergrund der Karte, aus dem die Skala aufsteigt
 */
export function zeichne(layout, wahl, { ansicht, liste, breite = 1000, beschriftung = true, grund = GRUND } = {}) {
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
    // Zahl der Felder anzurühren. Wonach geteilt wird, hängt an der Bezugsgröße:
    // auf der Sitzkarte nach Sitzen, auf der Einwohnerkarte nach Stimmenanteil.
    const teilung = (layout.grundlage ?? GRUNDLAGEN.sitze).teilung;
    const farbeJeFeld = split(
      layout,
      (region) => (gemeindeVon(region)?.ergebnis ?? []).map((e) => ({ key: e.id, value: teilung(e) })),
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
    // Die Skala steht im Datensatz, gerechnet von baue.mjs. Siehe skala.js.
    const eintrag = wahl.listen.find((l) => l.id === liste);
    const decke = eintrag?.skala?.decke ?? 0;
    const grundfarbe = eintrag?.farbe ?? "#666";
    const anteilVon = (region) => wert(gemeindeVon(region), liste, "anteil");

    return mitMuster(
      toSVG(layout, {
        ...gemeinsam,
        fill: (region) => {
          const anteil = anteilVon(region);
          return anteil == null ? OHNE : mische(grund, grundfarbe, decke ? anteil / decke : 0);
        },
        labelColour: (region) => {
          const anteil = anteilVon(region);
          return anteil != null && decke && anteil / decke > 0.55 ? "#faf7f0" : "#1b1814";
        },
      })
    );
  }

  if (ansicht === "veränderung") {
    const ausschlag = wahl.listen.find((l) => l.id === liste)?.wandel?.ausschlag ?? 0;
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
          return mische(grund, punkte >= 0 ? GEWINN : VERLUST, ausschlag ? Math.abs(punkte) / ausschlag : 0);
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
        return gemeinde && helligkeit(stärkste(gemeinde).farbe) < 0.62 ? "#faf7f0" : "#1b1814";
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

/** Die Farbe für einen Veränderungswert, Legende und Karte müssen dieselbe zeigen. */
export function farbeVeraenderung(punkte, ausschlag) {
  if (punkte == null) return OHNE;
  return mische(grund, punkte >= 0 ? GEWINN : VERLUST, ausschlag ? Math.abs(punkte) / ausschlag : 0);
}

export { GRUND, GEWINN, VERLUST, wert, mische };
