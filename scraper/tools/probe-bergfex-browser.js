// Isolierter Machbarkeitstest: kein data.json, kein Deploy, keine Rohdaten im Log.
// Reguläres Chromium ohne Stealth-Anpassungen, Cookies oder Challenge-Solver.
import { chromium } from 'playwright';
import bergfex from '../sources/bergfex.js';
import { validateResult } from '../lib/schema.js';
import { toViennaIso } from '../lib/time.js';

const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--headed')) {
  console.error('Aufruf: node tools/probe-bergfex-browser.js [--headed]');
  process.exitCode = 1;
} else {
  await probe();
}

async function probe() {
  let browser;
  let page;
  let challengeSeen = false;
  try {
    const headless = !args.includes('--headed');
    console.log(`Bergfex-Browserprobe: Chromium (${headless ? 'headless' : 'headed'})`);
    browser = await chromium.launch({ headless });
    const context = await browser.newContext({ locale: 'de-AT', timezoneId: 'Europe/Vienna' });
    page = await context.newPage();
    // Eine Challenge kann nach der ersten Antwort durch Browser-JavaScript
    // aufgelöst werden. Deshalb bis zu 45 s auf echtes Prognose-Markup warten.
    page.on('response', (response) => {
      if (response.frame() === page.mainFrame() && response.request().isNavigationRequest()) {
        const challenged = response.headers()['cf-mitigated'] === 'challenge';
        challengeSeen ||= challenged;
        console.log(`Navigation: HTTP ${response.status()}, Cloudflare-Challenge: ${challenged ? 'ja' : 'nein'}`);
      }
    });
    await page.goto(bergfex.url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await Promise.all([
      '#forecast-day-0', '#forecast-day-1',
      '.forecast-day-0-intervals .interval', '.forecast-day-1-intervals .interval',
    ].map((selector) => page.locator(selector).first().waitFor({ state: 'attached', timeout: 45_000 })));

    const now = new Date();
    const result = bergfex.parse(await page.content(), { now });
    validateResult(result);
    const today = toViennaIso(now).slice(0, 10);
    if (result.sections.find((s) => s.id === 'daily')?.entries[0]?.date !== today) {
      throw new Error(`Prognose beginnt nicht mit dem heutigen Datum (${today})`);
    }
    console.log(`ERFOLG: aktuelle Prognose geladen und validiert (${result.sections.map((s) => `${s.id}=${s.entries.length}`).join(', ')}).`);
    console.log('Ein erfolgreicher Einzeltest belegt noch keine langfristige Zuverlässigkeit.');
  } catch (err) {
    const title = page && !page.isClosed() ? await page.title().catch(() => '') : '';
    console.error(`FEHLGESCHLAGEN: ${err.message}`);
    console.error(`Cloudflare-Challenge beobachtet: ${challengeSeen ? 'ja' : 'nein'}; Seitentitel: ${JSON.stringify(title)}`);
    process.exitCode = 1;
  } finally {
    await browser?.close();
  }
}
