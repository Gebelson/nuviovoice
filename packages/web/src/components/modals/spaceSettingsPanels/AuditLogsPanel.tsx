import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '../../../i18n/formatters';
import { describeError } from '../../../i18n/errors';
import { Avatar } from '../../ui/Avatar';
import { api } from '../../../api/client';
import { useSpaceStore, getApiForOrigin } from '../../../stores/spaceStore';
import type { AuditLogItem } from '@concord/shared';

interface AuditLogsPanelProps {
  spaceId: string;
}

export function AuditLogsPanel({ spaceId }: AuditLogsPanelProps) {
  const { t } = useTranslation(['spaces', 'common']);
  const spaces = useSpaceStore((s) => s.spaces);
  const f = useFormatters();
  const space = spaces.find((s) => s.id === spaceId);
  const spaceApi = getApiForOrigin(space?._instanceOrigin ?? '');

  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await spaceApi.spaces.getAuditLogs(spaceId);
      setLogs(data.auditLogs || []);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setIsLoading(false);
    }
  }, [spaceId, spaceApi]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const formatAction = (action: string) => {
    switch (action) {
      case 'message_delete':
        return {
          label: 'Exclusão de mensagem',
          color: 'bg-accent-rose/15 text-accent-rose border-accent-rose/30',
        };
      case 'message_bulk_delete':
        return {
          label: 'Exclusão em massa',
          color: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
        };
      default:
        return {
          label: action,
          color: 'bg-white/10 text-txt-secondary border-white/20',
        };
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="w-6 h-6 border-2 border-white/20 border-t-accent-primary rounded-full animate-spin" />
        <div className="text-txt-tertiary text-sm">Carregando registros de auditoria...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-txt-primary">Registro de Auditoria</h2>
          <p className="text-xs text-txt-tertiary mt-0.5">
            Histórico das ações de moderação e exclusões de mensagens realizadas na comunidade.
          </p>
        </div>
        <button
          onClick={loadLogs}
          className="p-1.5 rounded-lg text-txt-tertiary hover:text-white hover:bg-white/[0.06] transition-colors"
          title="Atualizar registros"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-accent-rose/10 border border-accent-rose/30 rounded-xl text-txt-danger text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={loadLogs}
            className="text-xs font-semibold underline hover:no-underline ml-2"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {logs.length === 0 ? (
        <div className="text-center py-12 glass-bubble rounded-2xl border border-white/5 space-y-2">
          <div className="w-10 h-10 mx-auto rounded-full bg-white/[0.04] flex items-center justify-center text-txt-tertiary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="text-sm font-medium text-txt-secondary">Nenhum registro de auditoria</div>
          <div className="text-xs text-txt-tertiary max-w-sm mx-auto">
            Ações de moderação como exclusão de mensagens aparecerão registradas aqui.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider px-1">
            {logs.length} {logs.length === 1 ? 'registro' : 'registros'} de moderação
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin pr-1">
            {logs.map((log) => {
              const actionMeta = formatAction(log.action);
              const actorName = log.actor?.displayName ?? log.actor?.username ?? log.actorId;
              const targetUserName = log.targetUser
                ? (log.targetUser.displayName ?? log.targetUser.username)
                : null;
              const dateStr = f.formatNumericDate(log.createdAt);

              return (
                <div
                  key={log.id}
                  className="p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] transition-all flex flex-col gap-2.5"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`px-2 py-0.5 text-[11px] font-medium border rounded-full ${actionMeta.color}`}
                      >
                        {actionMeta.label}
                      </span>
                      {log.channelName && (
                        <span className="text-xs font-semibold text-txt-tertiary">
                          #{log.channelName}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-txt-tertiary">{dateStr}</span>
                  </div>

                  <div className="flex items-center gap-2.5 text-sm">
                    <Avatar
                      src={log.actor?.avatar ?? null}
                      name={actorName}
                      size={24}
                      userId={log.actorId}
                    />
                    <div className="min-w-0 text-txt-secondary leading-tight">
                      <span className="font-semibold text-white">{actorName}</span>
                      {log.action === 'message_delete' && (
                        <>
                          {' '}excluiu mensagem de{' '}
                          {targetUserName ? (
                            <span className="font-semibold text-white">@{targetUserName}</span>
                          ) : (
                            <span className="text-txt-tertiary">usuário</span>
                          )}
                        </>
                      )}
                      {log.action === 'message_bulk_delete' && (
                        <>
                          {' '}excluiu{' '}
                          <strong className="text-white">
                            {log.details?.count ?? 'múltiplas'} mensagens
                          </strong>{' '}
                          em massa
                        </>
                      )}
                    </div>
                  </div>

                  {log.details?.contentSnippet && (
                    <div className="p-2 rounded-lg bg-black/30 border border-white/5 text-xs text-txt-muted italic line-clamp-2">
                      "{log.details.contentSnippet}"
                    </div>
                  )}

                  {log.reason && (
                    <div className="text-xs text-txt-tertiary flex items-center gap-1.5 pl-1">
                      <span className="font-medium text-txt-secondary">Motivo:</span>
                      <span className="text-txt-primary">{log.reason}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
