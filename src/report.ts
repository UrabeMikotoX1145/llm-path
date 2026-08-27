import { classLabel, isReachable } from './classify.js';
import type { CodexConfigStatus } from './codex.js';
import { bestAnthropicPath, bestCodexPath, type ProbeResult } from './probes.js';
import type { LocalProxyStatus, ProxyEnv } from './proxy.js';

const useColor =
  typeof process !== 'undefined' &&
  !!process.stdout?.isTTY &&
  !process.env.NO_COLOR &&
  process.env.FORCE_COLOR !== '0';

const c = {
  reset: useColor ? '\u001b[0m' : '',
  bold: useColor ? '\u001b[1m' : '',
  green: useColor ? '\u001b[32m' : '',
  red: useColor ? '\u001b[31m' : '',
  yellow: useColor ? '\u001b[33m' : '',
  dim: useColor ? '\u001b[2m' : '',
  cyan: useColor ? '\u001b[36m' : '',
};

function pad(s: string, n: number): string {
  const visible = s.replace(/\u001b\[[0-9;]*m/g, '');
  if (visible.length >= n) return s;
  return s + ' '.repeat(n - visible.length);
}

function statusCell(r: ProbeResult): string {
  const label = classLabel(r.classification);
  if (isReachable(r.classification)) {
    return `${c.green}● ${label}${c.reset}`;
  }
  return `${c.red}● ${label}${c.reset}`;
}

function pathLabel(path: string): string {
  if (path === 'direct') return 'direct';
  if (path === 'env') return 'env proxy';
  return path;
}

/** Format ANSI (or plain) red/green results table. */
export function formatTable(results: ProbeResult[]): string {
  const cols = {
    name: Math.max(4, ...results.map((r) => r.name.length), 12),
    path: Math.max(4, ...results.map((r) => pathLabel(r.path).length), 10),
    status: 14,
    ms: 8,
  };

  const header =
    pad('API', cols.name) +
    '  ' +
    pad('Path', cols.path) +
    '  ' +
    pad('Status', cols.status) +
    '  ' +
    pad('ms', cols.ms);

  const sep = '-'.repeat(header.length);

  const rows = results.map((r) => {
    return (
      pad(r.name, cols.name) +
      '  ' +
      pad(pathLabel(r.path), cols.path) +
      '  ' +
      pad(statusCell(r), cols.status) +
      '  ' +
      pad(String(r.latencyMs), cols.ms)
    );
  });

  return [c.bold + header + c.reset, sep, ...rows].join('\n');
}

function suggestedProxyUrl(best: ProbeResult | undefined, locals: LocalProxyStatus[]): string {
  if (best?.proxyUrl) return best.proxyUrl;
  const up = locals.find((l) => l.listening);
  if (up) return `http://${up.host}:${up.port}`;
  return 'http://127.0.0.1:7890';
}

function existLabel(exists: boolean): string {
  return exists ? 'exists' : 'not found';
}

/** Existence-only Codex config lines (never file contents). */
export function formatCodexConfigLines(cfg: CodexConfigStatus): string[] {
  const lines: string[] = [];
  if (cfg.usingCodexHomeEnv) {
    lines.push(`Codex config (CODEX_HOME): ${cfg.configPath}  ${existLabel(cfg.configExists)}`);
    if (cfg.defaultConfigPath !== cfg.configPath) {
      lines.push(
        `  default ~/.codex/config.toml: ${cfg.defaultConfigPath}  ${existLabel(cfg.defaultConfigExists)}`,
      );
    }
  } else {
    lines.push(`Codex config: ${cfg.configPath}  ${existLabel(cfg.configExists)}`);
  }
  return lines;
}

/** Copy-paste Codex env (+ note: no HTTP-proxy key in config.toml). */
export function formatCodexFix(
  results: ProbeResult[],
  locals: LocalProxyStatus[],
  cfg?: CodexConfigStatus,
): string {
  const best = bestCodexPath(results);
  const proxy = suggestedProxyUrl(best, locals);
  const lines: string[] = [];

  lines.push(`${c.bold}${c.cyan}## Codex (OpenAI Codex CLI)${c.reset}`);
  lines.push('');

  if (best) {
    lines.push(
      `${c.green}Best Codex/OpenAI path:${c.reset} ${pathLabel(best.path)} (${best.latencyMs}ms) via ${best.name}`,
    );
  } else {
    lines.push(
      `${c.yellow}No reachable Codex/OpenAI path found.${c.reset} Start Clash (mixed port 7890) or set a working HTTPS_PROXY, then re-run.`,
    );
  }
  lines.push('');

  if (cfg) {
    lines.push(...formatCodexConfigLines(cfg));
    lines.push('');
  }

  lines.push(`${c.dim}# Shell — export in this terminal, then run:  codex${c.reset}`);
  lines.push(`export HTTPS_PROXY=${proxy}`);
  lines.push(`export HTTP_PROXY=${proxy}`);
  lines.push(`export ALL_PROXY=${proxy}`);
  lines.push(`codex`);
  lines.push('');
  lines.push(
    `${c.dim}# ~/.codex/config.toml  — Codex has no HTTP-proxy key for its own API traffic.${c.reset}`,
  );
  lines.push(
    `${c.dim}# (features.network_proxy is a sandbox listener, not Clash.) Export the vars above before \`codex\`.${c.reset}`,
  );

  return lines.join('\n');
}

/** Copy-paste shell export + Claude settings.json + Codex env. */
export function formatFixBlocks(
  results: ProbeResult[],
  locals: LocalProxyStatus[],
  proxyEnv: ProxyEnv,
  codexConfig?: CodexConfigStatus,
): string {
  const best = bestAnthropicPath(results);
  const proxy = suggestedProxyUrl(best, locals);
  const lines: string[] = [];

  lines.push(`${c.bold}${c.cyan}## Suggested fix (copy-paste)${c.reset}`);
  lines.push('');

  if (best) {
    lines.push(
      `${c.green}Best Anthropic path:${c.reset} ${pathLabel(best.path)} (${best.latencyMs}ms)`,
    );
  } else {
    lines.push(
      `${c.yellow}No reachable Anthropic path found.${c.reset} Start Clash (mixed port 7890) or set a working HTTPS_PROXY, then re-run.`,
    );
  }
  lines.push('');

  lines.push(`${c.dim}# Shell (bash/zsh)${c.reset}`);
  lines.push(`export HTTPS_PROXY=${proxy}`);
  lines.push(`export HTTP_PROXY=${proxy}`);
  lines.push(`export ALL_PROXY=${proxy}`);
  lines.push('');

  lines.push(`${c.dim}# Claude Code ~/.claude/settings.json  (env snippet)${c.reset}`);
  lines.push(`{
  "env": {
    "HTTPS_PROXY": "${proxy}",
    "HTTP_PROXY": "${proxy}",
    "ALL_PROXY": "${proxy}"
  }
}`);
  lines.push('');

  lines.push(formatCodexFix(results, locals, codexConfig));
  lines.push('');

  const listening = locals.filter((l) => l.listening);
  lines.push(`${c.bold}Local proxy ports${c.reset}`);
  for (const l of locals) {
    const mark = l.listening
      ? `${c.green}listening${c.reset}`
      : `${c.red}closed${c.reset}`;
    lines.push(`  ${l.host}:${l.port}  ${mark}${l.latencyMs != null ? ` (${l.latencyMs}ms)` : ''}`);
  }
  if (listening.length === 0) {
    lines.push(
      `  ${c.dim}Tip: Clash / Clash Verge mixed-port is often 7890; some builds use 7897.${c.reset}`,
    );
  }
  lines.push('');

  lines.push(`${c.bold}Env proxy vars${c.reset}`);
  lines.push(`  HTTPS_PROXY=${proxyEnv.httpsProxy ?? '(unset)'}`);
  lines.push(`  HTTP_PROXY=${proxyEnv.httpProxy ?? '(unset)'}`);
  lines.push(`  ALL_PROXY=${proxyEnv.allProxy ?? '(unset)'}`);

  return lines.join('\n');
}

export interface ReportInput {
  results: ProbeResult[];
  locals: LocalProxyStatus[];
  proxyEnv: ProxyEnv;
  codexConfig?: CodexConfigStatus;
}

export function formatReport(input: ReportInput): string {
  const parts = [
    `${c.bold}llm-path${c.reset} — LLM API path diagnostics`,
    '',
    formatTable(input.results),
    '',
    formatFixBlocks(input.results, input.locals, input.proxyEnv, input.codexConfig),
  ];
  return parts.join('\n');
}

export function formatJson(input: ReportInput): string {
  return JSON.stringify(
    {
      results: input.results,
      localProxies: input.locals,
      proxyEnv: input.proxyEnv,
      bestAnthropic: bestAnthropicPath(input.results) ?? null,
      bestCodex: bestCodexPath(input.results) ?? null,
      codexConfig: input.codexConfig
        ? {
            homeDir: input.codexConfig.homeDir,
            configPath: input.codexConfig.configPath,
            configExists: input.codexConfig.configExists,
            defaultConfigPath: input.codexConfig.defaultConfigPath,
            defaultConfigExists: input.codexConfig.defaultConfigExists,
            usingCodexHomeEnv: input.codexConfig.usingCodexHomeEnv,
          }
        : null,
    },
    null,
    2,
  );
}
