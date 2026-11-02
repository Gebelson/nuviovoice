import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { SecurityPanel } from './SecurityPanel';
import { api } from '../../../api';

vi.mock('../../../api', () => ({
  api: {
    securityAdmin: {
      getOverview: vi.fn(),
      getReports: vi.fn(),
      getReport: vi.fn(),
      updateReport: vi.fn(),
      getCases: vi.fn(),
      createCase: vi.fn(),
      updateCase: vi.fn(),
      getAuthorities: vi.fn(),
      createAuthority: vi.fn(),
      updateAuthority: vi.fn(),
      getEvidence: vi.fn(),
      getEvidenceItem: vi.fn(),
      depositEvidence: vi.fn(),
      getAlerts: vi.fn(),
      updateAlert: vi.fn(),
      getAuditLogs: vi.fn(),
      getSuspendedUsers: vi.fn(),
      suspendUser: vi.fn(),
      reactivateUser: vi.fn(),
      getReportedSpaces: vi.fn(),
    },
  },
}));

describe('SecurityPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (api.securityAdmin.getOverview as any).mockResolvedValue({
      metrics: {
        pendingReportsCount: 3,
        openCasesCount: 2,
        activeAlertsCount: 1,
        authorityRequestsCount: 4,
        suspendedUsersCount: 5,
        totalEvidenceItems: 12,
        recentAuditCount: 7,
        lastIncidentTimestamp: null,
      },
    });

    (api.securityAdmin.getReports as any).mockResolvedValue({
      reports: [
        {
          id: 'rep_100',
          protocol: 'REP-20261101-9988AABB',
          reporterId: 'user_1',
          targetType: 'message',
          targetId: 'msg_1',
          category: 'harassment',
          priority: 'high',
          status: 'pending',
          description: 'Ataque pessoal grave',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    });

    (api.securityAdmin.getReport as any).mockResolvedValue({
      report: {
        id: 'rep_100',
        protocol: 'REP-20261101-9988AABB',
        reporterId: 'user_1',
        targetType: 'message',
        targetId: 'msg_1',
        category: 'harassment',
        priority: 'high',
        status: 'pending',
        evidences: [
          {
            id: 'ev_1',
            reportId: 'rep_100',
            messageId: 'msg_1',
            contentSnapshot: 'Texto da mensagem denunciada',
            authorUsername: 'baduser',
            sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            createdAt: Date.now(),
          },
        ],
      },
    });
  });

  it('renders overview with real metrics loaded from API', async () => {
    render(<SecurityPanel />);

    expect(screen.getByText(/Central de Segurança e Cooperação com Autoridades/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument(); // pendingReportsCount
      expect(screen.getByText('1')).toBeInTheDocument(); // activeAlertsCount
      expect(screen.getByText('4')).toBeInTheDocument(); // authorityRequestsCount
      expect(screen.getByText('12')).toBeInTheDocument(); // totalEvidenceItems
    });
  });

  it('switches to reports tab and inspects evidence with SHA-256 hash', async () => {
    render(<SecurityPanel />);

    // Click on Denúncias tab
    const reportsTab = screen.getByRole('button', { name: /Denúncias/i });
    fireEvent.click(reportsTab);

    await waitFor(() => {
      expect(screen.getByText('REP-20261101-9988AABB')).toBeInTheDocument();
      expect(screen.getByText(/Ataque pessoal grave/i)).toBeInTheDocument();
    });

    // Click "Inspecionar Evidências"
    const inspectBtn = screen.getByRole('button', { name: /Inspecionar Evidências/i });
    fireEvent.click(inspectBtn);

    await waitFor(() => {
      expect(screen.getByText(/Inspeção Probatória Restrita/i)).toBeInTheDocument();
      expect(screen.getByText(/Texto da mensagem denunciada/i)).toBeInTheDocument();
      expect(screen.getByText(/e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855/i)).toBeInTheDocument();
    });
  });

  it('switches to policies tab and displays Brazilian legal framework', async () => {
    render(<SecurityPanel />);

    const policiesTab = screen.getByRole('button', { name: /Políticas/i });
    fireEvent.click(policiesTab);

    expect(screen.getByText(/Marco Regulatório Aplicável/i)).toBeInTheDocument();
    expect(screen.getByText(/Marco Civil da Internet \(Lei nº 12.965\/2014\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Lei Geral de Proteção de Dados/i)).toBeInTheDocument();
    expect(screen.getByText(/Estatuto da Criança e do Adolescente/i)).toBeInTheDocument();
  });
});
