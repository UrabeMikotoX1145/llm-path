import { describe, expect, it } from 'vitest';
import { detectCodexConfig } from '../src/codex.js';
import {
  bestCodexPath,
  isCodexTarget,
  isCodexUrl,
  pickBestReachable,
  type ProbeResult,
} from '../src/probes.js';
import { formatCodexConfigLines, formatCodexFix, formatFixBlocks, formatJson } from '../src/report.js';
import type { LocalProxyStatus } from '../src/proxy.js';

function mockResult(
  partial: Partial<ProbeResult> & Pick<ProbeResult, 'name' | 'path' | 'classification'>,
): ProbeResult {
  return {
    url: 'https://api.openai.com',
    latencyMs: 42,
    ...partial,
  };
}

describe('isCodexUrl / isCodexTarget', () => {
  it('matches OpenAI API and ChatGPT hosts', () => {
    expect(isCodexUrl('https://api.openai.com')).toBe(true);
    expect(isCodexUrl('https://api.openai.com/v1')).toBe(true);
    expect(isCodexUrl('https://chatgpt.com')).toBe(true);
    expect(isCodexUrl('https://chatgpt.com/backend-api/')).toBe(true);
    expect(isCodexUrl('https://api.anthropic.com')).toBe(false);
    expect(isCodexUrl('https://api.deepseek.com')).toBe(false);
  });

  it('matches named Codex targets including OPENAI_BASE_URL', () => {
    expect(isCodexTarget({ name: 'OpenAI', url: 'https://api.openai.com' })).toBe(true);
    expect(isCodexTarget({ name: 'ChatGPT', url: 'https://chatgpt.com' })).toBe(true);
    expect(isCodexTarget({ name: 'OPENAI_BASE_URL', url: 'https://relay.example.com/v1' })).toBe(
      true,
    );
    expect(isCodexTarget({ name: 'Anthropic', url: 'https://api.anthropic.com' })).toBe(false);
  });
});

describe('pickBestReachable / bestCodexPath', () => {
  it('prefers a working proxy path over direct', () => {
    const results: ProbeResult[] = [
      mockResult({
        name: 'OpenAI',
        path: 'direct',
        classification: 'ok',
        latencyMs: 50,
      }),
      mockResult({
        name: 'OpenAI',
        path: '127.0.0.1:7890',
        classification: 'ok',
        latencyMs: 200,
        proxyUrl: 'http://127.0.0.1:7890',
      }),
    ];
    const best = bestCodexPath(results);
    expect(best?.path).toBe('127.0.0.1:7890');
  });

  it('picks ChatGPT when OpenAI is down', () => {
    const results: ProbeResult[] = [
      mockResult({
        name: 'OpenAI',
        path: 'direct',
        classification: 'timeout',
        latencyMs: 4000,
      }),
      mockResult({
        name: 'ChatGPT',
        path: 'env',
        classification: 'ok',
        latencyMs: 180,
        url: 'https://chatgpt.com',
        proxyUrl: 'http://127.0.0.1:7890',
      }),
    ];
    const best = bestCodexPath(results);
    expect(best?.name).toBe('ChatGPT');
    expect(best?.path).toBe('env');
  });

  it('includes OPENAI_BASE_URL as a Codex path', () => {
    const results: ProbeResult[] = [
      mockResult({
        name: 'OPENAI_BASE_URL',
        path: '127.0.0.1:7897',
        classification: 'http_401',
        latencyMs: 90,
        url: 'https://relay.example.com/v1',
        proxyUrl: 'http://127.0.0.1:7897',
      }),
    ];
    expect(bestCodexPath(results)?.path).toBe('127.0.0.1:7897');
  });

  it('returns undefined when nothing Codex-related is reachable', () => {
    const results: ProbeResult[] = [
      mockResult({
        name: 'OpenAI',
        path: 'direct',
        classification: 'dns',
      }),
      mockResult({
        name: 'Anthropic',
        path: 'direct',
        classification: 'ok',
        url: 'https://api.anthropic.com',
      }),
    ];
    expect(bestCodexPath(results)).toBeUndefined();
  });

  it('pickBestReachable filters by matcher', () => {
    const results: ProbeResult[] = [
      mockResult({ name: 'A', path: 'direct', classification: 'ok', latencyMs: 10 }),
      mockResult({ name: 'B', path: 'direct', classification: 'ok', latencyMs: 5 }),
    ];
    const best = pickBestReachable(results, (r) => r.name === 'B');
    expect(best?.name).toBe('B');
  });
});

describe('detectCodexConfig', () => {
  it('defaults to ~/.codex/config.toml', () => {
    const cfg = detectCodexConfig({
      env: {},
      homedir: '/home/tester',
      exists: () => false,
    });
    expect(cfg.usingCodexHomeEnv).toBe(false);
    expect(cfg.homeDir).toBe('/home/tester/.codex');
    expect(cfg.configPath).toBe('/home/tester/.codex/config.toml');
    expect(cfg.configExists).toBe(false);
    expect(cfg.defaultConfigPath).toBe('/home/tester/.codex/config.toml');
  });

  it('honors CODEX_HOME and reports existence without reading files', () => {
    const existing = new Set(['/opt/codex/config.toml']);
    const cfg = detectCodexConfig({
      env: { CODEX_HOME: '/opt/codex' },
      homedir: '/home/tester',
      exists: (p) => existing.has(p),
    });
    expect(cfg.usingCodexHomeEnv).toBe(true);
    expect(cfg.configPath).toBe('/opt/codex/config.toml');
    expect(cfg.configExists).toBe(true);
    expect(cfg.defaultConfigPath).toBe('/home/tester/.codex/config.toml');
    expect(cfg.defaultConfigExists).toBe(false);
  });

  it('trims empty CODEX_HOME as unset', () => {
    const cfg = detectCodexConfig({
      env: { CODEX_HOME: '   ' },
      homedir: '/home/tester',
      exists: () => true,
    });
    expect(cfg.usingCodexHomeEnv).toBe(false);
    expect(cfg.configPath).toBe('/home/tester/.codex/config.toml');
  });
});

describe('formatCodexConfigLines / formatCodexFix', () => {
  const locals: LocalProxyStatus[] = [
    { host: '127.0.0.1', port: 7890, listening: true, latencyMs: 1 },
    { host: '127.0.0.1', port: 7897, listening: false },
  ];

  it('mentions exists vs not found only', () => {
    const lines = formatCodexConfigLines({
      homeDir: '/home/tester/.codex',
      configPath: '/home/tester/.codex/config.toml',
      configExists: true,
      defaultHomeDir: '/home/tester/.codex',
      defaultConfigPath: '/home/tester/.codex/config.toml',
      defaultConfigExists: true,
      usingCodexHomeEnv: false,
    });
    expect(lines.join('\n')).toContain('/home/tester/.codex/config.toml');
    expect(lines.join('\n')).toContain('exists');
    expect(lines.join('\n')).not.toMatch(/sk-|api[_-]?key/i);
  });

  it('prints Codex env copy-paste and tells user to export before codex', () => {
    const block = formatCodexFix(
      [
        mockResult({
          name: 'OpenAI',
          path: '127.0.0.1:7890',
          classification: 'ok',
          latencyMs: 180,
          proxyUrl: 'http://127.0.0.1:7890',
        }),
      ],
      locals,
      {
        homeDir: '/home/tester/.codex',
        configPath: '/home/tester/.codex/config.toml',
        configExists: false,
        defaultHomeDir: '/home/tester/.codex',
        defaultConfigPath: '/home/tester/.codex/config.toml',
        defaultConfigExists: false,
        usingCodexHomeEnv: false,
      },
    );
    expect(block).toContain('## Codex');
    expect(block).toContain('Best Codex/OpenAI path');
    expect(block).toContain('export HTTPS_PROXY=http://127.0.0.1:7890');
    expect(block).toMatch(/^codex$/m);
    expect(block).toContain('not found');
    expect(block).toContain('no HTTP-proxy key');
    expect(block).toContain('before');
  });
});

describe('formatFixBlocks Codex section', () => {
  it('includes Codex block alongside Claude settings.json', () => {
    const results: ProbeResult[] = [
      mockResult({
        name: 'Anthropic',
        path: '127.0.0.1:7890',
        classification: 'ok',
        latencyMs: 100,
        url: 'https://api.anthropic.com',
        proxyUrl: 'http://127.0.0.1:7890',
      }),
      mockResult({
        name: 'OpenAI',
        path: '127.0.0.1:7890',
        classification: 'ok',
        latencyMs: 120,
        proxyUrl: 'http://127.0.0.1:7890',
      }),
    ];
    const block = formatFixBlocks(
      results,
      [{ host: '127.0.0.1', port: 7890, listening: true, latencyMs: 1 }],
      {},
      {
        homeDir: '/x/.codex',
        configPath: '/x/.codex/config.toml',
        configExists: true,
        defaultHomeDir: '/x/.codex',
        defaultConfigPath: '/x/.codex/config.toml',
        defaultConfigExists: true,
        usingCodexHomeEnv: false,
      },
    );
    expect(block).toContain('~/.claude/settings.json');
    expect(block).toContain('## Codex');
    expect(block).toContain('export HTTPS_PROXY=http://127.0.0.1:7890');
    expect(block).toContain('/x/.codex/config.toml');
    expect(block).toContain('exists');
  });
});

describe('formatJson Codex fields', () => {
  it('includes bestCodex and existence-only codexConfig', () => {
    const results: ProbeResult[] = [
      mockResult({
        name: 'ChatGPT',
        path: 'env',
        classification: 'ok',
        latencyMs: 70,
        url: 'https://chatgpt.com',
        proxyUrl: 'http://127.0.0.1:7890',
      }),
    ];
    const json = JSON.parse(
      formatJson({
        results,
        locals: [],
        proxyEnv: {},
        codexConfig: {
          homeDir: '/h/.codex',
          configPath: '/h/.codex/config.toml',
          configExists: false,
          defaultHomeDir: '/h/.codex',
          defaultConfigPath: '/h/.codex/config.toml',
          defaultConfigExists: false,
          usingCodexHomeEnv: false,
        },
      }),
    );
    expect(json.bestCodex.name).toBe('ChatGPT');
    expect(json.codexConfig.configExists).toBe(false);
    expect(json.codexConfig.configPath).toBe('/h/.codex/config.toml');
    expect(JSON.stringify(json)).not.toMatch(/sk-|OPENAI_API_KEY/);
  });
});
