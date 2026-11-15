// Gemeinsame Tests für alle Quellen:
// 1. Fixture-HTML ergibt exakt den gespeicherten Snapshot (schützt vor stillem
//    Bruch bei Refactoring).
// 2. Eine fremde/leere Seite (Layoutänderung, Wartungsseite) führt zu einem
//    Fehler statt zu leeren Daten.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { validateResult } from '../lib/schema.js';
import { SOURCES } from '../sources/index.js';

const fixture = (name) => new URL(`../fixtures/${name}`, import.meta.url);
const meta = JSON.parse(await readFile(fixture('meta.json'), 'utf8'));

for (const source of SOURCES) {
  test(`${source.id}: Fixture ergibt gespeicherten Snapshot`, async () => {
    const html = await readFile(fixture(`${source.id}.html`), 'utf8');
    const expected = JSON.parse(await readFile(fixture(`${source.id}.expected.json`), 'utf8'));
    const result = source.parse(html, { now: new Date(meta[source.id].capturedAt) });
    validateResult(result);
    assert.deepEqual(result, expected);
  });

  test(`${source.id}: fremde Seite wirft Fehler`, () => {
    const html = '<html><body><h1>Wartungsarbeiten</h1><table><tr><td>-</td></tr></table></body></html>';
    assert.throws(() => source.parse(html, { now: new Date() }));
  });
}
