import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WinkUploadModal } from './WinkUploadModal';
import { api } from '../../../api/client';
import { Upload } from 'tus-js-client';

vi.mock('../../../api/client', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    api: {
      ...actual.api,
      adminWinks: {
        list: vi.fn(),
        upload: vi.fn(),
        get: vi.fn(),
        update: vi.fn(),
        publish: vi.fn(),
        unpublish: vi.fn(),
        retry: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
});

// Mock tus-js-client
let lastUploadInstance: any = null;
vi.mock('tus-js-client', () => {
  return {
    Upload: vi.fn().mockImplementation(function (file: any, options: any) {
      const instance = {
        file,
        options,
        url: 'http://localhost:3000/api/admin/winks/files/upload-123456',
        start: vi.fn().mockImplementation(() => {
          if (options.onProgress) {
            options.onProgress(2500000, 5000000);
          }
        }),
        abort: vi.fn(),
      };
      lastUploadInstance = instance;
      return instance;
    }),
  };
});

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      token: 'test-admin-token',
      user: { id: 'admin-1', username: 'admin' },
    }),
  },
}));

describe('WinkUploadModal Component', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    lastUploadInstance = null;
  });

  it('renders correctly when open', () => {
    render(
      <WinkUploadModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('Adicionar Novo Wink')).toBeInTheDocument();
    expect(screen.getByText('Arquivo de Vídeo (MOV ProRes 4444, MP4 ou WebM)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ex: iHazar Explosão')).toBeInTheDocument();
  });

  it('rejects files with invalid extensions', () => {
    render(
      <WinkUploadModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const invalidFile = new File(['dummy content'], 'script.sh', { type: 'application/x-sh' });

    fireEvent.change(input, { target: { files: [invalidFile] } });

    expect(screen.getByText(/Formato inválido/i)).toBeInTheDocument();
  });

  it('rejects files larger than 500 MB', () => {
    render(
      <WinkUploadModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const hugeFile = new File(['dummy'], 'huge.mov', { type: 'video/quicktime' });
    Object.defineProperty(hugeFile, 'size', { value: 501 * 1024 * 1024 });

    fireEvent.change(input, { target: { files: [hugeFile] } });

    expect(screen.getByText(/Arquivo muito grande/i)).toBeInTheDocument();
  });

  it('pre-fills name from file basename and shows formatted size', () => {
    render(
      <WinkUploadModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const movFile = new File(['content'], 'iHazar.mov', { type: 'video/quicktime' });
    Object.defineProperty(movFile, 'size', { value: 48559841 }); // 46.31 MB

    fireEvent.change(input, { target: { files: [movFile] } });

    const nameInput = screen.getByPlaceholderText('Ex: iHazar Explosão') as HTMLInputElement;
    expect(nameInput.value).toBe('iHazar');
    expect(screen.getByText(/46.31 MB/)).toBeInTheDocument();
    expect(screen.getByText(/MOV \(ProRes 4444 \/ Transparência\)/)).toBeInTheDocument();
  });

  it('initiates chunked Tus upload on submit and displays progress indicator', async () => {
    render(
      <WinkUploadModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const movFile = new File(['content'], 'iHazar.mov', { type: 'video/quicktime' });
    Object.defineProperty(movFile, 'size', { value: 5000000 }); // 5 MB

    fireEvent.change(input, { target: { files: [movFile] } });

    const submitBtn = screen.getByText('Confirmar Envio');
    fireEvent.click(submitBtn);

    expect(Upload).toHaveBeenCalled();
    expect(lastUploadInstance.start).toHaveBeenCalled();

    // Verify progress UI appears
    await waitFor(() => {
      expect(screen.getAllByText(/50%/).length).toBeGreaterThan(0);
      expect(screen.getByText('Pausar')).toBeInTheDocument();
      expect(screen.getByText('Cancelar Envio')).toBeInTheDocument();
    });
  });

  it('supports pausing and resuming the upload', async () => {
    render(
      <WinkUploadModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const movFile = new File(['content'], 'iHazar.mov', { type: 'video/quicktime' });
    Object.defineProperty(movFile, 'size', { value: 5000000 });

    fireEvent.change(input, { target: { files: [movFile] } });
    fireEvent.click(screen.getByText('Confirmar Envio'));

    await waitFor(() => {
      expect(screen.getByText('Pausar')).toBeInTheDocument();
    });

    // Click pause
    fireEvent.click(screen.getByText('Pausar'));
    expect(lastUploadInstance.abort).toHaveBeenCalledWith(false);

    await waitFor(() => {
      expect(screen.getByText('Retomar')).toBeInTheDocument();
    });

    // Click resume
    fireEvent.click(screen.getByText('Retomar'));
    expect(lastUploadInstance.start).toHaveBeenCalled();
  });

  it('supports cancelling upload and calling abort(true) to delete server partial data', async () => {
    render(
      <WinkUploadModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const movFile = new File(['content'], 'iHazar.mov', { type: 'video/quicktime' });
    Object.defineProperty(movFile, 'size', { value: 5000000 });

    fireEvent.change(input, { target: { files: [movFile] } });
    fireEvent.click(screen.getByText('Confirmar Envio'));

    await waitFor(() => {
      expect(screen.getByText('Cancelar Envio')).toBeInTheDocument();
    });

    // Click cancel
    fireEvent.click(screen.getByText('Cancelar Envio'));
    expect(lastUploadInstance.abort).toHaveBeenCalledWith(true);

    await waitFor(() => {
      expect(screen.queryByText('Cancelar Envio')).not.toBeInTheDocument();
    });
  });

  it('finalizes upload with api.adminWinks.upload when Tus completes', async () => {
    (api.adminWinks.upload as any).mockResolvedValue({
      id: 'wink-ihazar-1',
      name: 'iHazar',
      category: 'humor',
      status: 'pending',
    });

    render(
      <WinkUploadModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const movFile = new File(['content'], 'iHazar.mov', { type: 'video/quicktime' });
    Object.defineProperty(movFile, 'size', { value: 5000000 });

    fireEvent.change(input, { target: { files: [movFile] } });
    fireEvent.click(screen.getByText('Confirmar Envio'));

    // Trigger onSuccess on tus upload instance
    lastUploadInstance.options.onSuccess({
      lastResponse: {
        getBody: () => JSON.stringify({ uploadId: 'upload-ihazar-99', filename: 'iHazar.mov' }),
      },
    });

    await waitFor(() => {
      expect(api.adminWinks.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadId: 'upload-ihazar-99',
          name: 'iHazar',
          category: 'humor',
        })
      );
    });
  });

  it('displays friendly backend update message on 404 error and offers retry without false progress claims', async () => {
    (Upload as any).mockImplementationOnce(function (file: any, options: any) {
      const instance = {
        file,
        options,
        url: null,
        start: vi.fn().mockImplementation(() => {
          const error: any = new Error('tus: unexpected response while creating upload, response code: 404, response text: {"error":"Not found","statusCode":404}');
          error.originalResponse = { getStatus: () => 404 };
          options.onError(error);
        }),
        abort: vi.fn(),
      };
      lastUploadInstance = instance;
      return instance;
    });

    render(
      <WinkUploadModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const movFile = new File(['content'], 'iHazar.mov', { type: 'video/quicktime' });
    Object.defineProperty(movFile, 'size', { value: 5000000 });

    fireEvent.change(input, { target: { files: [movFile] } });
    fireEvent.click(screen.getByText('Confirmar Envio'));

    await waitFor(() => {
      expect(screen.getByText(/O serviço de upload de Winks não foi encontrado no servidor \(HTTP 404\)/i)).toBeInTheDocument();
      expect(screen.queryByText(/O progresso foi mantido/i)).not.toBeInTheDocument();
      expect(screen.queryByText('Progresso do envio')).not.toBeInTheDocument();
      expect(screen.getAllByText('Tentar Novamente').length).toBeGreaterThan(0);
      expect(screen.queryByText('Retomar Envio')).not.toBeInTheDocument();
    });

    const error404: any = new Error('HTTP 404 Not Found');
    error404.originalResponse = { getStatus: () => 404 };
    expect(lastUploadInstance.options.onShouldRetry(error404)).toBe(false);
  });

  it('displays resumable option when network fails after partial upload', async () => {
    (Upload as any).mockImplementationOnce(function (file: any, options: any) {
      const instance = {
        file,
        options,
        url: 'http://localhost:3000/api/admin/winks/files/upload-999',
        start: vi.fn().mockImplementation(() => {
          options.onProgress(1000000, 5000000);
          const error: any = new Error('tus: failed to upload chunk at http://localhost:3000/api/admin/winks/files/upload-999');
          options.onError(error);
        }),
        abort: vi.fn(),
      };
      lastUploadInstance = instance;
      return instance;
    });

    render(
      <WinkUploadModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const movFile = new File(['content'], 'iHazar.mov', { type: 'video/quicktime' });
    Object.defineProperty(movFile, 'size', { value: 5000000 });

    fireEvent.change(input, { target: { files: [movFile] } });
    fireEvent.click(screen.getByText('Confirmar Envio'));

    await waitFor(() => {
      expect(screen.getByText(/O progresso foi mantido/i)).toBeInTheDocument();
      expect(screen.getAllByText('Retomar Envio').length).toBeGreaterThan(0);
      expect(screen.queryByText('Tentar Novamente')).not.toBeInTheDocument();
    });
  });
});
