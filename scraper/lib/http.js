// HTTP-Abruf mit Timeout und klaren Fehlermeldungen.

// Generischer, ehrlicher User-Agent ohne Kontaktdaten (von allen 3 Quellen akzeptiert).
const USER_AGENT = 'look_outside/0.1 (private weather aggregator)';
const TIMEOUT_MS = 20_000;
// Fehlerseiten/Consent-Walls sind deutlich kürzer als die echten Seiten (≥ 15 KB).
const MIN_LENGTH = 2_000;

export async function fetchHtml(url) {
  let res;
  try {
    res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html', 'accept-language': 'de-AT,de;q=0.9' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err.name === 'TimeoutError' ? `Timeout nach ${TIMEOUT_MS / 1000} s` : err.cause?.code ?? err.message;
    throw new Error(`Abruf fehlgeschlagen (${reason})`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`.trim());
  const html = await res.text();
  if (html.length < MIN_LENGTH) throw new Error(`Antwort verdächtig kurz (${html.length} Zeichen)`);
  return html;
}
