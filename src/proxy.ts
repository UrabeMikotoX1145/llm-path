import net from 'node:net';

export const CLASH_PORTS = [7890, 7897] as const;

export interface ProxyEnv {
  httpsProxy?: string;
  httpProxy?: string;
  allProxy?: string;
  noProxy?: string;
}

export interface LocalProxyStatus {
  host: string;
  port: number;
  listening: boolean;
  latencyMs?: number;
}

/** Read common proxy-related environment variables. */
export function readProxyEnv(env: NodeJS.ProcessEnv = process.env): ProxyEnv {
  return {
    httpsProxy: env.HTTPS_PROXY || env.https_proxy || undefined,
    httpProxy: env.HTTP_PROXY || env.http_proxy || undefined,
    allProxy: env.ALL_PROXY || env.all_proxy || undefined,
    noProxy: env.NO_PROXY || env.no_proxy || undefined,
  };
}

/** Prefer HTTPS_PROXY, then HTTP_PROXY, then ALL_PROXY. */
export function effectiveProxyUrl(env: ProxyEnv = readProxyEnv()): string | undefined {
  return env.httpsProxy || env.httpProxy || env.allProxy;
}

/**
 * Try a TCP connect to host:port to see if something (e.g. Clash) is listening.
 */
export function probeTcpPort(
  port: number,
  host = '127.0.0.1',
  timeoutMs = 800,
): Promise<LocalProxyStatus> {
  const started = Date.now();
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    let settled = false;

    const done = (listening: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({
        host,
        port,
        listening,
        latencyMs: Date.now() - started,
      });
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

/** Probe Clash-style local ports 7890 and 7897. */
export async function detectLocalProxies(): Promise<LocalProxyStatus[]> {
  return Promise.all(CLASH_PORTS.map((p) => probeTcpPort(p)));
}
