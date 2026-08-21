import { layout, zeichne, stärkste, spanne, schwankung, mische, farbeVeraenderung, GRUND } from "../kern/karte.js";

const $ = (id) => document.getElementById(id);

const zustand = {
  wahl: null, // ausgewählte Wahl aus dem Verzeichnis
  daten: {}, // ebene -> Datensatz
  raster: null, // Hexagon-Layout, einmal je Wahl
  ansicht: "stärkste",
  ebene: "gemeinderat",
  liste: null,
};

const verzeichnis = await hole("data/wahlen/index.json");

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

$("liste").addEventListener("change", () => {
  zustand.liste = $("liste").value;
  zeichneAlles();
});

await ladeWahl(verzeichnis[0].id);

async function ladeWahl(id) {
  const eintrag = verzeichnis.find((w) => w.id === id);
  zustand.wahl = eintrag;
  $("karte").setAttribute("aria-busy", "true");

  zustand.daten = Object.fromEntries(
    await Promise.all(eintrag.ebenen.map(async (e) => [e, await hole(`data/wahlen/${id}-${e}.json`)]))
  );
  if (!zustand.daten[zustand.ebene]) zustand.ebene = eintrag.ebenen[0];

  const basis = zustand.daten.gemeinderat ?? zustand.daten[eintrag.ebenen[0]];
  const [gebiete, grenze] = await Promise.all([
    hole(`data/geo/${basis.gebiet.datensatz}/teile.geojson`),
    hole(`data/geo/${basis.gebiet.datensatz}/grenze.geojson`),
  ]);

  $("stand").textContent = `${basis.gebiet.name} · ${datum(basis.datum)}`;
  document.title = `${basis.titel} — ${basis.gebiet.name}`;

  // Ein Layout für alle Ansichten: die Fläche steht immer für die Sitze im
  // Gemeinderat, nur die Färbung wechselt.
  zustand.raster = layout({ gebiete, grenze, wahl: basis });

  markiere($("ebene"), "ebene", zustand.ebene);
  füllListen();
  zeichneAlles();
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

/** Ebenen, für die es Gewinn und Verlust gibt — nachprüfbar, nicht behauptet. */
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

  $("karte").innerHTML = zeichne(zustand.raster, daten, { ansicht: zustand.ansicht, liste: zustand.liste, breite: 1180 });
  $("karte").setAttribute("aria-busy", "false");
  verknüpfeAblesung(daten);

  beschrifte(daten);
  baueLegende(daten);
  baueHerkunft(daten);
  baueTabelle(daten);
}

function beschrifte(daten) {
  const sitze = daten.gemeinden.reduce((a, g) => a + (g.sitze ?? 0), 0);
  const grob = daten.gemeinden.filter((g) => g.genauigkeit === "sammel");

  const name = daten.listen.find((l) => l.id === zustand.liste)?.name ?? zustand.liste;

  if (zustand.ansicht === "liste") {
    const { höchster, stark, decke, gemeinden } = spanne(daten, zustand.liste);
    $("bildunterschrift").textContent =
      `${name}, ${daten.titel}. Die Skala endet bei ${zahl(decke)} % — dem geometrischen Mittel aus dem ` +
      `Spitzenwert dieser Liste (${zahl(höchster)} %) und einem starken Ergebnis auf dieser Karte (${zahl(stark)} %). ` +
      `Damit bleiben schwache Listen untereinander vergleichbar und trotzdem als schwach erkennbar. ` +
      `Angetreten in ${gemeinden} von ${daten.gemeinden.length} Gemeinden, schraffiert die übrigen.`;
  } else if (zustand.ansicht === "veränderung") {
    const { tief, hoch, gemeinden } = schwankung(daten, zustand.liste);
    $("bildunterschrift").textContent =
      `${name}: Gewinn und Verlust in Prozentpunkten gegenüber der ${daten.vergleichswahl ?? "Wahl davor"}, ` +
      `von ${vorzeichen(tief)} bis ${vorzeichen(hoch)} Punkten in ${gemeinden} Gemeinden. ` +
      `Die Fläche bleibt die Größe des Gemeinderats.`;
  } else if (zustand.ansicht === "sitze") {
    $("bildunterschrift").textContent = `Ein Sechseck ist ein Sitz — ${sitze} in ${daten.gemeinden.length} Gemeinderäten.`;
  } else {
    $("bildunterschrift").textContent =
      `Je Gemeinde die Liste mit den meisten Sitzen; bei Gleichstand entscheidet der Stimmenanteil. ` +
      `Die Fläche ist die Größe des Gemeinderats, zusammen ${sitze} Sitze.`;
  }

  const hinweise = [];
  if (grob.length) {
    hinweise.push(
      `In ${grob.length} von ${daten.gemeinden.length} Gemeinden liegen nur die amtlichen Sammelkategorien vor — ` +
        `örtliche Listen erscheinen dort als „Wählergruppen“ oder „Gemeinsame Wahlvorschläge“: ` +
        grob.map((g) => g.name).join(", ") +
        "."
    );
  }
  // Wo die Karte anders zusammenfasst als die amtliche Statistik, gehört das
  // dazu — sonst stünde eine Zahl im Raum, die sich nirgends wiederfindet.
  for (const h of daten.hinweise ?? []) {
    if (!h.liste || zustand.ansicht !== "liste" || zustand.liste === h.liste || zustand.ansicht === "stärkste") {
      hinweise.push(h.text);
    }
  }

  $("hinweis").replaceChildren(...hinweise.map((t) => Object.assign(document.createElement("p"), { textContent: t })));
  $("hinweis").hidden = !hinweise.length;

  $("quellen").textContent = "Quellen: " + daten.quellen.join(" · ");
}

function baueLegende(daten) {
  const liste = $("legende");
  const untertitel = $("legende-mass");

  if (zustand.ansicht === "liste") {
    const { decke } = spanne(daten, zustand.liste);
    const farbe = daten.listen.find((l) => l.id === zustand.liste)?.farbe ?? "#666";
    untertitel.textContent = "Stimmenanteil in der Gemeinde";
    liste.replaceChildren(
      ...[0, 0.25, 0.5, 0.75, 1].map((t) => eintrag({ farbe: mische(GRUND, farbe, t), text: `${zahl(decke * t)} %` })),
      eintrag({ text: "nicht angetreten", schraffiert: true })
    );
    return;
  }

  if (zustand.ansicht === "veränderung") {
    const { ausschlag } = schwankung(daten, zustand.liste);
    untertitel.textContent = `Prozentpunkte gegenüber der ${daten.vergleichswahl ?? "Wahl davor"}`;
    liste.replaceChildren(
      ...[-1, -0.5, 0, 0.5, 1].map((t) =>
        eintrag({ farbe: farbeVeraenderung(ausschlag * t, ausschlag), text: `${vorzeichen(ausschlag * t)} Punkte` })
      )
    );
    return;
  }

  // In der Sitzansicht steht jede Liste für sich; die Gruppen der Kreislegende
  // wären dort irreführend, weil die Felder einzeln gefärbt sind.
  const zeilen = zustand.ansicht === "sitze" ? gruppenLegende(daten) : stärkstenLegende(daten);
  const grösste = Math.max(...zeilen.map((z) => z.wert), 1);
  untertitel.textContent = daten.ebene === "gemeinderat" ? "Sitze im Landkreis" : "Stimmenanteil im Landkreis";

  liste.replaceChildren(
    ...zeilen.map((z) =>
      eintrag({ farbe: z.farbe, text: z.text, anteil: z.wert / grösste, wert: z.beschriftung, titel: z.titel })
    )
  );
}

/** Die Kreislegende: Gruppen nach Gewicht, mit dem, woraus sie bestehen. */
function gruppenLegende(daten) {
  return [...daten.listen]
    .sort((a, b) => (b.sitze || b.anteil) - (a.sitze || a.anteil))
    .map((l) => ({
      farbe: l.farbe,
      text: l.name ?? l.id,
      wert: daten.ebene === "gemeinderat" ? l.sitze : l.anteil,
      beschriftung: daten.ebene === "gemeinderat" ? `${l.sitze}` : `${zahl(l.anteil)} %`,
      // Wer sich hinter einer Gruppe verbirgt, steht im Titel statt in der
      // Zeile — sonst wäre die Legende länger als die Karte.
      titel: l.teile
        ? `${l.name}: ` +
          l.teile.map((t) => `${t.name} ${t.sitze}`).join(", ") +
          (l.unbenannt ? `, ${l.unbenannt} ohne Listennamen` : "")
        : null,
    }));
}

/**
 * Die Übersicht zeigt nur, was irgendwo stärkste Liste ist. Örtliche Listen
 * dürfen sich eine Farbe teilen, solange sie weit auseinander liegen — in der
 * Legende stünden sie dann untereinander und sähen wie dieselbe Liste aus.
 * Deshalb nennt sie hier die Gemeinden dazu.
 */
function stärkstenLegende(daten) {
  const nachGruppe = new Map();
  for (const gemeinde of daten.gemeinden) {
    const s = stärkste(gemeinde);
    const schlüssel = s.gruppe ?? s.id;
    const bisher = nachGruppe.get(schlüssel) ?? { farbe: gruppenfarbe(daten, schlüssel, s), orte: [] };
    bisher.orte.push(gemeinde.name);
    nachGruppe.set(schlüssel, bisher);
  }

  // Der Balken zeigt dasselbe wie in der Sitzansicht — das Gewicht im ganzen
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
      // Legendenzeilen im selben Blau. Auf der Karte stören sie sich nicht — sie
      // liegen nie nebeneinander —, in der Legende schon. Deshalb steht dort die
      // Gemeinde dabei, solange es eine oder zwei sind.
      beschriftung: l.orte.length <= 2 ? l.orte.join(", ") : `vorn in ${l.orte.length} Gemeinden`,
      titel: `Vorn in: ${l.orte.join(", ")}`,
    }));
}

// Bewusst eine Funktionsdeklaration und keine Pfeilfunktion: das Modul ruft
// ladeWahl() schon oben mit await auf, und ein const weiter unten ist zu diesem
// Zeitpunkt noch nicht belegt.
function gruppenfarbe(daten, schlüssel, rückfall) {
  return daten.listen.find((l) => l.id === schlüssel)?.farbe ?? rückfall.farbe;
}

/**
 * Eine Legendenzeile. Der Balken liegt als dünne Linie unter der Zeile statt
 * als eigene Spalte: er soll die Größenverhältnisse nachtragen, nicht mit dem
 * Namen um Aufmerksamkeit streiten.
 */
function eintrag({ farbe, text, schraffiert = false, anteil = null, wert = null, titel = null }) {
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

/**
 * Woher jede Art von Zahl stammt. Die Frage stellt sich bei dieser Karte
 * zwangsläufig, weil zwei Quellen nebeneinanderliegen, die verschieden viel
 * wissen — und weil eine dritte Angabe bewusst fehlt.
 */
function baueHerkunft(daten) {
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
        : "—",
    ],
    [
      "Gewählte namentlich",
      "Wahlleitungen der Gemeinden",
      mitGewählten.length ? `${mitGewählten.length} von ${daten.gemeinden.length} Gemeinden.` : "liegt für diese Ebene nicht vor.",
    ],
    [
      "Gewinn und Verlust",
      mitVergleich.length ? "Vergleichsgrafik der Wahlleitung" : "—",
      mitVergleich.length
        ? `${mitVergleich.length} von ${daten.gemeinden.length} Gemeinden, gegenüber der ${daten.vergleichswahl}. ` +
          `Gerechnet aus den beiden ausgewiesenen Ergebnissen, nicht aus der Spalte „Gewinn und Verlust“ der ` +
          `Übersichtstabelle: die weicht bei zwei Dritteln der Listen davon ab.`
        : `nicht ausgewiesen. Die Gemeindeseiten führen zwar eine Spalte dafür, aber keinen Vorwahlvergleich, ` +
          `an dem sie sich prüfen ließe — und dieselbe Spalte ist auf den Kreistagsseiten nachweislich falsch.`,
    ],
  ];

  const dl = document.createElement("dl");
  for (const [was, woher, wieviel] of zeilen) {
    const dt = document.createElement("dt");
    dt.textContent = was;
    const dd = document.createElement("dd");
    const quelle = document.createElement("strong");
    quelle.textContent = woher;
    dd.append(quelle, document.createTextNode(` — ${wieviel}`));
    dl.append(dt, dd);
  }
  $("herkunft").replaceChildren(dl);
}

/**
 * Beim Zeigen auf eine Fläche das vollständige Ergebnis der Gemeinde ausgeben.
 * Ein Zuhörer am Behälter statt je Gebiet einer: die Karte wird bei jedem
 * Umschalten neu gesetzt, und so hängt nichts an den ausgetauschten Knoten.
 */
function verknüpfeAblesung(daten) {
  const nachAgs = new Map(daten.gemeinden.map((g) => [g.ags, g]));
  const namen = new Map(daten.listen.map((l) => [l.id, l.name ?? l.id]));

  for (const gruppe of $("karte").querySelectorAll("g[data-id]")) gruppe.setAttribute("tabindex", "0");

  const behälter = $("karte");
  behälter.onpointerover = behälter.onfocusin = (e) => {
    const gemeinde = nachAgs.get(e.target.closest("g[data-id]")?.dataset.id);
    if (gemeinde) zeigeGemeinde(gemeinde, namen);
  };
}

function zeigeGemeinde(gemeinde, namen) {
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
    fuss.textContent = "Nur amtliche Sammelkategorien — örtliche Listen sind hier nicht einzeln ausgewiesen.";
    teile.push(fuss);
  }
  $("ablesung").replaceChildren(...teile);
}

function baueTabelle(daten) {
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
    // Die Spalten sind Gruppen, die Zeilen einer Gemeinde sind Einzellisten —
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

function markiere(gruppe, schlüssel, wert) {
  for (const knopf of gruppe.querySelectorAll("[role=radio]")) {
    knopf.setAttribute("aria-checked", String(knopf.dataset[schlüssel] === wert));
  }
}

async function hole(pfad) {
  const antwort = await fetch(pfad);
  if (!antwort.ok) throw new Error(`${pfad}: HTTP ${antwort.status}`);
  return antwort.json();
}

function zahl(v) {
  return v == null ? "–" : v.toLocaleString("de-DE", { maximumFractionDigits: 1 });
}

/** Aufsummierte Anteile schleppen Fließkommareste mit; die gehören nicht in eine Tabelle. */
function runde(v) {
  return v == null ? null : Math.round(v * 10) / 10;
}

/** Gewinn und Verlust immer mit Vorzeichen — ohne wäre unklar, was gemeint ist. */
function vorzeichen(v) {
  return v == null ? "–" : (v > 0 ? "+" : "") + zahl(v);
}

function datum(iso) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
}
