import { Info, X } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Col, Row } from '@/components/ui/layout';
import type { DiagnosticPresentation } from '@/domain/diagnostics/messages';
import { cn } from '@/lib/utils';

/** Shows source and version details without expanding the report row. */
export function DiagnosticDetails({
  details,
  describedBy,
}: {
  details: DiagnosticPresentation['details'];
  describedBy?: string;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  if (details.length === 0) return null;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground data-[state=open]:bg-accent"
          aria-label={t('suppression.details')}
          aria-describedby={describedBy}
          title={t('suppression.details')}
        >
          <Info aria-hidden="true" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={4}
          collisionPadding={8}
          aria-labelledby={titleId}
          className="z-60 w-96 max-w-[calc(100vw-1rem)] max-h-[var(--radix-popover-content-available-height)] overflow-auto rounded-slight border border-border bg-popover p-2 text-popover-foreground shadow-md"
        >
          <Row gap={2} className="items-center justify-between pb-2">
            <h4 id={titleId} className="text-xs font-semibold">
              {t('suppression.details')}
            </h4>
            <Popover.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground"
                aria-label={t('window.close')}
              >
                <X aria-hidden="true" />
              </Button>
            </Popover.Close>
          </Row>
          <Col asChild gap={2} className="select-text">
            <dl>
              {details.map(({ label, value, mono }, index) => (
                <div key={`${label}-${index}`}>
                  <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                  <dd
                    className={cn('text-xs wrap-anywhere whitespace-pre-wrap', mono && 'font-mono')}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </Col>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
