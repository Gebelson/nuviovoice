import { isElectron } from './platform';
import { useContextMenuStore, type ContextMenuItem } from '../stores/contextMenuStore';
import i18n from '../i18n';

/**
 * Checks whether an element is an active text input or textarea where
 * editing operations (Cut, Copy, Paste, Select All) are standard.
 */
export function isEditableElement(element: Element): boolean {
  if (element instanceof HTMLInputElement) {
    const type = element.type.toLowerCase();
    return (
      !element.readOnly &&
      !element.disabled &&
      (type === 'text' ||
        type === 'password' ||
        type === 'email' ||
        type === 'search' ||
        type === 'tel' ||
        type === 'url' ||
        type === 'number')
    );
  }
  if (element instanceof HTMLTextAreaElement) {
    return !element.readOnly && !element.disabled;
  }
  if (element instanceof HTMLElement) {
    if (
      element.isContentEditable ||
      element.contentEditable === 'true' ||
      element.getAttribute('contenteditable') === 'true'
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Global handler that suppresses exclusively the native browser context menu
 * in Nuvio Web, while preserving all right-click events and custom context menus.
 */
export function handleBrowserContextMenu(event: MouseEvent): void {
  // 1. Desktop app (Electron) preserves its own context menu behavior
  if (isElectron()) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Element)) {
    event.preventDefault();
    return;
  }

  // 2. Explicit opt-out for components that require the native browser context menu
  if (target.closest('[data-allow-native-context-menu]')) {
    return;
  }

  // 3. Suppress the native browser context menu
  event.preventDefault();

  // If a custom context menu was already opened by a component's onContextMenu handler,
  // do not overwrite it.
  if (useContextMenuStore.getState().menu) {
    return;
  }

  // 4. If right-clicked on an editable field, offer standard glass edit actions
  const editable = target.closest('input, textarea, [contenteditable="true"]');
  if (editable && isEditableElement(editable)) {
    const isInputOrTextarea =
      editable instanceof HTMLInputElement || editable instanceof HTMLTextAreaElement;
    const hasSelection = isInputOrTextarea
      ? editable.selectionStart !== null &&
        editable.selectionEnd !== null &&
        editable.selectionStart !== editable.selectionEnd
      : Boolean(window.getSelection()?.toString());

    const items: ContextMenuItem[] = [];

    if (hasSelection) {
      items.push({
        key: 'edit-cut',
        type: 'action',
        label: i18n.t('common:actions.cut', 'Recortar'),
        onClick: () => {
          if (isInputOrTextarea) {
            const start = editable.selectionStart ?? 0;
            const end = editable.selectionEnd ?? 0;
            const selected = editable.value.slice(start, end);
            navigator.clipboard.writeText(selected).catch(() => {});
            editable.setRangeText('', start, end, 'end');
            editable.dispatchEvent(new Event('input', { bubbles: true }));
            editable.focus();
          } else {
            document.execCommand('cut');
          }
        },
      });

      items.push({
        key: 'edit-copy',
        type: 'action',
        label: i18n.t('common:actions.copy', 'Copiar'),
        onClick: () => {
          if (isInputOrTextarea) {
            const start = editable.selectionStart ?? 0;
            const end = editable.selectionEnd ?? 0;
            const selected = editable.value.slice(start, end);
            navigator.clipboard.writeText(selected).catch(() => {});
          } else {
            const selected = window.getSelection()?.toString() ?? '';
            navigator.clipboard.writeText(selected).catch(() => {});
          }
        },
      });
    }

    items.push({
      key: 'edit-paste',
      type: 'action',
      label: i18n.t('common:actions.paste', 'Colar'),
      onClick: async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            if (isInputOrTextarea) {
              const start = editable.selectionStart ?? editable.value.length;
              const end = editable.selectionEnd ?? editable.value.length;
              editable.setRangeText(text, start, end, 'end');
              editable.dispatchEvent(new Event('input', { bubbles: true }));
              editable.focus();
            } else {
              document.execCommand('insertText', false, text);
            }
          }
        } catch {
          // If clipboard reading is restricted by the browser, keyboard shortcut Ctrl+V remains usable
        }
      },
    });

    if (isInputOrTextarea) {
      items.push({ key: 'edit-sep', type: 'separator' });
      items.push({
        key: 'edit-select-all',
        type: 'action',
        label: i18n.t('common:actions.selectAll', 'Selecionar tudo'),
        onClick: () => {
          editable.select();
        },
      });
    }

    if (items.length > 0) {
      useContextMenuStore.getState().open(
        { x: event.clientX, y: event.clientY },
        items,
      );
    }
    return;
  }

  // 5. If text is selected on a non-editable element, offer Copy
  const selection = window.getSelection()?.toString().trim();
  if (selection) {
    useContextMenuStore.getState().open(
      { x: event.clientX, y: event.clientY },
      [
        {
          key: 'selection-copy',
          type: 'action',
          label: i18n.t('common:actions.copy', 'Copiar'),
          onClick: () => {
            navigator.clipboard.writeText(selection).catch(() => {});
          },
        },
      ],
    );
  }
}

let activeDisposer: (() => void) | null = null;

/**
 * Initializes global context menu suppression on document.
 * Safe against duplicate registration and idempotent across React StrictMode / HMR.
 * Returns a disposal function to remove the listener.
 */
export function initializeNativeContextMenuSuppression(): () => void {
  if (isElectron()) {
    return () => {};
  }

  if (activeDisposer) {
    return activeDisposer;
  }

  // Attached to document in bubbling phase:
  // Component listeners and React synthetic onContextMenu execute first.
  document.addEventListener('contextmenu', handleBrowserContextMenu);

  activeDisposer = () => {
    document.removeEventListener('contextmenu', handleBrowserContextMenu);
    activeDisposer = null;
  };

  return activeDisposer;
}
