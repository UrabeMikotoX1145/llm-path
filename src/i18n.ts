export type Locale = 'zh' | 'en';

export const DEFAULT_LOCALE: Locale = 'zh';

export interface Messages {
  reportTitle: string;
  tableApi: string;
  tablePath: string;
  tableStatus: string;
  tableMs: string;
  pathDirect: string;
  pathEnv: string;
  exists: string;
  notFound: string;
  codexConfig: string;
  codexConfigHome: string;
  defaultCodexConfig: string;
  fixHeading: string;
  bestAnthropicPrefix: string;
  noAnthropic: string;
  shellBash: string;
  claudeSettings: string;
  codexHeading: string;
  bestCodexPrefix: string;
  noCodex: string;
  shellCodex: string;
  codexNoProxyKey: string;
  codexSandboxNote: string;
  localProxyPorts: string;
  listening: string;
  closed: string;
  clashTip: string;
  envProxyVars: string;
  unset: string;
  via: string;
  classOk: string;
  classDns: string;
  classTls: string;
  classTimeout: string;
  classError: string;
  helpIntro: string;
  helpProbes: string;
  helpUsage: string;
  helpOptions: string;
  helpJson: string;
  helpHelp: string;
  helpVersion: string;
  helpGui: string;
  helpExit: string;
  helpExamples: string;
  guiLoading: string;
  guiError: string;
  guiServing: string;
  guiQuit: string;
}

const zh: Messages = {
  reportTitle: 'llm-path — LLM API 路径诊断',
  tableApi: 'API',
  tablePath: '路径',
  tableStatus: '状态',
  tableMs: 'ms',
  pathDirect: '直连',
  pathEnv: '环境代理',
  exists: '存在',
  notFound: '不存在',
  codexConfig: 'Codex 配置',
  codexConfigHome: 'Codex 配置（CODEX_HOME）',
  defaultCodexConfig: '默认 ~/.codex/config.toml',
  fixHeading: '## 建议修复（复制即用）',
  bestAnthropicPrefix: '最佳 Anthropic 路径',
  noAnthropic:
    '没找到能通的 Anthropic 路径。先开 Clash（混合端口 7890）或设好 HTTPS_PROXY，再跑一遍。',
  shellBash: '# Shell（bash/zsh）',
  claudeSettings: '# Claude Code ~/.claude/settings.json  （env 片段）',
  codexHeading: '## Codex（OpenAI Codex CLI）',
  bestCodexPrefix: '最佳 Codex/OpenAI 路径',
  noCodex:
    '没找到能通的 Codex/OpenAI 路径。先开 Clash（混合端口 7890）或设好 HTTPS_PROXY，再跑一遍。',
  shellCodex: '# Shell — 在这个终端 export，然后跑：  codex',
  codexNoProxyKey: '# ~/.codex/config.toml  — Codex 没有给自身 API 流量用的 HTTP 代理键。',
  codexSandboxNote:
    '# （features.network_proxy 是沙箱监听，不是 Clash。）跑 `codex` 前先 export 上面的变量。',
  localProxyPorts: '本机代理端口',
  listening: '在听',
  closed: '没开',
  clashTip: '提示：Clash / Clash Verge 混合端口一般是 7890；有的版本用 7897。',
  envProxyVars: '环境变量代理',
  unset: '（未设置）',
  via: '走',
  classOk: '通',
  classDns: 'DNS 失败',
  classTls: 'TLS 失败',
  classTimeout: '超时',
  classError: '出错',
  helpIntro: '诊断 Claude Code / Codex / Cursor 为什么连不上 LLM API（国内网络 + Clash）',
  helpProbes:
    '探测 Anthropic、OpenAI、ChatGPT（Codex）、Gemini 和国内 LLM API，路径：直连 / 环境变量代理 / 127.0.0.1:7890 / 7897。尊重 OPENAI_BASE_URL。输出 Claude settings.json 和 Codex HTTPS_PROXY 可复制配置。',
  helpUsage: '用法：',
  helpOptions: '选项：',
  helpJson: '输出机器可读 JSON，不要表格',
  helpHelp: '显示帮助',
  helpVersion: '显示版本',
  helpGui: '在浏览器打开图形界面（可切换中/英文）',
  helpExit: '退出码永远是 0（诊断工具）。',
  helpExamples: '示例：',
  guiLoading: '正在探测…',
  guiError: '探测失败',
  guiServing: '图形界面已开：',
  guiQuit: 'Ctrl+C 退出',
};

const en: Messages = {
  reportTitle: 'llm-path — LLM API path diagnostics',
  tableApi: 'API',
  tablePath: 'Path',
  tableStatus: 'Status',
  tableMs: 'ms',
  pathDirect: 'direct',
  pathEnv: 'env proxy',
  exists: 'exists',
  notFound: 'not found',
  codexConfig: 'Codex config',
  codexConfigHome: 'Codex config (CODEX_HOME)',
  defaultCodexConfig: 'default ~/.codex/config.toml',
  fixHeading: '## Suggested fix (copy-paste)',
  bestAnthropicPrefix: 'Best Anthropic path',
  noAnthropic:
    'No reachable Anthropic path found. Start Clash (mixed port 7890) or set a working HTTPS_PROXY, then re-run.',
  shellBash: '# Shell (bash/zsh)',
  claudeSettings: '# Claude Code ~/.claude/settings.json  (env snippet)',
  codexHeading: '## Codex (OpenAI Codex CLI)',
  bestCodexPrefix: 'Best Codex/OpenAI path',
  noCodex:
    'No reachable Codex/OpenAI path found. Start Clash (mixed port 7890) or set a working HTTPS_PROXY, then re-run.',
  shellCodex: '# Shell — export in this terminal, then run:  codex',
  codexNoProxyKey: '# ~/.codex/config.toml  — Codex has no HTTP-proxy key for its own API traffic.',
  codexSandboxNote:
    '# (features.network_proxy is a sandbox listener, not Clash.) Export the vars above before `codex`.',
  localProxyPorts: 'Local proxy ports',
  listening: 'listening',
  closed: 'closed',
  clashTip: 'Tip: Clash / Clash Verge mixed-port is often 7890; some builds use 7897.',
  envProxyVars: 'Env proxy vars',
  unset: '(unset)',
  via: 'via',
  classOk: 'OK',
  classDns: 'DNS fail',
  classTls: 'TLS fail',
  classTimeout: 'Timeout',
  classError: 'Error',
  helpIntro:
    'Diagnose why Claude Code / Codex / Cursor cannot reach LLM APIs (especially on Chinese networks with Clash).',
  helpProbes:
    'Probes Anthropic, OpenAI, ChatGPT (Codex), Gemini, and China LLM APIs via direct / env proxy / 127.0.0.1:7890 / 7897. Honors OPENAI_BASE_URL. Prints Claude settings.json and Codex HTTPS_PROXY copy-paste.',
  helpUsage: 'Usage:',
  helpOptions: 'Options:',
  helpJson: 'Print machine-readable JSON instead of a table',
  helpHelp: 'Show this help',
  helpVersion: 'Show version',
  helpGui: 'Open a graphical report in the browser (Chinese / English toggle)',
  helpExit: 'Exit code is always 0 (diagnostic tool).',
  helpExamples: 'Examples:',
  guiLoading: 'Probing…',
  guiError: 'Probe failed',
  guiServing: 'GUI running at',
  guiQuit: 'Ctrl+C to quit',
};

export const messages: Record<Locale, Messages> = { zh, en };

export function isLocale(value: string): value is Locale {
  return value === 'zh' || value === 'en';
}

export function displayClassLabel(cls: string, locale: Locale): string {
  const t = messages[locale];
  switch (cls) {
    case 'ok':
      return t.classOk;
    case 'dns':
      return t.classDns;
    case 'tls':
      return t.classTls;
    case 'timeout':
      return t.classTimeout;
    case 'error':
      return t.classError;
    default:
      if (cls.startsWith('http_')) return cls.toUpperCase();
      return cls;
  }
}

export function displayPathLabel(path: string, locale: Locale): string {
  const t = messages[locale];
  if (path === 'direct') return t.pathDirect;
  if (path === 'env') return t.pathEnv;
  return path;
}
