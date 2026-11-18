# Bergfex-Browserprobe

`probe-bergfex-browser.js` prüft ausschließlich, ob reguläres Playwright-Chromium
die Bergfex-Prognose ohne manuelle Browserprüfung laden kann. Der vorhandene
Cheerio-Parser und die Schema-Validierung müssen anschließend eine Prognose
für den aktuellen Tag in `Europe/Vienna` liefern.

Der Test ruft nur Bergfex auf, schreibt keine `data.json` und veröffentlicht
keine Rohdaten, Screenshots oder Browserprofile. Er wird nicht vom stündlichen
Scraper aufgerufen. Playwright ist eine Entwicklungsabhängigkeit; der produktive
Abruf bleibt bei `fetch` und Cheerio.

## GitHub-Runner

Workflow `bergfex-browser-probe` manuell auslösen. Für den ersten Test vor der
Übernahme auf `main` startet er außerdem bei einem Push auf einen Branch
`probe/bergfex-browser-*`. Er installiert Chromium, führt die Tests aus und
meldet den Erfolg oder Misserfolg des Browserabrufs. Kein Pages-Deployment,
kein Cron, nur Leseberechtigung für das Repository.

## Lokal im vorgesehenen Node-Container

Zuerst die Projektabhängigkeiten mit `./dev.sh npm ci` installieren. Chromium
benötigt zusätzlich Systembibliotheken; dieser einmalige Container installiert
sie ausschließlich im Container und verwirft sie danach:

```sh
docker run --rm \
  -v "$PWD":/app -w /app/scraper \
  -e HOME=/tmp -e PLAYWRIGHT_BROWSERS_PATH=/tmp/playwright \
  "node:$(cat .node-version)-trixie-slim" \
  sh -c 'npx playwright install --with-deps chromium && node tools/probe-bergfex-browser.js'
```

Auf einem Rechner mit installiertem Chromium für Playwright und passenden
Systembibliotheken kann der Test auch direkt laufen:

```sh
cd scraper
node tools/probe-bergfex-browser.js
node tools/probe-bergfex-browser.js --headed
```

`--headed` benötigt eine grafische Sitzung und dient nur dem lokalen Vergleich.
Der Test verwendet keine Stealth-Anpassungen, vorab gespeicherten Cookies oder
Challenge-Solver. Auf Prognose-Markup wird nach der Navigation höchstens 45 s
gewartet; dann endet der Prozess mit Exitcode 1. Eine Browserprüfung kann
während dieser Zeit durch normales Browser-JavaScript aufgelöst werden.

Exitcode 0 bedeutet: aktuelles Prognose-Markup geladen, Parser und Schema
erfolgreich geprüft. Ein Einzeltest belegt noch keine langfristige Stabilität.
Bei einem Fehlschlag zeigen die Logs die HTTP-Statuscodes der Navigationen,
das Auftreten des Cloudflare-Challenge-Headers und den letzten Seitentitel.
Ein Fehler bei Browserinstallation oder -start ist kein Nachweis einer Sperre.
