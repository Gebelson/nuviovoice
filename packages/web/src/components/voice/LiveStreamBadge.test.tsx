import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { LiveStreamBadge } from './LiveStreamBadge';
import { useVoiceStore } from '../../stores/voiceStore';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      livekit: {
        ...actual.api.livekit,
        previewToken: vi.fn().mockResolvedValue({ token: 'mock-token', url: 'wss://lk.test' }),
      },
    },
  };
});

vi.mock('../../hooks/useLiveKit', () => ({
  getActiveRoom: vi.fn().mockReturnValue(null),
  parseIdentity: (identity: string) => ({ userId: identity.split(':')[0], username: identity.split(':')[1] || identity }),
}));

describe('LiveStreamBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useVoiceStore.setState({
      currentVoiceChannelId: null,
      isLiveKitConnected: false,
      activeDmCall: null,
      participants: [],
    });
  });

  it('renders the LIVE badge with accessible label', () => {
    render(
      <MemoryRouter>
        <LiveStreamBadge
          userId="user-1"
          displayName="renanzinho"
          avatar={null}
          channelId="chan-voice-1"
          channelName="Geral"
          spaceId="space-1"
          spaceName="Meu Espaço"
        />
      </MemoryRouter>
    );

    const badge = screen.getByRole('button', { name: /renanzinho/i });
    expect(badge).toBeInTheDocument();
  });

  it('opens hover preview card on mouse enter', async () => {
    vi.useFakeTimers();

    render(
      <MemoryRouter>
        <LiveStreamBadge
          userId="user-1"
          displayName="renanzinho"
          avatar={null}
          channelId="chan-voice-1"
          channelName="Geral"
          spaceId="space-1"
          spaceName="Meu Espaço"
        />
      </MemoryRouter>
    );

    const badge = screen.getByRole('button', { name: /renanzinho/i });
    fireEvent.mouseEnter(badge);

    // Fast-forward the 250ms debounce
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // The dialog should appear with user name, channel name, and action button
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('# Geral · Meu Espaço')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('prompts to switch call if user is already in another channel', async () => {
    useVoiceStore.setState({
      currentVoiceChannelId: 'other-channel-99',
      isLiveKitConnected: true,
    });

    render(
      <MemoryRouter>
        <LiveStreamBadge
          userId="user-1"
          displayName="renanzinho"
          avatar={null}
          channelId="chan-voice-1"
          channelName="Geral"
          spaceId="space-1"
          spaceName="Meu Espaço"
        />
      </MemoryRouter>
    );

    const badge = screen.getByRole('button', { name: /renanzinho/i });
    act(() => {
      fireEvent.click(badge);
    });

    // Should open the ConfirmDialog warning about switching calls
    expect(screen.getByText(/already in a call|já está em uma chamada/i)).toBeInTheDocument();
  });
});
