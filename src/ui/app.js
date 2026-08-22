// Die Seite: Zustand, Verdrahtung, Zeichnen. Legende, Tabelle, Ablesung und
// Herkunft liegen daneben in eigenen Modulen.

import { zeichneKarte } from "../kern/zeichne.js";
import { $, hole, zahl, vorzeichen, datum } from "./format.js";
import { baueLegende } from "./legende.js";
import { baueTabelle } from "./tabelle.js";
import { baueHerkunft } from "./herkunft.js";
import { verknüpfeAblesung } from "./ablesung.js";

/** Die Skalen stehen im Datensatz, gerechnet von baue.mjs. Siehe kern/skala.js. */
const skalaVon = (daten, liste) => daten.listen.find((l) => l.id === liste) ?? {};

// Der Grundton der Sättigungsskala muss der Untergrund der Karte sein, sonst
// hebt sich die unterste Stufe von ihm ab und „null Prozent" sähe aus wie ein
// kleiner Wert. Aus dem Stylesheet gelesen, damit beides nicht auseinanderläuft.
const stil = getComputedStyle(document.documentElement);
const marke = (name, rückfall) => stil.getPropertyValue(name).trim() || rückfall;
const GRUND = marke("--karte-grund", "#ffffff");
const TINTE = marke("--ink", "#1a1a19");
const SCHRAFFUR = marke("--rule", "#dededa");

const zustand = {
  wahl: null, // ausgewählte Wahl aus dem Verzeichnis
  daten: {}, // ebene -> Datensatz
  kartogramm: null, // vorgerechnete Geometrie, ein Raster je Bezugsgröße
  ansicht: "stärkste",
  ebene: "gemeinderat",
  grundlage: "sitze",
  liste: null,
  gemeinde: null, // angetippte Gemeinde, bleibt bis zum nächsten Tippen stehen
};

// Der Zustand steht in der Adresse. Ohne das ließe sich keine Ansicht
// weitergeben: „AfD, Gewinn und Verlust, Kreistagswahl" wäre nur zu beschreiben,
// nicht zu verlinken. Neu geschrieben wird mit replaceState, damit der
// Zurück-Knopf nicht durch jeden einzelnen Klick zurückläuft.
const AUS_URL = { ansicht: "ansicht", flaeche: "grundlage", ebene: "ebene", liste: "liste", wahl: "wahl" };

function lieseURL() {
  const p = new URLSearchParams(location.search);
  for (const [feld, schlüssel] of Object.entries(AUS_URL)) {
    const wert = p.get(feld);
    if (wert) zustand[schlüssel] = wert;
  }
  return p.get("wahl");
}

function schreibeURL() {
  const p = new URLSearchParams();
  p.set("ansicht", zustand.ansicht);
  p.set("flaeche", zustand.grundlage);
  if (zustand.ansicht === "liste" || zustand.ansicht === "veränderung") {
    p.set("ebene", zustand.ebene);
    p.set("liste", zustand.liste);
  }
  if (verzeichnis.length > 1) p.set("wahl", zustand.wahl.id);
  history.replaceState(null, "", `?${p}`);
}

const verzeichnis = await hole("data/wahlen/index.json");
const gewünschteWahl = lieseURL();

$("wahl").append(
  ...verzeichnis.map((w) => Object.assign(document.createElement("option"), { value: w.id, textContent: w.name }))
);
$("wahl").addEventListener("change", () => ladeWahl($("wahl").value));

$("ansicht").addEventListener("click", (e) => {
  const knopf = e.target.closest("[data-ansicht]");
  if (!knopf) return;
  zustand.ansicht = knopf.dataset.ansicht;
  markiere($("ansicht"), "ansicht", zustand.ansicht);
  zeichneAlles();
});

$("ebene").addEventListener("click", (e) => {
  const knopf = e.target.closest("[data-ebene]");
  if (!knopf) return;
  zustand.ebene = knopf.dataset.ebene;
  markiere($("ebene"), "ebene", zustand.ebene);
  füllListen();
  zeichneAlles();
});

$("grundlage").addEventListener("click", (e) => {
  const knopf = e.target.closest("[data-grundlage]");
  if (!knopf) return;
  zustand.grundlage = knopf.dataset.grundlage;
  markiere($("grundlage"), "grundlage", zustand.grundlage);
  zeichneAlles();
});

$("liste").addEventListener("change", () => {
  zustand.liste = $("liste").value;
  zeichneAlles();
});

await ladeWahl(verzeichnis.some((w) => w.id === gewünschteWahl) ? gewünschteWahl : verzeichnis[0].id);

async function ladeWahl(id) {
  const eintrag = verzeichnis.find((w) => w.id === id);
  zustand.wahl = eintrag;
  $("karte").setAttribute("aria-busy", "true");

  zustand.daten = Object.fromEntries(
    await Promise.all(eintrag.ebenen.map(async (e) => [e, await hole(`data/wahlen/${id}-${e}.json`)]))
  );
  if (!zustand.daten[zustand.ebene]) zustand.ebene = eintrag.ebenen[0];

  const basis = zustand.daten.gemeinderat ?? zustand.daten[eintrag.ebenen[0]];

  // Die Aufteilung ist vorgerechnet und liegt als Datei bereit: ein Raster je
  // Bezugsgröße. Früher löste die Seite das Transportproblem im Browser und zog
  // dafür hexagonalmap über das Netz nach; das kostete bei jedem Aufruf eine
  // knappe Sekunde und bei zwei Bezugsgrößen zwei.
  zustand.kartogramm = await hole(`data/kartogramm/${id}.json`);

  $("stand").textContent = `${basis.gebiet.name} · ${datum(basis.datum)}`;
  document.title = `${basis.titel}, ${basis.gebiet.name}`;

  markiere($("ansicht"), "ansicht", zustand.ansicht);
  markiere($("ebene"), "ebene", zustand.ebene);
  markiere($("grundlage"), "grundlage", zustand.grundlage);
  $("wahl").value = zustand.wahl.id;
  füllListen();
  zeichneAlles();
}

/** Das Raster einer Bezugsgröße aus der vorgerechneten Geometrie. */
function raster(grundlage) {
  return zustand.kartogramm.raster[grundlage] ?? Object.values(zustand.kartogramm.raster)[0];
}

function füllListen() {
  const daten = zustand.daten[zustand.ebene];
  const gewählt = daten.listen.some((l) => l.id === zustand.liste) ? zustand.liste : daten.listen[0].id;
  zustand.liste = gewählt;

  $("liste").replaceChildren(
    ...daten.listen.map((l) =>
      Object.assign(document.createElement("option"), {
        value: l.id,
        textContent: `${l.name ?? l.id}${l.gemeinden < daten.gemeinden.length ? ` (${l.gemeinden} Gemeinden)` : ""}`,
        selected: l.id === gewählt,
      })
    )
  );
}

/** Ebenen, für die es Gewinn und Verlust gibt, nachprüfbar, nicht behauptet. */
function ebenenMitVeränderung() {
  return Object.entries(zustand.daten)
    .filter(([, d]) => d.gemeinden.some((g) => g.ergebnis.some((e) => e.veraenderung != null)))
    .map(([e]) => e);
}

function zeichneAlles() {
  const proListe = zustand.ansicht === "liste" || zustand.ansicht === "veränderung";
  const mitVergleich = ebenenMitVeränderung();

  // Der Knopf steht nur da, wo er auch etwas zeigt. Eine tote Schaltfläche ist
  // ein Versprechen, das die Daten nicht halten.
  $("knopf-veränderung").hidden = !mitVergleich.length;
  if (zustand.ansicht === "veränderung" && !mitVergleich.includes(zustand.ebene)) {
    zustand.ebene = mitVergleich[0];
    markiere($("ebene"), "ebene", zustand.ebene);
    füllListen();
  }

  $("liste-feld").hidden = !proListe;
  $("ebene-feld").hidden = !proListe || zustand.wahl.ebenen.length < 2;
  for (const knopf of $("ebene").querySelectorAll("[data-ebene]")) {
    const erlaubt = zustand.ansicht !== "veränderung" || mitVergleich.includes(knopf.dataset.ebene);
    knopf.disabled = !erlaubt;
    knopf.title = erlaubt ? "" : "Für diese Wahl liegt kein prüfbarer Vorwahlvergleich vor.";
  }

  // Sitze fallen nur im Gemeinderat an; die Kreistagszahlen färben zwar, tragen
  // aber keine Sitzverteilung je Gemeinde.
  const daten = proListe ? zustand.daten[zustand.ebene] : zustand.daten.gemeinderat;

  $("karte").innerHTML = zeichneKarte(raster(zustand.grundlage), daten, {
    ansicht: zustand.ansicht,
    liste: zustand.liste,
    grund: GRUND,
    tinte: TINTE,
    schraffur: SCHRAFFUR,
  });
  $("karte").setAttribute("aria-busy", "false");
  verknüpfeAblesung(daten, zustand);

  schreibeURL();
  beschrifte(daten);
  baueLegende(daten, { ansicht: zustand.ansicht, liste: zustand.liste, grund: GRUND });
  baueHerkunft(daten);
  baueTabelle(daten);
}

/** Was ein Sechseck gerade bedeutet: der Satz kommt in fast jeder Ansicht vor. */
function flaeche() {
  const art = raster(zustand.grundlage).grundlage;
  return art.genau
    ? "Die Fläche einer Gemeinde ist die Größe ihres Rats"
    : `Die Fläche einer Gemeinde ist ihre Einwohnerzahl, ein Sechseck ${art.einheit}`;
}

function beschrifte(daten) {
  const sitze = daten.gemeinden.reduce((a, g) => a + (g.sitze ?? 0), 0);
  const grob = daten.gemeinden.filter((g) => g.genauigkeit === "sammel");

  const name = daten.listen.find((l) => l.id === zustand.liste)?.name ?? zustand.liste;

  // Auf der Einwohnerkarte hat ein Feld keine Entsprechung im Gremium; dort ist
  // es eine Stimmen- und keine Sitzverteilung, und der Knopf sagt das auch.
  const genau = raster(zustand.grundlage).grundlage.genau;
  $("knopf-verteilung").textContent = genau ? "Sitzverteilung" : "Stimmenverteilung";

  if (zustand.ansicht === "liste") {
    const { höchster, stark, decke, gemeinden } = skalaVon(daten, zustand.liste).skala ?? {};
    $("bildunterschrift").textContent =
      `${name}, ${daten.titel}. Die Skala endet bei ${zahl(decke)} %, dem geometrischen Mittel aus dem ` +
      `Spitzenwert dieser Liste (${zahl(höchster)} %) und einem starken Ergebnis auf dieser Karte (${zahl(stark)} %). ` +
      `Damit bleiben schwache Listen untereinander vergleichbar und trotzdem als schwach erkennbar. ` +
      `Angetreten in ${gemeinden} von ${daten.gemeinden.length} Gemeinden, schraffiert die übrigen. ` +
      `${flaeche()}.`;
  } else if (zustand.ansicht === "veränderung") {
    const { tief, hoch, gemeinden } = skalaVon(daten, zustand.liste).wandel ?? {};
    $("bildunterschrift").textContent =
      `${name}: Gewinn und Verlust in Prozentpunkten gegenüber der ${daten.vergleichswahl ?? "Wahl davor"}, ` +
      `von ${vorzeichen(tief)} bis ${vorzeichen(hoch)} Punkten in ${gemeinden} Gemeinden. ${flaeche()}.`;
  } else if (zustand.ansicht === "sitze") {
    $("bildunterschrift").textContent =
      genau
        ? `Ein Sechseck ist ein Sitz, ${sitze} in ${daten.gemeinden.length} Gemeinderäten.`
        : `Ein Sechseck sind ${raster(zustand.grundlage).grundlage.je} Einwohner, gefärbt nach dem Stimmenanteil ` +
          `der Listen. Anders als in der Sitzansicht ist das gerundet: ein Feld hat hier keine Entsprechung im Gremium.`;
  } else {
    $("bildunterschrift").textContent =
      `Je Gemeinde die Liste mit den meisten Sitzen; bei Gleichstand entscheidet der Stimmenanteil. ` +
      `${flaeche()}${genau ? `, zusammen ${sitze} Sitze` : ""}.`;
  }

  const hinweise = [];
  if (grob.length) {
    hinweise.push(
      `In ${grob.length} von ${daten.gemeinden.length} Gemeinden liegen nur die amtlichen Sammelkategorien vor, ` +
        `örtliche Listen erscheinen dort als „Wählergruppen“ oder „Gemeinsame Wahlvorschläge“: ` +
        grob.map((g) => g.name).join(", ") +
        "."
    );
  }
  // Wo die Karte anders zusammenfasst als die amtliche Statistik, gehört das
  // dazu, sonst stünde eine Zahl im Raum, die sich nirgends wiederfindet.
  for (const h of daten.hinweise ?? []) {
    if (!h.liste || zustand.ansicht !== "liste" || zustand.liste === h.liste || zustand.ansicht === "stärkste") {
      hinweise.push(h.text);
    }
  }

  $("hinweis").replaceChildren(...hinweise.map((t) => Object.assign(document.createElement("p"), { textContent: t })));
  $("hinweis").hidden = !hinweise.length;

  $("quellen").textContent = "Quellen: " + daten.quellen.join(" · ");
}

function markiere(gruppe, schlüssel, wert) {
  for (const knopf of gruppe.querySelectorAll("[role=radio]")) {
    knopf.setAttribute("aria-checked", String(knopf.dataset[schlüssel] === wert));
  }
}
