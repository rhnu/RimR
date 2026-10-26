import { describe, expect, it } from 'vitest';
import { createGroupId, createSeparatorId, createTestIdGenerator } from './ids';

describe('order model ids', () => {
  it('uses typed prefixes for generated group and separator ids', () => {
    const generate = createTestIdGenerator('case');

    expect(createGroupId(generate)).toBe('group-case-1');
    expect(createSeparatorId(generate)).toBe('sep-case-2');
  });
});
