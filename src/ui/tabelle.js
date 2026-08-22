// Alle Zahlen im Klartext.
//
// Der zweite Kanal neben der Farbe, und der einzige, der auch dann trägt, wenn
// Rot und Grün nicht auseinanderzuhalten sind.

import { $, zahl, runde } from "./format.js";

export function baueTabelle(daten) {
  const listen = daten.listen;
  const kopf = ["Gemeinde", daten.ebene === "gemeinderat" ? "Sitze" : "", ...listen.map((l) => l.name ?? l.id)].filter(
    (t, i) => i !== 1 || t
  );

  const zeile = (zellen, tag = "td") => {
    const tr = document.createElement("tr");
    tr.append(
      ...zellen.map((z) => {
        const zelle = document.createElement(tag);
        if (typeof z === "string") zelle.textContent = z;
        else Object.assign(zelle, z);
        return zelle;
      })
    );
    return tr;
  };

  const thead = document.createElement("thead");
  thead.append(zeile(kopf, "th"));

  const tbody = document.createElement("tbody");
  for (const gemeinde of daten.gemeinden) {
    // Die Spalten sind Gruppen, die Zeilen einer Gemeinde sind Einzellisten;
    // „CSU/FW" gehört in die Spalte „Gemeinsame Wahlvorschläge". Was in einer
    // Gemeinde mehrere Listen einer Gruppe sind, wird hier zusammengezählt und
    // beim Namen genannt.
    const gefunden = new Map();
    for (const e of gemeinde.ergebnis) {
      const schlüssel = e.gruppe ?? e.id;
      const bisher = gefunden.get(schlüssel) ?? { sitze: null, anteil: null, namen: [] };
      if (e.sitze != null) bisher.sitze = (bisher.sitze ?? 0) + e.sitze;
      if (e.anteil != null) bisher.anteil = (bisher.anteil ?? 0) + e.anteil;
      if (schlüssel !== e.id) bisher.namen.push(e.id);
      gefunden.set(schlüssel, bisher);
    }

    const werte = listen.map((l) => {
      const e = gefunden.get(l.id);
      if (!e) return "–"; // nicht angetreten
      const zahlteil = e.sitze != null ? `${e.sitze} (${zahl(runde(e.anteil))} %)` : `${zahl(runde(e.anteil))} %`;
      return e.namen.length ? `${zahlteil} · ${e.namen.join(", ")}` : zahlteil;
    });
    tbody.append(zeile([gemeinde.name, ...(daten.ebene === "gemeinderat" ? [String(gemeinde.sitze)] : []), ...werte]));
  }

  $("tabelle").replaceChildren(thead, tbody);
}
