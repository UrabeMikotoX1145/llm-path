import { describe, expect, it } from 'vitest';
import { parseArgs } from '../src/cli.js';

describe('parseArgs', () => {
  it('accepts --gui and -g', () => {
    expect(parseArgs(['--gui']).mode).toBe('gui');
    expect(parseArgs(['-g']).mode).toBe('gui');
  });

  it('does not treat --gui as report/json', () => {
    expect(parseArgs(['--gui', '--json']).mode).toBe('gui');
  });

  it('still handles help / version / json / report', () => {
    expect(parseArgs(['--help']).mode).toBe('help');
    expect(parseArgs(['-h']).mode).toBe('help');
    expect(parseArgs(['--version']).mode).toBe('version');
    expect(parseArgs(['-V']).mode).toBe('version');
    expect(parseArgs(['--json']).mode).toBe('json');
    expect(parseArgs([]).mode).toBe('report');
  });
});
