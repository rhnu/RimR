import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import type { DependencyDto, ModMetadataDto } from '@/commands';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { SteamBbcode } from '@/components/ui/steam-bbcode';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ModTypeIcon } from '@/components/mod/ModTypeIcon';
import { displayModName } from '@/lib/officialContent';
import { cn } from '@/lib/utils';

interface ModDetailsSheetProps {
  mod: ModMetadataDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground select-none">
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <Label className="text-xs font-normal text-muted-foreground">{label}</Label>
      <span className={cn('text-sm', mono && 'font-mono text-xs')}>{value}</span>
    </div>
  );
}

function LinkField({ label, href }: { label: string; href: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <Label className="text-xs font-normal text-muted-foreground">{label}</Label>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 break-all text-sm text-primary underline-offset-4 hover:underline"
      >
        <ExternalLink className="size-3.5 shrink-0" />
        {href}
      </a>
    </div>
  );
}

function SubField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-normal text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ListOrDash({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="font-mono text-xs">
          {item}
        </li>
      ))}
    </ul>
  );
}

function DependencyItem({ dep }: { dep: DependencyDto }) {
  const { t } = useTranslation();
  return (
    <li className="border border-border px-2 py-1.5">
      <div className="font-mono text-xs">{dep.packageId}</div>
      {dep.displayName ? <div className="text-sm">{dep.displayName}</div> : null}
      {dep.steamWorkshopUrl || dep.downloadUrl ? (
        <div className="mt-1 flex flex-wrap gap-2">
          {dep.steamWorkshopUrl ? (
            <a
              href={dep.steamWorkshopUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
            >
              <ExternalLink className="size-3" />
              {t('modDetails.links.steam')}
            </a>
          ) : null}
          {dep.downloadUrl ? (
            <a
              href={dep.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
            >
              <ExternalLink className="size-3" />
              {t('modDetails.links.download')}
            </a>
          ) : null}
        </div>
      ) : null}
      {dep.alternativePackageIds.length > 0 ? (
        <div className="mt-1 text-xs text-muted-foreground">
          {t('modDetails.alt', { ids: dep.alternativePackageIds.join(', ') })}
        </div>
      ) : null}
    </li>
  );
}

function DetailsBody({ mod }: { mod: ModMetadataDto }) {
  const { t } = useTranslation();
  const hasIssues = !mod.valid || mod.dataMalformed;
  return (
    <div className="space-y-3">
      <Section title={t('modDetails.sections.identity')}>
        <Field label={t('modDetails.fields.packageId')} value={mod.packageId} mono />
        <Field label={t('modDetails.fields.sourceKey')} value={mod.sourceKey} mono />
        {mod.modVersion ? (
          <Field label={t('modDetails.fields.modVersion')} value={mod.modVersion} />
        ) : null}
        {mod.steamAppId != null ? (
          <Field label={t('modDetails.fields.steamAppId')} value={String(mod.steamAppId)} />
        ) : null}
        {mod.url ? <LinkField label={t('modDetails.fields.url')} href={mod.url} /> : null}
      </Section>

      <Separator />
      <Section title={t('modDetails.sections.authors')}>
        {mod.authors.length > 0 ? (
          <p className="text-sm">{mod.authors.join(', ')}</p>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </Section>

      <Separator />
      <Section title={t('modDetails.sections.supportedVersions')}>
        {mod.supportedVersions.length > 0 ? (
          <p className="text-sm">{mod.supportedVersions.join(', ')}</p>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </Section>

      {mod.description ? (
        <>
          <Separator />
          <Section title={t('modDetails.sections.description')}>
            <SteamBbcode>{mod.description}</SteamBbcode>
          </Section>
        </>
      ) : null}

      <Separator />
      <RulesSection mod={mod} />

      {hasIssues ? <StatusSection dataMalformed={mod.dataMalformed} /> : null}
    </div>
  );
}

function RulesSection({ mod }: { mod: ModMetadataDto }) {
  const { t } = useTranslation();
  return (
    <Section title={t('modDetails.sections.rules')}>
      <SubField label={t('modDetails.rules.loadAfter')}>
        <ListOrDash items={mod.rules.loadAfter} />
      </SubField>
      <SubField label={t('modDetails.rules.loadBefore')}>
        <ListOrDash items={mod.rules.loadBefore} />
      </SubField>
      <SubField label={t('modDetails.rules.forceLoadAfter')}>
        <ListOrDash items={mod.rules.forceLoadAfter} />
      </SubField>
      <SubField label={t('modDetails.rules.forceLoadBefore')}>
        <ListOrDash items={mod.rules.forceLoadBefore} />
      </SubField>
      <SubField label={t('modDetails.rules.incompatibleWith')}>
        <ListOrDash items={mod.rules.incompatibleWith} />
      </SubField>
      <SubField label={t('modDetails.rules.dependencies')}>
        <Dependencies dependencies={mod.rules.modDependencies} />
      </SubField>
    </Section>
  );
}

function Dependencies({ dependencies }: { dependencies: DependencyDto[] }) {
  if (dependencies.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  return (
    <ul className="space-y-1">
      {dependencies.map((dep, index) => (
        <DependencyItem key={`${dep.packageId}-${index}`} dep={dep} />
      ))}
    </ul>
  );
}

function StatusSection({ dataMalformed }: { dataMalformed: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      <Separator />
      <Section title={t('modDetails.sections.status')}>
        <p className="text-sm text-muted-foreground">
          {dataMalformed ? t('modDetails.status.malformed') : t('modDetails.status.issues')}
        </p>
      </Section>
    </>
  );
}

export function ModDetailsSheet({ mod, open, onOpenChange }: ModDetailsSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 sm:max-w-xl">
        {mod ? (
          <>
            <SheetHeader>
              <SheetTitle className="text-lg">{displayModName(mod)}</SheetTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{t(`modDetails.source.${mod.sourceKind}`)}</Badge>
                {mod.valid && !mod.dataMalformed ? (
                  <Badge
                    variant="outline"
                    className="border-green-500/30 text-green-700 dark:text-green-400"
                  >
                    {t('modDetails.badges.valid')}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-yellow-500/30 text-yellow-700 dark:text-yellow-400"
                  >
                    {t('modDetails.badges.issues')}
                  </Badge>
                )}
                <ModTypeIcon hasAssemblies={mod.hasAssemblies} sourceKind={mod.sourceKind} />
              </div>
              <SheetDescription className="font-mono">{mod.packageId}</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-auto px-4 pb-6">
              <DetailsBody mod={mod} />
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
