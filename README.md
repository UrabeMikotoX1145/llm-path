# llm-path

**Your Claude Code is hanging. This tells you why in 8 seconds.**

`llm-path` diagnoses why **Claude Code / Codex / Cursor** cannot reach LLM APIs — especially on Chinese networks behind **Clash** — then prints a red/green table and **copy-paste fixes**.

```bash
npx llm-path
```

## Why this exists

Tools hang forever when `api.anthropic.com` (or OpenAI / Gemini / others) is blocked, DNS-poisoned, or not routed through your local proxy. Most switchers change *which model* you use; **llm-path** tells you *which network path* works.

| Tool | What it does | What llm-path does differently |
|------|----------------|--------------------------------|
| **cc-switch** | Switch Claude Code providers / configs | We probe **reachability** (direct vs proxy ports), not provider accounts |
| **OmniRoute** | Route / gateway for LLM traffic | We are a **diagnostic CLI** — no daemon, no proxy of our own |
| **GitHub520** | Hosts file hacks for GitHub | We target **LLM API endpoints** + Clash ports `7890` / `7897` |

## Quick start

```bash
npx llm-path
```

Or install globally from this repo after a build, then run `llm-path`.

Options:

```text
llm-path --help
llm-path --version
llm-path --json
```

Exit code is always `0` (pure diagnostics).

## What it probes

For each API, via **direct**, `HTTPS_PROXY`/`HTTP_PROXY`, and `http://127.0.0.1:7890` / `:7897`:

- `https://api.anthropic.com`
- `https://api.openai.com`
- `https://generativelanguage.googleapis.com`
- `https://api.deepseek.com`
- `https://open.bigmodel.cn`
- `https://api.moonshot.cn`
- `https://api.minimax.chat`
- `https://dashscope.aliyuncs.com`

Also probes `ANTHROPIC_BASE_URL` / `OPENAI_BASE_URL` when set.

Classification: `ok` | `dns` | `tls` | `timeout` | `http_<status>` — **401/403 = reachable**.

## Screenshot / GIF

<!-- drop a terminal recording here -->

```text
[ screenshot: red/green table + copy-paste HTTPS_PROXY / settings.json ]
```

## Install from source

```bash
git clone https://github.com/UrabeMikotoX1145/llm-path.git
cd llm-path
```

Then install deps, run tests, and build. See `package.json` scripts: `test`, `build`, `start`.

```bash
# after build
./dist/cli.js --help
```

## License

MIT

---

# llm-path（中文）

**Claude Code 一直转圈？8 秒告诉你卡在哪。**

`llm-path` 专门诊断 **Claude Code / Codex / Cursor** 连不上 LLM API 的原因（尤其是国内网络 + **Clash**），输出红/绿对照表，并给出**可直接复制**的修复命令。

```bash
npx llm-path
```

## 它解决什么

代理没开、端口不是 `7890`、环境变量没进 Claude Code……表现都是「卡住」。
**cc-switch** 换的是供应商配置；**OmniRoute** 是路由网关；**GitHub520** 改 hosts。
**llm-path** 只做一件事：测 **直连 / 环境变量代理 / 本地 7890·7897** 哪条路能打到 Anthropic 等 API。

## 快速开始

```bash
npx llm-path
llm-path --json
```

## 探测列表

Anthropic、OpenAI、Google AI、DeepSeek、智谱 BigModel、Moonshot、MiniMax、DashScope；
若设置了 `ANTHROPIC_BASE_URL` / `OPENAI_BASE_URL` 也会测。
`401`/`403` 视为**网络可达**（只是没密钥）。

## 截图 / GIF

```text
[ 在此放置终端录屏或截图 ]
```

## 协议

MIT
