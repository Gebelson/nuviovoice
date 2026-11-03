import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminWinksPanel } from './AdminWinksPanel';
import { api } from '../../../api/client';
import type { OfficialWink, WinkAdminMetrics } from '@concord/shared/src/winks';

vi.mock('../../../api/client', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    api: {
      ...actual.api,
      adminWinks: {
        list: vi.fn(),
        upload: vi.fn(),
        publish: vi.fn(),
        unpublish: vi.fn(),
        retry: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
});

const mockMetrics: WinkAdminMetrics = {
  total: 7,
  published: 5,
  processing: 0,
  drafts: 2,
  failed: 0,
};

const mockWinks: OfficialWink[] = [
  {
    id: 'wink-alpha-test',
    name: '3D Character Wave',
    category: 'humor',
    description: 'High quality 3D transparent animation',
    durationMs: 3500,
    hasAudio: true,
    hasAlpha: true,
    previewEmoji: '👋',
    originalFilename: 'wave_prores.mov',
    webmUrl: '/api/winks/media/wink-alpha-test.webm',
    mp4Url: '/api/winks/media/wink-alpha-test.mp4',
    thumbnailUrl: '/api/winks/media/wink-alpha-test_thumb.webp',
    status: 'completed',
    published: true,
  },
  {
    id: 'wink-draft',
    name: 'Confetti Draft',
    category: 'celebration',
    description: 'Festive burst',
    durationMs: 4000,
    hasAudio: false,
    hasAlpha: false,
    previewEmoji: '🎉',
    status: 'completed',
    published: false,
  },
];

describe('AdminWinksPanel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.adminWinks.list as any).mockResolvedValue({
      winks: mockWinks,
      metrics: mockMetrics,
    });
  });

  it('renders the header and metrics correctly', async () => {
    render(<AdminWinksPanel />);

    expect(screen.getByText('Gerenciamento de Winks Oficiais')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('3D Character Wave')).toBeInTheDocument();
      expect(screen.getByText('Confetti Draft')).toBeInTheDocument();
    });

    // Check metrics counts
    expect(screen.getByText('5')).toBeInTheDocument(); // published count
    expect(screen.getByText('2')).toBeInTheDocument(); // drafts count
  });

  it('displays transparency and audio badges', async () => {
    render(<AdminWinksPanel />);

    await waitFor(() => {
      expect(screen.getByText('✨ Transparente')).toBeInTheDocument();
      expect(screen.getByText('Opaco')).toBeInTheDocument();
      expect(screen.getByText('🔊 Com Áudio')).toBeInTheDocument();
    });
  });

  it('opens WinkUploadModal when clicking + Adicionar Wink', async () => {
    render(<AdminWinksPanel />);

    const addButton = screen.getByText('+ Adicionar Wink');
    fireEvent.click(addButton);

    expect(screen.getByText('Adicionar Novo Wink')).toBeInTheDocument();
    expect(screen.getByText('Arquivo de Vídeo (MOV ProRes 4444, MP4 ou WebM)')).toBeInTheDocument();
  });

  it('handles unpublishing a wink', async () => {
    (api.adminWinks.unpublish as any).mockResolvedValue({});
    render(<AdminWinksPanel />);

    await waitFor(() => {
      expect(screen.getByText('Despublicar')).toBeInTheDocument();
    });

    const unpublishBtn = screen.getByText('Despublicar');
    fireEvent.click(unpublishBtn);

    await waitFor(() => {
      expect(api.adminWinks.unpublish).toHaveBeenCalledWith('wink-alpha-test');
    });
  });
});
