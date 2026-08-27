import { existsSync } from 'node:fs';
import { homedir as osHomedir } from 'node:os';
import { join } from 'node:path';

/** Existence-only snapshot of Codex CLI config. Never reads file contents. */
export interface CodexConfigStatus {
  /** Directory Codex uses (CODEX_HOME or ~/.codex). */
  homeDir: string;
  /** $homeDir/config.toml — the file Codex would load. */
  configPath: string;
  configExists: boolean;
  /** Always ~/.codex (even when CODEX_HOME is set). */
  defaultHomeDir: string;
  defaultConfigPath: string;
  defaultConfigExists: boolean;
  usingCodexHomeEnv: boolean;
}

export interface DetectCodexConfigOptions {
  env?: NodeJS.ProcessEnv;
  homedir?: string;
  exists?: (path: string) => boolean;
}

/**
 * Locate Codex config.toml via CODEX_HOME or ~/.codex.
 * Only checks whether the path exists — never opens the file (no API keys).
 */
export function detectCodexConfig(options: DetectCodexConfigOptions = {}): CodexConfigStatus {
  const env = options.env ?? process.env;
  const home = options.homedir ?? osHomedir();
  const exists = options.exists ?? existsSync;

  const defaultHomeDir = join(home, '.codex');
  const defaultConfigPath = join(defaultHomeDir, 'config.toml');
  const fromEnv = env.CODEX_HOME?.trim() ?? '';
  const usingCodexHomeEnv = fromEnv.length > 0;
  const homeDir = usingCodexHomeEnv ? fromEnv : defaultHomeDir;
  const configPath = join(homeDir, 'config.toml');

  return {
    homeDir,
    configPath,
    configExists: exists(configPath),
    defaultHomeDir,
    defaultConfigPath,
    defaultConfigExists: exists(defaultConfigPath),
    usingCodexHomeEnv,
  };
}
