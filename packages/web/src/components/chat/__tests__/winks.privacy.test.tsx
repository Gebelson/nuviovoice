import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@concord/shared';
import { OFFICIAL_WINKS } from '@concord/shared/src/winks';
import { HttpError } from '../../../api/client';
import { useAuthStore } from '../../../stores/authStore';
import { useChatStore } from '../../../stores/chatStore';
import { useComposerStore } from '../../../stores/composerStore';
import { useSpaceStore } from '../../../stores/spaceStore';
import { useWinkStore } from '../../../stores/winkStore';
import { useUIStore } from '../../../stores/uiStore';
import { MessageInput } from '../MessageInput';
import i18n from '../../../i18n';

vi.mock('../../../hooks/useWebSocket', () => ({ wsSend: vi.fn() }));
vi.mock('../../../audio/AudioManager', () => ({
  AudioManager: {
    getInstance: vi.fn().mockReturnValue({
      setOutputDevice: vi.fn(),
      setVolume: vi.fn(),
    }),
  },
}));

const me: User = {
  id: 'user-me',
  username: 'alice',
  displayName: 'Alice',
  avatar: null,
  banner: null,
  accentColor: null,
  avatarColor: null,
  bio: null,
  status: 'online',
  customStatus: null,
  isAdmin: false,
  createdAt: 1,
  homeInstance: null,
  homeUserId: null,
  replicatedInstances: [],
};

const sendWinkMock = vi.fn();

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

describe('Winks Privacy rejection handling in MessageInput', () => {
  const addToastMock = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('pt');
    useAuthStore.setState({ user: me, token: 'token' });
    useComposerStore.setState({ states: new Map() });
    useChatStore.setState({
      currentChannelId: 'dm-1',
      messages: new Map(),
      replyTargets: new Map(),
      editingMessageId: null,
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
        name: null,
        icon: null,
        members: [me],
        lastMessage: null,
        metadataUpdatedAt: 1,
      } as any,
      {
        id: 'dm-group-1',
        federatedId: null,
        ownerId: 'user-me',
        ownerHomeUserId: null,
        ownerHomeInstance: null,
        createdAt: 1,
        name: 'Group 1',
        icon: null,
        members: [me],
        lastMessage: null,
        metadataUpdatedAt: 1,
      } as any,
    ]);
    useWinkStore.setState({
      settings: {
        autoplay: true,
        playAudio: true,
        volume: 80,
        reduceMotion: false,
        disableIncoming: false,
      },
      recentWinkIds: ['diabravinho', 'bolsogado', 'nikole'],
      activeWink: null,
      publishedWinks: [...OFFICIAL_WINKS],
    });
    useUIStore.setState({ addToast: addToastMock });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows error toast and does not trigger local playback when recipient refuses winks (1:1 DM)', async () => {
    const triggerSpy = vi.spyOn(useWinkStore.getState(), 'triggerWink');

    sendWinkMock.mockRejectedValueOnce(
      new HttpError(403, 'Não foi possível enviar este Wink. O destinatário não está aceitando Winks.', {
        statusCode: 403,
        code: 'winks_disabled_by_recipient',
        error: 'Não foi possível enviar este Wink. O destinatário não está aceitando Winks.',
      }, 'winks_disabled_by_recipient')
    );

    render(<MessageInput channelId="dm-1" channelName="@Bob" />);

    // Open Winks picker
    const winksButton = screen.getByRole('button', { name: /wink/i });
    fireEvent.click(winksButton);

    // Click on Diabravinho
    const diabravinhoButtons = await screen.findAllByRole('button', { name: /Diabravinho/i });
    await act(async () => {
      fireEvent.click(diabravinhoButtons[0]);
    });

    expect(sendWinkMock).toHaveBeenCalledWith('dm-1', 'diabravinho');
    expect(addToastMock).toHaveBeenCalledWith(
      'Não foi possível enviar este Wink. O destinatário não está aceitando Winks.',
      'warning'
    );
    expect(triggerSpy).not.toHaveBeenCalled();
    expect(useWinkStore.getState().activeWink).toBeNull();
  });

  it('shows error toast and does not trigger local playback when group has winks disabled', async () => {
    const triggerSpy = vi.spyOn(useWinkStore.getState(), 'triggerWink');

    sendWinkMock.mockRejectedValueOnce(
      new HttpError(403, 'Não foi possível enviar o Wink nesta conversa.', {
        statusCode: 403,
        code: 'winks_disabled_in_group',
        error: 'Não foi possível enviar o Wink nesta conversa.',
      }, 'winks_disabled_in_group')
    );

    render(<MessageInput channelId="dm-group-1" channelName="Group 1" />);

    // Open Winks picker
    const winksButton = screen.getByRole('button', { name: /wink/i });
    fireEvent.click(winksButton);

    // Click on Bolsogado
    const bolsogadoButtons = await screen.findAllByRole('button', { name: /Bolsogado/i });
    await act(async () => {
      fireEvent.click(bolsogadoButtons[0]);
    });

    expect(sendWinkMock).toHaveBeenCalledWith('dm-group-1', 'bolsogado');
    expect(addToastMock).toHaveBeenCalledWith(
      'Não foi possível enviar o Wink nesta conversa.',
      'warning'
    );
    expect(triggerSpy).not.toHaveBeenCalled();
    expect(useWinkStore.getState().activeWink).toBeNull();
  });
});
