import { isReachable } from './classify.js';
import type { CodexConfigStatus } from './codex.js';
import {
  DEFAULT_LOCALE,
  displayClassLabel,
  displayPathLabel,
  messages,
  type Locale,
} from './i18n.js';
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

function visibleWidth(s: string): number {
  const visible = s.replace(/\u001b\[[0-9;]*m/g, '');
  let w = 0;
  for (const ch of visible) {
    const cp = ch.codePointAt(0) ?? 0;
    w += cp > 0xff ? 2 : 1;
  }
  return w;
}

function pad(s: string, n: number): string {
  const w = visibleWidth(s);
  if (w >= n) return s;
  return s + ' '.repeat(n - w);
}

function statusCell(r: ProbeResult, locale: Locale): string {
  const label = displayClassLabel(r.classification, locale);
  if (isReachable(r.classification)) {
    return `${c.green}● ${label}${c.reset}`;
  }
  return `${c.red}● ${label}${c.reset}`;
}

function pathLabel(path: string, locale: Locale): string {
  return displayPathLabel(path, locale);
}

/** Format ANSI (or plain) red/green results table. */
export function formatTable(results: ProbeResult[], locale: Locale = DEFAULT_LOCALE): string {
  const t = messages[locale];
  const cols = {
    name: Math.max(
      4,
      ...results.map((r) => visibleWidth(r.name)),
      visibleWidth(t.tableApi),
      12,
    ),
    path: Math.max(
      4,
      ...results.map((r) => visibleWidth(pathLabel(r.path, locale))),
      visibleWidth(t.tablePath),
      10,
    ),
    status: Math.max(14, visibleWidth(t.tableStatus) + 4),
    ms: Math.max(8, visibleWidth(t.tableMs)),
  };

  const header =
    pad(t.tableApi, cols.name) +
    '  ' +
    pad(t.tablePath, cols.path) +
    '  ' +
    pad(t.tableStatus, cols.status) +
    '  ' +
    pad(t.tableMs, cols.ms);

  const sep = '-'.repeat(visibleWidth(header));

  const rows = results.map((r) => {
    return (
      pad(r.name, cols.name) +
      '  ' +
      pad(pathLabel(r.path, locale), cols.path) +
      '  ' +
      pad(statusCell(r, locale), cols.status) +
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

function existLabel(exists: boolean, locale: Locale): string {
  const t = messages[locale];
  return exists ? t.exists : t.notFound;
}

/** Existence-only Codex config lines (never file contents). */
export function formatCodexConfigLines(
  cfg: CodexConfigStatus,
  locale: Locale = DEFAULT_LOCALE,
): string[] {
  const t = messages[locale];
  const lines: string[] = [];
  if (cfg.usingCodexHomeEnv) {
    lines.push(`${t.codexConfigHome}: ${cfg.configPath}  ${existLabel(cfg.configExists, locale)}`);
    if (cfg.defaultConfigPath !== cfg.configPath) {
      lines.push(
        `  ${t.defaultCodexConfig}: ${cfg.defaultConfigPath}  ${existLabel(cfg.defaultConfigExists, locale)}`,
      );
    }
  } else {
    lines.push(`${t.codexConfig}: ${cfg.configPath}  ${existLabel(cfg.configExists, locale)}`);
  }
  return lines;
}

/** Copy-paste Codex env (+ note: no HTTP-proxy key in config.toml). */
export function formatCodexFix(
  results: ProbeResult[],
  locals: LocalProxyStatus[],
  cfg?: CodexConfigStatus,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const t = messages[locale];
  const best = bestCodexPath(results);
  const proxy = suggestedProxyUrl(best, locals);
  const lines: string[] = [];

  lines.push(`${c.bold}${c.cyan}${t.codexHeading}${c.reset}`);
  lines.push('');

  if (best) {
    lines.push(
      `${c.green}${t.bestCodexPrefix}:${c.reset} ${pathLabel(best.path, locale)} (${best.latencyMs}ms) ${t.via} ${best.name}`,
    );
  } else {
    lines.push(`${c.yellow}${t.noCodex}${c.reset}`);
  }
  lines.push('');

  if (cfg) {
    lines.push(...formatCodexConfigLines(cfg, locale));
    lines.push('');
  }

  lines.push(`${c.dim}${t.shellCodex}${c.reset}`);
  lines.push(`export HTTPS_PROXY=${proxy}`);
  lines.push(`export HTTP_PROXY=${proxy}`);
  lines.push(`export ALL_PROXY=${proxy}`);
  lines.push(`codex`);
  lines.push('');
  lines.push(`${c.dim}${t.codexNoProxyKey}${c.reset}`);
  lines.push(`${c.dim}${t.codexSandboxNote}${c.reset}`);

  return lines.join('\n');
}

/** Copy-paste shell export + Claude settings.json + Codex env. */
export function formatFixBlocks(
  results: ProbeResult[],
  locals: LocalProxyStatus[],
  proxyEnv: ProxyEnv,
  codexConfig?: CodexConfigStatus,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const t = messages[locale];
  const best = bestAnthropicPath(results);
  const proxy = suggestedProxyUrl(best, locals);
  const lines: string[] = [];

  lines.push(`${c.bold}${c.cyan}${t.fixHeading}${c.reset}`);
  lines.push('');

  if (best) {
    lines.push(
      `${c.green}${t.bestAnthropicPrefix}:${c.reset} ${pathLabel(best.path, locale)} (${best.latencyMs}ms)`,
    );
  } else {
    lines.push(`${c.yellow}${t.noAnthropic}${c.reset}`);
  }
  lines.push('');

  lines.push(`${c.dim}${t.shellBash}${c.reset}`);
  lines.push(`export HTTPS_PROXY=${proxy}`);
  lines.push(`export HTTP_PROXY=${proxy}`);
  lines.push(`export ALL_PROXY=${proxy}`);
  lines.push('');

  lines.push(`${c.dim}${t.claudeSettings}${c.reset}`);
  lines.push(`{
  "env": {
    "HTTPS_PROXY": "${proxy}",
    "HTTP_PROXY": "${proxy}",
    "ALL_PROXY": "${proxy}"
  }
}`);
  lines.push('');

  lines.push(formatCodexFix(results, locals, codexConfig, locale));
  lines.push('');

  const listening = locals.filter((l) => l.listening);
  lines.push(`${c.bold}${t.localProxyPorts}${c.reset}`);
  for (const l of locals) {
    const mark = l.listening
      ? `${c.green}${t.listening}${c.reset}`
      : `${c.red}${t.closed}${c.reset}`;
    lines.push(`  ${l.host}:${l.port}  ${mark}${l.latencyMs != null ? ` (${l.latencyMs}ms)` : ''}`);
  }
  if (listening.length === 0) {
    lines.push(`  ${c.dim}${t.clashTip}${c.reset}`);
  }
  lines.push('');

  lines.push(`${c.bold}${t.envProxyVars}${c.reset}`);
  lines.push(`  HTTPS_PROXY=${proxyEnv.httpsProxy ?? t.unset}`);
  lines.push(`  HTTP_PROXY=${proxyEnv.httpProxy ?? t.unset}`);
  lines.push(`  ALL_PROXY=${proxyEnv.allProxy ?? t.unset}`);

  return lines.join('\n');
}

export interface ReportInput {
  results: ProbeResult[];
  locals: LocalProxyStatus[];
  proxyEnv: ProxyEnv;
  codexConfig?: CodexConfigStatus;
}

export function formatReport(input: ReportInput, locale: Locale = DEFAULT_LOCALE): string {
  const t = messages[locale];
  const parts = [
    `${c.bold}llm-path${c.reset} — ${t.reportTitle.replace(/^llm-path — /, '')}`,
    '',
    formatTable(input.results, locale),
    '',
    formatFixBlocks(input.results, input.locals, input.proxyEnv, input.codexConfig, locale),
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
