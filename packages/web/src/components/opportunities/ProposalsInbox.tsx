import React, { useState, useEffect, useMemo } from 'react';
import type { OpportunityApplication, ApplicationStatus } from '@concord/shared';
import { useOpportunityStore } from '../../stores/opportunityStore';
import { useAuthStore } from '../../stores/authStore';
import { Avatar } from '../ui/Avatar';
import { ProposalThreadView } from './ProposalThreadView';
import { useFormatters } from '../../i18n/formatters';
import { Mascot } from '../ui/Mascot';
import { MarketplaceSegmentedControl } from '../marketplace';

interface ProposalsInboxProps {
  onBack?: () => void;
  initialSelectedId?: string | null;
}

export function ProposalsInbox({ onBack, initialSelectedId }: ProposalsInboxProps) {
  const f = useFormatters();
  const currentUser = useAuthStore((s) => s.user);
  const {
    receivedApplications,
    sentApplications,
    selectedApplicationId,
    selectApplication,
    fetchReceivedApplications,
    fetchSentApplications,
    isApplicationsLoading,
  } = useOpportunityStore();

  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected' | 'archived'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'job' | 'freelance' | 'gig'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchReceivedApplications();
    fetchSentApplications();
  }, [fetchReceivedApplications, fetchSentApplications]);

  useEffect(() => {
    if (initialSelectedId) {
      selectApplication(initialSelectedId);
    }
  }, [initialSelectedId, selectApplication]);

  const rawList = activeTab === 'received' ? receivedApplications : sentApplications;

  // Filter list
  const filteredList = useMemo(() => {
    return rawList.filter((app) => {
      // Status filter
      if (statusFilter === 'pending') {
        if (app.status !== 'submitted' && app.status !== 'viewed' && app.status !== 'under_review') return false;
      } else if (statusFilter === 'accepted') {
        if (app.status !== 'chat_unlocked') return false;
      } else if (statusFilter === 'rejected') {
        if (app.status !== 'rejected') return false;
      } else if (statusFilter === 'archived') {
        if (app.status !== 'archived') return false;
      }

      // Type filter
      if (typeFilter !== 'all' && app.opportunity?.type !== typeFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = app.opportunity?.title?.toLowerCase().includes(q);
        const matchesUser =
          activeTab === 'received'
            ? (app.applicant?.displayName?.toLowerCase().includes(q) || app.applicant?.username?.toLowerCase().includes(q))
            : app.opportunity?.title?.toLowerCase().includes(q);
        const matchesMsg = app.message?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesUser && !matchesMsg) return false;
      }

      return true;
    });
  }, [rawList, statusFilter, typeFilter, searchQuery, activeTab]);

  const selectedApp = useMemo(() => {
    if (!selectedApplicationId) return null;
    return rawList.find((a) => a.id === selectedApplicationId) || null;
  }, [rawList, selectedApplicationId]);

  // Unread pending counter for Received
  const pendingReceivedCount = useMemo(() => {
    return receivedApplications.filter(
      (a) => a.status === 'submitted' || a.status === 'viewed' || a.status === 'under_review'
    ).length;
  }, [receivedApplications]);

  const getStatusBadge = (status: ApplicationStatus) => {
    switch (status) {
      case 'submitted':
      case 'viewed':
      case 'under_review':
        return { label: 'Aguardando Aprovação', color: 'bg-amber-500/15 text-amber-400 border-amber-500/25' };
      case 'chat_unlocked':
        return { label: 'Chat Liberado', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' };
      case 'rejected':
        return { label: 'Recusada', color: 'bg-rose-500/15 text-rose-400 border-rose-500/25' };
      case 'withdrawn':
        return { label: 'Retirada', color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25' };
      case 'archived':
        return { label: 'Arquivada', color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25' };
      default:
        return { label: status, color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25' };
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-chat overflow-hidden">
      {/* Top Header & Tabs */}
      <div className="p-4 px-6 border-b border-border-hard bg-surface-panel/80 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 text-txt-secondary hover:text-white hover:bg-white/5 rounded-xl transition-colors"
              title="Voltar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              <span>Caixa de Propostas</span>
              {pendingReceivedCount > 0 && activeTab === 'received' && (
                <span className="px-2 py-0.5 rounded-full bg-accent-primary text-white text-[10px] font-extrabold shadow-sm">
                  {pendingReceivedCount} pendente{pendingReceivedCount > 1 ? 's' : ''}
                </span>
              )}
            </h1>
            <p className="text-xs text-txt-secondary">
              Gerencie suas candidaturas, solicitações de serviços e negociações com privacidade
            </p>
          </div>
        </div>

        {/* Tab switch: Recebidas vs Enviadas */}
        <MarketplaceSegmentedControl<'received' | 'sent'>
          options={[
            {
              id: 'received',
              label: 'Recebidas',
              count: pendingReceivedCount > 0 ? pendingReceivedCount : undefined,
            },
            {
              id: 'sent',
              label: 'Enviadas',
            },
          ]}
          selectedId={activeTab}
          onSelect={(id) => {
            setActiveTab(id);
            selectApplication(null);
          }}
        />
      </div>

      {/* Split View Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Proposals List */}
        <div
          className={`w-full md:w-[380px] lg:w-[420px] flex-shrink-0 border-r border-border-hard flex flex-col bg-surface-panel/40 ${
            selectedApp ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Search & Sub-filters */}
          <div className="p-3 border-b border-border-hard space-y-2.5 bg-surface-panel/60">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por cargo, pessoa ou mensagem..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-surface-channel border border-border-hard hover:border-border-soft text-white text-xs focus:outline-none focus:border-accent-primary transition-all placeholder:text-txt-tertiary"
              />
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="absolute left-3 top-2.5 text-txt-tertiary pointer-events-none"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>

            {/* Filter Chips */}
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'all', label: 'Todas' },
                  { id: 'pending', label: 'Aguardando' },
                  { id: 'accepted', label: 'Liberadas' },
                  { id: 'rejected', label: 'Recusadas' },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => setStatusFilter(chip.id)}
                  className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition-all border ${
                    statusFilter === chip.id
                      ? 'bg-accent-primary text-white border-accent-primary shadow-sm shadow-accent-primary/20'
                      : 'bg-surface-channel/80 border-border-hard text-txt-secondary hover:text-white hover:bg-surface-channel'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto divide-y divide-border-hard no-scrollbar">
            {isApplicationsLoading && filteredList.length === 0 ? (
              <div className="p-8 text-center text-xs text-txt-tertiary">Carregando propostas...</div>
            ) : filteredList.length === 0 ? (
              <div className="p-8 flex flex-col items-center justify-center text-center space-y-2 select-none opacity-90">
                <Mascot state="idle" className="w-28 h-28 -mb-2" />
                <div className="text-sm font-bold text-white">Nenhuma proposta encontrada</div>
                <p className="text-xs text-txt-secondary max-w-xs mx-auto">
                  {activeTab === 'received'
                    ? 'Quando outros usuários se candidatarem às suas publicações, elas aparecerão aqui.'
                    : 'Candidaturas ou propostas que você enviar aparecerão nesta lista.'}
                </p>
              </div>
            ) : (
              filteredList.map((app) => {
                const isSelected = selectedApplicationId === app.id;
                const statusBadge = getStatusBadge(app.status);
                const isPending =
                  app.status === 'submitted' || app.status === 'viewed' || app.status === 'under_review';
                const isUnread = isPending && activeTab === 'received';

                return (
                  <div
                    key={app.id}
                    onClick={() => selectApplication(app.id)}
                    className={`p-4 transition-all cursor-pointer relative select-none ${
                      isSelected
                        ? 'bg-accent-primary/10 border-l-4 border-l-accent-primary'
                        : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar
                          user={(activeTab === 'received' ? app.applicant : app.targetUser) as any}
                          name={
                            activeTab === 'received'
                              ? app.applicant?.displayName || app.applicant?.username || 'Candidato'
                              : app.targetUser?.displayName || app.targetUser?.username || 'Contratante'
                          }
                          size={32}
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-white block truncate">
                            {activeTab === 'received'
                              ? app.applicant?.displayName || app.applicant?.username || 'Candidato'
                              : app.opportunity?.title || 'Oportunidade'}
                          </span>
                          <span className="text-[11px] text-txt-tertiary block truncate">
                            {activeTab === 'received' ? app.opportunity?.title : `Para: ${app.opportunity?.title || 'Oportunidade'}`}
                          </span>
                        </div>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge.color}`}>
                        {statusBadge.label}
                      </span>
                    </div>

                    <p className="text-xs text-txt-secondary line-clamp-2 my-1.5 leading-relaxed">{app.message}</p>

                    <div className="flex items-center justify-between text-[11px] text-txt-tertiary pt-1">
                      <span className="font-extrabold text-accent-primary">
                        {app.proposedPrice ? f.formatCurrency(app.proposedPrice) : 'Sob proposta'}
                      </span>
                      <span>{f.formatShortDate(app.createdAt)}</span>
                    </div>

                    {isUnread && (
                      <span className="absolute top-4 right-2 w-2 h-2 rounded-full bg-accent-primary shadow-sm" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Proposal Thread View & Negotiation */}
        <div className={`flex-1 flex flex-col bg-surface-chat ${!selectedApp ? 'hidden md:flex' : 'flex'}`}>
          {selectedApp ? (
            <ProposalThreadView
              application={selectedApp}
              onBack={() => selectApplication(null)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 select-none">
              <div className="w-16 h-16 rounded-2xl bg-surface-panel border border-border-hard flex items-center justify-center text-accent-primary shadow-xl">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-white">Nenhuma proposta selecionada</h3>
              <p className="text-xs text-txt-secondary max-w-sm leading-relaxed">
                Selecione uma proposta na lista lateral para analisar a apresentação do profissional, currículo, portfólio e gerenciar a liberação do chat.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
