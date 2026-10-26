import { describe, expect, it } from 'vitest';
import { parseSmartModSearch } from './smartSearch';

describe('order smart search parser', () => {
  it('splits plain whitespace terms', () => {
    expect(parseSmartModSearch('core framework')).toEqual({
      terms: [
        { kind: 'text', value: 'core', negated: false },
        { kind: 'text', value: 'framework', negated: false },
      ],
    });
  });

  it('parses quoted phrases', () => {
    expect(parseSmartModSearch('"vanilla expanded" core')).toEqual({
      terms: [
        { kind: 'text', value: 'vanilla expanded', negated: false },
        { kind: 'text', value: 'core', negated: false },
      ],
    });
  });

  it('parses modifier phrases', () => {
    expect(parseSmartModSearch('#"quality of life" @"Core Mods" &steam')).toEqual({
      terms: [
        { kind: 'tag', value: 'quality of life', negated: false },
        { kind: 'group', value: 'Core Mods', negated: false },
        { kind: 'source', value: 'steam', negated: false },
      ],
    });
  });

  it('parses negated text and modifiers', () => {
    expect(parseSmartModSearch('!patch !#qol !@"Core Mods" !&local')).toEqual({
      terms: [
        { kind: 'text', value: 'patch', negated: true },
        { kind: 'tag', value: 'qol', negated: true },
        { kind: 'group', value: 'Core Mods', negated: true },
        { kind: 'source', value: 'local', negated: true },
      ],
    });
  });

  it('falls back to plain text for malformed quotes', () => {
    expect(parseSmartModSearch('#"quality of life')).toEqual({
      terms: [{ kind: 'text', value: '#"quality of life', negated: false }],
    });
  });

  it('treats unsupported field syntax as plain text', () => {
    expect(parseSmartModSearch('$author:oskar')).toEqual({
      terms: [{ kind: 'text', value: '$author:oskar', negated: false }],
    });
  });
});
