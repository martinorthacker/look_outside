// Orchestrierung: Fehlerisolation pro Quelle und Fallback auf letzte gültige Daten.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collect } from '../lib/collect.js';

const sections = (temp) => [{ id: 's', title: 'T', entries: [{ location: 'Graz', temp }] }];
const okSource = (id, temp) => ({ id, name: id, url: `https://example.org/${id}`, parse: () => ({ sections: sections(temp), warnings: [] }) });
const brokenSource = (id) => ({ id, name: id, url: `https://example.org/${id}`, parse: () => { throw new Error('Tabelle nicht gefunden'); } });
const fetch = async (url) => (url.endsWith('/offline') ? Promise.reject(new Error('Timeout')) : '<html></html>');

const t1 = new Date('2026-11-15T19:25:00Z');
const t2 = new Date('2026-11-15T20:25:00Z');

test('collect: kaputte Quellen blockieren die anderen nicht', async () => {
  const data = await collect([brokenSource('a'), okSource('b', 5), okSource('offline', 1)], { now: t1, fetch });
  const [a, b, offline] = data.sources;
  assert.equal(a.status, 'error');
  assert.equal(a.error, 'Tabelle nicht gefunden');
  assert.deepEqual(a.sections, []);
  assert.equal(a.lastSuccessAt, null);
  assert.equal(b.status, 'ok');
  assert.deepEqual(b.sections, sections(5));
  assert.equal(offline.status, 'error');
  assert.equal(offline.error, 'Timeout');
});

test('collect: bei Fehler bleiben die letzten gültigen Daten mit altem lastSuccessAt', async () => {
  const first = await collect([okSource('a', 3)], { now: t1, fetch });
  const second = await collect([brokenSource('a')], { now: t2, fetch, previous: first });
  const [a] = second.sources;
  assert.equal(a.status, 'error');
  assert.deepEqual(a.sections, sections(3));
  assert.equal(a.lastSuccessAt, '2026-11-15T20:25:00+01:00');
  assert.equal(a.fetchedAt, '2026-11-15T21:25:00+01:00');
});

test('collect: ungültiges Parser-Ergebnis wird zum Fehlerzustand', async () => {
  const empty = { id: 'e', name: 'e', url: 'https://example.org/e', parse: () => ({ sections: [] }) };
  const [e] = (await collect([empty], { now: t1, fetch })).sources;
  assert.equal(e.status, 'error');
  assert.match(e.error, /Schema/);
});

test('collect: inkompatible vorherige data.json wird ignoriert', async () => {
  const [a] = (await collect([brokenSource('a')], { now: t1, fetch, previous: { schemaVersion: 0, sources: [{ id: 'a', sections: sections(1) }] } })).sources;
  assert.deepEqual(a.sections, []);
  assert.equal(a.lastSuccessAt, null);
  const [b] = (await collect([brokenSource('a')], { now: t1, fetch, previous: 'kaputt' })).sources;
  assert.deepEqual(b.sections, []);
});
