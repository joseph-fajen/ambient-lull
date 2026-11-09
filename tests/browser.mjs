// Opens a page from this repo in headless Chrome and lets a script talk to it.
// Used by run-audio-checks.mjs and render-clips.mjs (Node 22+, for the built-in WebSocket).
// Set CHROME=/path/to/browser to choose the browser.
//
// It serves the repo itself on a free port and starts the browser with a fresh profile
// (so it never runs stale cached code).
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.mp3': 'audio/mpeg' };

const BROWSERS = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export function fail(message) {
  console.error(message);
  process.exit(1);
}

// Opens `page` (a path in the repo, with an optional query). Returns the browser's
// name, `evaluate(expression)` to run code in the page and get its value back, and
// `close()`.
export async function openPage(page) {
  if (typeof WebSocket === 'undefined') fail('Needs Node 22 or newer (for the built-in WebSocket).');
  const browserPath = BROWSERS.find(p => existsSync(p));
  if (!browserPath) fail('No Chrome, Chromium or Edge found. Set CHROME=/path/to/browser.');

  // A tiny static server for the repo, read-only, no directory listings.
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '');
    if (path.startsWith('..')) return res.writeHead(403).end();
    try {
      const body = await readFile(join(ROOT, path));
      res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const pageUrl = `http://127.0.0.1:${server.address().port}/${page}`;

  const profile = await mkdtemp(join(tmpdir(), 'ambient-lull-'));
  const browser = spawn(browserPath, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  let ws;
  async function close() {
    ws?.close();
    browser.kill();
    server.close();
    await sleep(300);
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }

  try {
    // The browser prints its debugging address on stderr once it's ready.
    const wsUrl = await new Promise((resolve, reject) => {
      let log = '';
      browser.stderr.on('data', chunk => {
        log += chunk;
        const match = log.match(/DevTools listening on (ws:\/\/\S+)/);
        if (match) resolve(match[1]);
      });
      browser.on('exit', () => reject(new Error(`The browser exited early:\n${log}`)));
      setTimeout(() => reject(new Error('The browser did not start in time.')), 20000);
    });

    // Connect to the browser, open a tab, and talk to it.
    let id = 0;
    const pending = new Map();
    ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    ws.onmessage = e => {
      const msg = JSON.parse(e.data);
      pending.get(msg.id)?.(msg);
      pending.delete(msg.id);
    };
    const send = (method, params = {}, sessionId) => new Promise(resolve => {
      pending.set(++id, resolve);
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
    const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
    const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
    const evaluate = async expression =>
      (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId)).result?.result?.value;
    await send('Page.navigate', { url: pageUrl }, sessionId);
    return { browserName: browserPath.split('/').pop(), evaluate, close };
  } catch (err) {
    await close();
    throw err;
  }
}

// Waits until `expression` gives a truthy value in the page, checking every second.
export async function waitFor(evaluate, expression, timeoutMs, what) {
  const started = Date.now();
  let value;
  while (!(value = await evaluate(expression))) {
    if (Date.now() - started > timeoutMs) throw new Error(`Timed out waiting for ${what}.`);
    await sleep(1000);
  }
  return value;
}
