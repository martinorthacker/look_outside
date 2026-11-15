// Tests gegen die lokal gespeicherten Original-Seiten (scraper/fixtures/, nicht
// im Repo, ROADMAP #10). Fehlen sie (z.B. in CI), werden die Tests übersprungen.
// Erzeugen: ./dev.sh node tools/update-fixtures.js
//
// 1. Fixture-HTML ergibt exakt den lokalen Snapshot (schützt vor stillem Bruch
//    bei Refactoring). Nach gewollter Parser-Änderung: update-fixtures --reparse
// 2. Plausibilität des Ergebnisses (Mengen, Zeitreihen lückenlos/aufsteigend).
// Zusätzlich für alle Quellen ohne Fixture: Fremde Seite → Fehler statt Leerwerte.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { validateResult } from '../lib/schema.js';
import { SOURCES } from '../sources/index.js';

const fixture = (name) => readFile(new URL(`../fixtures/${name}`, import.meta.url), 'utf8').catch(() => null);
const meta = JSON.parse((await fixture('meta.json')) ?? '{}');
const SKIP = 'kein lokales Fixture (./dev.sh node tools/update-fixtures.js)';

// Mindestumfang pro Abschnitt, den eine intakte Seite immer liefert.
const MIN_ENTRIES = { 'geosphere/hourly': 20, 'orf/stations': 3, 'bergfex/daily': 2, 'bergfex/intervals': 14 };

for (const source of SOURCES) {
  const html = await fixture(`${source.id}.html`);
  const expected = await fixture(`${source.id}.expected.json`);
  const skip = !(html && expected && meta[source.id]) && SKIP;
  const parseFixture = () => source.parse(html, { now: new Date(meta[source.id].capturedAt) });

  test(`${source.id}: Fixture ergibt lokalen Snapshot`, { skip }, () => {
    const result = parseFixture();
    validateResult(result);
    assert.deepEqual(result, JSON.parse(expected));
  });

  test(`${source.id}: Fixture-Ergebnis plausibel`, { skip }, () => {
    for (const section of parseFixture().sections) {
      const key = `${source.id}/${section.id}`;
      assert.ok(section.entries.length >= (MIN_ENTRIES[key] ?? 1), `${key}: nur ${section.entries.length} Einträge`);
      const times = section.entries.map((e) => Date.parse(e.time ?? e.date ?? NaN)).filter((t) => !Number.isNaN(t));
      assert.deepEqual(times, [...times].sort((a, b) => a - b), `${key}: Zeitreihe nicht aufsteigend`);
      assert.equal(new Set(times).size, times.length, `${key}: doppelte Zeitpunkte`);
    }
  });

  test(`${source.id}: fremde Seite wirft Fehler`, () => {
    const page = '<html><body><h1>Wartungsarbeiten</h1><table><tr><td>-</td></tr></table></body></html>';
    assert.throws(() => source.parse(page, { now: new Date() }));
  });
}
