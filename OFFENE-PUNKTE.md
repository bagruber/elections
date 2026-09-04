# Offene Punkte

*Notiert am 26.08.2026 fuer spaetere Sitzungen. Erledigte Punkte bitte streichen,
nicht abhaken — die Datei soll kurz bleiben.*


## Toolchain-Stand

Dieses Repo laeuft seit dem 26.08.2026 auf **pnpm** (nicht npm).
Alle Repos teilen sich einen pnpm-Store, der genau so weit dedupliziert, wie die
Versionen uebereinstimmen. **Einzelne Pakete also nicht im Alleingang
hochziehen** — das faellt allen anderen Repos zur Last.

Die projektweiten Zielversionen stehen in `hausbasis/baseline.json`;
`node ../hausbasis/check.mjs --kurz` zeigt, wo dieses Repo abweicht.

## Kein Build-Script

Das Repo hat Dependencies, aber keinen `build`-Eintrag — die pnpm-Umstellung
liess sich hier nur ueber `pnpm install` verifizieren, nicht ueber einen Build.
Wer hier weiterarbeitet, sollte den ersten echten Build im Blick behalten.

## Beim naechsten Paket-Update

Weder `pnpm install` noch `pnpm prune` raeumt die alte Version aus
`node_modules/.pnpm`. Nach einem Upgrade deshalb
`rm -rf node_modules && pnpm install`, dann `pnpm store prune` — sonst bleibt
der Speichergewinn auf dem Papier.

## Ungepinnte `github:`-Abhaengigkeit

`"hexagonalmap": "github:bagruber/hexagonalmap"` hat keine Ref und loest
deshalb auf den Default-Branch zum Installationszeitpunkt auf. Was in einem
gebauten Wahlkarten-Satz steckt, ist damit nicht rekonstruierbar. Die
ausfuehrliche Begruendung steht in `hexagonalmap/OFFENE-PUNKTE.md` - dort ist
auch die Empfehlung, weil dort der Tag gesetzt werden muss.

## Haengt an gruber.am

Die Projektliste auf gruber.am liest **nichts** aus diesem Repo. Der Eintrag
wird von Hand in `gruberam/site/src/data/projects.ts` gepflegt und stand am
30.08.2026 so drin:

```ts
id: "elections"
stack: ["JavaScript"]
```

Bis zum 30.08.2026 stand dort `["TypeScript"]` - auch hier liegt keine .ts-Datei im Repo.

Wer hier die Sprache, das Framework oder die Datenbank wechselt, das Repo
umbenennt, archiviert oder privat schaltet, muss den Eintrag dort nachziehen.
Die Seite merkt es von allein nicht.

Alle Repos mit so einem Abschnitt finden:

```bash
grep -rl "Haengt an gruber.am" ~/Documents/GitHub/bagruber/*/OFFENE-PUNKTE.md
```
