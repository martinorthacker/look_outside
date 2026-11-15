// fetchHtml gegen einen lokalen Testserver (kein Internet nötig).

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { fetchHtml } from '../lib/http.js';

const PAGE = `<html><body>${'x'.repeat(3000)}</body></html>`;
let server;
let base;
const hits = new Map();

// Pfad bestimmt das Verhalten: /seq/<status>,<status>,... liefert pro Aufruf den nächsten Status.
before(async () => {
  server = createServer((req, res) => {
    const n = (hits.get(req.url) ?? 0) + 1;
    hits.set(req.url, n);
    const [, kind, arg] = req.url.split('/');
    if (kind === 'seq') {
      const statuses = arg.split(',').map(Number);
      const status = statuses[Math.min(n, statuses.length) - 1];
      if (status === 200) return res.end(PAGE);
      res.writeHead(status, req.url.includes('ra') ? { 'retry-after': '3600' } : {});
      return res.end('nope');
    }
    if (kind === 'short') return res.end('<html></html>');
    res.writeHead(404);
    res.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const opts = { retryDelayMs: 5 };

test('fetchHtml: 429 einmal → zweiter Versuch erfolgreich', async () => {
  assert.equal(await fetchHtml(`${base}/seq/429,200`, opts), PAGE);
  assert.equal(hits.get('/seq/429,200'), 2);
});

test('fetchHtml: 503 zweimal → Fehler nach genau 2 Versuchen', async () => {
  await assert.rejects(fetchHtml(`${base}/seq/503,503`, opts), /HTTP 503 .* – auch beim 2\. Versuch/);
  assert.equal(hits.get('/seq/503,503'), 2);
});

test('fetchHtml: 404 und zu kurze Antwort → kein zweiter Versuch', async () => {
  await assert.rejects(fetchHtml(`${base}/missing`, opts), /HTTP 404/);
  assert.equal(hits.get('/missing'), 1);
  await assert.rejects(fetchHtml(`${base}/short`, opts), /verdächtig kurz/);
  assert.equal(hits.get('/short'), 1);
});

test('fetchHtml: Retry-After länger als 30 s → kein zweiter Versuch', async () => {
  await assert.rejects(fetchHtml(`${base}/seq/429,200/ra`, opts), /HTTP 429 .*Retry-After: 3600/);
  assert.equal(hits.get('/seq/429,200/ra'), 1);
});

test('fetchHtml: Netzwerkfehler → zweiter Versuch, Fehlermeldung mit Ursache', async () => {
  // Port eines gerade geschlossenen Servers → Verbindung abgelehnt
  const tmp = createServer();
  await new Promise((resolve) => tmp.listen(0, '127.0.0.1', resolve));
  const { port } = tmp.address();
  await new Promise((resolve) => tmp.close(resolve));
  await assert.rejects(fetchHtml(`http://127.0.0.1:${port}/`, opts), /Abruf fehlgeschlagen \(ECONNREFUSED\) – auch beim 2\. Versuch/);
});
