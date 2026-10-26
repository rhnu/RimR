import { describe, it, expect } from 'vitest';
import { queryKeys, sessionBoundQueryKeys } from '@/lib/queryKeys';

describe('sessionBoundQueryKeys', () => {
  const prefixes = sessionBoundQueryKeys.map((key) => JSON.stringify(key));

  it('purges catalog, active list, library, and mod filesystem snapshots', () => {
    expect(prefixes).toContain(JSON.stringify(queryKeys.catalogSnapshot));
    expect(prefixes).toContain(JSON.stringify(queryKeys.activeList));
    expect(prefixes).toContain(JSON.stringify(queryKeys.library));
    expect(prefixes).toContain(JSON.stringify(queryKeys.modPreviewRoot));
    expect(prefixes).toContain(JSON.stringify(queryKeys.modFolderSizeRoot));
  });

  it('does not purge app configuration', () => {
    expect(prefixes).not.toContain(JSON.stringify(queryKeys.appConfig));
  });
});
