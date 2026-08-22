# Nachgepflegte Listen

Die amtliche Statistik führt örtliche Listen nur als „Wählergruppen" und
„Gemeinsame Wahlvorschläge". Wo eine Gemeindewahlleitung ihr Ergebnis
maschinenlesbar veröffentlicht, steht die Adresse in `data/register.json` und
wird abgerufen. Für alle übrigen gibt es diese Datei.

Je Wahl eine CSV, benannt wie die Wahl. Eine Zeile je Liste:

```
ags;liste;sitze;anteil
09178155;Wählergemeinschaft Wang;8;55,2
```

`anteil` ist der Stimmenanteil in Prozent, wie ihn die Gemeinde ausweist; die
gewichteten Stimmen rechnet `baue.mjs` daraus zurück. Die Sitzsumme muss der
amtlichen Zahl entsprechen, sonst bricht der Lauf ab.

Einträge hier gehen den abgerufenen Quellen vor.
