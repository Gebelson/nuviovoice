import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { OpportunityItem, OpportunityApplication, OpportunityNegotiation } from '@concord/shared';
import { OpportunityCard } from '../OpportunityCard';
import { GigCard } from '../GigCard';
import { NegotiationCard } from '../NegotiationCard';
import { ProposalThreadView } from '../ProposalThreadView';

// Mock formatters hook
vi.mock('../../../i18n/formatters', () => ({
  useFormatters: () => ({
    formatCurrency: (val: number) => `R$ ${val.toLocaleString('pt-BR')}`,
    formatNumber: (val: number) => String(val),
    formatShortDate: (ts: number) => new Date(ts).toLocaleDateString('pt-BR'),
    formatDateTime: (ts: number) => new Date(ts).toLocaleString('pt-BR'),
    formatTime: (ts: number) => '12:00',
  }),
}));

// Mock auth store
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: any) =>
    selector({
      user: { id: 'user_recipient_123', username: 'recruiter_bob' },
    }),
}));

// Mock opportunity store
const mockAcceptApplication = vi.fn();
const mockRejectApplication = vi.fn();
const mockSendMessage = vi.fn();

vi.mock('../../../stores/opportunityStore', () => ({
  useOpportunityStore: () => ({
    activeMessages: [],
    activeNegotiations: [],
    activeOpportunity: null,
    activeApplicantProfile: null,
    isMessagesLoading: false,
    acceptApplication: mockAcceptApplication,
    rejectApplication: mockRejectApplication,
    withdrawApplication: vi.fn(),
    sendApplicationMessage: mockSendMessage,
    proposeNegotiation: vi.fn(),
    acceptNegotiation: vi.fn(),
    declineNegotiation: vi.fn(),
  }),
}));

describe('Nuvio Oportunidades Frontend Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockJob: OpportunityItem = {
    id: 'opp_job_1',
    userId: 'user_recipient_123',
    type: 'job',
    title: 'Desenvolvedor Frontend React Sênior',
    category: 'development',
    description: 'Vaga para atuar no ecossistema Nuvio com React e WebSockets.',
    status: 'published',
    companyName: 'Nuvio Labs',
    workModality: 'remote',
    contractType: 'clt',
    remunerationType: 'range',
    salaryMin: 9000,
    salaryMax: 14000,
    skills: ['React', 'TypeScript', 'TailwindCSS'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const mockGig: OpportunityItem = {
    id: 'opp_gig_1',
    userId: 'user_freelancer_456',
    type: 'gig',
    title: 'Criação de Vinhetas e Áudios para Winks',
    category: 'audio_music',
    description: 'Componho efeitos sonoros e músicas personalizadas para transmissões e winks.',
    status: 'published',
    workModality: 'remote',
    budget: 250,
    deliveryDays: 3,
    revisionsCount: 2,
    packages: {
      basic: {
        name: 'Básico',
        title: 'Básico',
        description: '1 som personalizado de 5s',
        price: 250,
        deliveryDays: 3,
        revisions: 2,
      },
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const mockApplicationPending: OpportunityApplication = {
    id: 'app_1',
    opportunityId: 'opp_job_1',
    applicantId: 'user_applicant_789',
    targetUserId: 'user_recipient_123',
    type: 'job_application',
    status: 'submitted',
    message: 'Olá, sou apaixonado pelo Nuvio e possuo 5 anos de experiência com React.',
    applicant: {
      id: 'user_applicant_789',
      username: 'dev_carla',
      displayName: 'Carla Silva',
    },
    opportunity: {
      id: 'opp_job_1',
      title: 'Desenvolvedor Frontend React Sênior',
      type: 'job',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const mockApplicationUnlocked: OpportunityApplication = {
    ...mockApplicationPending,
    status: 'chat_unlocked',
  };

  const mockNegotiation: OpportunityNegotiation = {
    id: 'neg_1',
    applicationId: 'app_1',
    senderId: 'user_applicant_789',
    receiverId: 'user_recipient_123',
    status: 'pending',
    price: 3500,
    deadline: '7 dias úteis',
    scope: 'Entrega de design no Figma e protótipo interativo',
    revisions: 3,
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  it('1. Renders OpportunityCard with company, title, contract and salary', () => {
    const handleClick = vi.fn();
    render(
      <MemoryRouter>
        <OpportunityCard opportunity={mockJob} onClick={handleClick} />
      </MemoryRouter>
    );

    expect(screen.getByText('Desenvolvedor Frontend React Sênior')).toBeDefined();
    expect(screen.getByText('Nuvio Labs')).toBeDefined();
    expect(screen.getByText(/clt/i)).toBeDefined();
    expect(screen.getByText('Remoto')).toBeDefined();
    expect(screen.getByText('R$ 9.000 - R$ 14.000')).toBeDefined();

    fireEvent.click(screen.getByText('Desenvolvedor Frontend React Sênior'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('2. Renders GigCard with starting price and delivery days', () => {
    const handleClick = vi.fn();
    render(
      <MemoryRouter>
        <GigCard opportunity={mockGig} onClick={handleClick} />
      </MemoryRouter>
    );

    expect(screen.getByText('Criação de Vinhetas e Áudios para Winks')).toBeDefined();
    expect(screen.getByText('A partir de R$ 250')).toBeDefined();
    expect(screen.getByText(/3 dias/)).toBeDefined();

    fireEvent.click(screen.getByText('Criação de Vinhetas e Áudios para Winks'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('3. Renders NegotiationCard with version, proposed price and counter actions', () => {
    const handleAccept = vi.fn();
    const handleDecline = vi.fn();
    const handleCounter = vi.fn();

    render(
      <NegotiationCard
        negotiation={mockNegotiation}
        isReceiver={true}
        onAccept={handleAccept}
        onDecline={handleDecline}
        onCounterOffer={handleCounter}
      />
    );

    expect(screen.getByText(/Negociação #1/)).toBeDefined();
    expect(screen.getByText('R$ 3.500')).toBeDefined();
    expect(screen.getByText('7 dias úteis')).toBeDefined();
    expect(screen.getByText('Aceitar Termos')).toBeDefined();
    expect(screen.getByText('Recusar')).toBeDefined();
    expect(screen.getByText('Contraproposta')).toBeDefined();

    fireEvent.click(screen.getByText('Aceitar Termos'));
    expect(handleAccept).toHaveBeenCalledWith('neg_1');
  });

  it('4. Enforces Gated Chat: shows locked state banner and buttons when pending approval', () => {
    render(
      <MemoryRouter>
        <ProposalThreadView application={mockApplicationPending} />
      </MemoryRouter>
    );

    // Initial proposal message is readable
    expect(screen.getByText(/Olá, sou apaixonado pelo Nuvio/)).toBeDefined();

    // Recipient can see Aceitar Proposta and Recusar Proposta
    const acceptBtn = screen.getByText('Aceitar Proposta & Liberar Chat');
    expect(acceptBtn).toBeDefined();

    const rejectBtn = screen.getByText('Recusar Proposta');
    expect(rejectBtn).toBeDefined();

    // Chat is locked
    expect(screen.getByText('Chat Profissional Bloqueado até Aprovação')).toBeDefined();

    // Click accept triggers store action
    fireEvent.click(acceptBtn);
    expect(mockAcceptApplication).toHaveBeenCalledWith('app_1');
  });

  it('5. Unlocked Chat allows sending normal negotiation messages', async () => {
    render(
      <MemoryRouter>
        <ProposalThreadView application={mockApplicationUnlocked} />
      </MemoryRouter>
    );

    // Chat unlocked indicator
    expect(screen.getByText('Chat Liberado')).toBeDefined();

    // Textarea input is present and enabled
    const input = screen.getByPlaceholderText('Digite uma mensagem profissional...');
    expect(input).toBeDefined();

    fireEvent.change(input, { target: { value: 'Olá Carla! Vamos alinhar o onboarding na próxima segunda-feira.' } });
    const sendBtn = screen.getByText('Enviar');
    await act(async () => {
      fireEvent.click(sendBtn);
    });

    expect(mockSendMessage).toHaveBeenCalledWith('Olá Carla! Vamos alinhar o onboarding na próxima segunda-feira.');
  });
});
