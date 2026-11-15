// Holt die Live-Seiten, speichert sie bereinigt als Test-Fixtures und erzeugt
// die erwartete Parser-Ausgabe (<id>.expected.json) als Snapshot.
// Nach dem Lauf den Git-Diff der *.expected.json prüfen: Er zeigt genau, was
// sich am Parser-Ergebnis ändert. Handgeprüfte Werte in test/<id>.test.js
// müssen danach ggf. angepasst werden.
//
//   node tools/update-fixtures.js          → alle Quellen
//   node tools/update-fixtures.js orf      → nur ORF

import * as cheerio from 'cheerio';
import { readFile, writeFile } from 'node:fs/promises';
import { fetchHtml } from '../lib/http.js';
import { validateResult } from '../lib/schema.js';
import { toViennaIso } from '../lib/time.js';
import { SOURCES } from '../sources/index.js';

const dir = new URL('../fixtures/', import.meta.url);

/** Entfernt Skripte, Styles, Einbettungen und Kommentare; die Struktur bleibt. */
function sanitize(html) {
  const $ = cheerio.load(html);
  $('script, style, noscript, svg, iframe, link, template').remove();
  $('*').contents().filter((_, node) => node.type === 'comment').remove();
  return $.html();
}

const wanted = process.argv.slice(2);
const metaFile = new URL('meta.json', dir);
const meta = JSON.parse(await readFile(metaFile, 'utf8').catch(() => '{}'));

for (const source of SOURCES.filter((s) => !wanted.length || wanted.includes(s.id))) {
  const now = new Date();
  const html = sanitize(await fetchHtml(source.url));
  const result = source.parse(html, { now });
  validateResult(result);
  await writeFile(new URL(`${source.id}.html`, dir), html);
  await writeFile(new URL(`${source.id}.expected.json`, dir), `${JSON.stringify(result, null, 2)}\n`);
  meta[source.id] = { url: source.url, capturedAt: toViennaIso(now) };
  console.log(`${source.id}: ${html.length} Zeichen, ${result.sections.map((s) => `${s.id}=${s.entries.length}`).join(', ')}`);
}

await writeFile(metaFile, `${JSON.stringify(meta, null, 2)}\n`);
