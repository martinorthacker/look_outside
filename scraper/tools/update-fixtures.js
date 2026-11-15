// Erzeugt/erneuert die lokalen Test-Fixtures (nicht im Repo, ROADMAP #10):
// holt die Live-Seiten, speichert sie bereinigt und legt die erwartete
// Parser-Ausgabe (<id>.expected.json) als Snapshot ab. Meldet, welche Pfade
// sich gegenüber dem bisherigen Snapshot geändert haben.
//
//   node tools/update-fixtures.js              → alle Quellen live
//   node tools/update-fixtures.js orf          → nur ORF
//   node tools/update-fixtures.js --reparse    → kein Abruf, nur Snapshots aus
//                                                vorhandenem HTML neu erzeugen
//                                                (nach gewollter Parser-Änderung)

import * as cheerio from 'cheerio';
import { readFile, writeFile } from 'node:fs/promises';
import { fetchHtml } from '../lib/http.js';
import { validateResult } from '../lib/schema.js';
import { toViennaIso } from '../lib/time.js';
import { SOURCES } from '../sources/index.js';

const dir = new URL('../fixtures/', import.meta.url);
const file = (name) => new URL(name, dir);
const readJson = (name) => readFile(file(name), 'utf8').then(JSON.parse).catch(() => null);

/** Entfernt Skripte, Styles, Einbettungen und Kommentare; die Struktur bleibt. */
function sanitize(html) {
  const $ = cheerio.load(html);
  $('script, style, noscript, svg, iframe, link, template').remove();
  $('*').contents().filter((_, node) => node.type === 'comment').remove();
  return $.html();
}

/** Liste geänderter JSON-Pfade (für die Konsolenausgabe). */
function diffPaths(a, b, path = '') {
  if (Object.is(a, b)) return [];
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return [path || '/'];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].flatMap((k) => diffPaths(a[k], b[k], `${path}/${k}`));
}

const args = process.argv.slice(2);
const reparse = args.includes('--reparse');
const wanted = args.filter((a) => !a.startsWith('--'));
const meta = (await readJson('meta.json')) ?? {};

for (const source of SOURCES.filter((s) => !wanted.length || wanted.includes(s.id))) {
  let html;
  let now;
  if (reparse) {
    html = await readFile(file(`${source.id}.html`), 'utf8').catch(() => null);
    if (!html || !meta[source.id]) {
      console.log(`${source.id}: kein lokales Fixture – übersprungen (ohne --reparse ausführen)`);
      continue;
    }
    now = new Date(meta[source.id].capturedAt);
  } else {
    now = new Date();
    html = sanitize(await fetchHtml(source.url));
    await writeFile(file(`${source.id}.html`), html);
    meta[source.id] = { url: source.url, capturedAt: toViennaIso(now) };
  }

  const result = source.parse(html, { now });
  validateResult(result);
  const before = await readJson(`${source.id}.expected.json`);
  await writeFile(file(`${source.id}.expected.json`), `${JSON.stringify(result, null, 2)}\n`);

  const counts = result.sections.map((s) => `${s.id}=${s.entries.length}`).join(', ');
  const changed = before ? diffPaths(before, result) : null;
  const summary = changed === null ? 'neu'
    : changed.length === 0 ? 'Snapshot unverändert'
      : `${changed.length} Pfade geändert, z.B. ${changed.slice(0, 5).join(', ')}`;
  console.log(`${source.id}: ${counts} – ${summary}`);
}

await writeFile(file('meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
