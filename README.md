# llm-path

**Claude Code 一直转圈？8 秒告诉你卡在哪。**

`llm-path` 是给大陆用户用的诊断命令：Claude Code / Codex / Cursor 连不上 API 时，8 秒查出是直连死了、代理没进终端，还是 Clash 端口不对。

```bash
npx llm-path
```

## 它解决什么

国内最常见的情况：Clash 开了，浏览器能翻，Claude Code 还是卡住。原因几乎总是终端没吃到 HTTPS_PROXY，或端口不是 7890 / 7897。

cc-switch 换的是供应商配置。OmniRoute 是网关。GitHub520 改 hosts。llm-path 只测网络：直连、环境变量代理、本地 7890/7897，哪条能打到 Anthropic / OpenAI / DeepSeek / 智谱 / Kimi / 通义。

## 快速开始

```bash
npx llm-path
npx llm-path --json
```

从源码安装见 package.json 的 test / build / start。

## 探测列表

每条 API 都测：直连、环境变量代理、本地 7890、本地 7897。

- Anthropic / OpenAI / Gemini
- DeepSeek / 智谱 / Kimi / MiniMax / 通义
- 设置了自定义 Base URL 也会测

401、403 算网络通了。跑完给红绿表、可复制的代理环境变量、以及 Claude Code 的 env 配置。

## 协议

MIT

---

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

