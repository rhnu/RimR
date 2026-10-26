import type { ModIdentityDto, ModTagBindingDto, TagDefDto } from '@/commands';
import { defById, tagIdsForIdentity } from '@/features/tags/tagModel';
import { Meta } from './MetaRow';

export function resolveModTags(
  identity: ModIdentityDto | null,
  tagDefs: TagDefDto[],
  modTags: ModTagBindingDto[],
): TagDefDto[] {
  if (!identity) return [];
  return tagIdsForIdentity(modTags, identity)
    .map((id) => defById(tagDefs, id))
    .filter((def): def is TagDefDto => def != null);
}

export function TagsMeta({ label, tags }: { label: string; tags: TagDefDto[] }) {
  const value =
    tags.length === 0 ? (
      '-'
    ) : (
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 border border-border px-1 py-0.5 text-xs"
          >
            {tag.color ? (
              <span className="size-2 shrink-0" style={{ backgroundColor: tag.color }} />
            ) : null}
            {tag.name}
          </span>
        ))}
      </div>
    );
  return <Meta label={label} value={value} />;
}
