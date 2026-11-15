# Datenschema `docs/data.json` (schemaVersion 1)

Ziel: Das Frontend rendert alle Quellen **ohne quellenspezifischen Code**.
Jede Quelle liefert Abschnitte (`sections`) mit Einträgen (`entries`), deren
Felder aus einem festen Vokabular stammen (siehe unten). Das Frontend kennt nur
dieses Vokabular (Beschriftung, Einheit, Format). Was angezeigt wird, legt
jeder Abschnitt über `display` fest. Die Entscheidung liegt damit beim
Scraper der Quelle, das Frontend setzt sie nur generisch um.

`data.json` wird nicht committet, sondern nur deployt (ROADMAP #2).

## Wurzel

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-11-15T20:33:00+01:00", // letzte inhaltliche Änderung
  "timezone": "Europe/Vienna",
  "sources": [ /* Source, Reihenfolge = Anzeigereihenfolge */ ]
}
```

## Source

```jsonc
{
  "id": "geosphere",                 // stabil, [a-z0-9-]
  "name": "GeoSphere Radl-Wetter Graz",
  "url": "https://…",                // Originalseite (Link im Frontend)
  "status": "ok",                    // "ok" | "error"
  "error": null,                     // bei "error": Fehlermeldung (string)
  "fetchedAt": "…",                  // Zeitpunkt dieses Abrufversuchs
  "lastSuccessAt": "…",              // letzter erfolgreicher Abruf (oder null)
  "warnings": [],                    // nicht fatale Auffälligkeiten (strings)
  "sections": [ /* Section */ ]
}
```

**Fehlerzustand:** Schlägt Abruf, Parsing oder Validierung fehl, wird
`status: "error"` mit `error` gesetzt. `sections` enthält dann die Daten des
letzten erfolgreichen Laufs (oder `[]`), `lastSuccessAt` zeigt, wie alt sie
sind. Es gibt nie einen „stillen" Leerwert: Entweder ist `status` `"ok"` und
die Daten sind validiert, oder es ist `"error"`.

## Section

```jsonc
{
  "id": "hourly",                    // eindeutig innerhalb der Quelle
  "title": "Stundenprognose Stadtzentrum",
  "observedAt": "…",                 // optional: Messzeitpunkt (Beobachtungen)
  "display": { /* Display, optional */ },
  "entries": [ /* Entry, mindestens 1 */ ]
}
```

## Display (Anzeige-Hinweise, alle Felder optional)

```jsonc
{
  "fields": ["condition", "temp", ["precipMm", "precipProb"]],
  // Spalten in Reihenfolge; ein Array fasst mehrere Felder in einer Zelle
  // zusammen (Überschrift = Beschriftung des ersten Felds).
  // Ohne "fields": alle vorkommenden Wertefelder.
  "layout": "table",      // "table" (Zeilen) | "cards" (je Eintrag eine Karte)
  "hidePast": true,       // vergangene Einträge ausblenden (nur time/date)
  "limit": 8,             // höchstens so viele Einträge (nach hidePast)
  "horizonHours": 6       // nur Einträge, die innerhalb von N Stunden beginnen
}
```

„Vergangen" bedeutet: Das Ende liegt vor jetzt. Das Ende ist `timeEnd`, sonst der
Beginn des nächsten Eintrags (der aktuelle Eintrag bleibt also sichtbar), bei
`date` Mitternacht des Folgetags. Beginn eines `date`-Eintrags ist 00:00
Europe/Vienna. Mit `horizonHours: 6` erscheint z.B. „Morgen" ab 18 Uhr.

## Entry

Jeder Eintrag hat genau **einen** Schlüssel, der die Zeile benennt:

| Feld | Typ | Bedeutung |
|---|---|---|
| `location` | string | Messstation / Ort (Beobachtungen) |
| `date` | `"YYYY-MM-DD"` | Tageswert (lokales Datum Europe/Vienna) |
| `time` | ISO 8601 mit Offset | Beginn (bzw. Zeitpunkt) eines Prognose-Intervalls |

Optional zu `time`: `timeEnd` (ISO 8601), wenn die Quelle ein Intervall angibt.

Wertefelder (alle optional; `null` = Quelle zeigt keinen Wert, z.B. „-"):

| Feld | Typ | Einheit | Bedeutung |
|---|---|---|---|
| `condition` | string | – | Wetterzustand im Originalwortlaut der Quelle |
| `isNight` | boolean | – | Nachtsymbol (aus Quellen-Icon bzw. Sonnenauf-/-untergang); steuert das Emoji |
| `iconUrl` | string | – | Original-Symbol der Quelle (absolute URL); nur Info, das Frontend lädt es nicht (ROADMAP #11) |
| `temp` | number | °C | Temperatur |
| `tempFeels` | number | °C | gefühlte Temperatur (GeoSphere: Radl-Temperatur) |
| `tempMin` | number | °C | Tagesminimum |
| `tempMax` | number | °C | Tagesmaximum |
| `precipMm` | number | mm (= l/m²) | Niederschlagsmenge |
| `precipProb` | number | % | Niederschlagswahrscheinlichkeit |
| `thunderProb` | number | % | Gewitterwahrscheinlichkeit |
| `sunHours` | number | h | Sonnenscheindauer |
| `snowLineM` | number | m | Schneefallgrenze |
| `newSnowCm` | number | cm | Neuschnee |
| `windKmh` | number | km/h | Windgeschwindigkeit |
| `windBft` | number | Bft | Windstärke Beaufort |
| `windDeg` | number | ° | Windrichtung (woher, 0 = Nord, im Uhrzeigersinn) |
| `windDir` | string | – | Windrichtung als Text (z.B. „NW", „SO-S") |

Neue Felder werden hier ergänzt, bevor ein Scraper sie liefert. Die Validierung
in `lib/schema.js` lehnt unbekannte Felder ab, damit Tippfehler auffallen.

## Quellen (Stand schemaVersion 1)

| Quelle | Sections | Zeilenschlüssel | Anzeige (`display`) |
|---|---|---|---|
| `geosphere` | `hourly`: 24 Stundenwerte ab aktueller Stunde | `time` + `timeEnd` | Wetter, Temp., Niederschlag; hidePast |
| `orf` | `stations`: 4 Grazer Messstationen, mit `observedAt` | `location` | Wetter, Temp. |
| `bergfex` | `daily`: Heute + Morgen | `date` | Karten, alles außer Schneefallgrenze; hidePast, horizonHours 6 |
| `bergfex` | `intervals`: 3-h-Werte Heute + Morgen | `time` | alles außer Schneefallgrenze; hidePast, limit 8 |
