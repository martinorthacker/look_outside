# ROADMAP — look_outside

## Ziel
Minimale Webseite (auf Android-Handy als PWA/Homescreen-Icon nutzbar), die
stündlich aktualisierte Wetterwerte von 3 Quellen abruft und in einer
gemeinsamen, kompakten Oberfläche darstellt:

1. GeoSphere Austria — Radl-Wetter Graz (https://www.zamg.ac.at/steiermark/stadt-graz/radlwetter/)
2. ORF Wetter Steiermark (https://wetter.orf.at/steiermark/)
3. bergfex Graz Prognose (https://www.bergfex.at/sommer/graz/wetter/prognose/#day0)

Aktualisierungsrhythmus: stündlich, mit Puffer nach der vollen Stunde
(ORF aktualisiert erst ca. 10-20 Min nach :00).

## Architektur-Entscheidungen (bindend, siehe CLAUDE.md)

| # | Entscheidung | Status |
|---|---|---|
| 1 | Kein reiner Client-only-Ansatz (CORS macht direktes Fetching von Handy-HTML aus unmöglich) | entschieden |
| 2 | Backend-Baustein: **GitHub Actions Cron-Workflow**, scraped stündlich, schreibt `data.json`, committet nach GitHub Pages | entschieden (ersetzt frühere Cloudflare-Worker-Entscheidung) |
| 3 | Parsing: **cheerio** (Node.js), kein CPU-Zeit-Limit wie bei Edge-Runtimes | entschieden (ersetzt HTMLRewriter) |
| 4 | Alle 3 Quellen per HTML-Scraping (keine der drei bietet eine öffentliche API für exakt dieses aufbereitete Format) | entschieden |
| 5 | Caching: entfällt, da Cron-Rhythmus selbst die Aktualisierungsfrequenz bestimmt | erledigt |
| 6 | Auslieferung ans Handy: einfache statische Seite vs. PWA mit Manifest (add-to-homescreen, Offline-Fallback) | **offen** |
| 7 | Rechtliches: Scraping von ORF/bergfex evtl. ToS-Konflikt → nur Eigenbedarf, keine Veröffentlichung/Weiterverbreitung, moderate Abruffrequenz. Repo ist public (Scraper-Code + Daten sichtbar) — Risiko bewusst akzeptiert, da reine Wetteraggregation für Eigenbedarf | Risiko, akzeptiert |
| 8 | Repository-Sichtbarkeit: **public**, damit GitHub Actions unlimitiert kostenlos bleibt | entschieden |
| 9 | Cron-Zeitpunkt: `25 * * * *` (Minute 25 jeder Stunde) als Startwert, ggf. nachjustieren falls ORF später/früher aktualisiert. **Achtung**: GitHub-Cron läuft in UTC — bei Umstellung Sommer-/Winterzeit muss der Cron-Ausdruck manuell verschoben werden (Wien = UTC+2 im Sommer, UTC+1 im Winter) | entschieden, DST-Anpassung als wiederkehrende Wartungsaufgabe vermerkt |

## Repo-Struktur

```
/
├── .github/workflows/
│   ├── scrape.yml                 # Cron + workflow_dispatch
│   └── test.yml                   # Fixture-Tests bei Code-Änderungen
├── .node-version                  # einzige Quelle der Node-Version (CI + Docker)
├── dev.sh                         # lokaler Node-Container, z.B. ./dev.sh npm test
├── scraper/
│   ├── package.json
│   ├── schema.md                  # gemeinsames Datenschema, dokumentiert
│   ├── sources/
│   │   ├── index.js               # Liste aller Quellen (Anzeigereihenfolge)
│   │   ├── geosphere.js
│   │   ├── orf.js
│   │   └── bergfex.js
│   ├── lib/                       # HTTP, Zeit (Europe/Vienna), Parsing, Schema-Validierung, collect
│   ├── fixtures/                  # bereinigte Beispiel-HTMLs + erwartete Parser-Ausgabe
│   ├── test/                      # node --test
│   ├── tools/update-fixtures.js   # Fixtures live erneuern
│   └── index.js                   # orchestriert alle 3, schreibt docs/data.json
├── docs/                          # GitHub Pages Quelle
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── data.json                  # wird vom Workflow aktualisiert & committet
├── ROADMAP.md
└── CLAUDE.md
```

## Phasen für den Agenten (Claude Code)

### Phase 1 — Grundgerüst
**Status:** lokal erledigt; GitHub-Repo + Pages-Aktivierung offen (wartet auf Freigabe)
- Repo-Struktur wie oben anlegen, `package.json` in `scraper/`
- GitHub Pages auf `docs/`-Ordner im `main`-Branch aktivieren (Repo Settings)
- `.github/workflows/scrape.yml` als Skelett anlegen mit **beiden** Triggern:
  `schedule` (Cron) **und** `workflow_dispatch` — Letzteres ist wichtig, damit
  man den Workflow während der Entwicklung manuell anstoßen kann, statt auf
  die nächste volle Stunde zu warten

### Phase 2 — Ein Scraper isoliert zum Laufen bringen
**Status:** erledigt
- Nur GeoSphere-Quelle, als reines Node-Skript (`node scraper/sources/geosphere.js`),
  lokal ausführbar und testbar, noch ohne Workflow-Integration
- Gemeinsames Datenschema in `scraper/schema.md` festlegen, bevor die
  restlichen Scraper gebaut werden

### Phase 3 — Restliche 2 Scraper
**Status:** erledigt
- ORF + bergfex nach demselben Schema
- Für jeden Scraper: mind. 1 gespeichertes Beispiel-HTML in `scraper/fixtures/`
  als Testgrundlage (schützt vor stillem Bruch bei Layoutänderungen)

### Phase 4 — Orchestrator + Workflow-Integration
**Status:** lokal erledigt und getestet; Live-Test per `workflow_dispatch` offen (wartet auf Push)
- `scraper/index.js`: ruft alle 3 Scraper auf, fängt Fehler pro Quelle ab
  (eine kaputte Quelle darf die anderen nicht blockieren), schreibt `docs/data.json`
- Workflow: Checkout → Node setup → `npm ci` → Skript ausführen → Diff-Check
  (`git diff --quiet`) → nur bei Änderung committen & pushen (leere Commits vermeiden)
- Mit `workflow_dispatch` mehrfach manuell testen, bevor der Cron scharf geschaltet wird

### Phase 5 — Frontend
- Minimale Seite in `docs/`, lädt `data.json`, rendert 3 Blöcke
- Layout an den Screenshots orientiert

### Phase 6 — Handy-Deployment
- Entscheidung #6 klären: GitHub-Pages-URL einfach als Lesezeichen/Homescreen-Link,
  oder zusätzlich `manifest.json` für "richtiges" Add-to-Homescreen-Verhalten

### Phase 7 — Härtung
- Ein paar Tage Cron beobachten (läuft er zuverlässig, kommt data.json rechtzeitig an)
- Bei Bedarf Cron-Minute nachjustieren

## Nicht-Ziele
- Keine Konto-/Multi-User-Funktion
- Keine eigene Wettervorhersage-Berechnung — reine Aggregation
- Kein natives App-Packaging (kein Play Store)
