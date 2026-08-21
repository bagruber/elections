import { layout, zeichne, stärkste, spanne, mische } from "../kern/karte.js";

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

function zeichneAlles() {
  const istListe = zustand.ansicht === "liste";
  $("liste-feld").hidden = !istListe;
  $("ebene-feld").hidden = !istListe || zustand.wahl.ebenen.length < 2;

  // Sitze fallen nur im Gemeinderat an; die Kreistagszahlen färben zwar, tragen
  // aber keine Sitzverteilung je Gemeinde.
  const daten = istListe ? zustand.daten[zustand.ebene] : zustand.daten.gemeinderat;

  $("karte").innerHTML = zeichne(zustand.raster, daten, { ansicht: zustand.ansicht, liste: zustand.liste, breite: 1180 });
  $("karte").setAttribute("aria-busy", "false");
  verknüpfeAblesung(daten);

  beschrifte(daten);
  baueLegende(daten);
  baueTabelle(daten);
}

function beschrifte(daten) {
  const sitze = daten.gemeinden.reduce((a, g) => a + (g.sitze ?? 0), 0);
  const grob = daten.gemeinden.filter((g) => g.genauigkeit === "sammel");

  if (zustand.ansicht === "liste") {
    const { höchster, gemeinden } = spanne(daten, zustand.liste);
    const name = daten.listen.find((l) => l.id === zustand.liste)?.name ?? zustand.liste;
    $("bildunterschrift").textContent =
      `${name}, ${daten.titel}. Sättigung von 0 bis ${zahl(höchster)} % — angetreten in ` +
      `${gemeinden} von ${daten.gemeinden.length} Gemeinden, schraffiert die übrigen. ` +
      `Die Fläche bleibt die Größe des Gemeinderats.`;
  } else if (zustand.ansicht === "sitze") {
    $("bildunterschrift").textContent = `Ein Sechseck ist ein Sitz — ${sitze} in ${daten.gemeinden.length} Gemeinderäten.`;
  } else {
    $("bildunterschrift").textContent =
      `Je Gemeinde die Liste mit den meisten Sitzen; bei Gleichstand entscheidet der Stimmenanteil. ` +
      `Die Fläche ist die Größe des Gemeinderats, zusammen ${sitze} Sitze.`;
  }

  $("hinweis").textContent = grob.length
    ? `In ${grob.length} von ${daten.gemeinden.length} Gemeinden liegen nur die amtlichen Sammelkategorien vor — ` +
      `örtliche Listen erscheinen dort als „Wählergruppen“ oder „Gemeinsame Wahlvorschläge“: ` +
      grob.map((g) => g.name).join(", ") +
      "."
    : "";
  $("hinweis").hidden = !grob.length;

  $("quellen").textContent = "Quellen: " + daten.quellen.join(" · ");
}

function baueLegende(daten) {
  const liste = $("legende");

  if (zustand.ansicht === "liste") {
    const { höchster } = spanne(daten, zustand.liste);
    const farbe = daten.listen.find((l) => l.id === zustand.liste)?.farbe ?? "#666";
    const stufen = [0, 0.25, 0.5, 0.75, 1];
    liste.replaceChildren(
      ...stufen.map((t) => eintrag(mische("#f2eee4", farbe, t), `${zahl(höchster * t)} %`)),
      eintrag(null, "nicht angetreten", true)
    );
    return;
  }

  if (zustand.ansicht === "sitze") {
    liste.replaceChildren(
      ...[...daten.listen]
        .sort((a, b) => b.sitze - a.sitze)
        .map((l) => eintrag(l.farbe, `${l.name ?? l.id} · ${l.sitze} ${l.sitze === 1 ? "Sitz" : "Sitze"}`))
    );
    return;
  }

  // Örtliche Listen dürfen sich eine Farbe teilen, solange sie weit auseinander
  // liegen — in der Legende stehen sie dann aber untereinander und sähen wie
  // dieselbe Liste aus. Deshalb nennt sie hier die Gemeinden dazu.
  const nachListe = new Map();
  for (const gemeinde of daten.gemeinden) {
    const s = stärkste(gemeinde);
    const bisher = nachListe.get(s.id) ?? { ...s, sitze: 0, orte: [] };
    bisher.sitze += s.sitze ?? 0;
    bisher.orte.push(gemeinde.name);
    nachListe.set(s.id, bisher);
  }

  liste.replaceChildren(
    ...[...nachListe.values()]
      .sort((a, b) => b.sitze - a.sitze)
      .map((l) => {
        const name = daten.listen.find((x) => x.id === l.id)?.name ?? l.id;
        const wo = l.orte.length > 3 ? `${l.orte.length} Gemeinden` : l.orte.join(", ");
        return eintrag(l.farbe, `${name} · ${wo}`);
      })
  );
}

function eintrag(farbe, text, schraffiert = false) {
  const li = document.createElement("li");
  const feld = document.createElement("span");
  feld.className = schraffiert ? "feldchen schraffiert" : "feldchen";
  if (farbe) feld.style.background = farbe;
  li.append(feld, document.createTextNode(text));
  return li;
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
    wert.textContent = e.sitze != null ? `${e.sitze} · ${zahl(e.anteil)} %` : `${zahl(e.anteil)} %`;
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
    const gefunden = new Map(gemeinde.ergebnis.map((e) => [e.id, e]));
    const werte = listen.map((l) => {
      const e = gefunden.get(l.id);
      if (!e) return "–"; // nicht angetreten
      return e.sitze != null ? `${e.sitze} (${zahl(e.anteil)} %)` : `${zahl(e.anteil)} %`;
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

function datum(iso) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
}
