# CLAUDE.md — look_outside

## Projektziel
Minimale Webseite, die stündlich aktualisierte Wetterwerte aus 3 Quellen
scraped und aggregiert anzeigt. Details siehe ROADMAP.md.

## Bindende Architektur-Entscheidungen
Siehe ROADMAP.md, Tabelle "Architektur-Entscheidungen". Diese sind
verbindlich. Falls eine Umsetzung einer dieser Entscheidungen widerspricht
(z.B. weil sie sich technisch als unpraktikabel erweist), **explizit im
Chat/PR benennen, nicht stillschweigend abweichen.**

Kurzfassung:
- Backend = GitHub Actions Cron-Workflow (kein Dauerserver, kein Edge-Worker)
- Parsing via cheerio (Node.js), kein DOM-Emulation nötig für einfaches HTML-Parsing
- Frontend-Hosting = GitHub Pages, deployt per Actions-Artefakt (`docs/` +
  generierte `data.json`); `data.json` wird **nie committet** (Entscheidung #2)
- Gemeinsames JSON-Schema für alle 3 Quellen (Frontend soll quellenagnostisch rendern)
- Repo ist public (siehe Entscheidung #8) — keine Secrets/Zugangsdaten im Code,
  auch wenn aktuell keine nötig sind

## Tech Stack
- Scraping/Orchestrierung: Node.js, `cheerio` für HTML-Parsing
- CI/Scheduling: GitHub Actions (`schedule` **und** `workflow_dispatch` Trigger
  — Letzteres zwingend, damit Läufe manuell testbar sind, ohne auf die nächste
  volle Stunde zu warten; zusätzlich `push` auf `main`, damit Code-Änderungen
  sofort ausgerollt werden)
- Frontend: reines HTML/CSS/JS, keine Frameworks (Projekt soll minimal bleiben),
  PWA mit Service Worker (Entscheidung #6)
- Keine Datenbank, keine externe Storage — `data.json` existiert nur im
  Pages-Deployment; der Workflow holt den vorherigen Stand von der Live-Seite

## Arbeitsweise
- Erkläre nicht-offensichtliche technische Entscheidungen kurz im Code-
  Kommentar oder in der Commit-Message, keine Grundlagen-Tutorials.
- Kleine, nachvollziehbare Commits statt großer Sprünge.
- Bei Änderungen an Architektur/Datenschema: kurze Begründung in der
  Commit-Message oder im PR.

## Rückfragen-Workflow
- Fragen und Unklarheiten gesammelt in einer temporären Datei
  `fragen_zu_<thema>.md` im Projekt-Root ablegen (nicht nur im Chat), damit
  der User sie abseits des Chats in Ruhe beantworten kann.
- Pro Frage: kurzer Kontext, Optionen, Empfehlung, die **Annahme**, mit der
  bis zur Antwort weitergearbeitet wird, und ein leeres Feld `**Antwort:**`.
- Nicht blockierte Arbeit läuft mit den dokumentierten Annahmen weiter.
  Nach außen wirkende Schritte (Repo anlegen, Push, Pages, Workflow-Läufe)
  erst nach Antwort.
- Nach Beantwortung: Entscheidungen in ROADMAP.md / CLAUDE.md / Code
  übernehmen, danach die Fragen-Datei löschen. `fragen_zu_*.md` ist per
  `.gitignore` vom (öffentlichen) Repo ausgeschlossen.

## Lokale Entwicklungsumgebung
Für Test/Entwicklung der Scraper lokal einen Docker-Container mit der im
Workflow verwendeten Node-Version vorsehen, damit:
- die lokale Umgebung exakt der CI-Umgebung entspricht (keine
  "geht bei mir, aber nicht im Workflow"-Überraschungen)
- keine globalen npm-Installationen auf dem Host nötig sind

Umsetzung: `.node-version` ist die einzige Quelle der Node-Version (Workflow:
`setup-node` mit `node-version-file`; lokal: `./dev.sh` startet
`node:<version>-trixie-slim`, Arbeitsverzeichnis `scraper/`).
- `./dev.sh npm ci` / `./dev.sh npm test`
- `./dev.sh node sources/<id>.js [fixtures/<id>.html]`: eine Quelle live bzw. aus Datei
- `./dev.sh node index.js`: alle Quellen → `docs/data.json`
- `./dev.sh node tools/update-fixtures.js [<id>] [--reparse]`: lokale Fixtures +
  Snapshot erneuern (`--reparse`: nur Snapshot aus vorhandenem HTML); das Skript
  meldet, was sich am Parser-Ergebnis geändert hat
- `./dev.sh node tools/make-icons.js`: PWA-Icons in `docs/` neu erzeugen
- Frontend-Vorschau: `./dev.sh node index.js` (erzeugt `docs/data.json`), dann
  `python3 -m http.server -d docs 8000` → http://localhost:8000

## Was NICHT tun
- Keine Live-Scrapes bei Seitenaufruf durch den User — ausschließlich der
  Cron-Workflow scraped, das Handy lädt nur die statische `data.json`
- Keine Veröffentlichung/Weitergabe der gescrapten Rohdaten an Dritte über
  den privaten Gebrauch hinaus (rechtliches Risiko, siehe ROADMAP #7)
- Keine Annahme, dass eine Quelle stabil bleibt — jeder Scraper braucht
  einen erkennbaren Fehlerzustand statt stillem Leerwert; ein Ausfall einer
  Quelle darf die anderen zwei nicht blockieren
- `data.json`, Test-Fixtures (Kopien fremder Seiten) und die lokalen
  Referenz-Screenshots nicht committen (ROADMAP #2, #10)
- Keine Original-Icons der Quellen im Frontend laden (ROADMAP #11)

## Tests / Review-Erwartung
- Für jeden Scraper: mindestens 1 gespeichertes Beispiel-HTML als
  Testfixture (schützt vor stillem Bruch bei Refactoring/Layoutänderungen) —
  **nur lokal** in `scraper/fixtures/` (ROADMAP #10); ohne Fixtures werden
  diese Tests übersprungen
- Committete Tests in `scraper/test/` verwenden synthetisches Markup, das die
  Struktur der Quelle nachbildet, und laufen in jedem Workflow-Lauf vor dem
  Deploy (rot → kein Deploy)
- `workflow_dispatch` immer parallel zu `schedule` einbauen, damit Läufe
  manuell testbar sind
