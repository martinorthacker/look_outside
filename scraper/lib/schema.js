// Validierung des Parser-Ergebnisses gegen schema.md. Jeder Verstoß wirft,
// damit eine Layoutänderung zu einem sichtbaren Fehlerzustand führt statt zu
// stillen Leerwerten.

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const ROW_KEYS = {
  location: (v) => typeof v === 'string' && v.length > 0,
  date: (v) => typeof v === 'string' && DATE.test(v),
  time: (v) => typeof v === 'string' && ISO.test(v),
};

const isNum = (v) => v === null || (typeof v === 'number' && Number.isFinite(v));
const isStr = (v) => v === null || typeof v === 'string';

export const FIELDS = {
  timeEnd: (v) => typeof v === 'string' && ISO.test(v),
  condition: isStr,
  iconUrl: (v) => v === null || (typeof v === 'string' && /^https:\/\//.test(v)),
  temp: isNum,
  tempFeels: isNum,
  tempMin: isNum,
  tempMax: isNum,
  precipMm: isNum,
  precipProb: isNum,
  thunderProb: isNum,
  sunHours: isNum,
  snowLineM: isNum,
  newSnowCm: isNum,
  windKmh: isNum,
  windBft: isNum,
  windDeg: isNum,
  windDir: isStr,
};

/** Prüft { sections, warnings? } eines Parsers. Wirft Error mit Pfadangabe. */
export function validateResult(result) {
  const fail = (path, msg) => { throw new Error(`Schema: ${path}: ${msg}`); };

  if (!result || !Array.isArray(result.sections) || result.sections.length === 0) {
    fail('sections', 'fehlt oder leer');
  }
  if (result.warnings !== undefined && !(Array.isArray(result.warnings) && result.warnings.every((w) => typeof w === 'string'))) {
    fail('warnings', 'muss string[] sein');
  }

  const sectionIds = new Set();
  result.sections.forEach((s, si) => {
    const sp = `sections[${si}]`;
    if (typeof s.id !== 'string' || !s.id) fail(sp, 'id fehlt');
    if (sectionIds.has(s.id)) fail(sp, `id "${s.id}" doppelt`);
    sectionIds.add(s.id);
    if (typeof s.title !== 'string' || !s.title) fail(sp, 'title fehlt');
    if (s.observedAt !== undefined && !ISO.test(s.observedAt)) fail(sp, 'observedAt kein ISO-Zeitpunkt');
    for (const k of Object.keys(s)) {
      if (!['id', 'title', 'observedAt', 'entries'].includes(k)) fail(sp, `unbekanntes Feld "${k}"`);
    }
    if (!Array.isArray(s.entries) || s.entries.length === 0) fail(sp, 'entries fehlt oder leer');

    s.entries.forEach((e, ei) => {
      const ep = `${sp}.entries[${ei}]`;
      const rowKeys = Object.keys(e).filter((k) => k in ROW_KEYS);
      if (rowKeys.length !== 1) fail(ep, `genau ein Zeilenschlüssel (${Object.keys(ROW_KEYS).join('/')}) erwartet`);
      for (const [k, v] of Object.entries(e)) {
        const check = ROW_KEYS[k] ?? FIELDS[k];
        if (!check) fail(ep, `unbekanntes Feld "${k}"`);
        if (!check(v)) fail(ep, `ungültiger Wert für "${k}": ${JSON.stringify(v)}`);
      }
    });
  });
}
