import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { CallActiveUpdateModal } from './CallActiveUpdateModal';

describe('CallActiveUpdateModal', () => {
  it('renders call warning and triggers onConfirm / onClose properly', () => {
    const handleClose = vi.fn();
    const handleConfirm = vi.fn();

    const { rerender } = render(
      <CallActiveUpdateModal
        isOpen={false}
        onClose={handleClose}
        onConfirm={handleConfirm}
      />,
    );

    expect(screen.queryByText(/Você está em uma chamada/i)).not.toBeInTheDocument();

    rerender(
      <CallActiveUpdateModal
        isOpen={true}
        onClose={handleClose}
        onConfirm={handleConfirm}
      />,
    );

    expect(screen.getByText(/Chamada em andamento/i)).toBeInTheDocument();
    expect(screen.getByText(/Você está em uma chamada. Reiniciar o Nuvio encerrará sua conexão./i)).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /Atualizar depois/i });
    fireEvent.click(cancelBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    const confirmBtn = screen.getByRole('button', { name: /Reiniciar e atualizar/i });
    fireEvent.click(confirmBtn);
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });
});
