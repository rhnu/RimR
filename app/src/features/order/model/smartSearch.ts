import type {
  DisplayAliasDto,
  ModIdentityDto,
  ModMetadataDto,
  ModTagBindingDto,
  SourceKindDto,
  TagDefDto,
} from '@/commands';
import { identityForMod, identityMatches } from '@/features/order/identity';
import { tagIdsForIdentity } from '@/features/tags/tagModel';

export type SmartSearchTermKind = 'text' | 'tag' | 'source' | 'group';

export type SmartSearchTerm = {
  kind: SmartSearchTermKind;
  value: string;
  negated: boolean;
};

export type SmartSearchQuery = {
  terms: SmartSearchTerm[];
};

export type SmartSearchContext = {
  aliases: DisplayAliasDto[];
  modByPackageId: Map<string, ModMetadataDto>;
  modTags: ModTagBindingDto[];
  tagDefs: TagDefDto[];
};

export type SmartSearchCandidateOptions = {
  groupName?: string;
};

type SearchCandidate = {
  searchText: string;
  tagNames: string[];
  groupNames: string[];
  sourceKind: SourceKindDto | null;
};

export type CompiledSmartSearch = {
  query: SmartSearchQuery;
  isEmpty: boolean;
  matchesMod: (mod: ModMetadataDto, options?: SmartSearchCandidateOptions) => boolean;
  matchesIdentity: (identity: ModIdentityDto, options?: SmartSearchCandidateOptions) => boolean;
  matchesSeparator: (title: string) => boolean;
};

const MODIFIER_KIND: Record<string, SmartSearchTermKind> = {
  '#': 'tag',
  '&': 'source',
  '@': 'group',
};

export function parseSmartModSearch(query: string): SmartSearchQuery {
  const terms: SmartSearchTerm[] = [];
  let index = 0;
  while (index < query.length) {
    while (index < query.length && /\s/.test(query[index] ?? '')) index += 1;
    if (index >= query.length) break;

    const termStart = index;
    let negated = false;
    if (query[index] === '!') {
      negated = true;
      index += 1;
    }

    const modifier = query[index] ?? '';
    const kind = MODIFIER_KIND[modifier];
    if (kind) index += 1;

    const parsed = parseTermValue(query, index);
    if (!parsed.closedQuote) {
      const value = query.slice(termStart).trim();
      if (value) terms.push({ kind: 'text', value, negated: false });
      break;
    }

    index = parsed.nextIndex;
    const value = parsed.value.trim();
    if (!value) {
      const fallback = query.slice(termStart, index).trim();
      if (fallback) terms.push({ kind: 'text', value: fallback, negated: false });
      continue;
    }

    terms.push({
      kind: kind ?? 'text',
      value,
      negated,
    });
  }

  return { terms };
}

export function compileSmartModSearch(
  query: string,
  context: SmartSearchContext,
): CompiledSmartSearch {
  const parsed = parseSmartModSearch(query);
  const normalized = parsed.terms.map((term) => ({
    ...term,
    needle: normalize(term.value),
    sourceKinds: term.kind === 'source' ? sourceKindsForTerm(term.value) : null,
  }));

  function matches(candidate: SearchCandidate, allowOnlyText = false): boolean {
    return normalized.every((term) => {
      if (allowOnlyText && term.kind !== 'text') return false;
      const matched = termMatchesCandidate(term, candidate);
      return term.negated ? !matched : matched;
    });
  }

  return {
    query: parsed,
    isEmpty: parsed.terms.length === 0,
    matchesMod: (mod, options) => matches(candidateForMod(mod, context, options)),
    matchesIdentity: (identity, options) =>
      matches(candidateForIdentity(identity, context, options)),
    matchesSeparator: (title) => {
      if (parsed.terms.length === 0) return true;
      return matches(
        {
          searchText: normalize(title),
          tagNames: [],
          groupNames: [],
          sourceKind: null,
        },
        true,
      );
    },
  };
}

function parseTermValue(
  query: string,
  index: number,
): { value: string; nextIndex: number; closedQuote: boolean } {
  if (query[index] === '"') {
    const end = query.indexOf('"', index + 1);
    if (end < 0) {
      return { value: query.slice(index + 1), nextIndex: query.length, closedQuote: false };
    }
    return { value: query.slice(index + 1, end), nextIndex: end + 1, closedQuote: true };
  }

  let nextIndex = index;
  while (nextIndex < query.length && !/\s/.test(query[nextIndex] ?? '')) nextIndex += 1;
  return { value: query.slice(index, nextIndex), nextIndex, closedQuote: true };
}

function termMatchesCandidate(
  term: SmartSearchTerm & { needle: string; sourceKinds: SourceKindDto[] | null },
  candidate: SearchCandidate,
): boolean {
  switch (term.kind) {
    case 'text':
      return candidate.searchText.includes(term.needle);
    case 'tag':
      return candidate.tagNames.some((name) => name.includes(term.needle));
    case 'group':
      return candidate.groupNames.some((name) => name.includes(term.needle));
    case 'source':
      return (
        candidate.sourceKind != null && (term.sourceKinds?.includes(candidate.sourceKind) ?? false)
      );
  }
}

function candidateForMod(
  mod: ModMetadataDto,
  context: SmartSearchContext,
  options: SmartSearchCandidateOptions = {},
): SearchCandidate {
  return candidateForIdentity(identityForMod(mod), context, options, mod);
}

function candidateForIdentity(
  identity: ModIdentityDto,
  context: SmartSearchContext,
  options: SmartSearchCandidateOptions = {},
  mod = context.modByPackageId.get(identity.packageId),
): SearchCandidate {
  const tagNames = tagNamesForIdentity(identity, context);
  const groupNames = options.groupName ? [normalize(options.groupName)] : [];
  const sourceKind = mod?.sourceKind ?? identity.sourceKind ?? null;
  const fields = [
    aliasForIdentity(context.aliases, identity),
    mod?.name,
    identity.packageId,
    identity.sourceKey,
    mod?.sourceKey,
    sourceKind,
    ...(mod?.authors ?? []),
    ...tagNames,
    ...groupNames,
  ];
  return {
    searchText: normalize(fields.filter(Boolean).join(' ')),
    tagNames,
    groupNames,
    sourceKind,
  };
}

function tagNamesForIdentity(identity: ModIdentityDto, context: SmartSearchContext): string[] {
  const defById = new Map(context.tagDefs.map((def) => [def.id, def.name] as const));
  return tagIdsForIdentity(context.modTags, identity)
    .map((id) => defById.get(id))
    .filter((name): name is string => Boolean(name))
    .map(normalize);
}

function aliasForIdentity(
  aliases: DisplayAliasDto[],
  identity: ModIdentityDto,
): string | undefined {
  return aliases.find((alias) => identityMatches(alias.identity, identity))?.displayAlias;
}

function sourceKindsForTerm(value: string): SourceKindDto[] | null {
  switch (normalize(value)) {
    case 'steam':
    case 'workshop':
      return ['workshop'];
    case 'local':
      return ['local'];
    case 'official':
    case 'expansion':
    case 'dlc':
      return ['expansion'];
    default:
      return null;
  }
}

function normalize(value: string): string {
  return value.toLocaleLowerCase();
}
