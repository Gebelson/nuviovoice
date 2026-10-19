import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { DownloadPage } from './DownloadPage';
import * as platformModule from '../../platform/platform';

describe('DownloadPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders correctly on Web with header, mockup, texts and download button', () => {
    vi.spyOn(platformModule, 'isElectron').mockReturnValue(false);

    render(
      <MemoryRouter initialEntries={['/download']}>
        <DownloadPage />
      </MemoryRouter>,
    );

    // Header title and icon
    expect(screen.getByTestId('download-header-title')).toHaveTextContent(/Download|Baixar/i);

    // Mockup image
    const mockupImg = screen.getByRole('img');
    expect(mockupImg).toBeInTheDocument();
    expect(mockupImg).toHaveAttribute('src', '/images/mockup-laptop-monitor.png');

    // Hero title in uppercase
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/BATE-PAPO|DIVERSÃO|JOGOS|GROUP CHAT/i);

    // Download CTA button for Windows
    const downloadBtn = screen.getByTestId('download-windows-btn');
    expect(downloadBtn).toBeInTheDocument();
    expect(downloadBtn).toHaveAttribute('href', expect.stringMatching(/\/api\/download\/windows|Nuvio-Setup\.exe/));
    expect(downloadBtn).toHaveTextContent(/Baixar para Windows|Download for Windows/i);
  });

  it('redirects to /channels/@me when accessed inside Desktop app (isElectron === true)', () => {
    vi.spyOn(platformModule, 'isElectron').mockReturnValue(true);

    render(
      <MemoryRouter initialEntries={['/download']}>
        <Routes>
          <Route path="/download" element={<DownloadPage />} />
          <Route path="/channels/@me" element={<div data-testid="fallback-me">Redirected to Me</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('fallback-me')).toBeInTheDocument();
    expect(screen.queryByTestId('download-windows-btn')).not.toBeInTheDocument();
  });

  it('displays "em breve" message when no release is available', async () => {
    vi.spyOn(platformModule, 'isElectron').mockReturnValue(false);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = String(input);
      if (url.includes('/api/download/info')) {
        return {
          ok: true,
          json: async () => ({ available: false }),
        } as any;
      }
      return {
        ok: false,
        status: 404,
      } as any;
    });

    render(
      <MemoryRouter initialEntries={['/download']}>
        <DownloadPage />
      </MemoryRouter>,
    );

    const msg = await screen.findByTestId('download-unavailable-msg');
    expect(msg).toBeInTheDocument();
    expect(msg).toHaveTextContent(/disponível em breve|available soon/i);
    expect(screen.queryByTestId('download-windows-btn')).not.toBeInTheDocument();
  });
});
