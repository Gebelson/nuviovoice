import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { VerificationsPanel } from './VerificationsPanel';
import { api } from '../../../api/client';

vi.mock('../../../api/client', () => ({
  api: {
    adminVerifications: {
      getMetrics: vi.fn(),
      getRequests: vi.fn(),
      getRequest: vi.fn(),
      approveRequest: vi.fn(),
      rejectRequest: vi.fn(),
      requestInfo: vi.fn(),
      revoke: vi.fn(),
      grantOfficial: vi.fn(),
      getAudit: vi.fn(),
      getVerifiedEntities: vi.fn(),
    },
  },
}));

describe('VerificationsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (api.adminVerifications.getMetrics as any).mockResolvedValue({
      totalVerified: 12,
      verifiedUsers: 8,
      verifiedSpaces: 4,
      verifiedPersonal: 5,
      verifiedCreators: 2,
      verifiedOrganizations: 4,
      verifiedOfficial: 1,
      pendingRequests: 3,
      underReviewRequests: 1,
      rejectedRequests: 2,
      revokedVerifications: 1,
    });

    (api.adminVerifications.getRequests as any).mockResolvedValue({
      requests: [
        {
          id: 'vreq_101',
          entityType: 'user',
          targetId: 'u_123',
          category: 'creator',
          publicName: 'Canal Tech Inovação',
          activityDescription: 'Canal de tecnologia com 500k inscritos e conteúdo diário.',
          officialWebsite: 'https://techinovacao.com.br',
          status: 'pending',
          createdAt: Date.now() - 3600000,
          updatedAt: Date.now() - 3600000,
        },
      ],
    });

    (api.adminVerifications.getVerifiedEntities as any).mockResolvedValue({
      verified: [
        {
          id: 'u_admin',
          username: 'gebelson',
          displayName: 'Gebelson',
          verificationCategory: 'official',
          createdAt: Date.now() - 86400000,
        },
      ],
    });

    (api.adminVerifications.getAudit as any).mockResolvedValue({
      logs: [
        {
          id: 'valog_1',
          action: 'official_granted',
          targetType: 'user',
          targetId: 'u_admin',
          actorId: 'system',
          reason: 'Concessão de Equipe Oficial',
          createdAt: Date.now() - 3600000,
        },
      ],
    });
  });

  it('renders overview tab with metrics and guidelines', async () => {
    render(<VerificationsPanel />);

    expect(screen.getByText('Central de Verificações')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Total Verificados')).toBeInTheDocument();
      expect(screen.getByText('Fila Pendente')).toBeInTheDocument();
      expect(screen.getByText('Diretrizes de Autenticidade e Governança')).toBeInTheDocument();
    });
  });

  it('switches to requests tab and renders pending request item with approve/reject actions', async () => {
    render(<VerificationsPanel />);

    const requestsTabBtn = screen.getByRole('button', { name: /solicitações/i });
    fireEvent.click(requestsTabBtn);

    await waitFor(() => {
      expect(screen.getByText('Canal Tech Inovação')).toBeInTheDocument();
      expect(screen.getByText(/Canal de tecnologia com 500k inscritos/i)).toBeInTheDocument();
      expect(screen.getByText('Aprovar')).toBeInTheDocument();
      expect(screen.getByText('Recusar')).toBeInTheDocument();
      expect(screen.getByText('Pedir Info')).toBeInTheDocument();
    });
  });

  it('approves a pending request successfully', async () => {
    (api.adminVerifications.approveRequest as any).mockResolvedValue({
      success: true,
      verificationId: 'v_approved_1',
    });

    render(<VerificationsPanel />);

    const requestsTabBtn = screen.getByRole('button', { name: /solicitações/i });
    fireEvent.click(requestsTabBtn);

    await waitFor(() => {
      expect(screen.getByText('Aprovar')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Aprovar'));

    await waitFor(() => {
      expect(api.adminVerifications.approveRequest).toHaveBeenCalledWith('vreq_101', expect.any(Object));
    });
  });

  it('opens official team grant modal on click', () => {
    render(<VerificationsPanel />);

    const officialBtn = screen.getByRole('button', { name: /conceder equipe oficial/i });
    fireEvent.click(officialBtn);

    expect(screen.getByText('Conceder Selo Oficial de Equipe Nuvio')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ex: gebelson')).toBeInTheDocument();
  });
});
