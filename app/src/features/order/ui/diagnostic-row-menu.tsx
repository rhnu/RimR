import { ListChecks } from 'lucide-react';
import { useRef, useState, type ReactElement, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import type { OrderDiagnosticScope, OrderDiagnosticTarget } from '../model/diagnostic-targets';

export type RowDiagnosticNavigation = {
  scopeForTarget: (target: OrderDiagnosticTarget) => OrderDiagnosticScope | null;
  openScope: (scope: OrderDiagnosticScope, trigger: HTMLElement | null) => void;
};

export function DiagnosticRowMenu({
  children,
  trigger,
  target,
  navigation,
  onOpen,
}: {
  children: ReactNode;
  trigger: ReactElement;
  target: OrderDiagnosticTarget;
  navigation: RowDiagnosticNavigation;
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const focusOrigin = useRef<HTMLElement | null>(null);
  const pendingScope = useRef<OrderDiagnosticScope | null>(null);

  return (
    <ContextMenu
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          const row = triggerRef.current;
          const focused = document.activeElement;
          focusOrigin.current =
            focused instanceof HTMLElement && row?.contains(focused) ? focused : row;
          onOpen?.();
        }
        setOpen(nextOpen);
      }}
    >
      <ContextMenuTrigger asChild ref={triggerRef}>
        {trigger}
      </ContextMenuTrigger>
      <ContextMenuContent
        onCloseAutoFocus={(event) => {
          const scope = pendingScope.current;
          if (!scope) return;
          pendingScope.current = null;
          // Radix closes the menu and releases its focus trap before the report takes focus.
          event.preventDefault();
          navigation.openScope(scope, focusOrigin.current);
        }}
      >
        <DiagnosticMenuItem
          target={target}
          navigation={navigation}
          onSelect={(scope) => {
            pendingScope.current = scope;
          }}
        />
        {children}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function DiagnosticMenuItem({
  target,
  navigation,
  onSelect,
}: {
  target: OrderDiagnosticTarget;
  navigation: RowDiagnosticNavigation;
  onSelect: (scope: OrderDiagnosticScope) => void;
}) {
  const { t } = useTranslation();
  const scope = navigation.scopeForTarget(target);
  if (!scope) return null;
  return (
    <>
      <ContextMenuItem onSelect={() => onSelect(scope)}>
        <ListChecks aria-hidden="true" className="size-4" />
        {t('order.validation.view')}
      </ContextMenuItem>
      <ContextMenuSeparator />
    </>
  );
}
