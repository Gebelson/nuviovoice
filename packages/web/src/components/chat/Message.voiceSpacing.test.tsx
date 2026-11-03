import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DmChannel, MessageWithUser, User, Attachment } from '@concord/shared';
import { useAuthStore } from '../../stores/authStore';
import { useSpaceStore } from '../../stores/spaceStore';
import { Message } from './Message';

vi.mock('../../hooks/useWebSocket', () => ({ wsSend: vi.fn() }));
vi.mock('../../audio/AudioManager', () => ({
  AudioManager: {
    getInstance: vi.fn().mockReturnValue({
      setOutputDevice: vi.fn(),
      setVolume: vi.fn(),
    }),
  },
}));

// Mock Audio element for VoiceMessagePlayer
class MockAudio {
  public src = '';
  public preload = '';
  public playbackRate = 1;
  public currentTime = 0;
  public duration = 12;
  private listeners = new Map<string, Array<() => void>>();

  public addEventListener(event: string, callback: () => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  public removeEventListener(event: string, callback: () => void) {
    const list = this.listeners.get(event);
    if (list) {
      this.listeners.set(event, list.filter(cb => cb !== callback));
    }
  }

  public play() {
    return Promise.resolve();
  }

  public pause() {}
}

function makeUser(id: string, username: string, displayName: string | null): User {
  return {
    id, username, displayName, avatar: null, banner: null, accentColor: null, avatarColor: null,
    bio: null, status: 'online', customStatus: null, isAdmin: false, createdAt: 1,
    homeInstance: null, homeUserId: null, replicatedInstances: [],
  };
}

const me = makeUser('u-1', 'gebelson', 'Gebelson');
const dm = { id: 'dm-1', ownerId: 'u-1', name: 'Chat', createdAt: 1, members: [me], lastMessage: null } as unknown as DmChannel;

function createVoiceAttachment(ext: string, mimetype: string): Attachment {
  return {
    id: 'att-voice-1',
    messageId: 'msg-voice-1',
    filename: `voice-1${ext}`,
    originalName: `voice-message-1793721105816${ext}`,
    mimetype,
    size: 42000,
    duration: 12,
    waveform: JSON.stringify(Array(38).fill(0.5)),
    createdAt: Date.now(),
  };
}

function createMessage(content: string | null, attachment: Attachment): MessageWithUser {
  return {
    id: 'm-1',
    channelId: '',
    dmChannelId: dm.id,
    userId: me.id,
    replyToId: null,
    content,
    editedAt: null,
    createdAt: Date.now(),
    user: me,
    attachments: [attachment],
    embeds: [],
    reactions: [],
  };
}

describe('Message - Voice Message Spacing and Container Layout', () => {
  let originalAudio: typeof Audio;

  beforeEach(() => {
    originalAudio = window.Audio;
    window.Audio = MockAudio as unknown as typeof Audio;
    useAuthStore.setState({ user: me, activeWorkspaceOrigin: null });
    useSpaceStore.setState({ dmChannels: [dm] });
  });

  afterEach(() => {
    window.Audio = originalAudio;
    vi.restoreAllMocks();
  });

  it('renders isolated voice message (isFirstInGroup = true) immediately below header with VoiceMessagePlayer', () => {
    const att = createVoiceAttachment('.webm', 'video/webm');
    const msg = createMessage(null, att);

    const { container } = render(
      <Message
        message={msg}
        isCompact={false}
        isFirstInGroup={true}
        previousMessageId={null}
      />
    );

    // Header must exist
    expect(screen.getByText('Gebelson')).toBeDefined();

    // Voice player must be rendered
    expect(screen.getByTestId('voice-message-player')).toBeDefined();
    expect(screen.getByTestId('voice-waveform-scrubber')).toBeDefined();

    // No video element and no text block
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('.text-txt-message')).toBeNull();
  });

  it('renders grouped voice message (isFirstInGroup = false) without header and without extra space', () => {
    const att = createVoiceAttachment('.webm', 'video/webm');
    const msg = createMessage(null, att);

    const { container } = render(
      <Message
        message={msg}
        isCompact={true}
        isFirstInGroup={false}
        previousMessageId="prev-1"
      />
    );

    // Header must not exist
    expect(screen.queryByText('Gebelson')).toBeNull();

    // Voice player must be rendered
    expect(screen.getByTestId('voice-message-player')).toBeDefined();
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('.text-txt-message')).toBeNull();
  });

  it('does not render an empty text box when content is whitespace only', () => {
    const att = createVoiceAttachment('.webm', 'video/webm');
    const msg = createMessage('   \n  ', att);

    const { container } = render(
      <Message
        message={msg}
        isCompact={false}
        isFirstInGroup={true}
        previousMessageId={null}
      />
    );

    // Voice player exists
    expect(screen.getByTestId('voice-message-player')).toBeDefined();

    // Empty text block must NOT be rendered
    expect(container.querySelector('.text-txt-message')).toBeNull();
  });

  it('renders both text and voice player when real text is present', () => {
    const att = createVoiceAttachment('.webm', 'video/webm');
    const msg = createMessage('Escuta este áudio:', att);

    const { container } = render(
      <Message
        message={msg}
        isCompact={false}
        isFirstInGroup={true}
        previousMessageId={null}
      />
    );

    expect(screen.getByText('Escuta este áudio:')).toBeDefined();
    expect(container.querySelector('.text-txt-message')).toBeDefined();
    expect(screen.getByTestId('voice-message-player')).toBeDefined();
  });
});
