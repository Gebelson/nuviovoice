import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
      ensureContext: () => ({
        decodeAudioData: vi.fn().mockResolvedValue({
          duration: 3.5,
          numberOfChannels: 1,
          sampleRate: 44100,
          length: 44100 * 3.5,
          getChannelData: () => new Float32Array(44100 * 3.5),
        }),
        createBuffer: (channels: number, length: number, sampleRate: number) => ({
          numberOfChannels: channels,
          length,
          sampleRate,
          duration: length / sampleRate,
          getChannelData: () => new Float32Array(length),
        }),
        createBufferSource: () => ({
          buffer: null,
          connect: vi.fn(),
          disconnect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        }),
        createGain: () => ({
          gain: { value: 1, setValueAtTime: vi.fn() },
          connect: vi.fn(),
          disconnect: vi.fn(),
        }),
      }),
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
        createSound: vi.fn().mockImplementation((data) =>
          Promise.resolve({
            sound: {
              id: 'custom-sound-123',
              name: data.name,
              emoji: data.emoji || '🎵',
              category: data.category || 'Personalizados',
              scope: data.scope || 'personal',
              audioUrl: '/api/soundpad/audio/custom-sound-123.wav',
              durationMs: data.durationMs || 2000,
              defaultVolume: data.defaultVolume || 1.0,
              playCount: 0,
              createdAt: new Date().toISOString(),
            },
          })
        ),
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

describe('SoundpadAddModal hierarchy & prevent premature closing', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('pt');

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

  it('opens Adicionar Som modal when "+ Som" button is clicked and keeps Soundpad open', () => {
    const handleClose = vi.fn();
    render(<PopoverWrapper open={true} onClose={handleClose} />);

    const addBtn = screen.getByText('+').closest('button');
    expect(addBtn).toBeInTheDocument();

    fireEvent.click(addBtn!);

    expect(screen.getByText('Adicionar Som ao Soundpad')).toBeInTheDocument();
    expect(screen.getByText('Soundpad')).toBeInTheDocument();
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('preserves modal and form when clicking inside modal elements (name, emoji, category, volume)', () => {
    const handleClose = vi.fn();
    render(<PopoverWrapper open={true} onClose={handleClose} />);

    // Open modal
    const addBtn = screen.getByText('+').closest('button');
    fireEvent.click(addBtn!);

    const modal = screen.getByText('Adicionar Som ao Soundpad').closest('div.bg-surface-chat')!;
    expect(modal).toBeInTheDocument();

    // 1. Click on name input field
    const nameInput = screen.getByPlaceholderText('Ex: Risada Épica');
    fireEvent.mouseDown(nameInput);
    fireEvent.click(nameInput);

    expect(screen.getByText('Adicionar Som ao Soundpad')).toBeInTheDocument();
    expect(handleClose).not.toHaveBeenCalled();

    // 2. Type name
    fireEvent.change(nameInput, { target: { value: 'Risada Maligna' } });
    expect(nameInput).toHaveValue('Risada Maligna');

    // 3. Select an emoji inside modal
    const boomEmoji = within(modal).getByRole('button', { name: '💥' });
    fireEvent.mouseDown(boomEmoji);
    fireEvent.click(boomEmoji);
    expect(screen.getByText('Adicionar Som ao Soundpad')).toBeInTheDocument();
    expect(nameInput).toHaveValue('Risada Maligna');

    // 4. Change category
    const categoryInput = document.getElementById('soundpad-category-input') as HTMLInputElement;
    expect(categoryInput).toBeInTheDocument();
    fireEvent.mouseDown(categoryInput);
    fireEvent.change(categoryInput, { target: { value: 'Memes' } });
    expect(categoryInput).toHaveValue('Memes');

    // 5. Change scope / destination
    const destSelect = document.getElementById('soundpad-dest-select') as HTMLSelectElement;
    expect(destSelect).toBeInTheDocument();
    fireEvent.mouseDown(destSelect);
    fireEvent.change(destSelect, { target: { value: 'personal' } });
    expect(destSelect).toHaveValue('personal');

    // 6. Adjust volume slider
    const volumeSlider = screen.getByDisplayValue('1');
    fireEvent.mouseDown(volumeSlider);
    fireEvent.change(volumeSlider, { target: { value: '0.75' } });
    expect(volumeSlider).toHaveValue('0.75');

    // All elements remain mounted and parent Soundpad is still open
    expect(screen.getByText('Adicionar Som ao Soundpad')).toBeInTheDocument();
    expect(screen.getByText('Soundpad')).toBeInTheDocument();
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('closes ONLY the modal when pressing Escape with modal open, keeping Soundpad open', () => {
    const handleClose = vi.fn();
    render(<PopoverWrapper open={true} onClose={handleClose} />);

    // Open modal
    const addBtn = screen.getByText('+').closest('button');
    fireEvent.click(addBtn!);
    expect(screen.getByText('Adicionar Som ao Soundpad')).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' });

    // Modal is closed, but Soundpad remains open, handleClose was NOT called
    expect(screen.queryByText('Adicionar Som ao Soundpad')).not.toBeInTheDocument();
    expect(screen.getByText('Soundpad')).toBeInTheDocument();
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('closes ONLY the modal when clicking Cancelar button', () => {
    const handleClose = vi.fn();
    render(<PopoverWrapper open={true} onClose={handleClose} />);

    // Open modal
    const addBtn = screen.getByText('+').closest('button');
    fireEvent.click(addBtn!);

    const cancelBtn = screen.getByRole('button', { name: 'Cancelar' });
    fireEvent.click(cancelBtn);

    expect(screen.queryByText('Adicionar Som ao Soundpad')).not.toBeInTheDocument();
    expect(screen.getByText('Soundpad')).toBeInTheDocument();
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('closes ONLY the modal when clicking modal close X button', () => {
    const handleClose = vi.fn();
    render(<PopoverWrapper open={true} onClose={handleClose} />);

    // Open modal
    const addBtn = screen.getByText('+').closest('button');
    fireEvent.click(addBtn!);

    const modal = screen.getByText('Adicionar Som ao Soundpad').closest('div.bg-surface-chat')!;
    const closeBtn = within(modal).getByRole('button', { name: '✕' });
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Adicionar Som ao Soundpad')).not.toBeInTheDocument();
    expect(screen.getByText('Soundpad')).toBeInTheDocument();
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('closes ONLY the modal when clicking on the backdrop outside the dialog', () => {
    const handleClose = vi.fn();
    render(<PopoverWrapper open={true} onClose={handleClose} />);

    // Open modal
    const addBtn = screen.getByText('+').closest('button');
    fireEvent.click(addBtn!);

    const backdrop = screen.getByText('Adicionar Som ao Soundpad').closest('.fixed.inset-0');
    expect(backdrop).toBeInTheDocument();

    // MouseDown on backdrop
    fireEvent.mouseDown(backdrop!);

    expect(screen.queryByText('Adicionar Som ao Soundpad')).not.toBeInTheDocument();
    expect(screen.getByText('Soundpad')).toBeInTheDocument();
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('closes Soundpad when clicking outside after modal is closed', () => {
    const handleClose = vi.fn();
    render(<PopoverWrapper open={true} onClose={handleClose} />);

    // Click outside on document.body
    fireEvent.mouseDown(document.body);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('closes Soundpad when pressing Escape after modal is closed', () => {
    const handleClose = vi.fn();
    render(<PopoverWrapper open={true} onClose={handleClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('uploads a sound and automatically updates library list in Soundpad', async () => {
    const handleClose = vi.fn();
    render(<PopoverWrapper open={true} onClose={handleClose} />);

    // Open modal
    const addBtn = screen.getByText('+').closest('button');
    fireEvent.click(addBtn!);

    // Fill form
    const nameInput = screen.getByPlaceholderText('Ex: Risada Épica');
    fireEvent.change(nameInput, { target: { value: 'Meu Efeito Top' } });

    // Simulate audio file selection
    const file = new File(['fake-audio-content'], 'test.wav', { type: 'audio/wav' });
    file.arrayBuffer = () => Promise.resolve(new ArrayBuffer(8));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    fireEvent.change(fileInput, { target: { files: [file] } });

    // Wait for file parsing and decoding
    await waitFor(() => {
      expect(screen.getByText(/test\.wav/)).toBeInTheDocument();
    });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: 'Adicionar Som' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      // Modal should be closed
      expect(screen.queryByText('Adicionar Som ao Soundpad')).not.toBeInTheDocument();
      // Soundpad remains open
      expect(screen.getByText('Soundpad')).toBeInTheDocument();
    });

    // Soundpad library is updated with the new sound
    expect(screen.getByText('Meu Efeito Top')).toBeInTheDocument();
  });
});
