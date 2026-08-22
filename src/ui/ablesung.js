// Was beim Zeigen auf eine Gemeinde erscheint.

import { $, zahl, vorzeichen } from "./format.js";

/**
 * Das vollständige Ergebnis einer Gemeinde ausgeben, beim Zeigen wie beim
 * Tippen.
 *
 * Zeigen allein reicht nicht: auf einem Telefon gibt es keinen Zeiger, und ein
 * Drittel der Gemeinden trägt auf der Einwohnerkarte keinen Namen, weil kein
 * Platz dafür ist. Ein Tipp wählt deshalb aus und bleibt stehen, bis der
 * nächste kommt; Zeigen blättert nur darüber.
 *
 * Ein Zuhörer am Behälter statt je Gebiet einer: die Karte wird bei jedem
 * Umschalten neu gesetzt, und so hängt nichts an den ausgetauschten Knoten.
 */
export function verknüpfeAblesung(daten, zustand) {
  const nachAgs = new Map(daten.gemeinden.map((g) => [g.ags, g]));
  const namen = new Map(daten.listen.map((l) => [l.id, l.name ?? l.id]));
  const behälter = $("karte");

  for (const gruppe of behälter.querySelectorAll("g[data-id]")) gruppe.setAttribute("tabindex", "0");

  const agsVon = (e) => e.target.closest("g[data-id]")?.dataset.id;
  const zeige = (ags) => {
    const gemeinde = nachAgs.get(ags);
    if (gemeinde) zeigeGemeinde(gemeinde, namen);
  };

  const markiereAuswahl = () => {
    for (const gruppe of behälter.querySelectorAll("g[data-id]")) {
      gruppe.classList.toggle("gewählt", gruppe.dataset.id === zustand.gemeinde);
    }
  };

  behälter.onpointerover = behälter.onfocusin = (e) => zeige(agsVon(e));
  behälter.onclick = (e) => {
    const ags = agsVon(e);
    if (!ags) return;
    zustand.gemeinde = zustand.gemeinde === ags ? null : ags;
    markiereAuswahl();
    zeige(ags);
  };
  // Verlässt der Zeiger die Karte, kommt die ausgewählte Gemeinde zurück.
  behälter.onpointerleave = () => (zustand.gemeinde ? zeige(zustand.gemeinde) : null);

  markiereAuswahl();
  if (zustand.gemeinde) zeige(zustand.gemeinde);
}
export function zeigeGemeinde(gemeinde, namen) {
  const kopf = document.createElement("p");
  kopf.className = "ablesung-kopf";
  kopf.textContent = gemeinde.sitze ? `${gemeinde.name} · ${gemeinde.sitze} Sitze` : gemeinde.name;

  const zeilen = gemeinde.ergebnis.map((e) => {
    const li = document.createElement("li");
    const feld = document.createElement("span");
    feld.className = "feldchen";
    feld.style.background = e.farbe;
    const name = document.createElement("span");
    name.className = "ablesung-name";
    name.textContent = namen.get(e.id) ?? e.id;
    const wert = document.createElement("span");
    wert.className = "ablesung-wert";
    const anteil = e.sitze != null ? `${e.sitze} · ${zahl(e.anteil)} %` : `${zahl(e.anteil)} %`;
    wert.textContent = e.veraenderung != null ? `${anteil} (${vorzeichen(e.veraenderung)})` : anteil;
    li.append(feld, name, wert);
    return li;
  });

  const ul = document.createElement("ul");
  ul.append(...zeilen);

  const teile = [kopf, ul];
  if (gemeinde.genauigkeit === "sammel") {
    const fuss = document.createElement("p");
    fuss.className = "ablesung-fuss";
    fuss.textContent = "Nur amtliche Sammelkategorien, örtliche Listen sind hier nicht einzeln ausgewiesen.";
    teile.push(fuss);
  }
  $("ablesung").replaceChildren(...teile);
}
