// Wahlvorschläge: Schreibweisen vereinheitlichen, gruppieren, Farben vergeben.
//
// Zur Farbwahl: Parteifarben sind keine freie Entscheidung, sondern Konvention —
// wer die CSU nicht schwarz und die SPD nicht rot färbt, macht die Karte
// schlechter lesbar, nicht besser. Die Werte hier sind die des Ratsinformations-
// projekts council, damit dieselbe Partei in beiden Projekten dieselbe Farbe
// trägt; zwei mussten für die Karte weichen und stehen unten begründet.
//
// Was diese Konvention kostet, ist nachgerechnet und nicht geschätzt: neben den
// neun gesetzten Parteifarben lassen sich auf cremefarbenem Grund noch genau
// VIER weitere Farben unterbringen, die sich von allen anderen und voneinander
// zuverlässig unterscheiden (ΔE ≥ 8 unter Farbfehlsichtigkeit, ≥ 15 bei
// normalem Sehen, OKLab ×100). Im Landkreis Freising treten aber 31 örtliche
// Listen an. Farbe kann sie nicht auseinanderhalten, und keine längere Leiter
// ändert daran etwas — sie würde nur so tun. Deshalb zwei Konsequenzen:
// zusammenfassen, was zusammengehört, und jede Fläche zusätzlich beschriften.

/** Bundesweite Parteien mit ihren üblichen Farben. */
export const PARTEIEN = {
  CSU: { name: "CSU", farbe: "#0a0a0a" },
  SPD: { name: "SPD", farbe: "#e31e2d" },
  // council führt die Grünen als #64a12d. Auf der Karte ging das nicht: gegen
  // das Orange der Freien Wähler bleiben bei Protanopie ΔE 1,3 übrig, und beide
  // sind hier große Flächen, die aneinandergrenzen. Das kühlere Grün hält 8,8.
  GRÜNE: { name: "Grüne", farbe: "#3d8b37" },
  FW: { name: "Freie Wähler", farbe: "#f28c15" },
  AfD: { name: "AfD", farbe: "#009de0" },
  // council führt die FDP als reines #ffed00. Auf Creme ist das ein Kontrast von
  // 1,1:1 — die Fläche verschwindet. Tiefer geht es nicht: ab #d9bc00 kippt das
  // Gelb ins Orange der Freien Wähler.
  FDP: { name: "FDP", farbe: "#e5c800" },
  LINKE: { name: "Die Linke", farbe: "#be3075" },
  // Und die ÖDP muss vom FW-Orange weg, sonst sind es zwei Namen für eine Farbe.
  ÖDP: { name: "ÖDP", farbe: "#a85a12" },
};

/**
 * Sammelkategorien der amtlichen Statistik. Sie sind hier mehr als ein Notnagel
 * für Gemeinden ohne eigene Quelle: die beiden Gruppen, zu denen die Karte
 * örtliche Listen zusammenfasst, sind genau diese amtlichen Kategorien. Damit
 * fällt die Zusammenfassung mit der Statistik zusammen, statt ihr zu widersprechen.
 */
export const SAMMEL = {
  GEMEINSAM: { name: "Gemeinsame Wahlvorschläge", farbe: "#6b6759" },
  WÄHLERGRUPPEN: { name: "Wählergruppen", farbe: "#b4afa1" },
};

/**
 * Örtliche Listen, die eine feste eigene Farbe haben, weil sie anderswo schon
 * eine tragen. FRESH sitzt im Moosburger Stadtrat und erscheint in council in
 * genau diesem Türkis.
 */
export const FEST = {
  FRESH: "#36c9c5",
};

/**
 * Farbleiter für alle übrigen örtlichen Listen — die vier, die neben den
 * Parteifarben noch Platz haben. Vergeben werden sie per Graphfärbung: nur was
 * nebeneinander liegt, muss sich unterscheiden, und weit auseinanderliegende
 * Wählergruppen dürfen sich eine Farbe teilen.
 */
export const ÖRTLICH = ["#2d47bc", "#7b2088", "#8861bc", "#c97b95"];

/**
 * Zweite Stufe für den Fall, dass zwei Listen der Freien Wähler in einem Rat
 * sitzen — in Langenbach (FW und FWO) und Wang (FWI und FWV) ist das so. Beide
 * im selben Orange wären in der Sitzansicht ein Block statt zwei. Das Dunkelrot-
 * braun hält gegen das Orange ΔE 25, kommt aber der ÖDP nahe; dass die beiden
 * nie im selben Rat sitzen, prüft baue.mjs, statt es zu unterstellen.
 */
export const FW_STUFEN = ["#f28c15", "#7d4a12"];

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

/**
 * Woran eine Partei in einem zusammengesetzten Listennamen zu erkennen ist.
 * Anders als SYNONYME muss das nicht den ganzen Namen treffen, sondern eine
 * Stelle darin — „Christlich-Soziale Union in Bayern e. V. / Freie Wähler
 * Kirchdorf" nennt zwei.
 */
const MARKER = [
  [/christlich[- ]soziale|(^|[^a-z])csu([^a-z]|$)/i, "CSU"],
  [/sozial ?demokratische partei|(^|[^a-z])spd([^a-z]|$)/i, "SPD"],
  [/b(ü|ue)ndnis ?90|die gr(ü|ue)nen|(^|[^a-zäöüß])gr(ü|ue)ne([^a-zäöüß]|$)/i, "GRÜNE"],
  [/freie demokratische partei|(^|[^a-z])fdp([^a-z]|$)/i, "FDP"],
  [/(ö|oe)kologisch-demokratische|(^|[^a-zäöüß])(ö|oe)dp([^a-z]|$)/i, "ÖDP"],
  [/alternative f(ü|ue)r deutschland|(^|[^a-z])afd([^a-z]|$)/i, "AfD"],
  [/(^|[^a-zäöüß])die linke([^a-zäöüß]|$)/i, "LINKE"],
  // „Parteifreie Wähler" ist keine: vor „freie" muss ein Wortanfang stehen.
  [/(^|[^a-zäöüß])freie[rn]?\s*w(ä|ae)hler|(^|[^a-z])fwg?([^a-z]|$)/i, "FW"],
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
 * @param {string} name  Kürzel oder Name, wie die Quelle ihn führt
 * @param {string} [lang] ausgeschriebener Name aus dem abbr-Titel der Quelle.
 *   Ohne ihn wäre „FWI" nicht von „FWO" zu trennen und nicht zu entscheiden, ob
 *   beide zu den Freien Wählern gehören — beide tun es.
 * @returns {{ id, name, art: "partei"|"sammel"|"verbindung"|"örtlich", familie?, teile? }}
 */
export function normalisiere(name, lang) {
  // GENESIS schreibt Parteien aus und hängt das Kürzel in Klammern an
  // („Christlich-Soziale Union in Bayern e.V. (CSU)"). Das Kürzel ist der
  // verlässlichere Anhaltspunkt, deshalb zuerst. Der Langname bleibt hier außen
  // vor: „BÜNDNIS 90/DIE GRÜNEN - Offene Liste Attenkirchen" ist eine eigene
  // Liste und keine Landesliste der Grünen.
  const kuerzel = String(name).match(/\(([^)]+)\)\s*$/)?.[1];
  for (const kandidat of [kuerzel, name].filter(Boolean)) {
    const sauber = rein(kandidat);
    for (const [muster, id] of SYNONYME) {
      if (!muster.test(sauber)) continue;
      if (PARTEIEN[id]) return { id, name: PARTEIEN[id].name, art: "partei", familie: id === "FW" ? "FW" : undefined };
      return { id, name: SAMMEL[id].name, art: "sammel" };
    }
  }

  const eigen = String(name).trim();
  const teile = parteienIn(`${eigen} ${lang ?? ""}`);

  // Mehr als eine Partei im Namen — oder eine Partei plus etwas Örtliches — ist
  // ein gemeinsamer Wahlvorschlag: „CSU/FW", „BfE, EM, ÖDP". Die Ausnahme sind
  // die Freien Wähler: „FREIE WÄHLER Bayern/Freie Wählergemeinschaft Mauern"
  // nennt zweimal dieselbe Familie und ist deshalb keine Verbindung zweier.
  if (teile.length && !(teile.length === 1 && teile[0] === "FW")) {
    return { id: eigen, name: eigen, art: "verbindung", teile };
  }
  if (teile.length === 1) return { id: eigen, name: eigen, art: "örtlich", familie: "FW" };
  return { id: eigen, name: eigen, art: "örtlich" };
}

/** Welche Parteien in einem Listennamen vorkommen. */
function parteienIn(text) {
  return MARKER.filter(([muster]) => muster.test(text)).map(([, id]) => id);
}

/**
 * Zu welcher Gruppe eine Liste in der Kreislegende zählt. Bei 31 örtlichen
 * Listen und vier verfügbaren Farben ist Zusammenfassen keine Bequemlichkeit,
 * sondern die einzige Möglichkeit, eine Legende zu bauen, die trägt.
 *
 * @param {object} liste     normalisierter Eintrag mit Sitzsumme und Gemeindezahl
 * @param {number} [einzeln] ab wie vielen Sitzen eine Wählergruppe für sich steht
 */
export function gruppeVon(liste, einzeln = 1) {
  if (liste.familie === "FW") return "FW";
  if (liste.art === "verbindung") return "GEMEINSAM";
  // Eine Wählergruppe, die einen einzigen Sitz in einer einzigen Gemeinde hält,
  // trägt in einer Kreislegende nichts bei, was ihr Name nicht besser sagt.
  if (liste.art === "örtlich" && (liste.sitze ?? 0) <= einzeln && (liste.gemeinden ?? 1) === 1) return "WÄHLERGRUPPEN";
  return liste.id;
}

/**
 * Vergibt Farben an die örtlichen Listen. Greedy über den Graphen der Listen,
 * die aneinanderstoßen — dieselbe Überlegung wie beim Färben angrenzender
 * Gebiete: nur was nebeneinander liegt, muss sich unterscheiden.
 *
 * Zwei Arten von Bedingung, und sie sind nicht gleich viel wert. Zwei Listen im
 * selben Rat oder in benachbarten Gemeinden berühren sich auf der Karte: teilen
 * sie eine Farbe, verschmelzen sie zu einem Klumpen, und die Karte sagt etwas
 * Falsches. Zwei Listen in derselben Legende stehen nur untereinander — dort ist
 * eine doppelte Farbe unschön, aber der Name daneben klärt sie auf. Bei vier
 * verfügbaren Farben und einunddreißig örtlichen Listen lassen sich nicht beide
 * Bedingungen erfüllen; also wird die harte zuerst bedient.
 *
 * @param {{hart: Array<string[]>, weich?: Array<string[]>}} bedingungen
 * @param {Object<string,string>} vorbelegt  Listen-ID -> bereits vergebene Farbe
 * @returns {Object<string, string>} Listen-ID -> Farbe
 */
export function faerbeÖrtliche({ hart, weich = [] }, vorbelegt = {}) {
  const istÖrtlich = (id) => !PARTEIEN[id] && !SAMMEL[id] && !FEST[id] && !vorbelegt[id];

  const graph = (gruppen) => {
    const nachbarn = new Map();
    for (const gruppe of gruppen) {
      for (const a of gruppe) {
        if (!istÖrtlich(a)) continue;
        if (!nachbarn.has(a)) nachbarn.set(a, new Set());
        for (const b of gruppe) if (b !== a) nachbarn.get(a).add(b);
      }
    }
    return nachbarn;
  };

  const berührt = graph(hart);
  const danebensteht = graph(weich);
  const farben = {};
  const belegtVon = (menge) => {
    const belegt = new Set();
    for (const nachbar of menge ?? []) {
      const farbe = PARTEIEN[nachbar]?.farbe ?? SAMMEL[nachbar]?.farbe ?? FEST[nachbar] ?? vorbelegt[nachbar] ?? farben[nachbar];
      if (farbe) belegt.add(farbe);
    }
    return belegt;
  };

  // Die Liste mit den meisten Berührungen zuerst: sie ist am schwersten
  // unterzubringen, und wer zuletzt kommt, hat die wenigste Auswahl.
  const alle = [...new Set([...berührt.keys(), ...danebensteht.keys()])];
  for (const id of alle.sort((a, b) => (berührt.get(b)?.size ?? 0) - (berührt.get(a)?.size ?? 0))) {
    const hartBelegt = belegtVon(berührt.get(id));
    const weichBelegt = belegtVon(danebensteht.get(id));
    farben[id] =
      ÖRTLICH.find((f) => !hartBelegt.has(f) && !weichBelegt.has(f)) ??
      ÖRTLICH.find((f) => !hartBelegt.has(f)) ??
      ÖRTLICH[0];
  }
  return farben;
}

/**
 * Farben für die Listen der Freien Wähler. Alle tragen dasselbe Orange — die
 * Ortsverbände sind eigenständig, gehören aber zusammen, und die Karte soll das
 * zeigen. Nur wo zwei von ihnen in einem Rat sitzen, bekommt die zweite eine
 * dunklere Stufe: gleiche Farbe hieße dort ein Block statt zwei.
 *
 * @param {Array<string[]>} gremien  je Gremium die Listen-IDs darin
 * @param {Set<string>} familie      IDs, die zu den Freien Wählern zählen
 */
export function faerbeFreieWaehler(gremien, familie) {
  const farben = {};
  for (const gremium of gremien) {
    const drin = gremium.filter((id) => familie.has(id));
    const belegt = new Set(drin.map((id) => farben[id]).filter(Boolean));
    for (const id of drin) {
      if (farben[id]) continue;
      // Die stärkste Liste eines Rats behält das Grundorange; erst die zweite
      // wird gestuft, damit die Karte nicht ohne Not zweifarbig wird.
      farben[id] = FW_STUFEN.find((s) => !belegt.has(s)) ?? FW_STUFEN.at(-1);
      belegt.add(farben[id]);
    }
  }
  for (const id of familie) farben[id] ??= FW_STUFEN[0];
  return farben;
}

/** Farbe einer Liste; örtliche Listen brauchen die Zuteilung aus faerbeÖrtliche. */
export function farbe(id, örtliche = {}) {
  return PARTEIEN[id]?.farbe ?? SAMMEL[id]?.farbe ?? FEST[id] ?? örtliche[id] ?? ÖRTLICH[0];
}

/** Farbe einer Gruppe der Kreislegende. */
export function gruppenfarbe(gruppe) {
  return gruppe === "FW" ? PARTEIEN.FW.farbe : SAMMEL[gruppe]?.farbe ?? null;
}
