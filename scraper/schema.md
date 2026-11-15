# Datenschema `docs/data.json` (schemaVersion 1)

Ziel: Das Frontend rendert alle Quellen **ohne quellenspezifischen Code**.
Jede Quelle liefert Abschnitte (`sections`) mit Einträgen (`entries`), deren
Felder aus einem festen Vokabular stammen (siehe unten). Das Frontend kennt nur
dieses Vokabular (Beschriftung, Einheit, Reihenfolge) und zeigt pro Abschnitt
die Spalten, die in den Einträgen vorkommen.

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
  "entries": [ /* Entry, mindestens 1 */ ]
}
```

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
| `iconUrl` | string | – | Original-Symbol der Quelle (absolute URL) |
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

| Quelle | Sections | Zeilenschlüssel |
|---|---|---|
| `geosphere` | `hourly`: 24 Stundenwerte ab aktueller Stunde | `time` + `timeEnd` |
| `orf` | `stations`: 4 Grazer Messstationen, mit `observedAt` | `location` |
| `bergfex` | `daily`: Heute + Morgen; `intervals`: 3-h-Werte Heute + Morgen | `date` / `time` |
