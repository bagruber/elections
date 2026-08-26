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

## Nichts davon ist gepusht

Alle Aenderungen vom 26.08.2026 liegen als lokale Commits.

## Beim naechsten Paket-Update

Weder `pnpm install` noch `pnpm prune` raeumt die alte Version aus
`node_modules/.pnpm`. Nach einem Upgrade deshalb
`rm -rf node_modules && pnpm install`, dann `pnpm store prune` — sonst bleibt
der Speichergewinn auf dem Papier.
