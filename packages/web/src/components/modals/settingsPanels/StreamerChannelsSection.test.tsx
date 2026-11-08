import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StreamerChannelsSection, formatChannelError } from './StreamerChannelsSection';
import { api } from '../../../api/client';
import { useAuthStore } from '../../../stores/authStore';
import { useSpaceStore } from '../../../stores/spaceStore';
import { useLiveStreamStore } from '../../../stores/liveStreamStore';
import type { StreamerChannel } from '@concord/shared';

describe('StreamerChannelsSection Component & Validation Suite', () => {
  const mockUser = {
    id: 'user_123',
    username: 'nuvioplayer',
    displayName: 'Nuvio Player',
    isAdmin: 0,
  };

  const sampleChannels: StreamerChannel[] = [
    {
      id: 'ch_twitch_1',
      userId: 'user_123',
      platform: 'twitch',
      channelId: 'gaules',
      channelName: 'gaules',
      channelUrl: 'https://twitch.tv/gaules',
      linkedSpaceId: null,
      isLive: 1,
      streamTitle: 'Major de CS2 ao vivo com a Tribo!',
      streamGame: 'Counter-Strike 2',
      streamThumbnail: 'https://thumb.twitch.tv/gaules.jpg',
      viewerCount: 45000,
      startedAt: Date.now() - 3600000,
      lastCheckedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'ch_kick_1',
      userId: 'user_123',
      platform: 'kick',
      channelId: 'coringa',
      channelName: 'coringa',
      channelUrl: 'https://kick.com/coringa',
      linkedSpaceId: 'space_pub_1',
      isLive: 0,
      streamTitle: null,
      streamGame: null,
      streamThumbnail: null,
      viewerCount: 0,
      startedAt: null,
      lastCheckedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();

    useAuthStore.setState({ user: mockUser as any });
    useSpaceStore.setState({
      spaces: [
        { id: 'space_pub_1', name: 'Comunidade Oficial do Coringa', ownerId: 'user_123', type: 'public' } as any,
      ],
    });
    useLiveStreamStore.setState({
      loadLiveStreams: vi.fn().mockResolvedValue(undefined),
    });
  });

  // 1. Error formatter sanitizer tests
  it('sanitizes raw technical "Not found" and 404 into user-friendly Portuguese message', () => {
    const err404 = { status: 404, message: 'Not found' };
    const formatted404 = formatChannelError(err404);
    expect(formatted404.type).toBe('backend');
    expect(formatted404.title).toBe('Serviço Nuvio Ao Vivo indisponível');
    expect(formatted404.message).toContain('temporariamente indisponível no servidor ou em fase de atualização');
    expect(formatted404.message).not.toContain('Not found');

    const errRawString = formatChannelError('HTTP 404: Not found');
    expect(errRawString.type).toBe('backend');
    expect(errRawString.message).not.toContain('Not found');

    const errNetwork = formatChannelError(new Error('Failed to fetch'));
    expect(errNetwork.type).toBe('network');
    expect(errNetwork.title).toBe('Falha de conexão');

    const errAuth = formatChannelError({ status: 401, message: 'Unauthorized' });
    expect(errAuth.type).toBe('auth');
    expect(errAuth.title).toBe('Autenticação necessária');
  });

  // 2. Empty state
  it('renders clean empty state when user has no linked channels', async () => {
    vi.spyOn(api.live, 'getMyChannels').mockResolvedValueOnce({ channels: [] });

    render(<StreamerChannelsSection />);

    // Should show loading first or directly finish
    await waitFor(() => {
      expect(screen.getByTestId('channels-empty')).toBeInTheDocument();
    });

    expect(screen.getByText('Você ainda não vinculou nenhum canal de transmissão.')).toBeInTheDocument();
    expect(screen.queryByTestId('channels-load-error')).not.toBeInTheDocument();
    expect(screen.queryByText(/Not found/i)).not.toBeInTheDocument();
  });

  // 3. Channels loaded list
  it('renders loaded channels with platform badges, live status and viewer counts', async () => {
    vi.spyOn(api.live, 'getMyChannels').mockResolvedValueOnce({ channels: sampleChannels });

    render(<StreamerChannelsSection />);

    await waitFor(() => {
      expect(screen.getByTestId('channels-list')).toBeInTheDocument();
    });

    // Twitch live channel
    expect(screen.getByText('gaules')).toBeInTheDocument();
    expect(screen.getByText(/Ao Vivo \(45000 espectadores\)/i)).toBeInTheDocument();
    expect(screen.getByText('Major de CS2 ao vivo com a Tribo!')).toBeInTheDocument();

    // Kick offline channel
    expect(screen.getByText('coringa')).toBeInTheDocument();
    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.getByText(/Espaço vinculado: Comunidade Oficial do Coringa/i)).toBeInTheDocument();
  });

  // 4. Link Twitch channel
  it('links a Twitch channel successfully and refreshes the list', async () => {
    vi.spyOn(api.live, 'getMyChannels')
      .mockResolvedValueOnce({ channels: [] })
      .mockResolvedValueOnce({ channels: [sampleChannels[0]] });

    const linkSpy = vi.spyOn(api.live, 'linkChannel').mockResolvedValueOnce({
      channel: sampleChannels[0],
    });

    render(<StreamerChannelsSection />);

    await waitFor(() => {
      expect(screen.getByTestId('channels-empty')).toBeInTheDocument();
    });

    const input = screen.getByTestId('channel-input');
    fireEvent.change(input, { target: { value: 'https://twitch.tv/gaules' } });

    const submitBtn = screen.getByTestId('submit-channel-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(linkSpy).toHaveBeenCalledWith({
        platform: 'twitch',
        channelInput: 'https://twitch.tv/gaules',
        linkedSpaceId: undefined,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('channel-action-success')).toBeInTheDocument();
    });
    expect(screen.getByText(/Canal gaules \(Twitch\) vinculado com sucesso!/i)).toBeInTheDocument();
  });

  // 5. Link Kick channel
  it('links a Kick channel successfully when Kick platform is selected', async () => {
    vi.spyOn(api.live, 'getMyChannels')
      .mockResolvedValueOnce({ channels: [] })
      .mockResolvedValueOnce({ channels: [sampleChannels[1]] });

    const linkSpy = vi.spyOn(api.live, 'linkChannel').mockResolvedValueOnce({
      channel: sampleChannels[1],
    });

    render(<StreamerChannelsSection />);

    await waitFor(() => {
      expect(screen.getByTestId('channels-empty')).toBeInTheDocument();
    });

    // Select Kick button
    const kickBtn = screen.getByTestId('platform-btn-kick');
    fireEvent.click(kickBtn);

    const input = screen.getByTestId('channel-input');
    fireEvent.change(input, { target: { value: 'coringa' } });

    const submitBtn = screen.getByTestId('submit-channel-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(linkSpy).toHaveBeenCalledWith({
        platform: 'kick',
        channelInput: 'coringa',
        linkedSpaceId: undefined,
      });
    });
  });

  // 6. Link YouTube channel
  it('links a YouTube channel successfully when YouTube platform is selected', async () => {
    const ytChannel: StreamerChannel = {
      id: 'ch_yt_1',
      userId: 'user_123',
      platform: 'youtube',
      channelId: 'alanzoka',
      channelName: 'alanzoka',
      channelUrl: 'https://www.youtube.com/@alanzoka',
      linkedSpaceId: null,
      isLive: 1,
      streamTitle: 'Gameplay Ao Vivo',
      streamGame: 'Resident Evil',
      streamThumbnail: null,
      viewerCount: 12000,
      startedAt: Date.now(),
      lastCheckedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    vi.spyOn(api.live, 'getMyChannels')
      .mockResolvedValueOnce({ channels: [] })
      .mockResolvedValueOnce({ channels: [ytChannel] });

    const linkSpy = vi.spyOn(api.live, 'linkChannel').mockResolvedValueOnce({
      channel: ytChannel,
    });

    render(<StreamerChannelsSection />);

    await waitFor(() => {
      expect(screen.getByTestId('channels-empty')).toBeInTheDocument();
    });

    // Select YouTube button
    const ytBtn = screen.getByTestId('platform-btn-youtube');
    fireEvent.click(ytBtn);

    const input = screen.getByTestId('channel-input');
    fireEvent.change(input, { target: { value: 'https://www.youtube.com/@alanzoka' } });

    const submitBtn = screen.getByTestId('submit-channel-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(linkSpy).toHaveBeenCalledWith({
        platform: 'youtube',
        channelInput: 'https://www.youtube.com/@alanzoka',
        linkedSpaceId: undefined,
      });
    });
  });

  // 7. Platform mismatch validation
  it('rejects submission with clear error when selected platform does not match pasted link', async () => {
    vi.spyOn(api.live, 'getMyChannels').mockResolvedValueOnce({ channels: [] });
    const linkSpy = vi.spyOn(api.live, 'linkChannel');

    render(<StreamerChannelsSection />);

    await waitFor(() => {
      expect(screen.getByTestId('channels-empty')).toBeInTheDocument();
    });

    // Twitch selected by default, but user pastes a Kick URL
    const input = screen.getByTestId('channel-input');
    fireEvent.change(input, { target: { value: 'https://kick.com/streamer' } });

    const submitBtn = screen.getByTestId('submit-channel-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId('channel-action-error')).toBeInTheDocument();
    });

    expect(screen.getByText(/Você selecionou a plataforma Twitch, mas inseriu um link da Kick/i)).toBeInTheDocument();
    expect(linkSpy).not.toHaveBeenCalled();
  });

  // 8. Invalid channel characters validation
  it('rejects invalid channel names with client-side validation', async () => {
    vi.spyOn(api.live, 'getMyChannels').mockResolvedValueOnce({ channels: [] });
    const linkSpy = vi.spyOn(api.live, 'linkChannel');

    render(<StreamerChannelsSection />);

    await waitFor(() => {
      expect(screen.getByTestId('channels-empty')).toBeInTheDocument();
    });

    // Twitch usernames cannot have spaces
    const input = screen.getByTestId('channel-input');
    fireEvent.change(input, { target: { value: 'nome com espacos' } });

    const submitBtn = screen.getByTestId('submit-channel-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId('channel-action-error')).toBeInTheDocument();
    });

    expect(screen.getByText(/Nome de canal da Twitch inválido/i)).toBeInTheDocument();
    expect(linkSpy).not.toHaveBeenCalled();
  });

  // 9. Duplicate channel prevention
  it('prevents linking an already linked channel', async () => {
    vi.spyOn(api.live, 'getMyChannels').mockResolvedValueOnce({ channels: sampleChannels });
    const linkSpy = vi.spyOn(api.live, 'linkChannel');

    render(<StreamerChannelsSection />);

    await waitFor(() => {
      expect(screen.getByTestId('channels-list')).toBeInTheDocument();
    });

    const input = screen.getByTestId('channel-input');
    fireEvent.change(input, { target: { value: 'gaules' } });

    const submitBtn = screen.getByTestId('submit-channel-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId('channel-action-error')).toBeInTheDocument();
    });

    expect(screen.getByText(/Você já vinculou este canal da Twitch/i)).toBeInTheDocument();
    expect(linkSpy).not.toHaveBeenCalled();
  });

  // 10. Backend Unavailable / 404 (Never shows "Not found")
  it('handles backend 404 / unavailable gracefully with Portuguese message and retry button', async () => {
    const error404: any = new Error('Not found');
    error404.status = 404;

    vi.spyOn(api.live, 'getMyChannels').mockRejectedValueOnce(error404);

    render(<StreamerChannelsSection />);

    await waitFor(() => {
      expect(screen.getByTestId('channels-load-error')).toBeInTheDocument();
    });

    // Must NOT display raw "Not found"
    expect(screen.queryByText(/^Not found$/i)).not.toBeInTheDocument();
    expect(screen.getByText('Serviço Nuvio Ao Vivo indisponível')).toBeInTheDocument();
    expect(screen.getByText(/O serviço Nuvio Ao Vivo está temporariamente indisponível no servidor/i)).toBeInTheDocument();

    // Verify retry button is rendered and functional
    const retryBtn = screen.getByTestId('retry-channels-btn');
    expect(retryBtn).toBeInTheDocument();

    // Form must remain visible even if channels failed to load
    expect(screen.getByTestId('channel-link-form')).toBeInTheDocument();

    // Mock successful retry
    vi.spyOn(api.live, 'getMyChannels').mockResolvedValueOnce({ channels: [] });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByTestId('channels-empty')).toBeInTheDocument();
    });
  });

  // 11. Unlink channel with confirmation
  it('unlinks a channel with confirmation dialog', async () => {
    vi.spyOn(api.live, 'getMyChannels')
      .mockResolvedValueOnce({ channels: [sampleChannels[0]] })
      .mockResolvedValueOnce({ channels: [] });

    const unlinkSpy = vi.spyOn(api.live, 'unlinkChannel').mockResolvedValueOnce({ success: true });

    render(<StreamerChannelsSection />);

    await waitFor(() => {
      expect(screen.getByTestId('channel-card-ch_twitch_1')).toBeInTheDocument();
    });

    // Click unlink icon button to trigger confirmation prompt
    const unlinkIconBtn = screen.getByTitle('Desvincular canal');
    fireEvent.click(unlinkIconBtn);

    // Confirmation container should now be visible
    expect(screen.getByTestId('confirm-unlink-ch_twitch_1')).toBeInTheDocument();
    expect(screen.getByText(/Tem certeza que deseja desvincular/i)).toBeInTheDocument();

    // Click the actual Desvincular confirm button
    const confirmBtn = screen.getByTestId('btn-confirm-unlink-ch_twitch_1');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(unlinkSpy).toHaveBeenCalledWith('ch_twitch_1');
    });

    await waitFor(() => {
      expect(screen.getByTestId('channel-action-success')).toBeInTheDocument();
    });
    expect(screen.getByText(/Canal gaules desvinculado com sucesso/i)).toBeInTheDocument();
  });

  // 12. Refresh channel status
  it('refreshes a channel status when refresh button is clicked', async () => {
    vi.spyOn(api.live, 'getMyChannels').mockResolvedValue({ channels: [sampleChannels[0]] });
    const refreshSpy = vi.spyOn(api.live, 'refreshChannel').mockResolvedValueOnce({
      channel: { ...sampleChannels[0], viewerCount: 52000 },
      changed: true,
    });

    render(<StreamerChannelsSection />);

    await waitFor(() => {
      expect(screen.getByTestId('channel-card-ch_twitch_1')).toBeInTheDocument();
    });

    const refreshBtn = screen.getByTitle('Verificar status da live agora');
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(refreshSpy).toHaveBeenCalledWith('ch_twitch_1');
    });
  });
});
