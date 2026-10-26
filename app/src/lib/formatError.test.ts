import { describe, it, expect } from 'vitest';
import { formatRimrError } from '@/lib/formatError';
import type { RimrClientError, CommandError } from '@/commands';

describe('formatRimrError', () => {
  it('formats a minimal command error', () => {
    const error = {
      kind: 'command',
      error: {
        code: 'pathNotConfigured',
        message: 'gameDir is not configured',
      } as CommandError,
    } as unknown as RimrClientError;
    expect(formatRimrError(error)).toEqual({
      title: 'gameDir is not configured',
      description: 'pathNotConfigured',
    });
  });

  it('formats a command error with sourceKey and path', () => {
    const error = {
      kind: 'command',
      error: {
        code: 'sourceIo',
        message: 'bad xml',
        sourceKey: 'local:Foo',
        path: 'C:/x/About.xml',
      } as CommandError,
    } as unknown as RimrClientError;
    expect(formatRimrError(error)).toEqual({
      title: 'bad xml',
      description: 'sourceIo · local:Foo · C:/x/About.xml',
    });
  });

  it('formats a transport error with a description key', () => {
    const error = {
      kind: 'transport',
      message: 'boom',
      cause: {},
    } as unknown as RimrClientError;
    expect(formatRimrError(error)).toEqual({
      title: 'boom',
      descriptionKey: 'error.transport',
    });
  });

  it('formats an unknown string with no description', () => {
    const result = formatRimrError('oops');
    expect(result).toEqual({ title: 'oops' });
    expect(result.description).toBeUndefined();
  });

  it('formats an unknown object via String()', () => {
    const result = formatRimrError({ foo: 1 });
    expect(result).toEqual({ title: '[object Object]' });
  });
});
