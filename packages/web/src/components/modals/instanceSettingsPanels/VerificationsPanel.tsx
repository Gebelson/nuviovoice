import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../api/client';
import { useFormatters } from '../../../i18n/formatters';
import { useUIStore } from '../../../stores/uiStore';
import { VerificationBadge } from '../../ui/VerificationBadge';
import type {
  VerificationMetrics,
  VerificationRequestData,
  VerificationAuditLogEntry,
  VerificationCategory,
} from '@concord/shared';
import {
  ShieldIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  FileTextIcon,
  UsersIcon,
  BuildingIcon,
  CompassIcon,
  AlertTriangleIcon,
  ExternalLinkIcon,
  GlobeIcon,
  AwardIcon,
  RefreshCwIcon,
} from '../../ui/VerificationIcons';

type VerificationsTab = 'overview' | 'accounts' | 'organizations' | 'spaces' | 'requests' | 'audit';

export function VerificationsPanel() {
  const { formatDateTime, formatMediumDate } = useFormatters();
  const addToast = useUIStore((s) => s.addToast);

  const [activeTab, setActiveTab] = useState<VerificationsTab>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Metrics
  const [metrics, setMetrics] = useState<VerificationMetrics | null>(null);

  // Requests queue
  const [requests, setRequests] = useState<VerificationRequestData[]>([]);
  const [requestFilterStatus, setRequestFilterStatus] = useState<string>('pending');
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequestData | null>(null);

  // Verified entities lists
  const [verifiedUsers, setVerifiedUsers] = useState<Array<Record<string, any>>>([]);
  const [verifiedSpaces, setVerifiedSpaces] = useState<Array<Record<string, any>>>([]);

  // Audit logs
  const [auditLogs, setAuditLogs] = useState<VerificationAuditLogEntry[]>([]);

  // Action Modals / Prompts
  const [rejectModalReq, setRejectModalReq] = useState<VerificationRequestData | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [infoModalReq, setInfoModalReq] = useState<VerificationRequestData | null>(null);
  const [requestedInfoText, setRequestedInfoText] = useState('');

  const [revokeModalEntity, setRevokeModalEntity] = useState<{ targetType: 'user' | 'space'; targetId: string; name: string } | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  // Official Team Grant Modal
  const [showOfficialGrantModal, setShowOfficialGrantModal] = useState(false);
  const [officialTargetUserId, setOfficialTargetUserId] = useState('');
  const [officialTargetUsername, setOfficialTargetUsername] = useState('');
  const [officialNotes, setOfficialNotes] = useState('');

  const loadMetrics = useCallback(async () => {
    try {
      const data = await api.adminVerifications.getMetrics();
      setMetrics(data);
    } catch (err: any) {
      console.error('Failed to load verification metrics', err);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.adminVerifications.getRequests({
        status: requestFilterStatus === 'all' ? undefined : requestFilterStatus,
      });
      setRequests(res.requests);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar solicitações.');
    } finally {
      setLoading(false);
    }
  }, [requestFilterStatus]);

  const loadVerifiedEntities = useCallback(async () => {
    try {
      setLoading(true);
      const [usersRes, spacesRes] = await Promise.all([
        api.adminVerifications.getVerifiedEntities('user'),
        api.adminVerifications.getVerifiedEntities('space'),
      ]);
      setVerifiedUsers(usersRes.verified);
      setVerifiedSpaces(spacesRes.verified);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar entidades verificadas.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAudit = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.adminVerifications.getAudit(50);
      setAuditLogs(res.logs);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar auditoria.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    if (activeTab === 'overview') {
      loadMetrics();
    } else if (activeTab === 'requests') {
      loadRequests();
    } else if (activeTab === 'accounts' || activeTab === 'organizations' || activeTab === 'spaces') {
      loadVerifiedEntities();
    } else if (activeTab === 'audit') {
      loadAudit();
    }
  }, [activeTab, loadMetrics, loadRequests, loadVerifiedEntities, loadAudit]);

  const handleApprove = async (req: VerificationRequestData) => {
    try {
      await api.adminVerifications.approveRequest(req.id, { notes: 'Aprovado via painel de administração.' });
      addToast(`Solicitação de ${req.publicName} aprovada com sucesso!`, 'success');
      loadRequests();
      loadMetrics();
    } catch (err: any) {
      addToast(err?.message || 'Erro ao aprovar solicitação.', 'warning');
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalReq || !rejectReason.trim()) return;
    try {
      await api.adminVerifications.rejectRequest(rejectModalReq.id, {
        reason: rejectReason.trim(),
      });
      addToast(`Solicitação recusada. O solicitante foi notificado.`, 'info');
      setRejectModalReq(null);
      setRejectReason('');
      loadRequests();
      loadMetrics();
    } catch (err: any) {
      addToast(err?.message || 'Erro ao recusar solicitação.', 'warning');
    }
  };

  const handleInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!infoModalReq || !requestedInfoText.trim()) return;
    try {
      await api.adminVerifications.requestInfo(infoModalReq.id, {
        requestedInfo: requestedInfoText.trim(),
      });
      addToast(`Informações adicionais solicitadas.`, 'info');
      setInfoModalReq(null);
      setRequestedInfoText('');
      loadRequests();
      loadMetrics();
    } catch (err: any) {
      addToast(err?.message || 'Erro ao solicitar informações.', 'warning');
    }
  };

  const handleRevokeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokeModalEntity || !revokeReason.trim()) return;
    try {
      await api.adminVerifications.revoke(revokeModalEntity.targetType, revokeModalEntity.targetId, {
        reason: revokeReason.trim(),
      });
      addToast(`Verificação de ${revokeModalEntity.name} revogada.`, 'success');
      setRevokeModalEntity(null);
      setRevokeReason('');
      loadVerifiedEntities();
      loadMetrics();
    } catch (err: any) {
      addToast(err?.message || 'Erro ao revogar verificação.', 'warning');
    }
  };

  const handleOfficialGrantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officialTargetUserId.trim() && !officialTargetUsername.trim()) {
      addToast('Informe o ID do usuário ou o nome de usuário (@username).', 'warning');
      return;
    }
    try {
      await api.adminVerifications.grantOfficial({
        targetUserId: officialTargetUserId.trim(),
        targetUsername: officialTargetUsername.trim() || undefined,
        notes: officialNotes.trim() || 'Concessão administrativa de selo de Equipe Oficial Nuvio.',
      });
      addToast('Selo oficial de equipe concedido e registrado na auditoria!', 'success');
      setShowOfficialGrantModal(false);
      setOfficialTargetUserId('');
      setOfficialTargetUsername('');
      setOfficialNotes('');
      loadVerifiedEntities();
      loadMetrics();
    } catch (err: any) {
      addToast(err?.message || 'Erro ao conceder selo oficial.', 'warning');
    }
  };

  const filteredOrganizations = verifiedUsers.filter(u => u.verificationCategory === 'organization')
    .concat(verifiedSpaces.filter(s => s.verificationCategory === 'organization'));

  const filteredPersonalAccounts = verifiedUsers.filter(u => u.verificationCategory !== 'organization');

  const filteredSpaceEntities = verifiedSpaces.filter(s => s.verificationCategory !== 'organization');

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-txt-primary">Central de Verificações</h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-500/15 text-sky-400 border border-sky-500/20">
              Autenticidade Oficial
            </span>
          </div>
          <p className="text-xs text-txt-secondary mt-0.5">
            Gestão de selos de contas, criadores, organizações, equipe oficial e espaços do Explorar.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowOfficialGrantModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-xs font-medium transition-colors"
          >
            <AwardIcon size={14} />
            <span>Conceder Equipe Oficial</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none border-b border-white/5 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'overview'
              ? 'bg-white/10 text-txt-primary font-semibold'
              : 'text-txt-secondary hover:text-txt-primary hover:bg-white/5'
          }`}
        >
          <CompassIcon size={14} />
          Visão Geral
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'requests'
              ? 'bg-white/10 text-txt-primary font-semibold'
              : 'text-txt-secondary hover:text-txt-primary hover:bg-white/5'
          }`}
        >
          <ClockIcon size={14} />
          Solicitações
          {metrics?.pendingRequests ? (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-bold">
              {metrics.pendingRequests}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('accounts')}
          className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'accounts'
              ? 'bg-white/10 text-txt-primary font-semibold'
              : 'text-txt-secondary hover:text-txt-primary hover:bg-white/5'
          }`}
        >
          <UsersIcon size={14} />
          Contas ({metrics?.verifiedAccounts ?? 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('organizations')}
          className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'organizations'
              ? 'bg-white/10 text-txt-primary font-semibold'
              : 'text-txt-secondary hover:text-txt-primary hover:bg-white/5'
          }`}
        >
          <BuildingIcon size={14} />
          Organizações ({metrics?.verifiedOrganizations ?? 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('spaces')}
          className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'spaces'
              ? 'bg-white/10 text-txt-primary font-semibold'
              : 'text-txt-secondary hover:text-txt-primary hover:bg-white/5'
          }`}
        >
          <CompassIcon size={14} />
          Espaços ({metrics?.verifiedSpaces ?? 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'audit'
              ? 'bg-white/10 text-txt-primary font-semibold'
              : 'text-txt-secondary hover:text-txt-primary hover:bg-white/5'
          }`}
        >
          <FileTextIcon size={14} />
          Auditoria
        </button>
      </div>

      {/* ── 1. VISÃO GERAL ── */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-surface-card border border-white/5">
              <div className="text-xs text-txt-tertiary">Total Verificados</div>
              <div className="text-2xl font-bold text-txt-primary mt-1">
                {(metrics?.verifiedAccounts ?? 0) + (metrics?.verifiedSpaces ?? 0)}
              </div>
              <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircleIcon size={11} /> Selos ativos
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-card border border-white/5">
              <div className="text-xs text-txt-tertiary">Contas Pessoais & Figuras</div>
              <div className="text-2xl font-bold text-sky-400 mt-1">
                {(metrics?.verifiedAccounts ?? 0)}
              </div>
              <div className="text-[10px] text-txt-tertiary mt-1">
                Contas pessoais / criadores
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-card border border-white/5">
              <div className="text-xs text-txt-tertiary">Organizações</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {metrics?.verifiedOrganizations ?? 0}
              </div>
              <div className="text-[10px] text-txt-tertiary mt-1">Empresas e coletivos</div>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-card border border-white/5">
              <div className="text-xs text-txt-tertiary">Fila Pendente</div>
              <div className="text-2xl font-bold text-amber-400 mt-1">
                {metrics?.pendingRequests ?? 0}
              </div>
              <div className="text-[10px] text-amber-400/80 mt-1 flex items-center gap-1">
                <ClockIcon size={11} /> Aguardando análise
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 text-xs">
            <div className="font-semibold text-txt-primary flex items-center gap-2">
              <ShieldIcon size={16} className="text-sky-400" />
              Diretrizes de Autenticidade e Governança
            </div>
            <p className="text-txt-secondary leading-relaxed">
              O sistema de verificação do Nuvio separa categoricamente a <strong>autenticidade cadastral</strong> das permissões administrativas. Selos de verificação confirmam a identidade legítima ou o controle do domínio, sem conceder poderes de moderação sobre a plataforma.
            </p>
            <div className="pt-2 border-t border-white/5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-txt-tertiary">
              <div>
                <strong className="text-sky-300 block mb-0.5">Selo Azul</strong>
                Pessoas físicas, criadores de conteúdo e espaços verificados.
              </div>
              <div>
                <strong className="text-emerald-300 block mb-0.5">Selo Verde</strong>
                Organizações, instituições e empresas autenticadas.
              </div>
              <div>
                <strong className="text-purple-300 block mb-0.5">Escudo Roxo</strong>
                Equipe Oficial Nuvio (concedido estritamente via administração auditada).
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. FILA DE SOLICITAÇÕES ── */}
      {activeTab === 'requests' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-txt-tertiary">Filtrar por:</span>
              {(['pending', 'under_review', 'info_requested', 'all'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRequestFilterStatus(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs capitalize transition-colors ${
                    requestFilterStatus === s
                      ? 'bg-accent-primary text-white font-medium'
                      : 'bg-surface-base text-txt-secondary hover:text-white'
                  }`}
                >
                  {s === 'pending' && 'Pendentes'}
                  {s === 'under_review' && 'Em Análise'}
                  {s === 'info_requested' && 'Info Solicitada'}
                  {s === 'all' && 'Todas'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={loadRequests}
              className="p-1.5 text-txt-tertiary hover:text-txt-primary rounded transition-colors"
              title="Atualizar"
            >
              <RefreshCwIcon size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {requests.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-surface-card border border-white/5 text-txt-tertiary text-xs">
              Nenhuma solicitação encontrada neste filtro.
            </div>
          ) : (
            <div className="space-y-2.5">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 rounded-xl bg-surface-card border border-white/5 hover:border-white/10 transition-colors space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-txt-primary">
                          {req.publicName}
                        </span>
                        <VerificationBadge category={req.category} size="xs" showTooltip={false} />
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-white/5 text-txt-secondary">
                          {req.targetType === 'space' ? 'Espaço' : 'Usuário'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          req.status === 'pending' ? 'bg-amber-500/15 text-amber-400' :
                          req.status === 'under_review' ? 'bg-sky-500/15 text-sky-400' :
                          req.status === 'info_requested' ? 'bg-purple-500/15 text-purple-400' :
                          req.status === 'verified' ? 'bg-emerald-500/15 text-emerald-400' :
                          'bg-rose-500/15 text-rose-400'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-txt-tertiary mt-0.5">
                        Alvo ID: <span className="font-mono text-txt-secondary">{req.targetId}</span> • Criado em: {formatDateTime(req.createdAt)}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleApprove(req)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-medium text-xs transition-colors flex items-center gap-1"
                      >
                        <CheckCircleIcon size={13} />
                        Aprovar
                      </button>
                      <button
                        type="button"
                        onClick={() => setInfoModalReq(req)}
                        className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-txt-secondary font-medium text-xs transition-colors"
                      >
                        Pedir Info
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectModalReq(req)}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-medium text-xs transition-colors"
                      >
                        Recusar
                      </button>
                    </div>
                  </div>

                  {/* Description & Evidence */}
                  <div className="text-xs text-txt-secondary leading-relaxed bg-surface-base/50 p-2.5 rounded-lg border border-white/5">
                    {req.activityDescription}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-txt-tertiary">
                    {req.officialWebsite && (
                      <a
                        href={req.officialWebsite}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="flex items-center gap-1 text-sky-400 hover:underline"
                      >
                        <GlobeIcon size={13} />
                        {req.officialWebsite}
                        <ExternalLinkIcon size={11} />
                      </a>
                    )}
                    {req.domainToVerify && (
                      <span className="flex items-center gap-1 text-txt-secondary">
                        <GlobeIcon size={13} />
                        Domínio: <strong>{req.domainToVerify}</strong>
                      </span>
                    )}
                    {req.socialLinks && req.socialLinks.length > 0 && (
                      <span className="flex items-center gap-1">
                        Links públicos: {req.socialLinks.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-sky-400 hover:underline inline-flex items-center gap-0.5 ml-1"
                          >
                            Link {i + 1}
                            <ExternalLinkIcon size={9} />
                          </a>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 3. CONTAS VERIFICADAS ── */}
      {activeTab === 'accounts' && (
        <div className="space-y-3">
          <div className="text-xs text-txt-secondary">
            Usuários com selo ativo de pessoa física, criador de conteúdo ou equipe oficial.
          </div>

          {filteredPersonalAccounts.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-surface-card border border-white/5 text-txt-tertiary text-xs">
              Nenhuma conta pessoal ou de criador verificada no momento.
            </div>
          ) : (
            <div className="rounded-xl bg-surface-card border border-white/5 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 text-txt-tertiary uppercase text-[10px] tracking-wider border-b border-white/5">
                  <tr>
                    <th className="p-3">Usuário</th>
                    <th className="p-3">Categoria</th>
                    <th className="p-3">Data</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-txt-secondary">
                  {filteredPersonalAccounts.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.02]">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-txt-primary">
                            {u.displayName || u.username}
                          </span>
                          <span className="text-txt-tertiary">@{u.username}</span>
                          <VerificationBadge category={u.verificationCategory} size="xs" />
                        </div>
                        <div className="text-[10px] text-txt-tertiary font-mono">{u.id}</div>
                      </td>
                      <td className="p-3 capitalize">
                        {u.verificationCategory === 'official' ? (
                          <span className="text-purple-400 font-semibold flex items-center gap-1">
                            <AwardIcon size={12} /> Equipe Oficial
                          </span>
                        ) : u.verificationCategory === 'creator' ? (
                          'Criador / Notório'
                        ) : (
                          'Pessoa Física'
                        )}
                      </td>
                      <td className="p-3 text-[11px] text-txt-tertiary">
                        {u.createdAt ? formatMediumDate(u.createdAt) : '—'}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => setRevokeModalEntity({ targetType: 'user', targetId: u.id, name: u.username })}
                          className="px-2.5 py-1 text-xs rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                        >
                          Revogar Selo
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── 4. ORGANIZAÇÕES VERIFICADAS ── */}
      {activeTab === 'organizations' && (
        <div className="space-y-3">
          <div className="text-xs text-txt-secondary">
            Organizações e empresas autenticadas com selo verde.
          </div>

          {filteredOrganizations.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-surface-card border border-white/5 text-txt-tertiary text-xs">
              Nenhuma organização verificada no momento.
            </div>
          ) : (
            <div className="rounded-xl bg-surface-card border border-white/5 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 text-txt-tertiary uppercase text-[10px] tracking-wider border-b border-white/5">
                  <tr>
                    <th className="p-3">Entidade</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-txt-secondary">
                  {filteredOrganizations.map((org) => (
                    <tr key={org.id} className="hover:bg-white/[0.02]">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-txt-primary">
                            {org.name || org.displayName || org.username}
                          </span>
                          <VerificationBadge category="organization" size="xs" />
                        </div>
                        <div className="text-[10px] text-txt-tertiary font-mono">{org.id}</div>
                      </td>
                      <td className="p-3 capitalize">{org.username ? 'Conta de Organização' : 'Espaço Organizacional'}</td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => setRevokeModalEntity({
                            targetType: org.username ? 'user' : 'space',
                            targetId: org.id,
                            name: org.name || org.username,
                          })}
                          className="px-2.5 py-1 text-xs rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                        >
                          Revogar Selo
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── 5. ESPAÇOS VERIFICADOS ── */}
      {activeTab === 'spaces' && (
        <div className="space-y-3">
          <div className="text-xs text-txt-secondary">
            Espaços públicos com selo de autenticidade no Explorar.
          </div>

          {filteredSpaceEntities.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-surface-card border border-white/5 text-txt-tertiary text-xs">
              Nenhum espaço verificado registrado.
            </div>
          ) : (
            <div className="rounded-xl bg-surface-card border border-white/5 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 text-txt-tertiary uppercase text-[10px] tracking-wider border-b border-white/5">
                  <tr>
                    <th className="p-3">Espaço</th>
                    <th className="p-3">Dono</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-txt-secondary">
                  {filteredSpaceEntities.map((sp) => (
                    <tr key={sp.id} className="hover:bg-white/[0.02]">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-txt-primary">{sp.name}</span>
                          <VerificationBadge category={sp.verificationCategory || 'space'} size="xs" />
                        </div>
                        <div className="text-[10px] text-txt-tertiary font-mono">{sp.id}</div>
                      </td>
                      <td className="p-3 text-txt-tertiary font-mono text-[11px]">{sp.ownerId}</td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => setRevokeModalEntity({ targetType: 'space', targetId: sp.id, name: sp.name })}
                          className="px-2.5 py-1 text-xs rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                        >
                          Revogar Selo
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── 6. HISTÓRICO E AUDITORIA ── */}
      {activeTab === 'audit' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-txt-secondary">
              Registro cronológico auditável de concessões, recusas e revogações de selos.
            </span>
            <button
              type="button"
              onClick={loadAudit}
              className="p-1.5 text-txt-tertiary hover:text-txt-primary rounded transition-colors"
            >
              <RefreshCwIcon size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {auditLogs.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-surface-card border border-white/5 text-txt-tertiary text-xs">
              Nenhum evento de auditoria de verificação registrado até o momento.
            </div>
          ) : (
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-lg bg-surface-card border border-white/5 text-xs flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        log.action === 'approved' ? 'bg-emerald-500/15 text-emerald-400' :
                        log.action === 'rejected' ? 'bg-rose-500/15 text-rose-400' :
                        log.action === 'revoked' ? 'bg-rose-500/20 text-rose-300' :
                        log.action === 'official_granted' ? 'bg-purple-500/20 text-purple-300' :
                        'bg-white/10 text-txt-secondary'
                      }`}>
                        {log.action}
                      </span>
                      <span className="text-txt-primary font-medium">
                        Alvo: <span className="font-mono text-sky-400">{log.targetType}:{log.targetId}</span>
                      </span>
                    </div>
                    {log.justification && (
                      <p className="text-txt-secondary text-[11px] leading-relaxed">
                        Motivo / Justificativa: {log.justification}
                      </p>
                    )}
                    <div className="text-[10px] text-txt-tertiary">
                      Responsável: <span className="font-mono">{log.adminUsername || log.adminId || 'Sistema'}</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-txt-tertiary shrink-0">
                    {formatDateTime(log.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL DE RECUSA ── */}
      {rejectModalReq && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleRejectSubmit}
            className="w-full max-w-md rounded-2xl bg-surface-modal border border-white/10 p-5 space-y-4 shadow-2xl animate-in zoom-in-95"
          >
            <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
              <XCircleIcon size={18} />
              Recusar Solicitação de Verificação
            </div>
            <p className="text-xs text-txt-secondary">
              Informe a justificativa fundamentada para a recusa de <strong>{rejectModalReq.publicName}</strong>. O motivo será exibido ao solicitante.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex: Documentação insuficiente, perfil não cumpre os requisitos de notoriedade ou não atendeu às diretrizes públicas..."
              rows={3}
              required
              className="w-full px-3 py-2 rounded-lg bg-surface-base border border-white/10 text-txt-primary text-xs focus:outline-none resize-none"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalReq(null)}
                className="px-3.5 py-1.5 text-xs text-txt-tertiary hover:text-txt-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-rose-500 hover:bg-rose-600 text-white transition-colors"
              >
                Confirmar Recusa
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── MODAL DE SOLICITAR INFORMAÇÕES ── */}
      {infoModalReq && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleInfoSubmit}
            className="w-full max-w-md rounded-2xl bg-surface-modal border border-white/10 p-5 space-y-4 shadow-2xl animate-in zoom-in-95"
          >
            <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm">
              <ClockIcon size={18} />
              Solicitar Informações Complementares
            </div>
            <p className="text-xs text-txt-secondary">
              Informe quais dados ou comprovações adicionais <strong>{infoModalReq.publicName}</strong> deve apresentar para a conclusão da análise.
            </p>
            <textarea
              value={requestedInfoText}
              onChange={(e) => setRequestedInfoText(e.target.value)}
              placeholder="Ex: Favor configurar o registro TXT em seu domínio ou informar link oficial de mídia comprovando a notoriedade..."
              rows={3}
              required
              className="w-full px-3 py-2 rounded-lg bg-surface-base border border-white/10 text-txt-primary text-xs focus:outline-none resize-none"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setInfoModalReq(null)}
                className="px-3.5 py-1.5 text-xs text-txt-tertiary hover:text-txt-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-accent-primary hover:bg-accent-primary/80 text-white transition-colors"
              >
                Enviar ao Solicitante
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── MODAL DE REVOGAÇÃO ── */}
      {revokeModalEntity && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleRevokeSubmit}
            className="w-full max-w-md rounded-2xl bg-surface-modal border border-white/10 p-5 space-y-4 shadow-2xl animate-in zoom-in-95"
          >
            <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
              <AlertTriangleIcon size={18} />
              Revogar Selo de Autenticidade
            </div>
            <p className="text-xs text-txt-secondary">
              Tem certeza de que deseja revogar o selo de verificação de <strong>{revokeModalEntity.name}</strong>? A revogação será registrada em auditoria permanente.
            </p>
            <textarea
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="Motivo formal da revogação (ex: perda de controle do domínio, violação dos termos de uso, alteração substantiva de titularidade)..."
              rows={3}
              required
              className="w-full px-3 py-2 rounded-lg bg-surface-base border border-white/10 text-txt-primary text-xs focus:outline-none resize-none"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRevokeModalEntity(null)}
                className="px-3.5 py-1.5 text-xs text-txt-tertiary hover:text-txt-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-rose-500 hover:bg-rose-600 text-white transition-colors"
              >
                Confirmar Revogação
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── MODAL DE CONCESSÃO OFICIAL DE EQUIPE ── */}
      {showOfficialGrantModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleOfficialGrantSubmit}
            className="w-full max-w-md rounded-2xl bg-surface-modal border border-purple-500/30 p-5 space-y-4 shadow-2xl animate-in zoom-in-95"
          >
            <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm">
              <AwardIcon size={20} />
              Conceder Selo Oficial de Equipe Nuvio
            </div>
            <p className="text-xs text-txt-secondary leading-relaxed">
              O selo roxo com escudo (<strong className="text-purple-300">Equipe oficial Nuvio</strong>) identifica membros legítimos do time da plataforma. Ele não pode ser solicitado publicamente e requer concessão administrativa explícita e auditada.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-medium text-txt-secondary">ID Interno do Usuário</label>
              <input
                type="text"
                value={officialTargetUserId}
                onChange={(e) => setOfficialTargetUserId(e.target.value)}
                placeholder="Ex: u-12345678-abcd..."
                className="w-full px-3 py-2 rounded-lg bg-surface-base border border-white/10 text-txt-primary text-xs focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-txt-secondary">Ou Nome de Usuário (@username)</label>
              <input
                type="text"
                value={officialTargetUsername}
                onChange={(e) => setOfficialTargetUsername(e.target.value)}
                placeholder="Ex: gebelson"
                className="w-full px-3 py-2 rounded-lg bg-surface-base border border-white/10 text-txt-primary text-xs focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-txt-secondary">Notas Administrativas / Justificativa</label>
              <textarea
                value={officialNotes}
                onChange={(e) => setOfficialNotes(e.target.value)}
                placeholder="Ex: Concessão ao proprietário/fundador do Nuvio (@gebelson) com verificação de identidade confirmada no servidor."
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-surface-base border border-white/10 text-txt-primary text-xs focus:outline-none resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowOfficialGrantModal(false)}
                className="px-3.5 py-1.5 text-xs text-txt-tertiary hover:text-txt-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors flex items-center gap-1.5"
              >
                <AwardIcon size={14} />
                Conceder Selo Oficial
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
