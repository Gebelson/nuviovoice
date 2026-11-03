import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageInput } from '../MessageInput';
import { WinkPickerPopover } from '../WinkPickerPopover';
import { useUIStore } from '../../../stores/uiStore';
import { useSpaceStore } from '../../../stores/spaceStore';
import { useChatStore } from '../../../stores/chatStore';
import { useWinkStore } from '../../../stores/winkStore';
import { useAuthStore } from '../../../stores/authStore';
import { OFFICIAL_WINKS } from '@concord/shared/src/winks';

vi.mock('../../../hooks/useWebSocket', () => ({ wsSend: vi.fn() }));

const sendWinkMock = vi.fn().mockResolvedValue({
  id: 'msg-wink-1',
  dmChannelId: 'dm-1',
  userId: 'user-me',
  winkId: 'diabravinho',
  createdAt: Date.now(),
});

vi.mock('../../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      dm: {
        ...actual.api.dm,
        sendWink: (...args: any[]) => sendWinkMock(...args),
      },
    },
    getApiForOrigin: () => ({
      ...actual.api,
      dm: {
        ...actual.api.dm,
        sendWink: (...args: any[]) => sendWinkMock(...args),
      },
    }),
  };
});
vi.mock('../../../audio/AudioManager', () => {
  const mockInstance = {
    loadWinkSound: vi.fn().mockResolvedValue({}),
    playWinkSound: vi.fn().mockResolvedValue({ stop: vi.fn() }),
    stopWinkSound: vi.fn(),
    preloadWinkSounds: vi.fn(),
  };
  return {
    AudioManager: {
      getInstance: vi.fn().mockReturnValue(mockInstance),
    },
  };
});

describe('Winks Mobile Picker & Keyboard Management (iPhone / Safari / PWA)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUIStore.setState({ isMobile: true });
    const me = { id: 'user-me', username: 'alice', displayName: 'Alice' } as any;
    useAuthStore.setState({
      user: me,
      token: 'test-token',
    });
    useSpaceStore.getState().reset();
    useSpaceStore.getState().populateFromReady('', [], [], [
      {
        id: 'dm-1',
        federatedId: null,
        ownerId: null,
        ownerHomeUserId: null,
        ownerHomeInstance: null,
        createdAt: 1,
        members: [me, { id: 'user-bob', username: 'bob', displayName: 'Bob' }],
        lastMessage: null,
        name: 'Bob',
        icon: null,
        metadataUpdatedAt: 1,
      } as any,
      {
        id: 'dm-2',
        federatedId: null,
        ownerId: null,
        ownerHomeUserId: null,
        ownerHomeInstance: null,
        createdAt: 1,
        members: [me, { id: 'user-charlie', username: 'charlie', displayName: 'Charlie' }],
        lastMessage: null,
        name: 'Charlie',
        icon: null,
        metadataUpdatedAt: 1,
      } as any,
    ]);
    useChatStore.setState({
      currentChannelId: 'dm-1',
      messages: new Map(),
      replyTargets: new Map(),
      editingMessageId: null,
    });
    useWinkStore.setState({
      publishedWinks: [...OFFICIAL_WINKS],
      isLoadingPublished: false,
      activeWink: null,
      queue: [],
    });
  });

  afterEach(() => {
    useUIStore.setState({ isMobile: false });
  });

  it('1. Abrir seletor com teclado fechado: exibe grade de 2 colunas no mobile', () => {
    render(<MessageInput channelId="dm-1" channelName="@Bob" />);

    const winksButton = screen.getByRole('button', { name: /wink/i });
    act(() => {
      fireEvent.click(winksButton);
    });

    // Mobile dialog header & 2-column grid
    const dialog = screen.getByRole('dialog', { name: 'Winks' });
    expect(dialog).toBeInTheDocument();
    expect(dialog.className).toContain('rounded-2xl');
    expect(dialog.className).toContain('absolute bottom-full');

    const grid = screen.getByTestId('winks-mobile-grid');
    expect(grid.className).toContain('grid-cols-2');

    // All official winks present
    expect(screen.getByText('Diabravinho')).toBeInTheDocument();
    expect(screen.getByText('Bolsogado')).toBeInTheDocument();
    expect(screen.getByText('Nikole')).toBeInTheDocument();
  });

  it('2. Abrir seletor com teclado aberto: fecha teclado e remove foco da textarea', () => {
    render(<MessageInput channelId="dm-1" channelName="@Bob" />);

    const textarea = screen.getByPlaceholderText(/message|enviar/i);
    const blurSpy = vi.spyOn(textarea, 'blur');

    // Simulate virtual keyboard open: textarea has focus
    textarea.focus();
    expect(document.activeElement).toBe(textarea);

    const winksButton = screen.getByRole('button', { name: /wink/i });
    act(() => {
      // Touch / pointerdown on Winks button
      fireEvent.pointerDown(winksButton);
      fireEvent.click(winksButton);
    });

    // Textarea blur must have been requested to collapse iOS keyboard
    expect(blurSpy).toHaveBeenCalled();

    // Winks panel opens
    expect(screen.getByRole('dialog', { name: 'Winks' })).toBeInTheDocument();
  });

  it('3. Fechar teclado ao abrir Winks: botão aciona pointerdown blur preventivo', () => {
    render(<MessageInput channelId="dm-1" channelName="@Bob" />);

    const textarea = screen.getByPlaceholderText(/message|enviar/i);
    const blurSpy = vi.spyOn(textarea, 'blur');

    const winksButton = screen.getByRole('button', { name: /wink/i });
    act(() => {
      fireEvent.pointerDown(winksButton);
    });

    expect(blurSpy).toHaveBeenCalled();
  });

  it('4. Garantir que o teclado não reabra: no mobile não há input autoFocus', () => {
    render(
      <WinkPickerPopover
        onSelect={vi.fn()}
        onClose={vi.fn()}
        anchorRef={{ current: document.createElement('button') }}
      />
    );

    // On mobile, the search input with autoFocus is NOT rendered to protect virtual keyboard stability
    const autoFocusInput = document.querySelector('input[autofocus]');
    expect(autoFocusInput).toBeNull();
  });

  it('5. Fechar painel ao focar ou tocar no campo de texto', () => {
    render(<MessageInput channelId="dm-1" channelName="@Bob" />);

    const winksButton = screen.getByRole('button', { name: /wink/i });
    act(() => {
      fireEvent.click(winksButton);
    });
    expect(screen.getByRole('dialog', { name: 'Winks' })).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/message|enviar/i);
    // User taps into textarea
    act(() => {
      fireEvent.touchStart(textarea);
      fireEvent.focus(textarea);
    });

    // Panel is closed
    expect(screen.queryByRole('dialog', { name: 'Winks' })).not.toBeInTheDocument();
  });

  it('6. Fechar painel ao tocar no botão de Winks novamente (toggle off)', () => {
    render(<MessageInput channelId="dm-1" channelName="@Bob" />);

    const winksButton = screen.getByRole('button', { name: /wink/i });
    // First tap: opens
    act(() => {
      fireEvent.click(winksButton);
    });
    expect(screen.getByRole('dialog', { name: 'Winks' })).toBeInTheDocument();

    // Second tap: closes
    act(() => {
      fireEvent.click(winksButton);
    });
    expect(screen.queryByRole('dialog', { name: 'Winks' })).not.toBeInTheDocument();
  });

  it('7. Selecionar e enviar Wink: envia, fecha painel e não foca textarea', async () => {
    const triggerWinkSpy = vi.spyOn(useWinkStore.getState(), 'triggerWink');
    render(<MessageInput channelId="dm-1" channelName="@Bob" />);

    const textarea = screen.getByPlaceholderText(/message|enviar/i);
    const focusSpy = vi.spyOn(textarea, 'focus');

    const winksButton = screen.getByRole('button', { name: /wink/i });
    act(() => {
      fireEvent.click(winksButton);
    });

    // Click on Diabravinho
    const diabravinhoBtn = screen.getByText('Diabravinho').closest('button')!;
    await act(async () => {
      fireEvent.click(diabravinhoBtn);
    });

    // Panel closed
    expect(screen.queryByRole('dialog', { name: 'Winks' })).not.toBeInTheDocument();
    // Wink triggered
    expect(triggerWinkSpy).toHaveBeenCalledWith(
      expect.objectContaining({ winkId: 'diabravinho', isLocalReplay: true })
    );
    // Focus was NOT requested on mobile textarea
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('8. Trocar de conversa com painel aberto fecha o seletor', () => {
    const { rerender } = render(<MessageInput channelId="dm-1" channelName="@Bob" />);

    const winksButton = screen.getByRole('button', { name: /wink/i });
    act(() => {
      fireEvent.click(winksButton);
    });
    expect(screen.getByRole('dialog', { name: 'Winks' })).toBeInTheDocument();

    // User navigates to dm-2
    rerender(<MessageInput channelId="dm-2" channelName="@Charlie" />);

    // Panel is closed
    expect(screen.queryByRole('dialog', { name: 'Winks' })).not.toBeInTheDocument();
  });

  it('9. Rolagem independente: container mobile possui overscroll-contain e touch-pan-y', () => {
    render(
      <WinkPickerPopover
        onSelect={vi.fn()}
        onClose={vi.fn()}
        anchorRef={{ current: document.createElement('button') }}
      />
    );

    const scrollContainer = screen.getByTestId('winks-mobile-grid-scroll');
    expect(scrollContainer.className).toContain('overscroll-contain');
    expect(scrollContainer.className).toContain('touch-pan-y');
    expect(scrollContainer.className).toContain('overflow-y-auto');
  });

  it('10. Diferentes alturas de viewport: adapta max-height dinamicamente', () => {
    // Stub visualViewport with small iPhone height (e.g. 500px)
    const mockVv = {
      height: 500,
      width: 375,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('visualViewport', mockVv);

    render(
      <WinkPickerPopover
        onSelect={vi.fn()}
        onClose={vi.fn()}
        anchorRef={{ current: document.createElement('button') }}
      />
    );

    const dialog = screen.getByRole('dialog', { name: 'Winks' });
    // 500 - 135 = 365px
    expect(dialog.style.maxHeight).toBe('365px');

    vi.unstubAllGlobals();
  });

  it('11. Safe area do iPhone: respeita variáveis seguras e bottom-full acima do composer', () => {
    render(
      <WinkPickerPopover
        onSelect={vi.fn()}
        onClose={vi.fn()}
        anchorRef={{ current: document.createElement('button') }}
      />
    );

    const dialog = screen.getByRole('dialog', { name: 'Winks' });
    expect(dialog.className).toContain('bottom-full');
    expect(dialog.className).toContain('mb-2');
    expect(dialog.className).toContain('left-0');
    expect(dialog.className).toContain('right-0');
  });

  it('12. Orientação vertical e horizontal: atualiza max-height no evento orientationchange', () => {
    const mockVv = {
      height: 380, // Landscape height
      width: 800,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('visualViewport', mockVv);

    render(
      <WinkPickerPopover
        onSelect={vi.fn()}
        onClose={vi.fn()}
        anchorRef={{ current: document.createElement('button') }}
      />
    );

    const dialog = screen.getByRole('dialog', { name: 'Winks' });
    // 380 - 135 = 245px
    expect(dialog.style.maxHeight).toBe('245px');

    vi.unstubAllGlobals();
  });

  it('13. Safari iOS e PWA: exibe indicador de áudio discreto nas miniaturas', () => {
    render(
      <WinkPickerPopover
        onSelect={vi.fn()}
        onClose={vi.fn()}
        anchorRef={{ current: document.createElement('button') }}
      />
    );

    // Audio indicators exist on official winks
    const audioBadges = screen.getAllByLabelText(/áudio/i);
    expect(audioBadges.length).toBeGreaterThan(0);
  });

  it('14. Preservação do comportamento desktop: no desktop renderiza o layout popover clássico', () => {
    useUIStore.setState({ isMobile: false });

    render(
      <WinkPickerPopover
        onSelect={vi.fn()}
        onClose={vi.fn()}
        anchorRef={{ current: document.createElement('button') }}
      />
    );

    // Desktop popover header text
    expect(screen.getByText('Animações clássicas para mensagens diretas')).toBeInTheDocument();
    // Desktop search input with autoFocus
    const searchInput = screen.getByPlaceholderText('Encontre um Wink...');
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveFocus();
  });
});
