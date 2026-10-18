import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../../audio/AudioManager', () => ({
  AudioManager: {
    getInstance: vi.fn().mockReturnValue({
      setOutputDevice: vi.fn(),
      setVolume: vi.fn(),
    }),
  },
}));

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import i18n from '../../../i18n';
import { useSpaceStore } from '../../../stores/spaceStore';
import { useVoiceStore } from '../../../stores/voiceStore';
import { useNotificationSettingsStore } from '../../../stores/notificationSettingsStore';
import { useUIStore } from '../../../stores/uiStore';
import { PermissionBits } from '../../../utils/permissions';
import { SpaceHoverCard } from '../SpaceHoverCard';

function seedSpaceWithVoice(options: {
  spaceId?: string;
  spaceName?: string;
  channelId?: string;
  channelName?: string;
  channelPermissions?: string;
  users?: Array<{ id: string; username: string; displayName?: string | null; avatar?: string | null }>;
  voiceUserIds?: string[];
  muted?: boolean;
}) {
  const spaceId = options.spaceId ?? 'space-1';
  const spaceName = options.spaceName ?? 'Comunidade Nuvio';
  const channelId = options.channelId ?? 'voice-1';
  const channelName = options.channelName ?? 'Sala Geral';
  const perms = options.channelPermissions ?? String(PermissionBits.VIEW_CHANNEL | PermissionBits.CONNECT);
  const users = options.users ?? [];

  useSpaceStore.getState().populateFromReady('', [
    {
      id: spaceId,
      name: spaceName,
      icon: null,
      banner: null,
      avatarColor: null,
      ownerId: 'owner-1',
      inviteCode: 'inv1',
      visibility: 'private',
      directoryListed: false,
      description: null,
      createdAt: 1000,
      myPermissions: perms,
      channels: [
        {
          id: channelId,
          spaceId,
          name: channelName,
          type: 'voice',
          topic: null,
          position: 0,
          categoryId: null,
          isPrivate: false,
          createdAt: 1000,
          myPermissions: perms,
        },
      ],
      categories: [],
      roles: [],
      members: users.map((u) => ({
        spaceId,
        userId: u.id,
        nickname: null,
        joinedAt: 1000,
        roles: [],
        user: {
          id: u.id,
          username: u.username,
          displayName: u.displayName ?? u.username,
          avatar: u.avatar ?? null,
          avatarColor: null,
          status: 'online' as const,
          createdAt: 1000,
        },
      })),
    },
  ]);

  if (options.voiceUserIds) {
    useVoiceStore.getState().setVoiceUsers(channelId, options.voiceUserIds);
  }

  if (options.muted !== undefined) {
    useNotificationSettingsStore.getState().apply('', {
      spaceId,
      channelId: null,
      level: null,
      muted: options.muted,
      mutedUntil: null,
      suppressEveryone: false,
      suppressRoles: false,
      updatedAt: Date.now(),
    });
  }
}

function makeUsers(count: number) {
  return Array.from({ length: count }, (_, idx) => ({
    id: `user-${idx + 1}`,
    username: `user${idx + 1}`,
    displayName: `Participante ${idx + 1}`,
    avatar: idx % 2 === 0 ? `https://cdn.nuvio.app/avatars/u${idx + 1}.png` : null,
  }));
}

describe('SpaceHoverCard', () => {
  const originalLanguage = i18n.language;

  beforeEach(async () => {
    vi.useFakeTimers();
    await i18n.changeLanguage('pt');
    useSpaceStore.getState().reset();
    useVoiceStore.setState({
      voiceUsers: new Map(),
      currentVoiceChannelId: null,
      isLiveKitConnected: false,
      participants: [],
      connectFn: vi.fn(),
    });
    useNotificationSettingsStore.getState().reset();
    useUIStore.setState({ isMobile: false });
  });

  afterEach(async () => {
    vi.useRealTimers();
    await i18n.changeLanguage(originalLanguage);
  });

  it('1. displays the hover card with the correct space name on mouse enter', () => {
    seedSpaceWithVoice({ spaceName: 'Servidor dos Amigos' });

    render(
      <SpaceHoverCard spaceId="space-1" spaceName="Servidor dos Amigos" delay={0}>
        <button data-testid="space-trigger">S</button>
      </SpaceHoverCard>,
    );

    fireEvent.mouseEnter(screen.getByTestId('space-trigger'));

    expect(screen.getByTestId('space-hover-card')).toBeInTheDocument();
    expect(screen.getByTestId('space-hover-name')).toHaveTextContent('Servidor dos Amigos');
  });

  it('2. renders very long space names with truncation classes and full title attribute', () => {
    const longName = 'Espaço Oficial Super Extremamente Longo Para Testar Truncamento Sem Quebrar Layout';
    seedSpaceWithVoice({ spaceName: longName });

    render(
      <SpaceHoverCard spaceId="space-1" spaceName={longName} delay={0}>
        <button data-testid="space-trigger">E</button>
      </SpaceHoverCard>,
    );

    fireEvent.mouseEnter(screen.getByTestId('space-trigger'));

    const nameEl = screen.getByTestId('space-hover-name');
    expect(nameEl).toHaveTextContent(longName);
    expect(nameEl).toHaveClass('truncate');
    expect(nameEl).toHaveAttribute('title', longName);
  });

  it('3. shows only the space name when no one is in a voice channel and space is not muted', () => {
    seedSpaceWithVoice({ spaceName: 'Espaço Silencioso', voiceUserIds: [], muted: false });

    render(
      <SpaceHoverCard spaceId="space-1" spaceName="Espaço Silencioso" delay={0}>
        <button data-testid="space-trigger">E</button>
      </SpaceHoverCard>,
    );

    fireEvent.mouseEnter(screen.getByTestId('space-trigger'));

    expect(screen.getByTestId('space-hover-name')).toHaveTextContent('Espaço Silencioso');
    expect(screen.queryByTestId('space-hover-participants')).not.toBeInTheDocument();
    expect(screen.queryByTestId('space-hover-muted')).not.toBeInTheDocument();
  });

  it('4. displays 1 avatar when 1 person is in the voice channel', () => {
    const users = makeUsers(1);
    seedSpaceWithVoice({ users, voiceUserIds: users.map((u) => u.id) });

    render(
      <SpaceHoverCard spaceId="space-1" spaceName="Comunidade Nuvio" delay={0}>
        <button data-testid="space-trigger">C</button>
      </SpaceHoverCard>,
    );

    fireEvent.mouseEnter(screen.getByTestId('space-trigger'));

    expect(screen.getAllByTestId('space-hover-avatar')).toHaveLength(1);
  });

  it('5. displays 3 avatars when 3 people are in the voice channel', () => {
    const users = makeUsers(3);
    seedSpaceWithVoice({ users, voiceUserIds: users.map((u) => u.id) });

    render(
      <SpaceHoverCard spaceId="space-1" spaceName="Comunidade Nuvio" delay={0}>
        <button data-testid="space-trigger">C</button>
      </SpaceHoverCard>,
    );

    fireEvent.mouseEnter(screen.getByTestId('space-trigger'));

    expect(screen.getAllByTestId('space-hover-avatar')).toHaveLength(3);
  });

  it('6. displays 5 avatars when 5 people are in the voice channel', () => {
    const users = makeUsers(5);
    seedSpaceWithVoice({ users, voiceUserIds: users.map((u) => u.id) });

    render(
      <SpaceHoverCard spaceId="space-1" spaceName="Comunidade Nuvio" delay={0}>
        <button data-testid="space-trigger">C</button>
      </SpaceHoverCard>,
    );

    fireEvent.mouseEnter(screen.getByTestId('space-trigger'));

    expect(screen.getAllByTestId('space-hover-avatar')).toHaveLength(5);
    expect(screen.queryByTestId('space-hover-avatar-overflow')).not.toBeInTheDocument();
  });

  it('7 & 8 & 9. displays MORE than 5 avatars (e.g. 9 and 12 avatars across multiple lines) without prematurely truncating at 5', () => {
    const users = makeUsers(12);
    seedSpaceWithVoice({ users, voiceUserIds: users.map((u) => u.id) });

    render(
      <SpaceHoverCard spaceId="space-1" spaceName="Comunidade Nuvio" delay={0}>
        <button data-testid="space-trigger">C</button>
      </SpaceHoverCard>,
    );

    fireEvent.mouseEnter(screen.getByTestId('space-trigger'));

    const avatars = screen.getAllByTestId('space-hover-avatar');
    expect(avatars).toHaveLength(12);
    expect(avatars.length).toBeGreaterThan(5);
    expect(screen.queryByTestId('space-hover-avatar-overflow')).not.toBeInTheDocument();

    const listEl = screen.getByTestId('space-hover-avatar-list');
    expect(listEl).toHaveClass('flex-wrap');
  });

  it('10 & 11. renders fallback initials when a participant has no photo or when their image fails to load', () => {
    const users = [
      { id: 'u1', username: 'alice', displayName: 'Alice', avatar: null },
      { id: 'u2', username: 'bruno', displayName: 'Bruno', avatar: 'https://broken.example/404.png' },
    ];
    seedSpaceWithVoice({ users, voiceUserIds: ['u1', 'u2'] });

    render(
      <SpaceHoverCard spaceId="space-1" spaceName="Comunidade Nuvio" delay={0}>
        <button data-testid="space-trigger">C</button>
      </SpaceHoverCard>,
    );

    fireEvent.mouseEnter(screen.getByTestId('space-trigger'));

    const avatars = screen.getAllByTestId('space-hover-avatar');
    expect(avatars).toHaveLength(2);
    expect(avatars[0]).toHaveTextContent('A');

    // Trigger image error on Bruno's avatar
    const img = avatars[1]!.querySelector('img')!;
    expect(img).toBeTruthy();
    fireEvent.error(img);
    expect(avatars[1]).toHaveTextContent('B');
  });

  it('12. displays "Silenciado" at the bottom when the space is muted', () => {
    seedSpaceWithVoice({ spaceName: 'Espaço Silenciado', voiceUserIds: [], muted: true });

    render(
      <SpaceHoverCard spaceId="space-1" spaceName="Espaço Silenciado" delay={0}>
        <button data-testid="space-trigger">E</button>
      </SpaceHoverCard>,
    );

    fireEvent.mouseEnter(screen.getByTestId('space-trigger'));

    const mutedEl = screen.getByTestId('space-hover-muted');
    expect(mutedEl).toBeInTheDocument();
    expect(mutedEl).toHaveTextContent('Silenciado');
  });

  it('13. does NOT display "Silenciado" or any unmuted label when the space is not muted', () => {
    seedSpaceWithVoice({ spaceName: 'Espaço Ativo', voiceUserIds: [], muted: false });

    render(
      <SpaceHoverCard spaceId="space-1" spaceName="Espaço Ativo" delay={0}>
        <button data-testid="space-trigger">E</button>
      </SpaceHoverCard>,
    );

    fireEvent.mouseEnter(screen.getByTestId('space-trigger'));

    expect(screen.queryByTestId('space-hover-muted')).not.toBeInTheDocument();
    expect(screen.queryByText(/Silenciado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Notifica/i)).not.toBeInTheDocument();
  });

  it('14 & 15. renders exact DOM order: Space Name (top) -> Voice Participants (middle) -> "Silenciado" (bottom) when muted, and omits "Silenciado" when unmuted', () => {
    const users = makeUsers(6);
    seedSpaceWithVoice({
      spaceName: 'Squad Nuvio',
      users,
      voiceUserIds: users.map((u) => u.id),
      muted: true,
    });

    render(
      <SpaceHoverCard spaceId="space-1" spaceName="Squad Nuvio" delay={0}>
        <button data-testid="space-trigger">S</button>
      </SpaceHoverCard>,
    );

    fireEvent.mouseEnter(screen.getByTestId('space-trigger'));

    const card = screen.getByTestId('space-hover-card');
    const nameEl = screen.getByTestId('space-hover-name');
    const participantsEl = screen.getByTestId('space-hover-participants');
    const mutedEl = screen.getByTestId('space-hover-muted');

    expect(card).toContainElement(nameEl);
    expect(card).toContainElement(participantsEl);
    expect(card).toContainElement(mutedEl);

    // Verify top-to-bottom DOM order: name precedes participants, participants precede muted label
    expect(nameEl.compareDocumentPosition(participantsEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(participantsEl.compareDocumentPosition(mutedEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('16 & 17 & 18. updates in real time when users join/leave voice and when mute status changes', () => {
    const users = makeUsers(6);
    seedSpaceWithVoice({
      users,
      voiceUserIds: ['user-1', 'user-2'],
      muted: false,
    });

    render(
      <SpaceHoverCard spaceId="space-1" spaceName="Comunidade Nuvio" delay={0}>
        <button data-testid="space-trigger">C</button>
      </SpaceHoverCard>,
    );

    fireEvent.mouseEnter(screen.getByTestId('space-trigger'));
    expect(screen.getAllByTestId('space-hover-avatar')).toHaveLength(2);
    expect(screen.queryByTestId('space-hover-muted')).not.toBeInTheDocument();

    // Join 4 more users -> 6 avatars shown
    act(() => {
      useVoiceStore.getState().setVoiceUsers('voice-1', users.map((u) => u.id));
    });
    expect(screen.getAllByTestId('space-hover-avatar')).toHaveLength(6);

    // Leave all users -> voice section disappears cleanly
    act(() => {
      useVoiceStore.getState().setVoiceUsers('voice-1', []);
    });
    expect(screen.queryByTestId('space-hover-participants')).not.toBeInTheDocument();

    // Mute the space -> "Silenciado" appears immediately
    act(() => {
      useNotificationSettingsStore.getState().apply('', {
        spaceId: 'space-1',
        channelId: null,
        level: null,
        muted: true,
        mutedUntil: null,
        suppressEveryone: false,
        suppressRoles: false,
        updatedAt: Date.now() + 1000,
      });
    });
    expect(screen.getByTestId('space-hover-muted')).toHaveTextContent('Silenciado');

    // Unmute the space -> "Silenciado" disappears immediately
    act(() => {
      useNotificationSettingsStore.getState().apply('', {
        spaceId: 'space-1',
        channelId: null,
        level: null,
        muted: false,
        mutedUntil: null,
        suppressEveryone: false,
        suppressRoles: false,
        updatedAt: Date.now() + 2000,
      });
    });
    expect(screen.queryByTestId('space-hover-muted')).not.toBeInTheDocument();
  });

  it('19. does not leak participants from private voice channels without VIEW_CHANNEL permission', () => {
    const users = makeUsers(3);
    seedSpaceWithVoice({
      users,
      voiceUserIds: ['user-1', 'user-2', 'user-3'],
      channelPermissions: '0', // No VIEW_CHANNEL permission
    });

    render(
      <SpaceHoverCard spaceId="space-1" spaceName="Espaço Restrito" delay={0}>
        <button data-testid="space-trigger">R</button>
      </SpaceHoverCard>,
    );

    fireEvent.mouseEnter(screen.getByTestId('space-trigger'));

    expect(screen.queryByTestId('space-hover-participants')).not.toBeInTheDocument();
    expect(screen.queryAllByTestId('space-hover-avatar')).toHaveLength(0);
  });

  it('20. opens/closes smoothly without flickering, allows only 1 card at a time, and never connects to LiveKit on hover', () => {
    const connectSpy = vi.fn();
    useVoiceStore.setState({ connectFn: connectSpy });

    seedSpaceWithVoice({ spaceId: 'space-1', spaceName: 'Espaço 1' });

    render(
      <div>
        <SpaceHoverCard spaceId="space-1" spaceName="Espaço 1" delay={0}>
          <button data-testid="trigger-1">1</button>
        </SpaceHoverCard>
        <SpaceHoverCard spaceId="space-2" spaceName="Espaço 2" delay={0}>
          <button data-testid="trigger-2">2</button>
        </SpaceHoverCard>
      </div>,
    );

    fireEvent.mouseEnter(screen.getByTestId('trigger-1'));
    expect(screen.getAllByTestId('space-hover-card')).toHaveLength(1);
    expect(screen.getByTestId('space-hover-name')).toHaveTextContent('Espaço 1');

    // Hovering second space immediately closes first space's card
    fireEvent.mouseEnter(screen.getByTestId('trigger-2'));
    expect(screen.getAllByTestId('space-hover-card')).toHaveLength(1);
    expect(screen.getByTestId('space-hover-name')).toHaveTextContent('Espaço 2');

    // Leaving trigger closes after grace period
    fireEvent.mouseLeave(screen.getByTestId('trigger-2'));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.queryByTestId('space-hover-card')).not.toBeInTheDocument();

    // Never connected to LiveKit
    expect(connectSpy).not.toHaveBeenCalled();
  });
});
