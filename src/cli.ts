#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { detectCodexConfig } from './codex.js';
import { startGuiServer } from './gui.js';
import { DEFAULT_LOCALE, messages } from './i18n.js';
import { detectLocalProxies, readProxyEnv } from './proxy.js';
import { runProbes } from './probes.js';
import { formatJson, formatReport } from './report.js';

const VERSION = readVersion();

function readVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(here, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export type CliMode = 'help' | 'version' | 'gui' | 'json' | 'report';

export function parseArgs(argv: string[]): { mode: CliMode } {
  if (argv.includes('--help') || argv.includes('-h')) return { mode: 'help' };
  if (argv.includes('--version') || argv.includes('-V')) return { mode: 'version' };
  if (argv.includes('--gui') || argv.includes('-g')) return { mode: 'gui' };
  if (argv.includes('--json')) return { mode: 'json' };
  return { mode: 'report' };
}

function printHelp(): void {
  const t = messages[DEFAULT_LOCALE];
  const text = `
llm-path v${VERSION}

${t.helpIntro}

${t.helpProbes}

${t.helpUsage}
  llm-path [options]

${t.helpOptions}
  --json       ${t.helpJson}
  --gui, -g    ${t.helpGui}
  --help, -h   ${t.helpHelp}
  --version, -V  ${t.helpVersion}

${t.helpExit}

${t.helpExamples}
  npx llm-path
  llm-path --json
  npx llm-path --gui
`.trim();
  console.log(text);
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const { mode } = parseArgs(argv);
  if (mode === 'help') {
    printHelp();
    return;
  }
  if (mode === 'version') {
    console.log(VERSION);
    return;
  }

  if (mode === 'gui') {
    const t = messages[DEFAULT_LOCALE];
    const handle = await startGuiServer({
      host: '127.0.0.1',
      port: 8787,
      openBrowser: true,
    });
    console.log(`${t.guiServing} ${handle.url}  （${t.guiQuit}）`);
    return;
  }

  const [results, locals] = await Promise.all([runProbes(), detectLocalProxies()]);
  const proxyEnv = readProxyEnv();
  const codexConfig = detectCodexConfig();
  const input = { results, locals, proxyEnv, codexConfig };

  if (mode === 'json') {
    console.log(formatJson(input));
  } else {
    console.log(formatReport(input));
  }
}

function isMain(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}

if (isMain()) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 0;
  });
}
