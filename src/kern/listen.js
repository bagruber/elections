// Wahlvorschläge: Schreibweisen vereinheitlichen, Farben vergeben.
//
// Zur Farbwahl: Parteifarben sind keine freie Entscheidung, sondern Konvention —
// wer die CSU nicht schwarz und die SPD nicht rot färbt, macht die Karte
// schlechter lesbar, nicht besser. Damit ist eine durchgehend farbfehlsichtigkeits-
// sichere Palette ausgeschlossen: SPD-Rot und Grünen-Grün liegen bei Deuteranopie
// nur ΔE 5,1 auseinander (OKLab ×100, Ziel ≥ 8), und daran ändert keine Abstufung
// etwas. Die Karte trägt deshalb Beschriftung, Legende und Tabelle als eigenen
// Kanal; die Farbe ist nie das einzige Unterscheidungsmerkmal.
//
// Örtliche Listen sind der eigentliche Fall im Landkreis Freising: 242 der 440
// Sitze entfallen auf Wählergruppen und gemeinsame Wahlvorschläge. Sie bekommen
// Farben aus einer Leiter, die keine Parteifarbe belegt, und zwar per
// Graphfärbung: zwei Listen, die im selben Gemeinderat sitzen, teilen nie
// dieselbe Farbe.

/** Bundesweite Parteien mit ihren üblichen Farben. */
export const PARTEIEN = {
  CSU: { name: "CSU", farbe: "#1c1b1f" },
  SPD: { name: "SPD", farbe: "#e3000f" },
  GRÜNE: { name: "Grüne", farbe: "#3d8b37" },
  FW: { name: "Freie Wähler", farbe: "#f5a800" },
  AfD: { name: "AfD", farbe: "#009ee0" },
  FDP: { name: "FDP", farbe: "#f2d43c" },
  LINKE: { name: "Die Linke", farbe: "#be3075" },
  ÖDP: { name: "ÖDP", farbe: "#8a4a1c" },
};

/** Sammelkategorien, die GENESIS statt der örtlichen Listen führt. */
export const SAMMEL = {
  GEMEINSAM: { name: "Gemeinsame Wahlvorschläge", farbe: "#6b6759" },
  WÄHLERGRUPPEN: { name: "Wählergruppen", farbe: "#b4afa1" },
};

/**
 * Farbleiter für örtliche Listen. Violett, Petrol, Weinrot und Indigo belegt
 * keine der Parteifarben; die helleren Stufen verlängern die Leiter, falls in
 * einem Gemeinderat mehr als vier örtliche Listen sitzen.
 */
export const ÖRTLICH = ["#6f4ea8", "#1f9c8f", "#7a3b5e", "#3f5fa0", "#a08cd4", "#6cc4b8", "#c98aa8", "#8fa6d4"];

const SYNONYME = [
  [/^csu$/, "CSU"],
  [/^spd$/, "SPD"],
  [/^(gr(ü|ue)ne|b(ü|ue)ndnis ?90.*|die gr(ü|ue)nen)$/, "GRÜNE"],
  [/^(fw|fwg|freie w(ä|ae)hler( bayern)?)$/, "FW"],
  [/^afd|^alternative f(ü|ue)r deutschland/, "AfD"],
  [/^(fdp|freie demokratische partei)/, "FDP"],
  [/^(die )?linke/, "LINKE"],
  [/^((ö|oe)dp|(ö|oe)kologisch-demokratische)/, "ÖDP"],
  [/^gemeinsame wahlvorschl(ä|ae)ge$/, "GEMEINSAM"],
  [/^w(ä|ae)hlergruppen$/, "WÄHLERGRUPPEN"],
];

const rein = (name) =>
  String(name)
    .trim()
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/, "") // GENESIS hängt das Kürzel in Klammern an
    .replace(/\s+/g, " ");

/**
 * Vereinheitlicht eine Schreibweise. Was keiner Partei entspricht, bleibt als
 * eigene örtliche Liste erhalten — der Name ist dort die Information.
 *
 * @returns {{ id: string, name: string, art: "partei"|"sammel"|"örtlich", familie?: string }}
 */
export function normalisiere(name) {
  // GENESIS schreibt Parteien aus und hängt das Kürzel in Klammern an
  // („Christlich-Soziale Union in Bayern e.V. (CSU)"). Das Kürzel ist der
  // verlässlichere Anhaltspunkt, deshalb zuerst.
  const kuerzel = String(name).match(/\(([^)]+)\)\s*$/)?.[1];
  for (const kandidat of [kuerzel, name].filter(Boolean)) {
    const sauber = rein(kandidat);
    for (const [muster, id] of SYNONYME) {
      if (!muster.test(sauber)) continue;
      if (PARTEIEN[id]) return { id, name: PARTEIEN[id].name, art: "partei" };
      return { id, name: SAMMEL[id].name, art: "sammel" };
    }
  }

  const sauber = rein(name);
  // „FREIE WÄHLER, FW Moosburg" ist eine eigene Liste, gehört aber zur Familie
  // der Freien Wähler — die Karte soll beides zeigen können.
  const familie = /freie w(ä|ae)hler|(^|[^a-z])fw([^a-z]|$)/.test(sauber) ? "FW" : undefined;
  return { id: String(name).trim(), name: String(name).trim(), art: "örtlich", familie };
}

/**
 * Vergibt Farben an die örtlichen Listen. Greedy über den Graphen der Listen,
 * die sich ein Gremium teilen — dieselbe Überlegung wie beim Färben angrenzender
 * Gebiete: nur was nebeneinander liegt, muss sich unterscheiden.
 *
 * @param {Array<string[]>} gremien  je Gremium die Listen-IDs darin
 * @returns {Object<string, string>} Listen-ID -> Farbe
 */
export function faerbeÖrtliche(gremien) {
  const nachbarn = new Map();
  const istÖrtlich = (id) => !PARTEIEN[id] && !SAMMEL[id];

  for (const gremium of gremien) {
    for (const a of gremium) {
      if (!istÖrtlich(a)) continue;
      if (!nachbarn.has(a)) nachbarn.set(a, new Set());
      for (const b of gremium) if (b !== a) nachbarn.get(a).add(b);
    }
  }

  // Die Liste mit den meisten Nachbarn zuerst: sie ist am schwersten unterzubringen.
  const reihenfolge = [...nachbarn.keys()].sort((a, b) => nachbarn.get(b).size - nachbarn.get(a).size);
  const farben = {};

  for (const id of reihenfolge) {
    const belegt = new Set();
    for (const nachbar of nachbarn.get(id)) {
      const farbe = PARTEIEN[nachbar]?.farbe ?? SAMMEL[nachbar]?.farbe ?? farben[nachbar];
      if (farbe) belegt.add(farbe);
    }
    farben[id] = ÖRTLICH.find((f) => !belegt.has(f)) ?? ÖRTLICH[0];
  }
  return farben;
}

/** Farbe einer Liste; örtliche Listen brauchen die Zuteilung aus faerbeÖrtliche. */
export function farbe(id, örtliche = {}) {
  return PARTEIEN[id]?.farbe ?? SAMMEL[id]?.farbe ?? örtliche[id] ?? ÖRTLICH[0];
}
