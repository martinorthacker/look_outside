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
| 2 | Backend-Baustein: **GitHub Actions Cron-Workflow**, scraped stündlich, erzeugt `data.json` und deployt `docs/` + `data.json` als **Pages-Artefakt** (`actions/deploy-pages`). `data.json` wird **nicht committet**; den vorherigen Stand (für den Ausfall-Fallback, #12) holt der Workflow von der Live-Seite | entschieden (geändert 15.11.2026: vorher Commit von `data.json` in `main`, verworfen wegen ~24 Commits/Tag) |
| 3 | Parsing: **cheerio** (Node.js), kein CPU-Zeit-Limit wie bei Edge-Runtimes | entschieden (ersetzt HTMLRewriter) |
| 4 | Alle 3 Quellen per HTML-Scraping (keine der drei bietet eine öffentliche API für exakt dieses aufbereitete Format) | entschieden |
| 5 | Caching: entfällt, da Cron-Rhythmus selbst die Aktualisierungsfrequenz bestimmt | erledigt |
| 6 | Auslieferung ans Handy: **PWA** mit `manifest.json`, Icon und Service Worker (network-first: online immer frisch, offline letzter geladener Stand) | entschieden |
| 7 | Rechtliches: Scraping von ORF/bergfex evtl. ToS-Konflikt → nur Eigenbedarf, keine Veröffentlichung/Weiterverbreitung, moderate Abruffrequenz. Repo ist public (Scraper-Code sichtbar, Pages-Seite mit `noindex`) — Risiko bewusst akzeptiert, da reine Wetteraggregation für Eigenbedarf | Risiko, akzeptiert |
| 8 | Repository-Sichtbarkeit: **public**, damit GitHub Actions unlimitiert kostenlos bleibt | entschieden |
| 9 | Cron-Zeitpunkt: `25 * * * *` (Minute 25 jeder Stunde, rund um die Uhr) als Startwert, ggf. nachjustieren falls ORF später/früher aktualisiert. GitHub-Cron läuft in UTC; bei einem **stündlichen** Cron ist das egal, da der österreichische Offset immer ganze Stunden beträgt → keine Sommer-/Winterzeit-Wartung nötig. Erst relevant, wenn der Cron auf bestimmte Stunden eingeschränkt wird | entschieden |
| 10 | Test-Fixtures (gespeicherte HTML-Seiten) sind Kopien fremder Seiten → **nur lokal** (`.gitignore`). Committete Tests nutzen synthetisches Markup, das die Struktur der Quellen nachbildet | entschieden |
| 11 | Wetter-Symbole: **eigene Emoji** aus dem Wettertext (alle Quellen einheitlich), keine Original-Icons von Fremdservern im Frontend | entschieden |
| 12 | Ausfall einer Quelle: letzte gültige Daten bleiben sichtbar, mit deutlichem Hinweis „veraltet – Stand … – Fehler: …". Workflow-Lauf bleibt grün (Warnung im Log), rot nur bei Programm-/Testfehlern | entschieden |
| 13 | Scheduled Workflows werden von GitHub nach 60 Tagen ohne Repo-Aktivität deaktiviert. Da keine Daten-Commits mehr entstehen (#2), aktiviert sich der Workflow bei jedem Lauf per API selbst neu (setzt den Zähler zurück) | entschieden, Wirksamkeit in Phase 7 prüfen |

## Anzeige (Frontend)

Drei Blöcke untereinander (GeoSphere → ORF → bergfex), kompakt, Dark Mode
nach Systemeinstellung, oben „Stand"-Zeitstempel, Seite mit `noindex`.
Welche Felder angezeigt werden, steht pro Abschnitt in `data.json`
(`display`, siehe `scraper/schema.md`), damit das Frontend quellenagnostisch bleibt.

| Quelle | angezeigt |
|---|---|
| GeoSphere | alle 24 Stunden (vergangene ausgeblendet): Zeit, Wetter, Temperatur, Niederschlag |
| ORF | Graz Heinrichstraße, Straßgang, Thalerhof, Universität: Wetter, Temperatur. Fehlende Station → Hinweis, kein Ausfall |
| bergfex | Tageswerte „Heute", ab 18 Uhr auch „Morgen"; die nächsten 8 3-h-Intervalle ab jetzt (auch über Mitternacht). Alle Werte außer Schneefallgrenze |

In `data.json` stehen jeweils alle verfügbaren Werte, also mehr als angezeigt.

## Repo-Struktur

```
/
├── .github/workflows/scrape.yml   # Cron + workflow_dispatch + push: testen, scrapen, Pages deployen
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
│   ├── fixtures/                  # nur lokal (#10): Beispiel-HTMLs + erwartete Parser-Ausgabe
│   ├── test/                      # node --test
│   ├── tools/                     # update-fixtures.js, make-icons.js
│   └── index.js                   # orchestriert alle 3, schreibt docs/data.json
├── docs/                          # Quelle des Pages-Artefakts
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   ├── sw.js                      # Service Worker (network-first)
│   ├── manifest.json + Icons
│   └── data.json                  # nur lokal/im Deployment, nie committet (#2)
├── ROADMAP.md
└── CLAUDE.md
```

## Phasen für den Agenten (Claude Code)

### Phase 1 — Grundgerüst
**Status:** lokal erledigt; GitHub-Repo + Pages in Arbeit
- Repo-Struktur wie oben anlegen, `package.json` in `scraper/`
- GitHub Pages aktivieren, Quelle **„GitHub Actions"** (nicht Branch/`docs/`, siehe #2)
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
  als Testgrundlage (nur lokal, #10)

### Phase 4 — Orchestrator + Workflow-Integration
**Status:** lokal erledigt; Umstellung auf Pages-Artefakt (#2) und Live-Test in Arbeit
- `scraper/index.js`: ruft alle 3 Scraper auf, fängt Fehler pro Quelle ab
  (eine kaputte Quelle darf die anderen nicht blockieren), schreibt `docs/data.json`
- Workflow: Checkout → Node setup → `npm ci` → `npm test` → vorherige `data.json`
  von der Live-Seite holen → Skript ausführen → `docs/` als Pages-Artefakt
  hochladen → deployen → Workflow selbst reaktivieren (#13)
- Mit `workflow_dispatch` mehrfach manuell testen

### Phase 5 — Frontend
**Status:** in Arbeit
- Minimale Seite in `docs/`, lädt `data.json`, rendert 3 Blöcke (siehe „Anzeige")

### Phase 6 — Handy-Deployment
**Status:** in Arbeit (#6: PWA). Auf dem Handy: Seite in Chrome öffnen →
Menü → „Zum Startbildschirm hinzufügen" bzw. „App installieren"

### Phase 7 — Härtung
- Ein paar Tage Cron beobachten (läuft er zuverlässig, kommt data.json rechtzeitig an)
- Bei Bedarf Cron-Minute nachjustieren
- Nach > 60 Tagen prüfen, ob der Schedule noch aktiv ist (#13)

## Nicht-Ziele
- Keine Konto-/Multi-User-Funktion
- Keine eigene Wettervorhersage-Berechnung — reine Aggregation
- Kein natives App-Packaging (kein Play Store)
