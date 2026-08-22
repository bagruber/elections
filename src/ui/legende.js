// Die Legende, je Ansicht eine andere.
//
// Sättigungsskala und Veränderungsskala zeigen Stufen, die Sitzansicht alle
// Zeilen der Kreislegende, die Übersicht nur das, was irgendwo stärkste Liste
// ist. Jede Zeile trägt einen dünnen Balken mit dem Gewicht im Landkreis.

import { stärkste, farbeVeraenderung } from "../kern/zeichne.js";
import { mische } from "../kern/farbe.js";
import { $, zahl, vorzeichen } from "./format.js";

/** Die Skalen stehen im Datensatz, gerechnet von baue.mjs. Siehe kern/skala.js. */
const skalaVon = (daten, liste) => daten.listen.find((l) => l.id === liste) ?? {};

export function baueLegende(daten, { ansicht, liste, grund }) {
  const ziel = $("legende");
  const untertitel = $("legende-mass");

  if (ansicht === "liste") {
    const { decke = 0 } = skalaVon(daten, liste).skala ?? {};
    const farbe = daten.listen.find((l) => l.id === liste)?.farbe ?? "#666";
    untertitel.textContent = "Stimmenanteil in der Gemeinde";
    ziel.replaceChildren(
      ...[0, 0.25, 0.5, 0.75, 1].map((t) => eintrag({ farbe: mische(grund, farbe, t), text: `${zahl(decke * t)} %` })),
      eintrag({ text: "nicht angetreten", schraffiert: true })
    );
    return;
  }

  if (ansicht === "veränderung") {
    const { ausschlag = 0 } = skalaVon(daten, liste).wandel ?? {};
    untertitel.textContent = `Prozentpunkte gegenüber der ${daten.vergleichswahl ?? "Wahl davor"}`;
    ziel.replaceChildren(
      ...[-1, -0.5, 0, 0.5, 1].map((t) =>
        eintrag({ farbe: farbeVeraenderung(ausschlag * t, ausschlag, grund), text: `${vorzeichen(ausschlag * t)} Punkte` })
      )
    );
    return;
  }

  // In der Sitzansicht steht jede Liste für sich; die Gruppen der Kreislegende
  // wären dort irreführend, weil die Felder einzeln gefärbt sind.
  const zeilen = ansicht === "sitze" ? gruppenLegende(daten) : stärkstenLegende(daten);
  const grösste = Math.max(...zeilen.map((z) => z.wert), 1);
  untertitel.textContent = daten.ebene === "gemeinderat" ? "Sitze im Landkreis" : "Stimmenanteil im Landkreis";

  ziel.replaceChildren(
    ...zeilen.map((z) =>
      eintrag({ farbe: z.farbe, text: z.text, anteil: z.wert / grösste, wert: z.beschriftung, titel: z.titel })
    )
  );
}
/** Die Kreislegende: Gruppen nach Gewicht, mit dem, woraus sie bestehen. */
export function gruppenLegende(daten) {
  return [...daten.listen]
    .sort((a, b) => (b.sitze || b.anteil) - (a.sitze || a.anteil))
    .map((l) => ({
      farbe: l.farbe,
      text: l.name ?? l.id,
      wert: daten.ebene === "gemeinderat" ? l.sitze : l.anteil,
      beschriftung: daten.ebene === "gemeinderat" ? `${l.sitze}` : `${zahl(l.anteil)} %`,
      // Wer sich hinter einer Gruppe verbirgt, steht im Titel statt in der
      // Zeile, sonst wäre die Legende länger als die Karte.
      titel: l.teile
        ? `${l.name}: ` +
          l.teile.map((t) => `${t.name} ${t.sitze}`).join(", ") +
          (l.unbenannt ? `, ${l.unbenannt} ohne Listennamen` : "")
        : null,
    }));
}
/**
 * Die Übersicht zeigt nur, was irgendwo stärkste Liste ist. Örtliche Listen
 * dürfen sich eine Farbe teilen, solange sie weit auseinander liegen, in der
 * Legende stünden sie dann untereinander und sähen wie dieselbe Liste aus.
 * Deshalb nennt sie hier die Gemeinden dazu.
 */
export function stärkstenLegende(daten) {
  const nachGruppe = new Map();
  for (const gemeinde of daten.gemeinden) {
    const s = stärkste(gemeinde);
    const schlüssel = s.gruppe ?? s.id;
    const bisher = nachGruppe.get(schlüssel) ?? { farbe: gruppenfarbe(daten, schlüssel, s), orte: [] };
    bisher.orte.push(gemeinde.name);
    nachGruppe.set(schlüssel, bisher);
  }

  // Der Balken zeigt dasselbe wie in der Sitzansicht: das Gewicht im ganzen
  // Landkreis. Die Zahl der Gemeinden, in denen eine Liste vorn liegt, wäre
  // hier fast überall eins und sagte nichts.
  const gewicht = (schlüssel) => daten.listen.find((x) => x.id === schlüssel) ?? {};

  return [...nachGruppe]
    .sort((a, b) => b[1].orte.length - a[1].orte.length || (gewicht(b[0]).sitze ?? 0) - (gewicht(a[0]).sitze ?? 0))
    .map(([schlüssel, l]) => ({
      farbe: l.farbe,
      text: gewicht(schlüssel).name ?? schlüssel,
      wert: gewicht(schlüssel).sitze ?? gewicht(schlüssel).anteil ?? 0,
      // Bei vier Farben für einunddreißig örtliche Listen stehen manche
      // Legendenzeilen im selben Blau. Auf der Karte stören sie sich nicht, sie
      // liegen nie nebeneinander, in der Legende schon. Deshalb steht dort die
      // Gemeinde dabei, solange es eine oder zwei sind.
      beschriftung: l.orte.length <= 2 ? l.orte.join(", ") : `vorn in ${l.orte.length} Gemeinden`,
      titel: `Vorn in: ${l.orte.join(", ")}`,
    }));
}
// Bewusst eine Funktionsdeklaration und keine Pfeilfunktion: das Modul ruft
// ladeWahl() schon oben mit await auf, und ein const weiter unten ist zu diesem
// Zeitpunkt noch nicht belegt.
export function gruppenfarbe(daten, schlüssel, rückfall) {
  return daten.listen.find((l) => l.id === schlüssel)?.farbe ?? rückfall.farbe;
}
/**
 * Eine Legendenzeile. Der Balken liegt als dünne Linie unter der Zeile statt
 * als eigene Spalte: er soll die Größenverhältnisse nachtragen, nicht mit dem
 * Namen um Aufmerksamkeit streiten.
 */
export function eintrag({ farbe, text, schraffiert = false, anteil = null, wert = null, titel = null }) {
  const li = document.createElement("li");
  if (titel) li.title = titel;

  const feld = document.createElement("span");
  feld.className = schraffiert ? "feldchen schraffiert" : "feldchen";
  if (farbe) feld.style.background = farbe;

  const name = document.createElement("span");
  name.className = "legende-name";
  name.textContent = text;
  li.append(feld, name);

  if (wert != null) {
    const zahlfeld = document.createElement("span");
    zahlfeld.className = "legende-wert";
    zahlfeld.textContent = wert;
    li.append(zahlfeld);
  }
  if (anteil != null) {
    li.classList.add("mit-balken");
    li.style.setProperty("--balken", `${(anteil * 100).toFixed(1)}%`);
    li.style.setProperty("--balkenfarbe", farbe ?? "currentColor");
  }
  return li;
}
