// TEMP — seed a single simple course, generate, screenshot the R1 single-result state.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WEB = 'http://localhost:3000';
const FILE_ID = 'd35ec9f3-a2b8-4fff-8422-d5185461948f';
const MAINS = ['BUSI1302', 'GİTA1106', 'ELEC2207'];
const OUT = join(tmpdir(), 'isik-screens');
mkdirSync(OUT, { recursive: true });
const CHROME = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean).find((p) => existsSync(p));

async function launchChrome() {
  const userDataDir = mkdtempSync(join(tmpdir(), 'isik-chrome-'));
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', '--window-size=1440,1000', '--remote-debugging-port=0', '--user-data-dir=' + userDataDir, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = ''; const t = setTimeout(() => reject(new Error('no devtools endpoint')), 20000);
    proc.stderr.on('data', (d) => { buf += d.toString(); const m = buf.match(/ws:\/\/127\.0\.0\.1:(\d+)\/devtools\/browser\/\S+/); if (m) { clearTimeout(t); resolve(m[0]); } });
    proc.on('exit', (c) => reject(new Error('chrome exited ' + c)));
  });
  const port = new URL(wsUrl).port;
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  return { proc, pageWs: targets.find((t) => t.type === 'page').webSocketDebuggerUrl };
}
function cdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map();
  const ready = new Promise((res, rej) => { ws.onopen = () => res(); ws.onerror = () => rej(new Error('ws error')); });
  ws.onmessage = (ev) => { const msg = JSON.parse(ev.data); if (msg.id && pending.has(msg.id)) { const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id); msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result); } };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = nextId++; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('timeout ' + method)); } }, 30000); });
  return { ready, send, close: () => ws.close() };
}
async function evaluate(cdp, expression) { const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails))); return r.result.value; }
async function waitFor(cdp, expr, { timeout = 45000, label = expr } = {}) { const start = Date.now(); while (Date.now() - start < timeout) { try { if (await evaluate(cdp, expr)) return true; } catch {} await new Promise((r) => setTimeout(r, 250)); } throw new Error('waitFor timed out: ' + label); }
async function shot(cdp, name) { const r = await cdp.send('Page.captureScreenshot', { format: 'png' }); const p = join(OUT, name); writeFileSync(p, Buffer.from(r.data, 'base64')); console.log('shot ->', p); }
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const { proc, pageWs } = await launchChrome();
  const cdp = cdpClient(pageWs); await cdp.ready;
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  try {
    await cdp.send('Page.navigate', { url: WEB + '/' });
    await waitFor(cdp, "document.readyState === 'complete'", { label: 'landing' });
    const snap = { fileId: FILE_ID, sourceLabel: '2024-2025 Güz', selectedCourseCodes: [], selectedMainCodes: MAINS, lockedSlots: [], algorithm: 'dfs', maxEcts: 45, maxConflicts: 1 };
    await evaluate(cdp, `localStorage.setItem('isikschedule:scheduler:v1', ${JSON.stringify(JSON.stringify(snap))})`);
    await cdp.send('Page.navigate', { url: WEB + '/scheduler' });
    await waitFor(cdp, "!!document.body && /oluştur/i.test(document.body.innerText)", { label: 'scheduler restored' });
    await pause(1000);
    await evaluate(cdp, `(() => { const b=[...document.querySelectorAll('button')].find(x=>/program oluştur/i.test(x.textContent||'') && !x.disabled); if(b) b.click(); })()`);
    await waitFor(cdp, "/uygun|program bulundu|kombinasyon/i.test(document.body.innerText)", { label: 'results overlay', timeout: 30000 });
    await pause(1800);
    const cardCount = await evaluate(cdp, `[...document.querySelectorAll('p')].filter(p=>/^Program #\\d+$/.test((p.textContent||'').trim())).length`);
    const variantBadge = await evaluate(cdp, `(document.body.innerText.match(/↔\\s*(\\d+)\\s*seçenek/)||[])[1] || 'none'`);
    console.log('result cards:', cardCount, '| variant badge count:', variantBadge);
    await shot(cdp, 'results-r2.png');
    // scroll to the shareable card (variant picker lives there) and shoot again
    await evaluate(cdp, `(() => { const el=[...document.querySelectorAll('div')].find(d=>typeof d.className==='string' && d.className.includes('fixed')&&d.className.includes('overflow-y-auto')); if(el){ el.scrollTop=el.scrollHeight; } })()`);
    await pause(900);
    const hasPicker = await evaluate(cdp, `/Aynı saat düzeni/.test(document.body.innerText)`);
    console.log('variant picker present:', hasPicker);
    await shot(cdp, 'results-variants-detail.png');
  } catch (e) { console.error('ERR:', e.message); try { await shot(cdp, 'results-single-error.png'); } catch {} }
  finally { cdp.close(); proc.kill(); }
})();
