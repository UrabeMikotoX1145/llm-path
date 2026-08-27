import http from 'node:http';
import tls from 'node:tls';
import { classifyProbe, isReachable, type ProbeClass } from './classify.js';
import { effectiveProxyUrl, readProxyEnv, type ProxyEnv } from './proxy.js';

export const DEFAULT_TIMEOUT_MS = 4000;

export const DEFAULT_TARGETS: { name: string; url: string }[] = [
  { name: 'Anthropic', url: 'https://api.anthropic.com' },
  { name: 'OpenAI', url: 'https://api.openai.com' },
  { name: 'Google AI', url: 'https://generativelanguage.googleapis.com' },
  { name: 'DeepSeek', url: 'https://api.deepseek.com' },
  { name: 'Zhipu BigModel', url: 'https://open.bigmodel.cn' },
  { name: 'Moonshot', url: 'https://api.moonshot.cn' },
  { name: 'MiniMax', url: 'https://api.minimax.chat' },
  { name: 'DashScope', url: 'https://dashscope.aliyuncs.com' },
];

export type ProxyPath =
  | 'direct'
  | 'env'
  | '127.0.0.1:7890'
  | '127.0.0.1:7897'
  | `custom:${string}`;

export interface ProbeResult {
  name: string;
  url: string;
  path: ProxyPath;
  proxyUrl?: string;
  classification: ProbeClass;
  latencyMs: number;
  status?: number;
  error?: string;
}

export interface ProbeOptions {
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

function errorText(err: unknown): string {
  if (err instanceof Error) {
    const anyErr = err as Error & { cause?: unknown; code?: string };
    const parts = [anyErr.name, anyErr.message, anyErr.code].filter(Boolean);
    if (anyErr.cause instanceof Error) parts.push(anyErr.cause.message, (anyErr.cause as Error & { code?: string }).code);
    else if (anyErr.cause) parts.push(String(anyErr.cause));
    return parts.join(' | ');
  }
  return String(err);
}

function isAbortLike(err: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true;
  if (err && typeof err === 'object' && 'name' in err) {
    const n = String((err as { name?: string }).name);
    if (n === 'AbortError' || n === 'TimeoutError') return true;
  }
  return false;
}

/** HTTPS GET through an HTTP CONNECT proxy (Clash mixed-port). */
function httpsGetViaProxy(
  targetUrl: string,
  proxyUrl: string,
  signal: AbortSignal,
): Promise<{ status: number }> {
  return new Promise((resolve, reject) => {
    const target = new URL(targetUrl);
    const proxy = new URL(proxyUrl);
    const destPort = target.port ? Number(target.port) : 443;
    const proxyPort = proxy.port ? Number(proxy.port) : 80;

    let req: http.ClientRequest | undefined;
    let tlsSocket: tls.TLSSocket | undefined;
    let settled = false;

    const finish = (err?: Error, status?: number) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      try {
        tlsSocket?.destroy();
      } catch {
        /* ignore */
      }
      try {
        req?.destroy();
      } catch {
        /* ignore */
      }
      if (err) reject(err);
      else resolve({ status: status ?? 0 });
    };

    const onAbort = () => {
      finish(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }));
    };

    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });

    req = http.request({
      host: proxy.hostname,
      port: proxyPort,
      method: 'CONNECT',
      path: `${target.hostname}:${destPort}`,
      headers: { Host: `${target.hostname}:${destPort}` },
    });

    req.on('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        finish(Object.assign(new Error(`proxy CONNECT ${res.statusCode}`), { code: 'ECONNREFUSED' }));
        return;
      }

      tlsSocket = tls.connect(
        {
          socket,
          servername: target.hostname,
          ALPNProtocols: ['http/1.1'],
        },
        () => {
          const reqPath = `${target.pathname || '/'}${target.search}`;
          const raw =
            `GET ${reqPath} HTTP/1.1\r\n` +
            `Host: ${target.host}\r\n` +
            `User-Agent: llm-path/1.0\r\n` +
            `Accept: */*\r\n` +
            `Connection: close\r\n` +
            `\r\n`;
          tlsSocket?.write(raw);
        },
      );

      let buf = Buffer.alloc(0);
      tlsSocket.on('data', (chunk: Buffer) => {
        buf = Buffer.concat([buf, chunk]);
        const idx = buf.indexOf('\r\n');
        if (idx === -1) return;
        const line = buf.subarray(0, idx).toString('latin1');
        const m = /^HTTP\/\d(?:\.\d)?\s+(\d+)/.exec(line);
        if (m) finish(undefined, Number(m[1]));
        else finish(new Error('bad HTTP status line'));
      });
      tlsSocket.on('error', (err) => finish(err));
      tlsSocket.on('end', () => {
        if (!settled) finish(new Error('empty TLS response'));
      });
    });

    req.on('error', (err) => finish(err));
    req.end();
  });
}

async function probeOnce(
  name: string,
  url: string,
  path: ProxyPath,
  proxyUrl: string | undefined,
  timeoutMs: number,
): Promise<ProbeResult> {
  const started = Date.now();
  const signal = AbortSignal.timeout(timeoutMs);

  try {
    let status: number;

    if (proxyUrl) {
      const r = await httpsGetViaProxy(url, proxyUrl, signal);
      status = r.status;
    } else {
      const response = await fetch(url, {
        method: 'GET',
        signal,
        headers: { accept: '*/*', 'user-agent': 'llm-path/1.0' },
        redirect: 'manual',
      });
      try {
        await response.arrayBuffer();
      } catch {
        /* ignore body errors */
      }
      status = response.status;
    }

    return {
      name,
      url,
      path,
      proxyUrl,
      classification: classifyProbe({ status }),
      latencyMs: Date.now() - started,
      status,
    };
  } catch (err) {
    const msg = errorText(err);
    return {
      name,
      url,
      path,
      proxyUrl,
      classification: classifyProbe({
        timedOut: isAbortLike(err, signal),
        errorMessage: msg,
      }),
      latencyMs: Date.now() - started,
      error: msg,
    };
  }
}

function extraTargetsFromEnv(env: NodeJS.ProcessEnv): { name: string; url: string }[] {
  const extras: { name: string; url: string }[] = [];
  if (env.ANTHROPIC_BASE_URL) {
    extras.push({ name: 'ANTHROPIC_BASE_URL', url: env.ANTHROPIC_BASE_URL });
  }
  if (env.OPENAI_BASE_URL) {
    extras.push({ name: 'OPENAI_BASE_URL', url: env.OPENAI_BASE_URL });
  }
  return extras;
}

function buildPaths(proxyEnv: ProxyEnv): { path: ProxyPath; proxyUrl?: string }[] {
  const paths: { path: ProxyPath; proxyUrl?: string }[] = [{ path: 'direct' }];

  const envProxy = effectiveProxyUrl(proxyEnv);
  if (envProxy) {
    paths.push({ path: 'env', proxyUrl: envProxy });
  }

  paths.push({ path: '127.0.0.1:7890', proxyUrl: 'http://127.0.0.1:7890' });
  paths.push({ path: '127.0.0.1:7897', proxyUrl: 'http://127.0.0.1:7897' });

  return paths;
}

/** Run all target × path probes (parallel). */
export async function runProbes(options: ProbeOptions = {}): Promise<ProbeResult[]> {
  const env = options.env ?? process.env;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const proxyEnv = readProxyEnv(env);
  const targets = [...DEFAULT_TARGETS, ...extraTargetsFromEnv(env)];
  const paths = buildPaths(proxyEnv);

  const jobs: Promise<ProbeResult>[] = [];
  for (const t of targets) {
    for (const p of paths) {
      jobs.push(probeOnce(t.name, t.url, p.path, p.proxyUrl, timeoutMs));
    }
  }
  return Promise.all(jobs);
}

/** Pick the best working Anthropic path (reachable, lowest latency). */
export function bestAnthropicPath(results: ProbeResult[]): ProbeResult | undefined {
  const candidates = results.filter(
    (r) =>
      (r.name === 'Anthropic' || r.url.includes('api.anthropic.com')) &&
      isReachable(r.classification),
  );
  if (candidates.length === 0) return undefined;
  return candidates.reduce((a, b) => {
    const proxyScore = (p: string) => (p === 'direct' ? 1 : 0);
    const sa = proxyScore(a.path);
    const sb = proxyScore(b.path);
    if (sa !== sb) return sa < sb ? a : b;
    return a.latencyMs <= b.latencyMs ? a : b;
  });
}
