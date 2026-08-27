import { describe, expect, it } from 'vitest';
import type { ProbeResult } from '../src/probes.js';
import { formatFixBlocks, formatJson, formatTable } from '../src/report.js';
import type { LocalProxyStatus, ProxyEnv } from '../src/proxy.js';

function mockResult(partial: Partial<ProbeResult> & Pick<ProbeResult, 'name' | 'path' | 'classification'>): ProbeResult {
  return {
    url: 'https://api.anthropic.com',
    latencyMs: 42,
    ...partial,
  };
}

describe('formatTable', () => {
  it('renders API / Path / Status / ms columns', () => {
    const table = formatTable([
      mockResult({ name: 'Anthropic', path: 'direct', classification: 'ok', latencyMs: 120 }),
      mockResult({
        name: 'OpenAI',
        path: '127.0.0.1:7890',
        classification: 'timeout',
        latencyMs: 4000,
        url: 'https://api.openai.com',
      }),
    ]);
    expect(table).toContain('API');
    expect(table).toContain('Path');
    expect(table).toContain('Status');
    expect(table).toContain('Anthropic');
    expect(table).toContain('OpenAI');
    expect(table).toContain('direct');
    expect(table).toContain('127.0.0.1:7890');
    expect(table).toMatch(/OK/);
    expect(table).toMatch(/Timeout/i);
  });
});

describe('formatFixBlocks', () => {
  const locals: LocalProxyStatus[] = [
    { host: '127.0.0.1', port: 7890, listening: true, latencyMs: 1 },
    { host: '127.0.0.1', port: 7897, listening: false, latencyMs: 800 },
  ];
  const proxyEnv: ProxyEnv = {};

  it('suggests working Anthropic proxy path', () => {
    const results: ProbeResult[] = [
      mockResult({
        name: 'Anthropic',
        path: 'direct',
        classification: 'timeout',
        latencyMs: 4000,
      }),
      mockResult({
        name: 'Anthropic',
        path: '127.0.0.1:7890',
        classification: 'ok',
        latencyMs: 200,
        proxyUrl: 'http://127.0.0.1:7890',
        status: 401,
      }),
    ];
    const block = formatFixBlocks(results, locals, proxyEnv);
    expect(block).toContain('export HTTPS_PROXY=http://127.0.0.1:7890');
    expect(block).toContain('export HTTP_PROXY=http://127.0.0.1:7890');
    expect(block).toContain('"HTTPS_PROXY": "http://127.0.0.1:7890"');
    expect(block).toContain('Best Anthropic path');
    expect(block).toContain('listening');
  });

  it('falls back when Anthropic unreachable', () => {
    const results: ProbeResult[] = [
      mockResult({
        name: 'Anthropic',
        path: 'direct',
        classification: 'dns',
        latencyMs: 10,
      }),
    ];
    const block = formatFixBlocks(results, [
      { host: '127.0.0.1', port: 7890, listening: false },
      { host: '127.0.0.1', port: 7897, listening: false },
    ], proxyEnv);
    expect(block).toContain('No reachable Anthropic path');
    expect(block).toContain('export HTTPS_PROXY=http://127.0.0.1:7890');
  });
});

describe('formatJson', () => {
  it('includes results and bestAnthropic', () => {
    const results: ProbeResult[] = [
      mockResult({
        name: 'Anthropic',
        path: 'env',
        classification: 'ok',
        latencyMs: 90,
        proxyUrl: 'http://127.0.0.1:7890',
        status: 403,
      }),
    ];
    const json = JSON.parse(
      formatJson({
        results,
        locals: [],
        proxyEnv: { httpsProxy: 'http://127.0.0.1:7890' },
      }),
    );
    expect(json.results).toHaveLength(1);
    expect(json.bestAnthropic.path).toBe('env');
    expect(json.proxyEnv.httpsProxy).toBe('http://127.0.0.1:7890');
  });
});
