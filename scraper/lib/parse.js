// Text-/Zahlen-Helfer für deutschsprachige Wetterseiten.

/** Whitespace (inkl. &nbsp; und &thinsp;) zusammenfassen und trimmen. */
export function cleanText(text) {
  return String(text ?? '').replace(/[\s   ]+/g, ' ').trim();
}

/**
 * Erste Zahl aus einem Text: "−0,5 °C" → -0.5, "+18.1" → 18.1, "60%" → 60,
 * "0,4l" → 0.4. Liefert null, wenn keine Zahl enthalten ist (z.B. "-" = kein Wert).
 * thousands: Punkt als Tausendertrenner behandeln ("1.230m" → 1230).
 */
export function parseNumber(text, { thousands = false } = {}) {
  if (text == null) return null;
  let s = cleanText(text).replace(/−/g, '-'); // typografisches Minus
  if (thousands) s = s.replace(/(\d)\.(?=\d{3}(?!\d))/g, '$1');
  const m = s.match(/[-+]?\d+(?:[.,]\d+)?/);
  return m ? Number(m[0].replace(',', '.')) : null;
}
