import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, displayPathLabel, messages } from '../src/i18n.js';

describe('i18n', () => {
  it('defaults to Chinese', () => {
    expect(DEFAULT_LOCALE).toBe('zh');
  });

  it('zh and en have the same keys', () => {
    expect(Object.keys(messages.zh).sort()).toEqual(Object.keys(messages.en).sort());
  });

  it('Chinese strings match the spoken mainland tone', () => {
    expect(messages.zh.helpIntro).toBe(
      '诊断 Claude Code / Codex / Cursor 为什么连不上 LLM API（国内网络 + Clash）',
    );
    expect(messages.zh.bestCodexPrefix).toBe('最佳 Codex/OpenAI 路径');
    expect(messages.zh.notFound).toBe('不存在');
    expect(messages.zh.pathDirect).toBe('直连');
    expect(messages.zh.exists).toBe('存在');
  });

  it('English locale keeps the original UI wording', () => {
    expect(messages.en.bestCodexPrefix).toBe('Best Codex/OpenAI path');
    expect(messages.en.notFound).toBe('not found');
    expect(messages.en.pathDirect).toBe('direct');
    expect(messages.en.tablePath).toBe('Path');
  });

  it('path labels differ by locale; machine path keys stay English', () => {
    expect(displayPathLabel('direct', 'zh')).toBe('直连');
    expect(displayPathLabel('env', 'zh')).toBe('环境代理');
    expect(displayPathLabel('direct', 'en')).toBe('direct');
    expect(displayPathLabel('127.0.0.1:7890', 'zh')).toBe('127.0.0.1:7890');
  });
});
