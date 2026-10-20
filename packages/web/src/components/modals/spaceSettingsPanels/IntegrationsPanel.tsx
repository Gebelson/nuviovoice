import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBotStore } from '../../../stores/botStore';
import { useUIStore } from '../../../stores/uiStore';
import { resolveUploadUrl } from '../../../utils/assetUrls';
import type { BotInstallation, Bot } from '@concord/shared';

const PERMISSION_NAMES: Record<string, string> = {
  ADMINISTRATOR: 'Administrador',
  MANAGE_SPACE: 'Gerenciar Espaço',
  MANAGE_ROLES: 'Gerenciar Cargos',
  MANAGE_CHANNELS: 'Gerenciar Canais',
  KICK_MEMBERS: 'Expulsar Membros',
  BAN_MEMBERS: 'Banir Membros',
  MANAGE_MESSAGES: 'Gerenciar Mensagens',
  SEND_MESSAGES: 'Enviar Mensagens',
  VIEW_CHANNEL: 'Ver Canais',
};

export function IntegrationsPanel({ spaceId }: { spaceId: string }) {
  const navigate = useNavigate();
  const closeModal = useUIStore((s) => s.closeModal);
  const installedMap = useBotStore((s) => s.installedSpaceBots);
  const loadSpaceBots = useBotStore((s) => s.loadSpaceBots);
  const uninstallBot = useBotStore((s) => s.uninstallBot);
  const updatePermissions = useBotStore((s) => s.updatePermissions);

  const installedBots = installedMap[spaceId] || [];
  const [loading, setLoading] = useState(true);
  const [editingBot, setEditingBot] = useState<(BotInstallation & { bot: Bot }) | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    void loadSpaceBots(spaceId).finally(() => setLoading(false));
  }, [spaceId]);

  const handleOpenDiscover = () => {
    closeModal();
    navigate(`/store/bots?spaceId=${encodeURIComponent(spaceId)}`);
  };

  const handleUninstall = async (botId: string, botName: string) => {
    if (
      !window.confirm(
        `Tem certeza que deseja remover o bot ${botName} deste espaço? O bot será desconectado e não responderá mais a comandos.`
      )
    ) {
      return;
    }
    await uninstallBot(spaceId, botId);
  };

  const handleStartEdit = (item: BotInstallation & { bot: Bot }) => {
    setEditingBot(item);
    setSelectedPerms(item.grantedPermissions || []);
  };

  const handleTogglePerm = (perm: string) => {
    setSelectedPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleSavePerms = async () => {
    if (!editingBot) return;
    setSaving(true);
    try {
      await updatePermissions(spaceId, editingBot.botId, selectedPerms);
      setEditingBot(null);
    } catch (err: any) {
      alert(err?.message || 'Erro ao salvar permissões');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-txt-primary">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h2 className="text-lg font-bold text-white leading-tight">
            Integrações & Bots
          </h2>
          <p className="text-xs text-txt-muted mt-0.5">
            Gerencie os bots e integrações ativas no seu espaço
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenDiscover}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-primary hover:bg-accent-primary/90 text-white font-semibold text-xs shadow-md transition-all self-start sm:self-auto"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M5 12h14M12 5v14" />
          </svg>
          Descobrir Bots
        </button>
      </div>

      {/* Bots list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-20 rounded-2xl bg-surface-panel/40 border border-white/5 animate-pulse"
            />
          ))}
        </div>
      ) : installedBots.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.01] space-y-3">
          <div className="text-3xl">🤖</div>
          <h3 className="text-base font-bold text-white">
            Nenhum bot instalado neste espaço
          </h3>
          <p className="text-xs text-txt-muted max-w-sm mx-auto">
            Aumente o engajamento e a segurança da sua comunidade adicionando
            bots de moderação, música, enquetes e jogos.
          </p>
          <button
            type="button"
            onClick={handleOpenDiscover}
            className="px-5 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-white font-semibold text-xs transition-colors border border-white/10"
          >
            Explorar Biblioteca de Bots
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {installedBots.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-2xl bg-surface-panel/70 border border-white/10 shadow-lg space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-surface-chat border border-white/10 overflow-hidden flex items-center justify-center font-bold text-lg shadow-sm">
                    {item.bot.avatar ? (
                      <img
                        src={resolveUploadUrl(item.bot.avatar) ?? undefined}
                        alt={item.bot.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      '🤖'
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-white">
                        {item.bot.name}
                      </span>
                      {item.bot.isVerified && (
                        <span
                          className="text-accent-primary"
                          title="Bot Verificado"
                        >
                          ✓
                        </span>
                      )}
                      <span className="px-1.5 py-0.2 rounded bg-accent-primary/20 text-accent-primary text-[10px] font-bold">
                        BOT
                      </span>
                    </div>
                    <p className="text-xs text-txt-muted line-clamp-1 mt-0.5">
                      {item.bot.tagline || item.bot.description || 'Bot ativo no espaço.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(item)}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-txt-secondary hover:text-white text-xs font-semibold transition-colors border border-white/5"
                  >
                    Permissões
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUninstall(item.botId, item.bot.name)}
                    className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition-colors border border-red-500/20"
                  >
                    Remover
                  </button>
                </div>
              </div>

              {/* Granted permissions chips */}
              {item.grantedPermissions && item.grantedPermissions.length > 0 && (
                <div className="pt-2 border-t border-white/5 flex flex-wrap gap-1.5 items-center">
                  <span className="text-[10px] text-txt-muted mr-1 font-semibold uppercase">
                    Permissões:
                  </span>
                  {item.grantedPermissions.map((perm) => (
                    <span
                      key={perm}
                      className="px-2 py-0.5 rounded bg-white/[0.03] border border-white/5 text-[10px] text-txt-muted"
                    >
                      {PERMISSION_NAMES[perm] || perm}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Permissions Modal */}
      {editingBot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md bg-surface-panel border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white">
                Permissões de {editingBot.bot.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingBot(null)}
                className="text-txt-muted hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {(editingBot.bot.requiredPermissions &&
              editingBot.bot.requiredPermissions.length > 0
                ? editingBot.bot.requiredPermissions
                : ['VIEW_CHANNEL', 'SEND_MESSAGES']
              ).map((perm) => {
                const label = PERMISSION_NAMES[perm] || perm;
                const isChecked = selectedPerms.includes(perm);
                return (
                  <label
                    key={perm}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/[0.05]"
                  >
                    <span className="text-xs font-medium text-white">{label}</span>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleTogglePerm(perm)}
                      className="rounded border-white/20 bg-surface-chat text-accent-primary focus:ring-accent-primary"
                    />
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setEditingBot(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-txt-muted hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSavePerms}
                className="px-5 py-2 rounded-xl bg-accent-primary hover:bg-accent-primary/90 text-white font-bold text-xs transition-colors shadow-md"
              >
                {saving ? 'Salvando...' : 'Salvar Permissões'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
