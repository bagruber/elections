// Woher welche Angabe stammt.
//
// Bei zwei Quellen, die verschieden viel wissen, gehört das auf die Seite und
// nicht nur ins README: wer auf die Karte zeigt, macht kein README auf.

import { $ } from "./format.js";

/**
 * Woher jede Art von Zahl stammt. Die Frage stellt sich bei dieser Karte
 * zwangsläufig, weil zwei Quellen nebeneinanderliegen, die verschieden viel
 * wissen, und weil eine dritte Angabe bewusst fehlt.
 */
export function baueHerkunft(daten) {
  const mitListen = daten.gemeinden.filter((g) => g.genauigkeit === "listen");
  const ohne = daten.gemeinden.filter((g) => g.genauigkeit === "sammel");
  const mitGewählten = daten.gemeinden.filter((g) => g.gewaehlte?.length);
  const mitVergleich = daten.gemeinden.filter((g) => g.ergebnis.some((e) => e.veraenderung != null));

  const zeilen = [
    [
      "Sitze und Stimmen",
      "Bayerisches Landesamt für Statistik (GENESIS-Online)",
      `alle ${daten.gemeinden.length} Gemeinden. Jede Sitzsumme aus einer Gemeindequelle wird dagegen geprüft; ` +
        `weicht sie ab, wird der Datensatz nicht gebaut.`,
    ],
    [
      "Listennamen",
      "Wahlleitungen der Gemeinden",
      mitListen.length
        ? `${mitListen.length} von ${daten.gemeinden.length} Gemeinden.` +
          (ohne.length ? ` Ohne eigene Quelle und daher nur mit amtlichen Sammelkategorien: ${ohne.map((g) => g.name).join(", ")}.` : "")
        : "–",
    ],
    [
      "Gewählte namentlich",
      "Wahlleitungen der Gemeinden",
      mitGewählten.length ? `${mitGewählten.length} von ${daten.gemeinden.length} Gemeinden.` : "liegt für diese Ebene nicht vor.",
    ],
    [
      "Gewinn und Verlust",
      mitVergleich.length ? "Vergleichsgrafik der Wahlleitung" : "–",
      mitVergleich.length
        ? `${mitVergleich.length} von ${daten.gemeinden.length} Gemeinden, gegenüber der ${daten.vergleichswahl}. ` +
          `Gerechnet aus den beiden ausgewiesenen Ergebnissen, nicht aus der Spalte „Gewinn und Verlust“ der ` +
          `Übersichtstabelle: die weicht bei zwei Dritteln der Listen davon ab.`
        : `nicht ausgewiesen. Die Gemeindeseiten führen zwar eine Spalte dafür, aber keinen Vorwahlvergleich, ` +
          `an dem sie sich prüfen ließe, und dieselbe Spalte ist auf den Kreistagsseiten nachweislich falsch.`,
    ],
  ];

  const dl = document.createElement("dl");
  for (const [was, woher, wieviel] of zeilen) {
    const dt = document.createElement("dt");
    dt.textContent = was;
    const dd = document.createElement("dd");
    const quelle = document.createElement("strong");
    quelle.textContent = woher;
    dd.append(quelle, document.createTextNode(`, ${wieviel}`));
    dl.append(dt, dd);
  }
  $("herkunft").replaceChildren(dl);
}
