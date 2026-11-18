import { useDroppable } from '@dnd-kit/core';
import type { ReactNode, Ref } from 'react';
import { Col, Row } from '@/components/ui/layout';
import { cn } from '@/lib/utils';

export function PageMessage({ children }: { children: ReactNode }) {
  return <Row className="h-full justify-center p-6 text-sm text-muted-foreground">{children}</Row>;
}

interface WorkspacePanelProps {
  title: string;
  count?: number;
  actions?: ReactNode;
  children: ReactNode;
}

/** Shared frame keeps the panel title and controls visible while its contents scroll. */
export function WorkspacePanel({
  as: Element = 'section',
  ref,
  className,
  title,
  count,
  actions,
  children,
}: WorkspacePanelProps & {
  as?: 'section' | 'aside';
  ref?: Ref<HTMLElement>;
  className?: string;
}) {
  return (
    <Col
      asChild
      gap={0}
      className={cn('overflow-hidden rounded-slight border bg-background', className)}
    >
      <Element ref={ref}>
        <Row asChild className="h-9 shrink-0 border-b px-2.5 select-none">
          <header>
            <h2 title={title} className="truncate text-sm font-semibold">
              {title}
            </h2>
            {count != null && (
              <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
            )}
          </header>
        </Row>
        {actions && <div className="shrink-0 border-b px-2 py-1">{actions}</div>}
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">{children}</div>
      </Element>
    </Col>
  );
}

export function DroppablePanel({ id, ...props }: WorkspacePanelProps & { id: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <WorkspacePanel ref={setNodeRef} className={isOver ? 'border-primary' : undefined} {...props} />
  );
}
