#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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

function printHelp(): void {
  const text = `
llm-path v${VERSION}

Diagnose why Claude Code / Codex / Cursor cannot reach LLM APIs
(especially on Chinese networks with Clash).

Usage:
  llm-path [options]

Options:
  --json       Print machine-readable JSON instead of a table
  --help, -h   Show this help
  --version, -V  Show version

Exit code is always 0 (diagnostic tool).

Examples:
  npx llm-path
  llm-path --json
`.trim();
  console.log(text);
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return;
  }
  if (argv.includes('--version') || argv.includes('-V')) {
    console.log(VERSION);
    return;
  }

  const asJson = argv.includes('--json');

  const [results, locals] = await Promise.all([runProbes(), detectLocalProxies()]);
  const proxyEnv = readProxyEnv();
  const input = { results, locals, proxyEnv };

  if (asJson) {
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
