// Sammelt alle Quellen zu einem data.json-Objekt (ohne Dateizugriff, testbar).
// Fehler werden pro Quelle abgefangen: Eine kaputte Quelle blockiert die
// anderen nicht. Sie bekommt status "error" und behält die letzten gültigen
// Daten; deren Alter ist über lastSuccessAt erkennbar.

import { fetchHtml } from './http.js';
import { validateResult } from './schema.js';
import { TZ, toViennaIso } from './time.js';

export const SCHEMA_VERSION = 1;

async function runSource(source, { now, previous, fetch }) {
  const base = { id: source.id, name: source.name, url: source.url };
  const fetchedAt = toViennaIso(now);
  try {
    const result = source.parse(await fetch(source.url), { now });
    validateResult(result);
    return {
      ...base,
      status: 'ok',
      error: null,
      fetchedAt,
      lastSuccessAt: fetchedAt,
      warnings: result.warnings ?? [],
      sections: result.sections,
    };
  } catch (err) {
    return {
      ...base,
      status: 'error',
      error: err.message,
      fetchedAt,
      lastSuccessAt: previous?.lastSuccessAt ?? null,
      warnings: [],
      sections: previous?.sections ?? [],
    };
  }
}

/** previous: bisheriges data.json (oder null). fetch ist für Tests austauschbar. */
export async function collect(sources, { now = new Date(), previous = null, fetch = fetchHtml } = {}) {
  const prevById = new Map(isCompatible(previous) ? previous.sources.map((s) => [s.id, s]) : []);
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: toViennaIso(now),
    timezone: TZ,
    sources: await Promise.all(sources.map((s) => runSource(s, { now, previous: prevById.get(s.id), fetch }))),
  };
}

const isCompatible = (data) => data?.schemaVersion === SCHEMA_VERSION && Array.isArray(data?.sources);
