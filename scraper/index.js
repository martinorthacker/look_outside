// Orchestrator: ruft alle Quellen ab (lib/collect.js) und schreibt docs/data.json.
// Die vorherige docs/data.json (im Workflow von der Live-Seite geholt) liefert
// bei Quellenausfall die letzten gültigen Daten.
// Geschrieben wird bei jedem Lauf: data.json wird nicht committet, sondern
// deployt (ROADMAP #2), und generatedAt zeigt so den echten letzten Lauf.
// Exit-Code 0 auch bei Quellenfehlern (die zeigt das Frontend an). Ein roter
// Workflow-Lauf bedeutet einen Programmfehler.

import { readFile, writeFile } from 'node:fs/promises';
import { collect } from './lib/collect.js';
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
if (!previous) console.log('Keine (lesbare) vorherige data.json – kein Fallback für Ausfälle');
const data = await collect(SOURCES, { previous });

for (const s of data.sources) {
  const counts = s.sections.map((sec) => `${sec.id}=${sec.entries.length}`).join(', ');
  console.log(`${s.id}: ${s.status}${counts ? ` (${counts})` : ''}`);
  if (s.status === 'error') report('warning', s.id, s.error);
  for (const w of s.warnings) report('notice', s.id, w);
}

await writeFile(OUT, `${JSON.stringify(data, null, 2)}\n`);
console.log('docs/data.json geschrieben');
