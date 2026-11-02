import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../api';
import type {
  SecurityOverviewMetrics,
  SafetyReport,
  SecurityCase,
  AuthorityRequest,
  SecurityAlert,
  SecurityAuditLog,
  EvidenceVaultItem,
  SafetyReportStatus,
  SecurityAlertStatus,
} from '@concord/shared';

type SecurityTab =
  | 'overview'
  | 'reports'
  | 'alerts'
  | 'users'
  | 'spaces'
  | 'authorities'
  | 'evidence'
  | 'audit'
  | 'policies';

export function SecurityPanel() {
  const [activeTab, setActiveTab] = useState<SecurityTab>('overview');
  const [metrics, setMetrics] = useState<SecurityOverviewMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subtab data states
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<SafetyReport | null>(null);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [cases, setCases] = useState<SecurityCase[]>([]);
  const [authorities, setAuthorities] = useState<AuthorityRequest[]>([]);
  const [evidenceItems, setEvidenceItems] = useState<EvidenceVaultItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<SecurityAuditLog[]>([]);
  const [suspendedUsers, setSuspendedUsers] = useState<Array<{ id: string; username: string; isDeleted: number }>>([]);
  const [reportedSpaces, setReportedSpaces] = useState<Array<{ id: string; name: string; reportCount: number }>>([]);

  // Inspection modal / justification states
  const [actionJustification, setActionJustification] = useState('');
  const [promptAction, setPromptAction] = useState<{
    type: 'report_status' | 'suspend_user' | 'reactivate_user' | 'evidence_view' | 'alert_status';
    targetId: string;
    newStatus?: string;
  } | null>(null);
  const [inspectedEvidence, setInspectedEvidence] = useState<any | null>(null);

  // Authority registration form modal
  const [showNewAuthorityModal, setShowNewAuthorityModal] = useState(false);
  const [authorityForm, setAuthorityForm] = useState({
    protocolNumber: '',
    requestingBody: '',
    authorityName: '',
    authorityContact: '',
    legalBasis: 'Art. 15 da Lei 12.965/2014 (Marco Civil da Internet)',
    targetUserId: '',
    targetSpaceId: '',
    preservationDays: 180,
    notes: '',
    justification: '',
  });

  // Suspend user form
  const [suspendUserIdInput, setSuspendUserIdInput] = useState('');

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.securityAdmin.getOverview();
      setMetrics(res.metrics);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar métricas de segurança.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.securityAdmin.getReports();
      setReports(res.reports);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar denúncias.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.securityAdmin.getAlerts();
      setAlerts(res.alerts);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar alertas.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAuthorities = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.securityAdmin.getAuthorities();
      setAuthorities(res.requests);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar solicitações de autoridades.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEvidence = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.securityAdmin.getEvidence();
      setEvidenceItems(res.evidence);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar cofre de evidências.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAudit = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.securityAdmin.getAuditLogs({ limit: 100 });
      setAuditLogs(res.logs);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar logs de auditoria.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsersAndSpaces = useCallback(async () => {
    try {
      setLoading(true);
      const [uRes, sRes] = await Promise.all([
        api.securityAdmin.getSuspendedUsers(),
        api.securityAdmin.getReportedSpaces(),
      ]);
      setSuspendedUsers(uRes.users);
      setReportedSpaces(sRes.spaces);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar usuários ou espaços.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    switch (activeTab) {
      case 'overview':
        void loadOverview();
        break;
      case 'reports':
        void loadReports();
        break;
      case 'alerts':
        void loadAlerts();
        break;
      case 'authorities':
        void loadAuthorities();
        break;
      case 'evidence':
        void loadEvidence();
        break;
      case 'audit':
        void loadAudit();
        break;
      case 'users':
      case 'spaces':
        void loadUsersAndSpaces();
        break;
      default:
        break;
    }
  }, [activeTab, loadOverview, loadReports, loadAlerts, loadAuthorities, loadEvidence, loadAudit, loadUsersAndSpaces]);

  // Inspect report detail
  const handleInspectReport = async (reportId: string) => {
    try {
      setLoading(true);
      const res = await api.securityAdmin.getReport(reportId);
      setSelectedReport(res.report);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar detalhes da denúncia.');
    } finally {
      setLoading(false);
    }
  };

  // Perform moderation action requiring justification
  const handleConfirmAction = async () => {
    if (!promptAction || !actionJustification.trim()) return;

    try {
      setLoading(true);
      setError(null);

      if (promptAction.type === 'report_status') {
        await api.securityAdmin.updateReport(promptAction.targetId, {
          status: promptAction.newStatus as SafetyReportStatus,
          justification: actionJustification.trim(),
        });
        await loadReports();
        if (selectedReport?.id === promptAction.targetId) {
          await handleInspectReport(promptAction.targetId);
        }
      } else if (promptAction.type === 'suspend_user') {
        await api.securityAdmin.suspendUser(promptAction.targetId, {
          justification: actionJustification.trim(),
        });
        await loadUsersAndSpaces();
      } else if (promptAction.type === 'reactivate_user') {
        await api.securityAdmin.reactivateUser(promptAction.targetId, {
          justification: actionJustification.trim(),
        });
        await loadUsersAndSpaces();
      } else if (promptAction.type === 'alert_status') {
        await api.securityAdmin.updateAlert(promptAction.targetId, {
          status: promptAction.newStatus as SecurityAlertStatus,
          justification: actionJustification.trim(),
        });
        await loadAlerts();
      } else if (promptAction.type === 'evidence_view') {
        const res = await api.securityAdmin.getEvidenceItem(promptAction.targetId, actionJustification.trim());
        setInspectedEvidence(res.evidence);
      }

      setPromptAction(null);
      setActionJustification('');
    } catch (err: any) {
      setError(err?.message || 'Falha ao executar ação de moderação.');
    } finally {
      setLoading(false);
    }
  };

  // Submit authority request
  const handleSubmitAuthority = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.securityAdmin.createAuthority({
        protocolNumber: authorityForm.protocolNumber.trim(),
        requestingBody: authorityForm.requestingBody.trim(),
        authorityName: authorityForm.authorityName.trim(),
        authorityContact: authorityForm.authorityContact.trim(),
        legalBasis: authorityForm.legalBasis.trim(),
        targetUserId: authorityForm.targetUserId.trim() || undefined,
        targetSpaceId: authorityForm.targetSpaceId.trim() || undefined,
        preservationDays: Number(authorityForm.preservationDays) || 180,
        notes: authorityForm.notes.trim() || undefined,
        justification: authorityForm.justification.trim(),
      });
      setShowNewAuthorityModal(false);
      setAuthorityForm({
        protocolNumber: '',
        requestingBody: '',
        authorityName: '',
        authorityContact: '',
        legalBasis: 'Art. 15 da Lei 12.965/2014 (Marco Civil da Internet)',
        targetUserId: '',
        targetSpaceId: '',
        preservationDays: 180,
        notes: '',
        justification: '',
      });
      await loadAuthorities();
    } catch (err: any) {
      setError(err?.message || 'Falha ao cadastrar solicitação da autoridade.');
    } finally {
      setLoading(false);
    }
  };

  const navItems: Array<{ id: SecurityTab; label: string; icon: string }> = [
    { id: 'overview', label: 'Visão Geral', icon: '📊' },
    { id: 'reports', label: 'Denúncias', icon: '🚨' },
    { id: 'alerts', label: 'Alertas', icon: '⚡' },
    { id: 'users', label: 'Usuários', icon: '👥' },
    { id: 'spaces', label: 'Espaços', icon: '🪐' },
    { id: 'authorities', label: 'Autoridades', icon: '⚖️' },
    { id: 'evidence', label: 'Evidências', icon: '🔒' },
    { id: 'audit', label: 'Auditoria', icon: '📜' },
    { id: 'policies', label: 'Políticas', icon: '🛡️' },
  ];

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-xl font-bold text-txt-primary flex items-center gap-2">
            <span>🛡️</span> Central de Segurança e Cooperação com Autoridades
          </h2>
          <p className="text-xs text-txt-secondary mt-1">
            Conformidade com a legislação brasileira (Marco Civil, LGPD, ECA e CF/88), integridade probatória e prevenção de abusos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Integridade SHA-256 Ativa
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-txt-secondary hover:text-txt-primary ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-white/5 scrollbar-none">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setSelectedReport(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-accent-primary text-white shadow-sm'
                  : 'text-txt-secondary hover:text-txt-primary hover:bg-white/5'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: VISÃO GERAL */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div
              onClick={() => setActiveTab('reports')}
              className="p-4 bg-surface-elevated/70 border border-white/5 rounded-2xl cursor-pointer hover:border-red-500/30 transition-all group"
            >
              <div className="text-[11px] font-medium text-txt-secondary flex justify-between">
                <span>Denúncias Pendentes</span>
                <span className="group-hover:translate-x-0.5 transition-transform">🚨</span>
              </div>
              <div className="text-2xl font-bold text-red-400 mt-2">
                {metrics?.pendingReportsCount ?? 0}
              </div>
              <div className="text-[10px] text-txt-tertiary mt-1">Aguardando triagem</div>
            </div>

            <div
              onClick={() => setActiveTab('alerts')}
              className="p-4 bg-surface-elevated/70 border border-white/5 rounded-2xl cursor-pointer hover:border-amber-500/30 transition-all group"
            >
              <div className="text-[11px] font-medium text-txt-secondary flex justify-between">
                <span>Alertas Técnicos</span>
                <span className="group-hover:translate-x-0.5 transition-transform">⚡</span>
              </div>
              <div className="text-2xl font-bold text-amber-400 mt-2">
                {metrics?.activeAlertsCount ?? 0}
              </div>
              <div className="text-[10px] text-txt-tertiary mt-1">Sinais comportamentais</div>
            </div>

            <div
              onClick={() => setActiveTab('authorities')}
              className="p-4 bg-surface-elevated/70 border border-white/5 rounded-2xl cursor-pointer hover:border-sky-500/30 transition-all group"
            >
              <div className="text-[11px] font-medium text-txt-secondary flex justify-between">
                <span>Ordens Judiciais / Ofícios</span>
                <span className="group-hover:translate-x-0.5 transition-transform">⚖️</span>
              </div>
              <div className="text-2xl font-bold text-sky-400 mt-2">
                {metrics?.authorityRequestsCount ?? 0}
              </div>
              <div className="text-[10px] text-txt-tertiary mt-1">Art. 15 Marco Civil</div>
            </div>

            <div
              onClick={() => setActiveTab('evidence')}
              className="p-4 bg-surface-elevated/70 border border-white/5 rounded-2xl cursor-pointer hover:border-emerald-500/30 transition-all group"
            >
              <div className="text-[11px] font-medium text-txt-secondary flex justify-between">
                <span>Cofre de Evidências</span>
                <span className="group-hover:translate-x-0.5 transition-transform">🔒</span>
              </div>
              <div className="text-2xl font-bold text-emerald-400 mt-2">
                {metrics?.totalEvidenceItems ?? 0}
              </div>
              <div className="text-[10px] text-txt-tertiary mt-1">Custódia SHA-256</div>
            </div>
          </div>

          {/* Quick Legal Principles Card */}
          <div className="p-4 bg-surface-elevated/40 border border-white/5 rounded-2xl space-y-3">
            <h3 className="text-xs font-semibold text-txt-primary flex items-center gap-2">
              <span>🏛️</span> Compromisso de Privacidade e Legalidade da Instância
            </h3>
            <div className="grid sm:grid-cols-3 gap-3 text-xs text-txt-secondary leading-relaxed">
              <div className="p-3 bg-black/20 rounded-xl space-y-1">
                <span className="font-semibold text-txt-primary block">Sem Vigilância Arbitrária</span>
                O Nuvio não realiza varreduras automáticas ocultas e não monitora mensagens diretas de forma massiva. Apenas conteúdos denunciados explicitamente pelos usuários são analisados.
              </div>
              <div className="p-3 bg-black/20 rounded-xl space-y-1">
                <span className="font-semibold text-txt-primary block">Cooperação Oficial</span>
                Atendimento a ofícios policiais e determinações judiciais estritamente fundamentadas na Lei nº 12.965/2014 (Marco Civil da Internet), mantendo integridade probatória auditada.
              </div>
              <div className="p-3 bg-black/20 rounded-xl space-y-1">
                <span className="font-semibold text-txt-primary block">Tolerância Zero para o ECA</span>
                Casos que envolvam abuso ou exploração de crianças e adolescentes recebem prioridade máxima urgente imediata e salvaguarda contra visualização imprópria no painel.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DENÚNCIAS */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-txt-primary">
              Denúncias Recebidas ({reports.length})
            </h3>
            <button
              onClick={loadReports}
              className="text-xs text-txt-secondary hover:text-txt-primary px-3 py-1 bg-surface-elevated rounded-lg"
            >
              Atualizar
            </button>
          </div>

          {reports.length === 0 ? (
            <div className="p-8 text-center text-xs text-txt-tertiary bg-surface-elevated/30 rounded-2xl">
              Nenhuma denúncia registrada no momento.
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((rep) => (
                <div
                  key={rep.id}
                  className="p-4 bg-surface-elevated/60 border border-white/5 rounded-2xl hover:border-white/10 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-txt-primary">
                        {rep.protocol}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          rep.priority === 'urgent'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : rep.priority === 'high'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-white/10 text-txt-secondary'
                        }`}
                      >
                        {rep.priority.toUpperCase()}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-elevated text-txt-secondary border border-white/5">
                        {rep.status}
                      </span>
                    </div>
                    <div className="text-xs text-txt-secondary">
                      Motivo: <span className="text-txt-primary font-medium">{rep.category}</span> • Alvo: {rep.targetType} ({rep.targetId})
                    </div>
                    {rep.description && (
                      <div className="text-xs text-txt-tertiary italic">
                        "{rep.description}"
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleInspectReport(rep.id)}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-txt-primary text-xs font-medium rounded-xl transition-colors"
                    >
                      Inspecionar Evidências
                    </button>
                    <button
                      onClick={() =>
                        setPromptAction({
                          type: 'report_status',
                          targetId: rep.id,
                          newStatus: rep.status === 'pending' ? 'triaged' : 'resolved',
                        })
                      }
                      className="px-3 py-1.5 bg-accent-primary hover:bg-accent-primary/80 text-white text-xs font-medium rounded-xl transition-colors"
                    >
                      {rep.status === 'pending' ? 'Triar' : 'Alterar Status'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Report Evidence Inspection Modal */}
          {selectedReport && (
            <div className="p-4 bg-surface-elevated border border-accent-primary/30 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-accent-primary">Inspeção Probatória Restrita</div>
                  <div className="text-sm font-bold text-txt-primary">Protocolo {selectedReport.protocol}</div>
                </div>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="text-xs text-txt-secondary hover:text-txt-primary"
                >
                  Fechar
                </button>
              </div>

              <div className="text-xs text-txt-secondary leading-relaxed bg-black/20 p-3 rounded-xl">
                🔒 <strong className="text-txt-primary">Salvaguarda de Privacidade:</strong> Apenas as mensagens anexadas explicitamente pelo denunciante estão disponíveis abaixo. O acesso irrestrito ao canal ou DM não é permitido.
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-txt-primary">
                  Evidências Anexadas ({selectedReport.evidences?.length ?? 0}):
                </div>
                {selectedReport.evidences?.map((ev) => (
                  <div key={ev.id} className="p-3 bg-black/30 rounded-xl space-y-2 border border-white/5">
                    <div className="flex items-center justify-between text-[11px] text-txt-tertiary">
                      <span>Autor: <strong className="text-txt-primary">@{ev.authorUsername || 'desconhecido'}</strong></span>
                      <span>Hash SHA-256 verificado</span>
                    </div>
                    <div className="text-xs text-txt-primary font-mono bg-surface-elevated/40 p-2.5 rounded-lg whitespace-pre-wrap">
                      {ev.contentSnapshot || '[Conteúdo não textual / anexo]'}
                    </div>
                    <div className="text-[10px] text-txt-tertiary font-mono break-all flex items-center gap-1">
                      <span>HASH:</span> <span className="text-emerald-400">{ev.sha256Hash}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ALERTAS DE SEGURANÇA */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-txt-primary">
              Alertas Comportamentais ({alerts.length})
            </h3>
            <button
              onClick={loadAlerts}
              className="text-xs text-txt-secondary hover:text-txt-primary px-3 py-1 bg-surface-elevated rounded-lg"
            >
              Atualizar
            </button>
          </div>

          {alerts.length === 0 ? (
            <div className="p-8 text-center text-xs text-txt-tertiary bg-surface-elevated/30 rounded-2xl">
              Nenhum alerta comportamental ativo. Todos os parâmetros operacionais normais.
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((al) => (
                <div
                  key={al.id}
                  className="p-4 bg-surface-elevated/60 border border-white/5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-txt-primary">
                        {al.alertType}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold">
                        {al.severity.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-txt-tertiary">
                        {new Date(al.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs text-txt-secondary">
                      {al.technicalExplanation}
                    </div>
                    {al.subjectUserId && (
                      <div className="text-[11px] text-txt-tertiary">
                        Usuário: @{al.subjectUsername || al.subjectUserId}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() =>
                      setPromptAction({
                        type: 'alert_status',
                        targetId: al.id,
                        newStatus: 'resolved',
                      })
                    }
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-txt-primary text-xs font-medium rounded-xl transition-colors shrink-0"
                  >
                    Marcar como Revisado
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: USUÁRIOS */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="p-4 bg-surface-elevated/60 border border-white/5 rounded-2xl space-y-3">
            <h3 className="text-xs font-semibold text-txt-primary">Ação de Moderação em Conta</h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="ID ou Username da conta a ser suspensa..."
                value={suspendUserIdInput}
                onChange={(e) => setSuspendUserIdInput(e.target.value)}
                className="flex-1 bg-surface-elevated border border-white/10 rounded-xl px-3 py-2 text-xs text-txt-primary focus:outline-none focus:border-red-500"
              />
              <button
                disabled={!suspendUserIdInput.trim()}
                onClick={() =>
                  setPromptAction({
                    type: 'suspend_user',
                    targetId: suspendUserIdInput.trim(),
                  })
                }
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                Suspender Conta
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-txt-primary">
              Contas Atualmente Suspensas ({suspendedUsers.length})
            </h3>
            {suspendedUsers.length === 0 ? (
              <div className="p-6 text-center text-xs text-txt-tertiary bg-surface-elevated/30 rounded-2xl">
                Nenhum usuário suspenso.
              </div>
            ) : (
              suspendedUsers.map((u) => (
                <div
                  key={u.id}
                  className="p-3 bg-surface-elevated/60 border border-white/5 rounded-xl flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-semibold text-txt-primary">@{u.username}</span>
                    <span className="text-[11px] text-txt-tertiary ml-2 font-mono">({u.id})</span>
                  </div>
                  <button
                    onClick={() =>
                      setPromptAction({
                        type: 'reactivate_user',
                        targetId: u.id,
                      })
                    }
                    className="px-3 py-1 bg-white/10 hover:bg-white/20 text-txt-primary text-xs rounded-lg transition-colors"
                  >
                    Reativar Conta
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: ESPAÇOS */}
      {activeTab === 'spaces' && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-txt-primary">
            Espaços com Denúncias ({reportedSpaces.length})
          </h3>
          {reportedSpaces.length === 0 ? (
            <div className="p-8 text-center text-xs text-txt-tertiary bg-surface-elevated/30 rounded-2xl">
              Nenhum espaço alvo de denúncias no momento.
            </div>
          ) : (
            reportedSpaces.map((sp) => (
              <div
                key={sp.id}
                className="p-4 bg-surface-elevated/60 border border-white/5 rounded-2xl flex items-center justify-between gap-3"
              >
                <div className="space-y-0.5 text-xs">
                  <div className="font-semibold text-txt-primary text-sm">{sp.name}</div>
                  <div className="text-txt-tertiary font-mono">ID: {sp.id}</div>
                  <div className="text-red-400 font-medium">
                    {sp.reportCount} {sp.reportCount === 1 ? 'denúncia recebida' : 'denúncias recebidas'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 6: SOLICITAÇÕES DE AUTORIDADES */}
      {activeTab === 'authorities' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-txt-primary">
              Ordens Judiciais e Preservação Legal (Marco Civil Art. 15)
            </h3>
            <button
              onClick={() => setShowNewAuthorityModal(true)}
              className="px-3 py-1.5 bg-accent-primary hover:bg-accent-primary/80 text-white text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5"
            >
              <span>+</span> Cadastrar Ofício / Mandado
            </button>
          </div>

          {authorities.length === 0 ? (
            <div className="p-8 text-center text-xs text-txt-tertiary bg-surface-elevated/30 rounded-2xl">
              Nenhuma solicitação de autoridade registrada.
            </div>
          ) : (
            <div className="space-y-3">
              {authorities.map((req) => (
                <div
                  key={req.id}
                  className="p-4 bg-surface-elevated/60 border border-white/5 rounded-2xl space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sky-400">{req.protocolNumber}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-elevated text-txt-secondary border border-white/10 font-medium">
                      {req.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-txt-primary font-medium">{req.requestingBody}</div>
                  <div className="text-txt-secondary">
                    Autoridade: <span className="text-txt-primary">{req.authorityName}</span> • Base Legal: {req.legalBasis}
                  </div>
                  {req.preservationUntil && (
                    <div className="text-[11px] text-amber-300">
                      Guarda legal obrigatória até: {new Date(req.preservationUntil).toLocaleDateString()}
                    </div>
                  )}
                  {req.notes && <div className="text-txt-tertiary italic">Notas: {req.notes}</div>}
                </div>
              ))}
            </div>
          )}

          {/* New Authority Registration Modal */}
          {showNewAuthorityModal && (
            <div className="p-4 bg-surface-elevated border border-sky-500/30 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-sm font-bold text-txt-primary">Cadastrar Requisição de Autoridade</span>
                <button onClick={() => setShowNewAuthorityModal(false)} className="text-xs text-txt-secondary hover:text-txt-primary">✕</button>
              </div>
              <form onSubmit={handleSubmitAuthority} className="space-y-3 text-xs">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-txt-secondary block mb-1">Número do Processo / Protocolo *</label>
                    <input
                      required
                      value={authorityForm.protocolNumber}
                      onChange={(e) => setAuthorityForm({ ...authorityForm, protocolNumber: e.target.value })}
                      placeholder="Ex: OFICIO-PCSP-2026-9871"
                      className="w-full bg-surface-elevated border border-white/10 rounded-xl px-3 py-2 text-txt-primary"
                    />
                  </div>
                  <div>
                    <label className="text-txt-secondary block mb-1">Órgão Requisitante *</label>
                    <input
                      required
                      value={authorityForm.requestingBody}
                      onChange={(e) => setAuthorityForm({ ...authorityForm, requestingBody: e.target.value })}
                      placeholder="Ex: Polícia Civil de SP / Delegacia de Crimes Cibernéticos"
                      className="w-full bg-surface-elevated border border-white/10 rounded-xl px-3 py-2 text-txt-primary"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-txt-secondary block mb-1">Nome da Autoridade *</label>
                    <input
                      required
                      value={authorityForm.authorityName}
                      onChange={(e) => setAuthorityForm({ ...authorityForm, authorityName: e.target.value })}
                      placeholder="Ex: Delegado Titular Dr. Silva"
                      className="w-full bg-surface-elevated border border-white/10 rounded-xl px-3 py-2 text-txt-primary"
                    />
                  </div>
                  <div>
                    <label className="text-txt-secondary block mb-1">Base Legal *</label>
                    <input
                      required
                      value={authorityForm.legalBasis}
                      onChange={(e) => setAuthorityForm({ ...authorityForm, legalBasis: e.target.value })}
                      className="w-full bg-surface-elevated border border-white/10 rounded-xl px-3 py-2 text-txt-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-txt-secondary block mb-1">Justificativa e Validação do Documento *</label>
                  <textarea
                    required
                    rows={2}
                    value={authorityForm.justification}
                    onChange={(e) => setAuthorityForm({ ...authorityForm, justification: e.target.value })}
                    placeholder="Confirmação de recebimento por canal oficial com assinatura/validador..."
                    className="w-full bg-surface-elevated border border-white/10 rounded-xl p-2.5 text-txt-primary resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewAuthorityModal(false)}
                    className="px-4 py-1.5 text-txt-secondary hover:text-txt-primary"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-full"
                  >
                    Salvar Requisição
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* TAB 7: EVIDÊNCIAS */}
      {activeTab === 'evidence' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-txt-primary">
              Cofre de Evidências Criptográficas ({evidenceItems.length})
            </h3>
            <button
              onClick={loadEvidence}
              className="text-xs text-txt-secondary hover:text-txt-primary px-3 py-1 bg-surface-elevated rounded-lg"
            >
              Atualizar
            </button>
          </div>

          {evidenceItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-txt-tertiary bg-surface-elevated/30 rounded-2xl">
              Nenhuma evidência depositada no cofre.
            </div>
          ) : (
            <div className="space-y-3">
              {evidenceItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-surface-elevated/60 border border-white/5 rounded-2xl space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-txt-primary">{item.evidenceType}</span>
                    {item.isExtremelySensitive ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-semibold border border-red-500/30">
                        Restrito (ECA)
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold">
                        Íntegro
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[11px] text-txt-tertiary break-all">
                    SHA-256: <span className="text-emerald-400">{item.hashSha256}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-txt-tertiary">
                      Depositado em {new Date(item.createdAt).toLocaleString()}
                    </span>
                    <button
                      onClick={() =>
                        setPromptAction({
                          type: 'evidence_view',
                          targetId: item.id,
                        })
                      }
                      className="px-3 py-1 bg-white/10 hover:bg-white/15 text-txt-primary text-xs rounded-lg transition-colors"
                    >
                      Acessar com Justificativa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Inspected Evidence Display */}
          {inspectedEvidence && (
            <div className="p-4 bg-surface-elevated border border-emerald-500/30 rounded-2xl space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="font-bold text-txt-primary">Registro de Custódia Legal</span>
                <button onClick={() => setInspectedEvidence(null)} className="text-txt-secondary hover:text-txt-primary">✕</button>
              </div>

              {inspectedEvidence.isExtremelySensitive ? (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 space-y-1">
                  <span className="font-bold block">⚠️ Material Restrito para Proteção Legal</span>
                  {inspectedEvidence.restrictedNotice}
                  <div className="font-mono text-[10px] text-txt-secondary mt-1">
                    Assinatura SHA-256 preservada: {inspectedEvidence.hashSha256}
                  </div>
                </div>
              ) : (
                <div className="bg-black/30 p-3 rounded-xl font-mono text-[11px] whitespace-pre-wrap text-txt-primary">
                  {inspectedEvidence.payloadEncrypted}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 8: AUDITORIA */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-txt-primary">
              Trilha de Auditoria Administrativa ({auditLogs.length})
            </h3>
            <button
              onClick={loadAudit}
              className="text-xs text-txt-secondary hover:text-txt-primary px-3 py-1 bg-surface-elevated rounded-lg"
            >
              Atualizar
            </button>
          </div>

          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-txt-tertiary bg-surface-elevated/30 rounded-2xl">
              Nenhuma ação administrativa registrada na trilha.
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-surface-elevated/60 border border-white/5 rounded-xl space-y-1 font-mono text-[11px]"
                >
                  <div className="flex items-center justify-between text-txt-tertiary">
                    <span>
                      {new Date(log.createdAt).toLocaleString()} • @{log.adminUsername || log.adminId}
                    </span>
                    <span className="text-accent-mint">{log.action}</span>
                  </div>
                  <div className="text-txt-primary font-sans">
                    Recurso: <span className="text-sky-300">{log.resourceType}</span> ({log.resourceId || 'N/A'})
                  </div>
                  <div className="text-txt-secondary font-sans italic bg-black/20 p-2 rounded-lg">
                    Justificativa: "{log.justification}"
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 9: POLÍTICAS DE SEGURANÇA & LEGISLAÇÃO */}
      {activeTab === 'policies' && (
        <div className="space-y-4 text-xs text-txt-secondary leading-relaxed">
          <div className="p-4 bg-surface-elevated/60 border border-white/5 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-txt-primary flex items-center gap-2">
              <span>⚖️</span> Marco Regulatório Aplicável à Operação do Nuvio
            </h3>
            <p>
              Esta instância opera sob estrita observância das normas vigentes na República Federativa do Brasil, harmonizando os direitos fundamentais à privacidade com a segurança coletiva e a cooperação jurídica.
            </p>

            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="p-3 bg-black/20 rounded-xl space-y-1">
                <span className="font-semibold text-txt-primary block">1. Constituição Federal de 1988 (Art. 5º, X e XII)</span>
                Assegura a inviolabilidade da intimidade, da vida privada, da honra e o sigilo da correspondência e das comunicações telegráficas, de dados e das comunicações telefônicas, salvo por ordem judicial fundamentada.
              </div>

              <div className="p-3 bg-black/20 rounded-xl space-y-1">
                <span className="font-semibold text-txt-primary block">2. Marco Civil da Internet (Lei nº 12.965/2014)</span>
                Regula o dever de guarda de registros de acesso a aplicações de internet em ambiente seguro e sigiloso (art. 15), prevendo o fornecimento de dados mediante ordem judicial motivada (art. 10), garantindo a liberdade de expressão e a neutralidade.
              </div>

              <div className="p-3 bg-black/20 rounded-xl space-y-1">
                <span className="font-semibold text-txt-primary block">3. Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD)</span>
                Aplica os princípios de finalidade, necessidade, adequação e transparência. Dados probatórios são tratados exclusivamente sob as bases legais de cumprimento de obrigação legal/regulatória e exercício regular de direitos.
              </div>

              <div className="p-3 bg-black/20 rounded-xl space-y-1">
                <span className="font-semibold text-txt-primary block">4. Estatuto da Criança e do Adolescente (ECA - Lei nº 8.069/1990)</span>
                Tolerância zero absoluta para pornografia infantil, exploração ou aliciamento de menores. Prioridade urgente em todas as rotinas administrativas e preservação cautelar com restrição de renderização.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Justification Modal for Moderation Actions */}
      {promptAction && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-surface-elevated border border-white/10 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-txt-primary">
              Justificativa Obrigatória de Auditoria
            </h3>
            <p className="text-xs text-txt-secondary leading-relaxed">
              Em conformidade com a LGPD e as normas de governança, todas as ações de moderação e acesso a dados exigem justificativa fundamentada e são registradas de forma indelével na trilha de auditoria.
            </p>
            <textarea
              autoFocus
              rows={3}
              value={actionJustification}
              onChange={(e) => setActionJustification(e.target.value)}
              placeholder="Descreva o motivo desta ação (mínimo de 5 caracteres)..."
              className="w-full bg-surface-elevated border border-white/10 rounded-xl p-3 text-xs text-txt-primary focus:outline-none focus:border-accent-primary resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPromptAction(null);
                  setActionJustification('');
                }}
                className="px-4 py-1.5 text-xs text-txt-secondary hover:text-txt-primary"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={actionJustification.trim().length < 5 || loading}
                onClick={handleConfirmAction}
                className="px-4 py-1.5 bg-accent-primary hover:bg-accent-primary/80 text-white text-xs font-medium rounded-full transition-colors disabled:opacity-50"
              >
                Confirmar Ação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
