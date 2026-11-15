// HTTP-Abruf mit Timeout, klaren Fehlermeldungen und höchstens einem
// Wiederholungsversuch bei vorübergehenden Fehlern.
// Hintergrund: bergfex antwortet GitHub-Runnern gelegentlich mit 429. Ein
// zweiter Versuch nach kurzer Pause (Retry-After respektiert) hält die Daten
// frisch, ohne die Abruffrequenz nennenswert zu erhöhen (ROADMAP #7).
// Verlangt die Quelle eine längere Pause, wird nicht erneut angefragt.

// Generischer, ehrlicher User-Agent ohne Kontaktdaten (keine Browser-Tarnung).
const USER_AGENT = 'look_outside/0.1 (private weather aggregator)';
const TIMEOUT_MS = 20_000;
// Fehlerseiten/Consent-Walls sind deutlich kürzer als die echten Seiten (≥ 15 KB).
const MIN_LENGTH = 2_000;
const RETRY_STATUS = new Set([429, 502, 503, 504]);
const DEFAULT_RETRY_DELAY_MS = 10_000;
const MAX_RETRY_WAIT_MS = 30_000;

class FetchError extends Error {
  constructor(message, { retryable = false, retryAfterMs = null } = {}) {
    super(message);
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
  }
}

/** Retry-After (Sekunden oder HTTP-Datum) → ms, sonst null */
function parseRetryAfter(value) {
  if (!value) return null;
  if (/^\d+$/.test(value.trim())) return Number(value) * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

async function fetchOnce(url) {
  let res;
  try {
    res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html', 'accept-language': 'de-AT,de;q=0.9' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err.name === 'TimeoutError'
      ? `Timeout nach ${TIMEOUT_MS / 1000} s`
      : err.cause?.code ?? err.cause?.errors?.[0]?.code ?? err.cause?.message ?? err.message;
    throw new FetchError(`Abruf fehlgeschlagen (${reason})`, { retryable: true });
  }
  if (!res.ok) {
    const retryAfter = res.headers.get('retry-after');
    await res.body?.cancel();
    throw new FetchError(`HTTP ${res.status} ${res.statusText}`.trim() + (retryAfter ? ` (Retry-After: ${retryAfter})` : ''), {
      retryable: RETRY_STATUS.has(res.status),
      retryAfterMs: parseRetryAfter(retryAfter),
    });
  }
  const html = await res.text();
  if (html.length < MIN_LENGTH) throw new FetchError(`Antwort verdächtig kurz (${html.length} Zeichen)`);
  return html;
}

export async function fetchHtml(url, { retryDelayMs = DEFAULT_RETRY_DELAY_MS } = {}) {
  try {
    return await fetchOnce(url);
  } catch (err) {
    const wait = err.retryAfterMs ?? retryDelayMs;
    if (!err.retryable || wait > MAX_RETRY_WAIT_MS) throw err;
    await new Promise((resolve) => setTimeout(resolve, wait));
    try {
      return await fetchOnce(url);
    } catch (err2) {
      err2.message += ' – auch beim 2. Versuch';
      throw err2;
    }
  }
}
