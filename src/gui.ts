import { exec } from 'node:child_process';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { detectCodexConfig } from './codex.js';
import { messages } from './i18n.js';
import { runProbes } from './probes.js';
import { detectLocalProxies, readProxyEnv } from './proxy.js';
import { formatJson, type ReportInput } from './report.js';

export interface GuiServerOptions {
  host?: string;
  port?: number;
  openBrowser?: boolean;
  getResults?: () => Promise<ReportInput> | ReportInput;
}

export interface GuiHandle {
  url: string;
  port: number;
  close: () => Promise<void>;
}

async function defaultCollect(): Promise<ReportInput> {
  const [results, locals] = await Promise.all([runProbes(), detectLocalProxies()]);
  return {
    results,
    locals,
    proxyEnv: readProxyEnv(),
    codexConfig: detectCodexConfig(),
  };
}

const CLIENT_JS = String.raw`
var STORAGE_KEY = 'llm-path-locale';
var data = null;
var loadError = false;

function getLocale() {
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'zh') return saved;
  } catch (e) {}
  return 'zh';
}

function msgs() {
  return I18N[getLocale()] || I18N.zh;
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pathLabel(path) {
  var t = msgs();
  if (path === 'direct') return t.pathDirect;
  if (path === 'env') return t.pathEnv;
  return path;
}

function classLabel(cls) {
  var t = msgs();
  if (cls === 'ok') return t.classOk;
  if (cls === 'dns') return t.classDns;
  if (cls === 'tls') return t.classTls;
  if (cls === 'timeout') return t.classTimeout;
  if (cls === 'error') return t.classError;
  if (String(cls).indexOf('http_') === 0) return String(cls).toUpperCase();
  return String(cls);
}

function isReachable(cls) {
  return cls === 'ok' || String(cls).indexOf('http_') === 0;
}

function suggestedProxy(best, locals) {
  if (best && best.proxyUrl) return best.proxyUrl;
  var list = locals || [];
  for (var i = 0; i < list.length; i++) {
    if (list[i].listening) return 'http://' + list[i].host + ':' + list[i].port;
  }
  return 'http://127.0.0.1:7890';
}

function applyLangButtons() {
  var loc = getLocale();
  document.documentElement.lang = loc === 'zh' ? 'zh-CN' : 'en';
  var buttons = document.querySelectorAll('[data-locale]');
  for (var i = 0; i < buttons.length; i++) {
    var btn = buttons[i];
    if (btn.getAttribute('data-locale') === loc) btn.classList.add('active');
    else btn.classList.remove('active');
  }
  document.title = msgs().reportTitle;
  var titleEl = document.getElementById('title');
  if (titleEl) titleEl.textContent = msgs().reportTitle;
}

function setLocale(locale) {
  try { localStorage.setItem(STORAGE_KEY, locale); } catch (e) {}
  applyLangButtons();
  render();
}

function renderTable(results) {
  var t = msgs();
  var rows = '';
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    var ok = isReachable(r.classification);
    var cls = ok ? 'ok' : 'bad';
    rows += '<tr><td>' + esc(r.name) + '</td><td>' + esc(pathLabel(r.path)) +
      '</td><td class="' + cls + '">● ' + esc(classLabel(r.classification)) +
      '</td><td>' + esc(r.latencyMs) + '</td></tr>';
  }
  return '<table><thead><tr><th>' + esc(t.tableApi) + '</th><th>' + esc(t.tablePath) +
    '</th><th>' + esc(t.tableStatus) + '</th><th>' + esc(t.tableMs) +
    '</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

function preExports(proxy, withCodex) {
  var lines = 'export HTTPS_PROXY=' + proxy + '\nexport HTTP_PROXY=' + proxy +
    '\nexport ALL_PROXY=' + proxy;
  if (withCodex) lines += '\ncodex';
  return '<pre>' + esc(lines) + '</pre>';
}

function stripHeading(s) {
  return String(s).replace(/^##\s*/, '');
}

function renderFixes() {
  var t = msgs();
  var bestA = data.bestAnthropic;
  var bestC = data.bestCodex;
  var locals = data.localProxies || [];
  var proxyA = suggestedProxy(bestA, locals);
  var proxyC = suggestedProxy(bestC, locals);
  var html = '<h2>' + esc(stripHeading(t.fixHeading)) + '</h2>';
  if (bestA) {
    html += '<p class="ok">' + esc(t.bestAnthropicPrefix) + ': ' +
      esc(pathLabel(bestA.path)) + ' (' + esc(bestA.latencyMs) + 'ms)</p>';
  } else {
    html += '<p class="warn">' + esc(t.noAnthropic) + '</p>';
  }
  html += '<p class="muted">' + esc(t.shellBash) + '</p>';
  html += preExports(proxyA, false);
  html += '<p class="muted">' + esc(t.claudeSettings) + '</p>';
  html += '<pre>' + esc('{\n  "env": {\n    "HTTPS_PROXY": "' + proxyA +
    '",\n    "HTTP_PROXY": "' + proxyA + '",\n    "ALL_PROXY": "' + proxyA +
    '"\n  }\n}') + '</pre>';

  html += '<h2>' + esc(stripHeading(t.codexHeading)) + '</h2>';
  if (bestC) {
    html += '<p class="ok">' + esc(t.bestCodexPrefix) + ': ' +
      esc(pathLabel(bestC.path)) + ' (' + esc(bestC.latencyMs) + 'ms) ' +
      esc(t.via) + ' ' + esc(bestC.name) + '</p>';
  } else {
    html += '<p class="warn">' + esc(t.noCodex) + '</p>';
  }

  var cfg = data.codexConfig;
  if (cfg) {
    var existA = cfg.configExists ? t.exists : t.notFound;
    if (cfg.usingCodexHomeEnv) {
      html += '<p>' + esc(t.codexConfigHome) + ': ' + esc(cfg.configPath) + '  ' + esc(existA) + '</p>';
      if (cfg.defaultConfigPath !== cfg.configPath) {
        var existB = cfg.defaultConfigExists ? t.exists : t.notFound;
        html += '<p>' + esc(t.defaultCodexConfig) + ': ' + esc(cfg.defaultConfigPath) + '  ' + esc(existB) + '</p>';
      }
    } else {
      html += '<p>' + esc(t.codexConfig) + ': ' + esc(cfg.configPath) + '  ' + esc(existA) + '</p>';
    }
  }

  html += '<p class="muted">' + esc(t.shellCodex) + '</p>';
  html += preExports(proxyC, true);
  html += '<p class="muted">' + esc(t.codexNoProxyKey) + '</p>';
  html += '<p class="muted">' + esc(t.codexSandboxNote) + '</p>';

  html += '<h2>' + esc(t.localProxyPorts) + '</h2><ul>';
  var anyUp = false;
  for (var i = 0; i < locals.length; i++) {
    var l = locals[i];
    if (l.listening) anyUp = true;
    var mark = l.listening
      ? '<span class="ok">' + esc(t.listening) + '</span>'
      : '<span class="bad">' + esc(t.closed) + '</span>';
    var ms = l.latencyMs != null ? ' (' + l.latencyMs + 'ms)' : '';
    html += '<li><code>' + esc(l.host + ':' + l.port) + '</code>  ' + mark + esc(ms) + '</li>';
  }
  html += '</ul>';
  if (!anyUp && locals.length) {
    html += '<p class="muted">' + esc(t.clashTip) + '</p>';
  }

  var env = data.proxyEnv || {};
  html += '<h2>' + esc(t.envProxyVars) + '</h2><pre>' +
    esc('HTTPS_PROXY=' + (env.httpsProxy || t.unset) + '\nHTTP_PROXY=' +
      (env.httpProxy || t.unset) + '\nALL_PROXY=' + (env.allProxy || t.unset)) +
    '</pre>';
  return html;
}

function render() {
  applyLangButtons();
  var app = document.getElementById('app');
  if (!app) return;
  var t = msgs();
  if (loadError) {
    app.innerHTML = '<p class="bad">' + esc(t.guiError) + '</p>';
    return;
  }
  if (!data) {
    app.innerHTML = '<p class="muted">' + esc(t.guiLoading) + '</p>';
    return;
  }
  app.innerHTML = renderTable(data.results || []) + renderFixes();
}

function load() {
  fetch('/api/results').then(function (res) {
    if (!res.ok) throw new Error('bad status');
    return res.json();
  }).then(function (json) {
    data = json;
    loadError = false;
    render();
  }).catch(function () {
    loadError = true;
    render();
  });
}

document.getElementById('btn-zh').addEventListener('click', function () { setLocale('zh'); });
document.getElementById('btn-en').addEventListener('click', function () { setLocale('en'); });
applyLangButtons();
render();
load();
`;

function pageHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>llm-path</title>
<style>
  :root {
    --bg: #0f1419;
    --fg: #e6edf3;
    --muted: #8b9bb4;
    --card: #1a2332;
    --ok: #3dd68c;
    --bad: #f87171;
    --warn: #fbbf24;
    --accent: #38bdf8;
    --btn: #243044;
    --line: #243044;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: ui-sans-serif, system-ui, "PingFang SC", "Noto Sans SC", sans-serif;
    background: var(--bg);
    color: var(--fg);
    line-height: 1.5;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 24px;
    border-bottom: 1px solid var(--line);
    position: sticky;
    top: 0;
    background: var(--bg);
    z-index: 1;
  }
  h1 { font-size: 18px; margin: 0; }
  .lang-switch { display: flex; gap: 8px; }
  .lang-switch button {
    appearance: none;
    border: 2px solid #334155;
    background: var(--btn);
    color: var(--fg);
    font-size: 15px;
    font-weight: 700;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
  }
  .lang-switch button.active {
    background: #0ea5e9;
    border-color: #7dd3fc;
    color: #082f49;
  }
  main { padding: 24px; max-width: 1100px; margin: 0 auto; }
  table {
    width: 100%;
    border-collapse: collapse;
    background: var(--card);
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 24px;
  }
  th, td { text-align: left; padding: 8px 12px; font-variant-numeric: tabular-nums; }
  th { color: var(--muted); font-size: 13px; font-weight: 600; }
  tr:nth-child(even) td { background: #152033; }
  .ok { color: var(--ok); }
  .bad { color: var(--bad); }
  .warn { color: var(--warn); }
  .muted { color: var(--muted); }
  h2 { font-size: 16px; color: var(--accent); margin: 24px 0 8px; }
  pre {
    background: #0b1220;
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    border: 1px solid var(--line);
  }
  ul { padding-left: 18px; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
</style>
</head>
<body>
  <header>
    <h1 id="title">llm-path</h1>
    <div class="lang-switch" role="group" aria-label="Language">
      <button type="button" id="btn-zh" data-locale="zh">【中文】</button>
      <button type="button" id="btn-en" data-locale="en">【English】</button>
    </div>
  </header>
  <main id="app"></main>
  <script>
const I18N = ${JSON.stringify(messages)};
${CLIENT_JS}
  </script>
</body>
</html>`;
}

function tryOpenBrowser(url: string): void {
  try {
    const plat = process.platform;
    const cmd =
      plat === 'darwin'
        ? `open ${JSON.stringify(url)}`
        : plat === 'win32'
          ? `cmd /c start "" ${JSON.stringify(url)}`
          : `xdg-open ${JSON.stringify(url)}`;
    exec(cmd, { windowsHide: true }, () => {
      /* ignore failure */
    });
  } catch {
    /* ignore */
  }
}

function listen(
  server: http.Server,
  port: number,
  host: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && port !== 0) {
        server.off('error', onError);
        server.listen(0, host, () => {
          const addr = server.address() as AddressInfo | null;
          resolve(addr?.port ?? 0);
        });
        return;
      }
      reject(err);
    };
    server.once('error', onError);
    server.listen(port, host, () => {
      server.off('error', onError);
      const addr = server.address() as AddressInfo | null;
      resolve(addr?.port ?? port);
    });
  });
}

/** Tiny local GUI. Bind 127.0.0.1; port 8787 or 0 (ephemeral). Stop with close(). */
export async function startGuiServer(options: GuiServerOptions = {}): Promise<GuiHandle> {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 8787;
  const html = pageHtml();

  let cache: ReportInput | undefined;
  let inflight: Promise<ReportInput> | undefined;

  const collect = async (): Promise<ReportInput> => {
    if (cache) return cache;
    if (!inflight) {
      inflight = Promise.resolve(options.getResults ? options.getResults() : defaultCollect())
        .then((r) => {
          cache = r;
          return r;
        })
        .finally(() => {
          inflight = undefined;
        });
    }
    return inflight;
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || host}`);
    const path = url.pathname;

    if (req.method === 'GET' && (path === '/' || path === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    if (req.method === 'GET' && path === '/api/results') {
      collect()
        .then((input) => {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(formatJson(input));
        })
        .catch((err: unknown) => {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: String(err) }));
        });
      return;
    }

    if (path === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  });

  const actualPort = await listen(server, port, host);
  const url = `http://${host}:${actualPort}`;

  if (options.openBrowser) {
    tryOpenBrowser(url);
  }

  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  };

  return { url, port: actualPort, close };
}
