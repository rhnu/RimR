const CUSTOM_TRIGGER_SELECTOR = '[data-slot="context-menu-trigger"]';

function isInsideCustomContextMenuTrigger(event: MouseEvent): boolean {
  return event.composedPath().some((node): node is Element => {
    return node instanceof Element && node.matches(CUSTOM_TRIGGER_SELECTOR);
  });
}

export function disableDefaultContextMenu(): void {
  document.addEventListener(
    'contextmenu',
    (event) => {
      if (!isInsideCustomContextMenuTrigger(event)) {
        event.preventDefault();
      }
    },
    { capture: true },
  );
}
