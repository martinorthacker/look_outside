// Orchestrator: ruft alle Quellen ab (lib/collect.js) und schreibt
// docs/data.json, aber nur, wenn sich der Inhalt geändert hat. Reine
// Zeitstempel zählen nicht, damit der Workflow keine leeren Commits erzeugt.
// Exit-Code 0 auch bei Quellenfehlern (die zeigt das Frontend an). Ein roter
// Workflow-Lauf bedeutet einen Programmfehler.

import { readFile, writeFile } from 'node:fs/promises';
import { collect, sameContent } from './lib/collect.js';
import { SOURCES } from './sources/index.js';

const OUT = new URL('../docs/data.json', import.meta.url);

/** GitHub-Actions-Annotation (erscheint in der Run-Übersicht), lokal normale Logzeile. */
function report(level, title, message) {
  if (process.env.GITHUB_ACTIONS) {
    const esc = message.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
    console.log(`::${level} title=${title}::${esc}`);
  } else {
    console.log(`[${level}] ${title}: ${message}`);
  }
}

const previous = await readFile(OUT, 'utf8').then(JSON.parse).catch(() => null);
const data = await collect(SOURCES, { previous });

for (const s of data.sources) {
  const counts = s.sections.map((sec) => `${sec.id}=${sec.entries.length}`).join(', ');
  console.log(`${s.id}: ${s.status}${counts ? ` (${counts})` : ''}`);
  if (s.status === 'error') report('warning', s.id, s.error);
  for (const w of s.warnings) report('notice', s.id, w);
}

if (sameContent(previous, data)) {
  console.log('data.json inhaltlich unverändert, nicht geschrieben');
} else {
  await writeFile(OUT, `${JSON.stringify(data, null, 2)}\n`);
  console.log('data.json geschrieben');
}
