// Die Skalen der Karte.
//
// Sie hängen allein an den Daten, nicht an der Darstellung, und werden deshalb
// im Build ausgerechnet und in den Datensatz geschrieben. Vorher stand dieselbe
// Rechnung zweimal da, einmal in JavaScript für die Standalone-Seite und einmal
// in TypeScript für den Datahub. Zwei Fassungen einer Formel laufen irgendwann
// auseinander, ohne dass es jemand merkt.

/**
 * Wie stark die Skala einer einzelnen Liste an die Karte gekoppelt wird.
 *
 * 0 hieße: jede Liste bekommt ihre eigene Skala, die bei ihrem eigenen
 * Spitzenwert endet. Dann sieht eine FDP mit sieben Prozent genauso satt aus
 * wie eine CSU mit zweiundvierzig, und der Vergleich zwischen Listen ist
 * verloren. 1 hieße: alle teilen sich eine Skala bis zum stärksten Wert der
 * Karte. Dann bleibt die FDP überall gleich blass, und der Vergleich zwischen
 * Gemeinden ist verloren.
 *
 * 0,5 legt die Obergrenze auf das geometrische Mittel aus beidem. Die FDP
 * erreicht damit an ihrer besten Stelle gut die Hälfte der Skala statt eines
 * Fünftels oder des Ganzen: als schwach erkennbar, aber innerlich abgestuft.
 */
export const KOPPLUNG = 0.5;

/**
 * Der Wert einer Legendenzeile in einer Gemeinde. Ausgewählt wird immer eine
 * Gruppe; wo eine Gemeinde mehrere Listen derselben Gruppe hat, etwa FW und FWO
 * in Langenbach, werden sie addiert.
 *
 * @param {"anteil"|"veraenderung"|"sitze"} feld
 */
export function wert(gemeinde, liste, feld = "anteil") {
  const treffer = (gemeinde?.ergebnis ?? []).filter((e) => (e.gruppe ?? e.id) === liste);
  const werte = treffer.map((e) => e[feld]).filter((v) => v != null);
  return werte.length ? werte.reduce((a, b) => a + b, 0) : null;
}

/** Die Skala der Ansicht „Eine Liste“. */
export function spanne(gemeinden, liste) {
  const werte = gemeinden.map((g) => wert(g, liste, "anteil")).filter((v) => v != null);
  const höchster = Math.max(0, ...werte);
  const stark = starkesErgebnis(alleGruppenwerte(gemeinden, "anteil"));
  return {
    höchster: runde(höchster),
    stark: runde(stark),
    decke: runde(höchster > 0 ? höchster ** (1 - KOPPLUNG) * stark ** KOPPLUNG : 0),
    gemeinden: werte.length,
  };
}

/**
 * Dasselbe für Gewinn und Verlust. Der Ausschlag ist symmetrisch: eine Skala,
 * die nach oben weiter reicht als nach unten, ließe drei Punkte Verlust
 * kräftiger aussehen als drei Punkte Gewinn.
 */
export function schwankung(gemeinden, liste) {
  const werte = gemeinden.map((g) => wert(g, liste, "veraenderung")).filter((v) => v != null);
  if (!werte.length) return null;

  const eigener = Math.max(...werte.map(Math.abs));
  const stark = starkesErgebnis(alleGruppenwerte(gemeinden, "veraenderung").map((v) => (v == null ? null : Math.abs(v))));
  return {
    ausschlag: runde(eigener ** (1 - KOPPLUNG) * stark ** KOPPLUNG),
    tief: runde(Math.min(...werte)),
    hoch: runde(Math.max(...werte)),
    gemeinden: werte.length,
  };
}

/**
 * Was auf dieser Karte als starkes Ergebnis gilt: der Wert, den nur jedes
 * zehnte Gemeindeergebnis übertrifft.
 *
 * Nicht das Maximum. In Hörgertshausen tritt eine einzige Liste an und holt
 * 99,8 Prozent; als Bezugsgröße zöge dieser eine Sonderfall jede Skala so weit
 * hoch, dass nirgends mehr etwas sättigt. Was darüber liegt, läuft ans obere
 * Ende, und das ist kein Verlust: ganz oben ist ganz oben.
 */
function starkesErgebnis(werte) {
  const sortiert = werte.filter((v) => v != null).sort((a, b) => a - b);
  return sortiert.length ? sortiert[Math.floor((sortiert.length - 1) * 0.9)] : 0;
}

/** Alle Gemeindewerte, nach Gruppen zusammengefasst, als Maßstab der Karte. */
function alleGruppenwerte(gemeinden, feld) {
  return gemeinden.flatMap((g) => [...new Set(g.ergebnis.map((e) => e.gruppe ?? e.id))].map((id) => wert(g, id, feld)));
}

const runde = (v) => Math.round(v * 10) / 10;
