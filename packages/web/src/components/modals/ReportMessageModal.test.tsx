import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ReportMessageModal } from './ReportMessageModal';
import { useUIStore } from '../../stores/uiStore';
import { api } from '../../api';

vi.mock('../../api', () => ({
  api: {
    reports: {
      reportMessage: vi.fn(),
    },
  },
}));

vi.mock('../../hooks/usePortalContainer', () => ({
  usePortalContainer: () => document.body,
}));

describe('ReportMessageModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUIStore.setState({
      activeModal: 'reportMessage',
      modalData: {
        messageId: 'msg_test_123',
        authorUsername: 'baduser',
        content: 'Conteudo abusivo para teste',
        isDm: false,
      },
    });
  });

  it('renders message preview and transparency banner', () => {
    render(<ReportMessageModal />);

    expect(screen.getByText(/Denunciar mensagem/i)).toBeInTheDocument();
    expect(screen.getByText(/Privacidade e Integridade Legal/i)).toBeInTheDocument();
    expect(screen.getByText(/@baduser/i)).toBeInTheDocument();
    expect(screen.getByText(/"Conteudo abusivo para teste"/i)).toBeInTheDocument();
  });

  it('submits report with selected category and context option', async () => {
    (api.reports.reportMessage as any).mockResolvedValueOnce({
      protocol: 'REP-20261101-ABCD9999',
      priority: 'urgent',
      status: 'pending',
    });

    render(<ReportMessageModal />);

    // Select category csam_exploitation
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'csam_exploitation' } });

    // Toggle include context
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    // Fill optional description
    const textarea = screen.getByPlaceholderText(/Forneça detalhes adicionais/i);
    fireEvent.change(textarea, { target: { value: 'Evidência urgente de abuso' } });

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Enviar denúncia/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.reports.reportMessage).toHaveBeenCalledWith({
        messageId: 'msg_test_123',
        category: 'csam_exploitation',
        description: 'Evidência urgente de abuso',
        includeContext: true,
      });
    });

    expect(useUIStore.getState().activeModal).toBeNull();
  });
});
