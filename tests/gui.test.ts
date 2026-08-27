import { describe, expect, it } from 'vitest';
import { startGuiServer } from '../src/gui.js';
import type { ProbeResult } from '../src/probes.js';

const sample: ProbeResult = {
  name: 'Anthropic',
  url: 'https://api.anthropic.com',
  path: 'direct',
  classification: 'ok',
  latencyMs: 12,
};

describe('startGuiServer', () => {
  it('binds 127.0.0.1, serves language buttons + JSON API, caches probes, then stops', async () => {
    let calls = 0;
    const handle = await startGuiServer({
      host: '127.0.0.1',
      port: 0,
      openBrowser: false,
      getResults: async () => {
        calls += 1;
        return {
          results: [sample],
          locals: [{ host: '127.0.0.1', port: 7890, listening: true, latencyMs: 1 }],
          proxyEnv: {},
        };
      },
    });

    try {
      expect(handle.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      expect(handle.port).toBeGreaterThan(0);

      const html = await (await fetch(handle.url + '/')).text();
      expect(html).toContain('【中文】');
      expect(html).toContain('【English】');
      expect(html).toContain('btn-zh');
      expect(html).toContain('btn-en');
      expect(html).toContain('localStorage');
      expect(html).toContain('type="button"');

      const res1 = await fetch(handle.url + '/api/results');
      expect(res1.headers.get('content-type')).toMatch(/application\/json/);
      const json = await res1.json();
      expect(json.results[0].name).toBe('Anthropic');
      expect(json.results[0].path).toBe('direct');
      expect(json.bestAnthropic.path).toBe('direct');
      expect(json).toHaveProperty('localProxies');
      expect(json).toHaveProperty('proxyEnv');

      await (await fetch(handle.url + '/api/results')).json();
      expect(calls).toBe(1);
    } finally {
      await handle.close();
    }

    await expect(fetch(handle.url + '/')).rejects.toThrow();
  });
});
