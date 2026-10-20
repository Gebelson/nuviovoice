import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpaceStore } from '../../stores/spaceStore';
import { useAuthStore } from '../../stores/authStore';
import { useBotStore } from '../../stores/botStore';
import { resolveUploadUrl } from '../../utils/assetUrls';
import type { Bot } from '@concord/shared';

interface BotInstallModalProps {
  bot: Bot;
  initialSpaceId?: string | null;
  onClose: () => void;
  onSuccess?: (spaceId: string) => void;
}

const PERMISSION_LABELS: Record<string, { label: string; description: string }> = {
  ADMINISTRATOR: {
    label: 'Administrador',
    description: 'Acesso completo a todas as funções e canais do espaço.',
  },
  MANAGE_SPACE: {
    label: 'Gerenciar Espaço',
    description: 'Modificar nome, ícone e configurações do espaço.',
  },
  MANAGE_ROLES: {
    label: 'Gerenciar Cargos',
    description: 'Criar, editar e atribuir cargos aos participantes.',
  },
  MANAGE_CHANNELS: {
    label: 'Gerenciar Canais',
    description: 'Criar, editar e remover canais de texto e voz.',
  },
  KICK_MEMBERS: {
    label: 'Expulsar Membros',
    description: 'Remover participantes infratores do espaço.',
  },
  BAN_MEMBERS: {
    label: 'Banir Membros',
    description: 'Bloquear permanentemente a entrada de usuários indesejados.',
  },
  MANAGE_MESSAGES: {
    label: 'Gerenciar Mensagens',
    description: 'Apagar e moderar mensagens enviadas por outros membros.',
  },
  SEND_MESSAGES: {
    label: 'Enviar Mensagens',
    description: 'Publicar mensagens e avisos nos canais de texto.',
  },
  VIEW_CHANNEL: {
    label: 'Ver Canais',
    description: 'Ler mensagens e visualizar a estrutura de canais.',
  },
};

export function BotInstallModal({
  bot,
  initialSpaceId,
  onClose,
  onSuccess,
}: BotInstallModalProps) {
  const navigate = useNavigate();
  const spaces = useSpaceStore((s) => s.spaces);
  const currentUser = useAuthStore((s) => s.user);
  const installBot = useBotStore((s) => s.installBot);

  // Filter spaces where user is owner or manager
  const eligibleSpaces = spaces.filter(
    (space) => space.ownerId === currentUser?.id
  );

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(
    initialSpaceId && eligibleSpaces.some((s) => s.id === initialSpaceId)
      ? initialSpaceId
      : eligibleSpaces[0]?.id || ''
  );

  const [grantedPermissions, setGrantedPermissions] = useState<string[]>(
    bot.requiredPermissions || []
  );

  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSpace = spaces.find((s) => s.id === selectedSpaceId);

  const togglePermission = (perm: string) => {
    setGrantedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleInstall = async () => {
    if (!selectedSpaceId) return;
    setIsInstalling(true);
    setError(null);
    try {
      const res = await installBot(selectedSpaceId, bot.id, grantedPermissions);
      if (res.success) {
        setStep(4);
        if (onSuccess) onSuccess(selectedSpaceId);
      } else {
        setError('Não foi possível instalar o bot. Verifique suas permissões.');
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao conectar o bot ao espaço.');
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-lg bg-surface-panel/90 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-txt-primary animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-accent-primary/20 border border-accent-primary/30 p-0.5 overflow-hidden flex items-center justify-center shadow-md">
              {bot.avatar ? (
                <img
                  src={resolveUploadUrl(bot.avatar) ?? undefined}
                  alt={bot.name}
                  className="w-full h-full object-cover rounded-[10px]"
                />
              ) : (
                <span className="text-xl">🤖</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-lg font-bold text-white leading-tight">
                  Adicionar {bot.name}
                </h2>
                {bot.isVerified && (
                  <span
                    className="inline-flex text-accent-primary"
                    title="Bot Verificado Oficial"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                  </span>
                )}
              </div>
              <p className="text-xs text-txt-muted mt-0.5">
                Passo {step} de 3 • Instalação no Espaço
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-txt-muted hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              {error}
            </div>
          )}

          {/* STEP 1: Select Space */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Selecione onde deseja instalar o bot:
                </h3>
                <p className="text-xs text-txt-muted mt-1">
                  Apenas espaços onde você é proprietário ou possui permissão de
                  gerenciamento são exibidos.
                </p>
              </div>

              {eligibleSpaces.length === 0 ? (
                <div className="text-center py-8 px-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02]">
                  <p className="text-sm text-txt-muted">
                    Você ainda não administra nenhum espaço. Crie um espaço
                    primeiro para instalar bots!
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {eligibleSpaces.map((space) => {
                    const isSelected = space.id === selectedSpaceId;
                    return (
                      <button
                        key={space.id}
                        type="button"
                        onClick={() => setSelectedSpaceId(space.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                          isSelected
                            ? 'bg-accent-primary/20 border-accent-primary text-white shadow-lg'
                            : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/15 text-txt-primary'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-surface-chat border border-white/10 overflow-hidden flex items-center justify-center font-bold text-sm">
                            {space.icon ? (
                              <img
                                src={resolveUploadUrl(space.icon) ?? undefined}
                                alt={space.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              space.name.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-sm">
                              {space.name}
                            </div>
                            <div className="text-xs text-txt-muted">
                              Proprietário
                            </div>
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                            isSelected
                              ? 'border-accent-primary bg-accent-primary text-white'
                              : 'border-white/30'
                          }`}
                        >
                          {isSelected && (
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                            >
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Review Permissions */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Permissões solicitadas por {bot.name}
                </h3>
                <p className="text-xs text-txt-muted mt-1">
                  Personalize quais permissões este bot poderá exercer dentro do
                  espaço <strong>{selectedSpace?.name}</strong>.
                </p>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {(bot.requiredPermissions.length > 0
                  ? bot.requiredPermissions
                  : ['SEND_MESSAGES', 'VIEW_CHANNEL']
                ).map((perm) => {
                  const info = PERMISSION_LABELS[perm] || {
                    label: perm,
                    description: 'Ação autorizada dentro do espaço.',
                  };
                  const isChecked = grantedPermissions.includes(perm);

                  return (
                    <label
                      key={perm}
                      className="flex items-start gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePermission(perm)}
                        className="mt-0.5 rounded border-white/20 bg-surface-chat text-accent-primary focus:ring-accent-primary"
                      />
                      <div className="flex-1 text-xs">
                        <div className="font-semibold text-white">
                          {info.label}
                        </div>
                        <div className="text-txt-muted mt-0.5">
                          {info.description}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Confirmation */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-accent-primary/20 bg-accent-primary/10 text-center space-y-2">
                <div className="text-xs uppercase tracking-wider font-bold text-accent-primary">
                  Confirmar Autorização
                </div>
                <p className="text-sm text-txt-secondary leading-relaxed">
                  Você está autorizando o bot <strong>{bot.name}</strong> a
                  acessar o espaço <strong>{selectedSpace?.name}</strong> com as{' '}
                  <strong>{grantedPermissions.length}</strong> permissões
                  concedidas.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-2 text-xs text-txt-muted">
                <div className="flex items-center gap-2 font-medium text-txt-primary">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-accent-primary"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  Segurança e Privacidade Nuvio
                </div>
                <p>
                  O bot poderá responder a comandos iniciados com{' '}
                  <code className="text-accent-primary font-mono bg-white/5 px-1 py-0.5 rounded">
                    {bot.prefix || '/'}
                  </code>{' '}
                  e interagir de acordo com as permissões concedidas. Você pode
                  revogar ou alterar essas permissões a qualquer momento em{' '}
                  <em>Configurações do espaço → Integrações</em>.
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: Success */}
          {step === 4 && (
            <div className="py-6 text-center space-y-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center text-3xl shadow-lg">
                ✓
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">
                  {bot.name} foi adicionado!
                </h3>
                <p className="text-sm text-txt-muted mt-1 max-w-sm mx-auto">
                  O bot já está conectado ao espaço{' '}
                  <strong>{selectedSpace?.name}</strong> e disponível para uso
                  imediato.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(`/space/${selectedSpaceId}`);
                  }}
                  className="px-6 py-2.5 rounded-xl bg-accent-primary hover:bg-accent-primary/90 text-white font-semibold text-sm transition-colors shadow-lg"
                >
                  Abrir Espaço
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {step !== 4 && (
          <div className="p-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as any)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-txt-muted hover:text-white hover:bg-white/5 transition-colors"
              >
                Voltar
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-medium text-txt-muted hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>

              {step === 1 && (
                <button
                  type="button"
                  disabled={!selectedSpaceId}
                  onClick={() => setStep(2)}
                  className="px-5 py-2 rounded-xl bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-50 text-white text-sm font-semibold transition-colors shadow-md"
                >
                  Continuar
                </button>
              )}

              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-5 py-2 rounded-xl bg-accent-primary hover:bg-accent-primary/90 text-white text-sm font-semibold transition-colors shadow-md"
                >
                  Continuar
                </button>
              )}

              {step === 3 && (
                <button
                  type="button"
                  disabled={isInstalling}
                  onClick={handleInstall}
                  className="px-5 py-2 rounded-xl bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-50 text-white text-sm font-semibold transition-colors shadow-lg flex items-center gap-2"
                >
                  {isInstalling ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Instalando...
                    </>
                  ) : (
                    'Autorizar e Instalar'
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
