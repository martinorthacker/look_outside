// Macht jede Quelle als Einzelskript ausführbar:
//   node sources/geosphere.js                       → live abrufen
//   node sources/geosphere.js fixtures/geosphere.html → gespeichertes HTML parsen
// Ausgabe: validiertes Parser-Ergebnis als JSON.

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fetchHtml } from './http.js';
import { validateResult } from './schema.js';

export async function runIfMain(moduleUrl, source) {
  if (!process.argv[1] || moduleUrl !== pathToFileURL(process.argv[1]).href) return;
  const file = process.argv[2];
  const html = file ? await readFile(file, 'utf8') : await fetchHtml(source.url);
  const result = source.parse(html, { now: new Date() });
  validateResult(result);
  console.log(JSON.stringify(result, null, 2));
}
