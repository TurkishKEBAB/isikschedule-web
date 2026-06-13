#!/usr/bin/env node
// driver.mjs — zero-dependency harness to launch-check and DRIVE isikschedule-web.
//
// Requires Node 18+ (global fetch) and Node 21+ (global WebSocket). Tested on Node 24.
// No npm install: it talks to an already-installed Chrome/Edge over the DevTools
// Protocol and to the FastAPI backend over plain fetch.
//
// Two layers are driven (the layers PRs in this repo actually touch):
//   * Backend  FastAPI API  (http://127.0.0.1:8000) — health, JWT auth, courses
//   * Frontend Next.js app  (http://localhost:3000)  — renders + real login flow
//
// Usage:
//   node driver.mjs api                  # backend API smoke (health, root, login, /me, courses)
//   node driver.mjs shot <url> <out.png> # screenshot any URL with headless Chrome
//   node driver.mjs login [out.png]      # fill login form, submit, follow redirect, screenshot
//   node driver.mjs smoke                # api + landing screenshot + login flow (the full run)
//
// Servers must already be running (see SKILL.md). The backend MUST be launched with
// PYTHONUTF8=1, otherwise it crashes on its emoji startup banner under Windows cp1252.

import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const API = process.env.API_BASE || 'http://127.0.0.1:8000';
const WEB = process.env.WEB_BASE || 'http://localhost:3000';

// This repo is public, so NO admin credentials are baked in. Commands that log in
// (api, login, smoke) read them from the environment and fail loudly when unset.
function adminCreds() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD env vars are required (nothing is hardcoded).\n' +
        '  bash:       ADMIN_EMAIL=admin@isik.edu.tr ADMIN_PASSWORD=*** node <driver.mjs> smoke\n' +
        "  PowerShell: $env:ADMIN_EMAIL='admin@isik.edu.tr'; $env:ADMIN_PASSWORD='***'; node <driver.mjs> smoke",
    );
  }
  return { email, password };
}

const SCREENS = join(tmpdir(), 'isik-screens');
mkdirSync(SCREENS, { recursive: true });

const CHROME_CANDIDATES = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

function chromePath() {
  for (const p of CHROME_CANDIDATES) if (existsSync(p)) return p;
  throw new Error('Chrome/Edge not found. Set CHROME=/path/to/chrome.exe');
}

// ---------- backend API smoke (fetch) ----------
async function apiSmoke() {
  const { email: adminEmail, password: adminPassword } = adminCreds();
  const checks = [];
  const ok = (name, cond, detail) => checks.push({ name, pass: !!cond, detail });

  let r = await fetch(API + '/health');
  let j = await r.json();
  ok('GET /health -> healthy', r.status === 200 && j.status === 'healthy', `env=${j.environment}`);

  r = await fetch(API + '/');
  j = await r.json();
  ok('GET / -> running', j.status === 'running', j.name);

  r = await fetch(API + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  j = await r.json();
  const token = j.access_token;
  ok('POST /api/auth/login (admin)', r.status === 200 && !!token, `role=${j.user && j.user.role}`);

  r = await fetch(API + '/api/auth/me', { headers: { Authorization: 'Bearer ' + token } });
  j = await r.json();
  ok('GET /api/auth/me (bearer)', r.status === 200 && j.email === adminEmail, j.email);

  // 200 when an admin has uploaded a semester, 404 on a fresh DB — both are healthy.
  r = await fetch(API + '/api/courses/global');
  ok('GET /api/courses/global (200|404)', r.status === 200 || r.status === 404, `status=${r.status}`);

  report('BACKEND API', checks);
  return checks.every((c) => c.pass);
}

// ---------- Chrome DevTools Protocol plumbing ----------
async function launchChrome() {
  const userDataDir = mkdtempSync(join(tmpdir(), 'isik-chrome-'));
  const proc = spawn(
    chromePath(),
    [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--disable-extensions', '--hide-scrollbars', '--window-size=1366,900',
      '--remote-debugging-port=0', '--user-data-dir=' + userDataDir, 'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const t = setTimeout(() => reject(new Error('Chrome gave no DevTools endpoint in 20s')), 20000);
    proc.stderr.on('data', (d) => {
      buf += d.toString();
      const m = buf.match(/ws:\/\/127\.0\.0\.1:(\d+)\/devtools\/browser\/\S+/);
      if (m) { clearTimeout(t); resolve(m[0]); }
    });
    proc.on('exit', (c) => reject(new Error('Chrome exited early (code ' + c + ')')));
  });
  const port = new URL(wsUrl).port;
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = targets.find((t) => t.type === 'page');
  return { proc, pageWs: page.webSocketDebuggerUrl };
}

function cdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const ready = new Promise((res, rej) => {
    ws.onopen = () => res();
    ws.onerror = () => rej(new Error('CDP websocket error'));
  });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (pending.has(id)) { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }
      }, 30000);
    });
  return { ready, send, close: () => ws.close() };
}

async function evaluate(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    throw new Error('eval: ' + (r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails)));
  }
  return r.result.value;
}

async function waitFor(cdp, expr, { timeout = 20000, label = expr } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { if (await evaluate(cdp, expr)) return true; } catch { /* page mid-navigation */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('waitFor timed out: ' + label);
}

async function screenshot(cdp, outPath) {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(outPath, Buffer.from(r.data, 'base64'));
  return outPath;
}

async function openPage() {
  const { proc, pageWs } = await launchChrome();
  const cdp = cdpClient(pageWs);
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  return { proc, cdp, done: () => { cdp.close(); proc.kill(); } };
}

// ---------- frontend flows ----------
async function shot(url, outPath) {
  const { cdp, done } = await openPage();
  try {
    await cdp.send('Page.navigate', { url });
    await waitFor(cdp, "document.readyState === 'complete'", { timeout: 30000, label: 'page load' });
    await new Promise((r) => setTimeout(r, 1200)); // let client components paint
    await screenshot(cdp, outPath);
    console.log('screenshot ->', outPath);
  } finally {
    done();
  }
}

async function loginFlow(outPath = join(SCREENS, 'after-login.png')) {
  const { email: adminEmail, password: adminPassword } = adminCreds();
  const { cdp, done } = await openPage();
  try {
    await cdp.send('Page.navigate', { url: WEB + '/login' });
    // /login shows a spinner while it checks localStorage, then renders the form.
    await waitFor(cdp, "!!document.querySelector('input[type=email]')", { timeout: 30000, label: 'login form' });

    // React owns these inputs: set via the native value setter + input event,
    // otherwise React's onChange never fires and state stays empty.
    const fill = (sel, val) => `(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      set.call(el, ${JSON.stringify(val)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return el.value;
    })()`;
    await evaluate(cdp, fill('input[type=email]', adminEmail));
    await evaluate(cdp, fill('input[type=password]', adminPassword));
    await screenshot(cdp, join(SCREENS, 'login-filled.png'));

    await evaluate(cdp, "document.querySelector('form button[type=submit]').click()");

    // Success proof: the backend returns a JWT and the page stores it.
    await waitFor(cdp, "!!localStorage.getItem('token')", { timeout: 20000, label: 'token in localStorage' });
    const user = JSON.parse(await evaluate(cdp, "localStorage.getItem('user')"));
    const home = user.role === 'admin' ? '/admin' : '/scheduler';

    // The /login page sets localStorage directly and soft-redirects, but
    // AuthProvider only reads localStorage on its initial mount, so a guarded
    // page (RequireAuth) renders null after a soft nav. A full reload re-mounts
    // the provider with the now-stored token, so the dashboard actually paints.
    await cdp.send('Page.navigate', { url: WEB + home });
    const needle = user.role === 'admin' ? 'Admin Paneli' : 'IşıkSchedule';
    await waitFor(
      cdp,
      `!!document.body && document.body.innerText.includes(${JSON.stringify(needle)})`,
      { timeout: 45000, label: home + ' content (first Next.js compile is slow)' },
    );
    await new Promise((r) => setTimeout(r, 1200));
    await screenshot(cdp, outPath);
    console.log(`login OK -> ${home}  user=${user.email} (${user.role})`);
    console.log('screenshot ->', outPath);
    return true;
  } finally {
    done();
  }
}

function report(title, checks) {
  console.log('\n== ' + title + ' ==');
  for (const c of checks) {
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  (' + c.detail + ')' : ''}`);
  }
}

// Close undici's keep-alive pool so the event loop drains and the process exits
// on its own. Calling process.exit() with live sockets crashes Node on Windows
// with a libuv "UV_HANDLE_CLOSING" assertion, so we never hard-exit instead.
async function shutdownHttp() {
  try {
    for (const sym of Object.getOwnPropertySymbols(globalThis)) {
      if (sym.toString().includes('undici.globalDispatcher')) {
        const d = globalThis[sym];
        if (d && typeof d.close === 'function') await d.close();
      }
    }
  } catch { /* best effort */ }
}

async function main() {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'api') {
    process.exitCode = (await apiSmoke()) ? 0 : 1;
  } else if (cmd === 'shot') {
    if (!a) throw new Error('usage: node driver.mjs shot <url> <out.png>');
    await shot(a, b || join(SCREENS, 'shot.png'));
  } else if (cmd === 'login') {
    await loginFlow(a);
  } else if (cmd === 'smoke') {
    const apiPass = await apiSmoke();
    await shot(WEB + '/', join(SCREENS, 'landing.png'));
    await shot(WEB + '/scheduler', join(SCREENS, 'scheduler.png'));
    const loginPass = await loginFlow();
    console.log(`\nscreenshots in: ${SCREENS}`);
    process.exitCode = apiPass && loginPass ? 0 : 1;
  } else {
    console.log('usage: node driver.mjs <api|shot <url> <out.png>|login [out.png]|smoke>');
    process.exitCode = 2;
  }
}

main()
  .catch((e) => {
    console.error('\nDRIVER ERROR:', e.message);
    if (/ECONNREFUSED|fetch failed|ENOTFOUND|ETIMEDOUT/i.test(e.message)) {
      console.error('Are both servers up? Backend must be started with PYTHONUTF8=1.');
    }
    process.exitCode = 1;
  })
  .finally(shutdownHttp);
