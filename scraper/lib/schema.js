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
  isNight: (v) => v === null || typeof v === 'boolean',
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

const fail = (path, msg) => { throw new Error(`Schema: ${path}: ${msg}`); };

// Anzeigbare Wertefelder (ohne timeEnd/iconUrl/isNight, die nur Hilfsdaten sind).
const DISPLAYABLE = new Set(Object.keys(FIELDS).filter((k) => !['timeEnd', 'iconUrl', 'isNight'].includes(k)));

function validateDisplay(d, path) {
  if (typeof d !== 'object' || d === null || Array.isArray(d)) fail(path, 'muss ein Objekt sein');
  for (const [k, v] of Object.entries(d)) {
    if (k === 'fields') {
      if (!Array.isArray(v) || !v.length) fail(`${path}.fields`, 'muss ein nicht leeres Array sein');
      for (const f of v.flat()) if (!DISPLAYABLE.has(f)) fail(`${path}.fields`, `unbekanntes/nicht anzeigbares Feld "${f}"`);
      if (v.some((f) => Array.isArray(f) && !f.length)) fail(`${path}.fields`, 'leere Feldgruppe');
    } else if (k === 'layout') {
      if (!['table', 'cards'].includes(v)) fail(`${path}.layout`, `"${v}" (erlaubt: table, cards)`);
    } else if (k === 'hidePast') {
      if (typeof v !== 'boolean') fail(`${path}.hidePast`, 'muss boolean sein');
    } else if (k === 'limit' || k === 'horizonHours') {
      if (!(typeof v === 'number' && v > 0)) fail(`${path}.${k}`, 'muss eine Zahl > 0 sein');
    } else {
      fail(path, `unbekanntes Feld "${k}"`);
    }
  }
}

/** Prüft { sections, warnings? } eines Parsers. Wirft Error mit Pfadangabe. */
export function validateResult(result) {

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
    if (s.display !== undefined) validateDisplay(s.display, `${sp}.display`);
    for (const k of Object.keys(s)) {
      if (!['id', 'title', 'observedAt', 'display', 'entries'].includes(k)) fail(sp, `unbekanntes Feld "${k}"`);
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
