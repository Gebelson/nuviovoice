import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  handleBrowserContextMenu,
  initializeNativeContextMenuSuppression,
  isEditableElement,
} from './nativeContextMenu';
import { useContextMenuStore } from '../stores/contextMenuStore';

describe('nativeContextMenu suppression', () => {
  beforeEach(() => {
    useContextMenuStore.getState().close();
    // Default: not Electron
    delete (window as unknown as { backspace?: unknown }).backspace;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('identifies editable elements correctly', () => {
    const textInput = document.createElement('input');
    textInput.type = 'text';
    expect(isEditableElement(textInput)).toBe(true);

    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    expect(isEditableElement(passwordInput)).toBe(true);

    const disabledInput = document.createElement('input');
    disabledInput.type = 'text';
    disabledInput.disabled = true;
    expect(isEditableElement(disabledInput)).toBe(false);

    const readOnlyInput = document.createElement('input');
    readOnlyInput.type = 'text';
    readOnlyInput.readOnly = true;
    expect(isEditableElement(readOnlyInput)).toBe(false);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    expect(isEditableElement(checkbox)).toBe(false);

    const textarea = document.createElement('textarea');
    expect(isEditableElement(textarea)).toBe(true);

    const contentEditable = document.createElement('div');
    contentEditable.contentEditable = 'true';
    expect(isEditableElement(contentEditable)).toBe(true);

    const normalDiv = document.createElement('div');
    expect(isEditableElement(normalDiv)).toBe(false);
  });

  it('cancels the default browser context menu on empty/standard page areas', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);

    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 100,
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    div.dispatchEvent(event);
    handleBrowserContextMenu(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    // No custom menu is opened on empty space
    expect(useContextMenuStore.getState().menu).toBeNull();

    div.remove();
  });

  it('allows the native context menu when target or ancestor has [data-allow-native-context-menu]', () => {
    const container = document.createElement('div');
    container.setAttribute('data-allow-native-context-menu', 'true');

    const child = document.createElement('span');
    container.appendChild(child);
    document.body.appendChild(container);

    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 50,
      clientY: 50,
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    // Simulate event target being child
    Object.defineProperty(event, 'target', { value: child });

    handleBrowserContextMenu(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
    expect(useContextMenuStore.getState().menu).toBeNull();

    container.remove();
  });

  it('does NOT suppress context menu when running in Electron (Desktop app)', () => {
    // Mock Electron environment
    (window as unknown as { backspace?: unknown }).backspace = { platform: 'win32' };

    const div = document.createElement('div');
    document.body.appendChild(div);

    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 100,
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    handleBrowserContextMenu(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();

    div.remove();
  });

  it('opens custom edit context menu when right-clicking on an input without selection', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'Hello Nuvio';
    document.body.appendChild(input);

    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 200,
      clientY: 150,
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    Object.defineProperty(event, 'target', { value: input });

    handleBrowserContextMenu(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    const menu = useContextMenuStore.getState().menu;
    expect(menu).not.toBeNull();
    expect(menu?.position).toEqual({ x: 200, y: 150 });

    const keys = menu?.items.map((i) => i.key);
    expect(keys).toContain('edit-paste');
    expect(keys).toContain('edit-select-all');

    input.remove();
  });

  it('opens custom edit context menu with cut and copy when input has selected text', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'Selected Text';
    document.body.appendChild(input);
    input.setSelectionRange(0, 8);

    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 120,
      clientY: 80,
    });
    Object.defineProperty(event, 'target', { value: input });

    handleBrowserContextMenu(event);

    const menu = useContextMenuStore.getState().menu;
    expect(menu).not.toBeNull();
    const keys = menu?.items.map((i) => i.key);
    expect(keys).toContain('edit-cut');
    expect(keys).toContain('edit-copy');
    expect(keys).toContain('edit-paste');
    expect(keys).toContain('edit-select-all');

    input.remove();
  });

  it('preserves an already-opened custom context menu from another component', () => {
    // Simulate a component (e.g. Message or Space) having already opened its menu
    useContextMenuStore.getState().open({ x: 10, y: 20 }, [
      { key: 'space-leave', type: 'action', label: 'Leave Space', onClick: vi.fn() },
    ]);

    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);

    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 50,
      clientY: 50,
    });
    Object.defineProperty(event, 'target', { value: input });

    handleBrowserContextMenu(event);

    // Existing space-leave menu remains untouched
    const menu = useContextMenuStore.getState().menu;
    expect(menu?.items[0]?.key).toBe('space-leave');

    input.remove();
  });

  it('initializes and cleans up the global document listener idempotently', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const cleanup1 = initializeNativeContextMenuSuppression();
    expect(addSpy).toHaveBeenCalledWith('contextmenu', expect.any(Function));

    // Calling it again returns the same disposer without adding another listener
    const callCountBefore = addSpy.mock.calls.length;
    const cleanup2 = initializeNativeContextMenuSuppression();
    expect(addSpy.mock.calls.length).toBe(callCountBefore);

    cleanup1();
    expect(removeSpy).toHaveBeenCalledWith('contextmenu', expect.any(Function));
  });
});
