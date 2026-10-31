import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useRef } from 'react';
import i18n from 'i18next';
import { SoundpadPopover } from './SoundpadPopover';
import { useSoundpadStore, DEFAULT_OFFICIAL_SOUNDS } from '../../stores/soundpadStore';
import { useVoiceStore } from '../../stores/voiceStore';

vi.mock('../../hooks/useFloatingPosition', () => ({
  useFloatingPosition: () => ({ coords: { x: 100, y: 200 }, placement: 'top' }),
}));

vi.mock('../../hooks/usePortalContainer', () => ({
  usePortalContainer: () => document.body,
}));

vi.mock('../../audio/AudioManager', () => ({
  AudioManager: {
    getInstance: () => ({
      playSoundpad: vi.fn().mockResolvedValue({ stop: vi.fn(), duration: 2.5 }),
      stopAllSoundpad: vi.fn(),
      setSoundpadVolume: vi.fn(),
      setMicMuted: vi.fn(),
      getIsMicMuted: vi.fn().mockReturnValue(false),
    }),
  },
}));

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      soundpad: {
        getSounds: vi.fn().mockResolvedValue({ sounds: [], favorites: [] }),
        toggleFavorite: vi.fn().mockResolvedValue({ favorited: true }),
        recordPlay: vi.fn().mockResolvedValue({ success: true }),
        uploadSound: vi.fn().mockResolvedValue({ sound: {} }),
        deleteSound: vi.fn().mockResolvedValue({ success: true }),
      },
    },
  };
});

function PopoverWrapper({ open, onClose }: { open: boolean; onClose: () => void }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button ref={btnRef}>Anchor</button>
      <SoundpadPopover
        open={open}
        onClose={onClose}
        anchorRef={btnRef}
        spaceId="space-1"
        channelId="voice-1"
        canManageSoundpad={true}
      />
    </div>
  );
}

describe('SoundpadPopover', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('pt');

    useVoiceStore.setState({
      soundpadVolume: 80,
      activeRoom: null,
      isMuted: false,
    });

    useSoundpadStore.setState({
      sounds: DEFAULT_OFFICIAL_SOUNDS,
      favorites: new Set<string>(),
      playingSoundId: null,
      searchQuery: '',
      activeCategory: 'all',
      expandedSections: { recent: true, personal: true, official: true, space: true },
      isLoading: false,
    });
  });

  it('renders correctly when open with search input and official sounds', () => {
    const handleClose = vi.fn();
    render(<PopoverWrapper open={true} onClose={handleClose} />);

    expect(screen.getByText('Soundpad')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Encontre o som perfeito')).toBeInTheDocument();
    expect(screen.getByText(/Sons do Nuvio/)).toBeInTheDocument();
    expect(screen.getByText('Airhorn')).toBeInTheDocument();
    expect(screen.getByText('Vine Boom')).toBeInTheDocument();
  });

  it('filters sounds by search query', () => {
    const handleClose = vi.fn();
    render(<PopoverWrapper open={true} onClose={handleClose} />);

    const searchInput = screen.getByPlaceholderText('Encontre o som perfeito');
    fireEvent.change(searchInput, { target: { value: 'Airhorn' } });

    expect(screen.getByText('Airhorn')).toBeInTheDocument();
    expect(screen.queryByText('Vine Boom')).not.toBeInTheDocument();
  });

  it('filters sounds by category chip', () => {
    const handleClose = vi.fn();
    render(<PopoverWrapper open={true} onClose={handleClose} />);

    const chipNuvio = screen.getByRole('button', { name: 'Nuvio' });
    fireEvent.click(chipNuvio);

    expect(useSoundpadStore.getState().activeCategory).toBe('official');
    expect(screen.getByText('Airhorn')).toBeInTheDocument();
  });

  it('triggers playSound on card click', () => {
    const handleClose = vi.fn();
    render(<PopoverWrapper open={true} onClose={handleClose} />);

    const airhorn = screen.getByText('Airhorn');
    fireEvent.click(airhorn);

    expect(useSoundpadStore.getState().playingSoundId).toBe('official-airhorn');
  });

  it('stops sound when clicking already playing sound card', () => {
    useSoundpadStore.setState({ playingSoundId: 'official-airhorn' });

    const handleClose = vi.fn();
    render(<PopoverWrapper open={true} onClose={handleClose} />);

    const airhorn = screen.getByText('Airhorn');
    fireEvent.click(airhorn);

    expect(useSoundpadStore.getState().playingSoundId).toBeNull();
  });

  it('toggles favorite on star button click', () => {
    const handleClose = vi.fn();
    render(<PopoverWrapper open={true} onClose={handleClose} />);

    const favBtns = screen.getAllByTitle('Adicionar aos favoritos');
    expect(favBtns.length).toBeGreaterThan(0);

    fireEvent.click(favBtns[0]);
    expect(useSoundpadStore.getState().favorites.size).toBe(1);
  });

  it('toggles volume slider when volume button is clicked and updates volume', () => {
    const handleClose = vi.fn();
    render(<PopoverWrapper open={true} onClose={handleClose} />);

    // Click volume toggle button
    const volBtn = screen.getByTitle('Volume do Soundpad');
    fireEvent.click(volBtn);

    const slider = screen.getByRole('slider');
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveValue('80');

    fireEvent.change(slider, { target: { value: '60' } });
    expect(useVoiceStore.getState().soundpadVolume).toBe(60);
  });

  it('toggles collapsible section when header is clicked', () => {
    const handleClose = vi.fn();
    render(<PopoverWrapper open={true} onClose={handleClose} />);

    const officialSectionHeader = screen.getByText(/Sons do Nuvio/).closest('button');
    expect(officialSectionHeader).toBeInTheDocument();

    // Collapse section
    fireEvent.click(officialSectionHeader!);
    expect(useSoundpadStore.getState().expandedSections.official).toBe(false);

    // Expand section
    fireEvent.click(officialSectionHeader!);
    expect(useSoundpadStore.getState().expandedSections.official).toBe(true);
  });
});
