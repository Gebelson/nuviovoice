import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SpaceCoverEditor } from './SpaceCoverEditor';
import * as cropImageModule from '../../utils/cropImage';

vi.mock('../../utils/cropImage', () => ({
  cropImage: vi.fn(async () => new Blob(['fake-image'], { type: 'image/webp' })),
}));

// Mock react-easy-crop
vi.mock('react-easy-crop', () => {
  return {
    default: ({ onCropChange, onZoomChange, onCropComplete }: any) => (
      <div data-testid="mock-cropper">
        <button
          data-testid="simulate-crop"
          onClick={() => {
            onCropChange({ x: 10, y: 10 });
            onZoomChange(1.5);
            onCropComplete(
              { x: 5, y: 5, width: 90, height: 24 },
              { x: 100, y: 100, width: 900, height: 240 },
            );
          }}
        >
          Simulate Crop
        </button>
      </div>
    ),
  };
});

describe('SpaceCoverEditor', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    imageSrc: 'data:image/png;base64,mock',
    onSave: vi.fn(),
    spaceName: 'Nuvio Lounge',
    description: 'Espaço para testes e conversa',
    visibility: 'public',
    isJoined: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    class ValidMockImage {
      crossOrigin = '';
      naturalWidth = 1800;
      naturalHeight = 480;
      onload: ((ev: Event) => void) | null = null;
      onerror: ((ev: Event) => void) | null = null;
      set src(_val: string) {
        setTimeout(() => {
          if (this.onload) this.onload(new Event('load'));
        }, 10);
      }
    }

    vi.stubGlobal('Image', ValidMockImage);
  });

  it('renders correctly when open', async () => {
    render(<SpaceCoverEditor {...defaultProps} />);

    expect(screen.getByText(/Editar capa|Edit cover/i)).toBeInTheDocument();
    expect(screen.getByText(/15:4/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('mock-cropper')).toBeInTheDocument();
    });
  });

  it('shows error when image resolution is below 900x240 minimum', async () => {
    class SmallMockImage {
      crossOrigin = '';
      naturalWidth = 640;
      naturalHeight = 200;
      onload: ((ev: Event) => void) | null = null;
      onerror: ((ev: Event) => void) | null = null;
      set src(_val: string) {
        setTimeout(() => {
          if (this.onload) this.onload(new Event('load'));
        }, 10);
      }
    }

    vi.stubGlobal('Image', SmallMockImage);

    render(<SpaceCoverEditor {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /insuficientes|Insufficient/i }),
      ).toBeInTheDocument();
    });

    expect(screen.queryByTestId('mock-cropper')).not.toBeInTheDocument();
  });

  it('toggles between desktop and mobile preview tabs', async () => {
    render(<SpaceCoverEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-cropper')).toBeInTheDocument();
    });

    const mobileTab = screen.getByRole('button', { name: /Mobile|Celular/i });
    const desktopTab = screen.getByRole('button', { name: /Desktop/i });

    expect(mobileTab).toBeInTheDocument();
    expect(desktopTab).toBeInTheDocument();

    fireEvent.click(mobileTab);
    expect(screen.getByText(/Nuvio Lounge/)).toBeInTheDocument();

    fireEvent.click(desktopTab);
    expect(screen.getByText(/Nuvio Lounge/)).toBeInTheDocument();
  });

  it('handles zoom controls and reset framing', async () => {
    render(<SpaceCoverEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-cropper')).toBeInTheDocument();
    });

    const zoomInBtn = screen.getByTitle(/Aumentar zoom|Zoom in/i);
    const zoomOutBtn = screen.getByTitle(/Reduzir zoom|Zoom out/i);
    const resetBtn = screen.getByRole('button', { name: /Restaurar enquadramento|Reset framing/i });

    expect(zoomInBtn).toBeInTheDocument();
    expect(zoomOutBtn).toBeInTheDocument();
    expect(resetBtn).toBeInTheDocument();

    fireEvent.click(zoomInBtn);
    expect(screen.getByText('120%')).toBeInTheDocument();

    fireEvent.click(resetBtn);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('applies crop and calls onSave with 1800x480 webp image', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<SpaceCoverEditor {...defaultProps} onSave={onSave} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-cropper')).toBeInTheDocument();
    });

    // Simulate crop change
    fireEvent.click(screen.getByTestId('simulate-crop'));

    // Click save button
    const saveBtn = screen.getByRole('button', { name: /Salvar capa|Save cover/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(cropImageModule.cropImage).toHaveBeenCalledWith(
        defaultProps.imageSrc,
        { x: 100, y: 100, width: 900, height: 240 },
        'image/webp',
        expect.objectContaining({
          maxDimension: 1800,
          quality: 0.85,
          outputType: 'image/webp',
        }),
      );
      expect(onSave).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
