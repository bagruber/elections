// Zahlen und Daten so schreiben, wie sie auf der Seite stehen sollen.

/** Ein Element per id. */
export const $ = (id) => document.getElementById(id);

export async function hole(pfad) {
  const antwort = await fetch(pfad);
  if (!antwort.ok) throw new Error(`${pfad}: HTTP ${antwort.status}`);
  return antwort.json();
}
export function zahl(v) {
  return v == null ? "–" : v.toLocaleString("de-DE", { maximumFractionDigits: 1 });
}
/** Aufsummierte Anteile schleppen Fließkommareste mit; die gehören nicht in eine Tabelle. */
export function runde(v) {
  return v == null ? null : Math.round(v * 10) / 10;
}
/** Gewinn und Verlust immer mit Vorzeichen, ohne wäre unklar, was gemeint ist. */
export function vorzeichen(v) {
  return v == null ? "–" : (v > 0 ? "+" : "") + zahl(v);
}
export function datum(iso) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
}
