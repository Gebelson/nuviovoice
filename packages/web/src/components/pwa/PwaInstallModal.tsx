import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../ui/Modal';
import { usePwaInstallStore } from '../../stores/pwaInstallStore';
import { useUIStore } from '../../stores/uiStore';

export function PwaInstallModal() {
  const { t } = useTranslation(['settings', 'common']);
  const isOpen = usePwaInstallStore((s) => s.isOpen);
  const closeInstallModal = usePwaInstallStore((s) => s.closeInstallModal);
  const dismissNotNow = usePwaInstallStore((s) => s.dismissNotNow);
  const dismissNever = usePwaInstallStore((s) => s.dismissNever);
  const triggerNativeInstall = usePwaInstallStore((s) => s.triggerNativeInstall);
  const isInstalling = usePwaInstallStore((s) => s.isInstalling);
  const environment = usePwaInstallStore((s) => s.environment);
  const addToast = useUIStore((s) => s.addToast);

  const [neverShowAgain, setNeverShowAgain] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    if (neverShowAgain) {
      dismissNever();
    } else {
      closeInstallModal();
    }
  };

  const handleNotNow = () => {
    if (neverShowAgain) {
      dismissNever();
    } else {
      dismissNotNow();
    }
  };

  const handleInstallClick = async () => {
    if (environment.canPromptNative) {
      const outcome = await triggerNativeInstall();
      if (outcome === 'accepted') {
        addToast('Nuvio instalado com sucesso!', 'success');
      }
    } else {
      handleClose();
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
      addToast('Link copiado! Cole no navegador padrão.', 'success');
    } catch {
      addToast('Não foi possível copiar o link.', 'warning');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      mobileStyle="sheet"
      maxWidth="max-w-lg"
    >
      <div className="flex flex-col gap-5 text-txt-primary select-none">
        {/* Header Hero */}
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-accent-primary/20 border border-accent-primary/30 flex items-center justify-center shrink-0 shadow-lg p-2.5">
            <img
              src="/icons/nuvio_logo.svg"
              alt="Nuvio"
              className="w-full h-full object-contain pointer-events-none"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-white tracking-tight">
                Instale o Nuvio
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/[0.08] text-txt-secondary border border-white/10 shrink-0">
                {environment.label}
              </span>
            </div>
            <p className="text-xs text-txt-secondary mt-1 leading-relaxed">
              Acesse suas conversas diretamente da tela inicial, como um aplicativo nativo e rápido.
            </p>
          </div>
        </div>

        {/* Dynamic Instructions per Platform & Browser */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4 flex flex-col gap-3.5">
          {/* Case 1: In-App Browser (Instagram, WhatsApp, TikTok, etc.) */}
          {environment.isInAppBrowser ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>Navegador interno detectado</span>
              </div>
              <p className="text-xs text-txt-secondary leading-relaxed">
                Navegadores internos de redes sociais não permitem adicionar o app à tela inicial.
              </p>
              <div className="space-y-2 mt-1 text-xs">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    1
                  </span>
                  <span>Toque nos <strong>três pontos (⋯)</strong> ou ícone de opções no topo.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Selecione <strong>"Abrir no Safari"</strong> ou <strong>"Abrir no navegador"</strong>.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="mt-2 w-full py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-medium text-white flex items-center justify-center gap-2 transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>{copiedLink ? 'Link copiado!' : 'Copiar link do Nuvio'}</span>
              </button>
            </div>
          ) : environment.platform === 'ios' && environment.browser === 'safari' ? (
            /* Case 2: iOS / iPadOS Safari */
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold text-white">
                Como adicionar à tela inicial no Safari:
              </span>
              <div className="space-y-2.5 text-xs text-txt-secondary">
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-accent-primary/20 text-accent-primary flex items-center justify-center shrink-0 mt-0.5">
                    {/* Safari Share Icon: Square with upward arrow */}
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                  </div>
                  <div>
                    <strong className="text-white">1. Toque em Compartilhar</strong>
                    <p className="text-[11px] text-txt-tertiary">
                      Localizado na barra inferior do iPhone ou no topo do iPad.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-accent-primary/20 text-accent-primary flex items-center justify-center shrink-0 mt-0.5">
                    {/* Add to Home Screen Icon: Square with plus */}
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="4" />
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                  </div>
                  <div>
                    <strong className="text-white">2. Selecione "Adicionar à Tela de Início"</strong>
                    <p className="text-[11px] text-txt-tertiary">
                      Role o menu de compartilhamento para cima até encontrar a opção.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-accent-primary/20 text-accent-primary flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <strong className="text-white">3. Confirme em "Adicionar"</strong>
                    <p className="text-[11px] text-txt-tertiary">
                      No canto superior direito. O Nuvio aparecerá na sua tela inicial!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : environment.platform === 'ios' ? (
            /* Case 3: iOS Chrome / Edge / Firefox */
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold text-white">
                Instalação no {environment.browser === 'chrome' ? 'Chrome' : environment.browser === 'edge' ? 'Edge' : 'navegador'}:
              </span>
              <div className="space-y-2.5 text-xs text-txt-secondary">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Toque no menu <strong>(três pontos ⋯)</strong> ou no botão de compartilhar.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Selecione <strong>"Adicionar à Tela de Início"</strong>.
                  </span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-between gap-2 mt-1">
                <span className="text-[11px] text-txt-secondary">
                  Prefere abrir no Safari para suporte completo a notificações?
                </span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-2.5 py-1 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-white text-[11px] font-semibold shrink-0 transition-colors"
                >
                  {copiedLink ? 'Copiado!' : 'Copiar link'}
                </button>
              </div>
            </div>
          ) : environment.canPromptNative ? (
            /* Case 4: Android with native prompt */
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-status-online text-xs font-semibold">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Instalação rápida disponível</span>
              </div>
              <p className="text-xs text-txt-secondary leading-relaxed">
                Você pode instalar o Nuvio diretamente em um toque. O aplicativo será integrado à sua lista de apps com notificações e tela cheia.
              </p>
            </div>
          ) : (
            /* Case 5: Android without native prompt (manual menu instructions) */
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold text-white">
                Como instalar pelo menu do navegador:
              </span>
              <div className="space-y-2.5 text-xs text-txt-secondary">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Toque no menu do navegador <strong>(três pontos ⋮)</strong> no canto da tela.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Confirme em <strong>"Instalar"</strong>.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Benefits list */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <span className="text-sm">⚡</span>
            <div className="text-[11px] font-semibold text-white mt-0.5">Abertura rápida</div>
            <div className="text-[10px] text-txt-tertiary">Sem barra de URL</div>
          </div>
          <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <span className="text-sm">🔔</span>
            <div className="text-[11px] font-semibold text-white mt-0.5">Notificações</div>
            <div className="text-[10px] text-txt-tertiary">Alertas em tempo real</div>
          </div>
          <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <span className="text-sm">📱</span>
            <div className="text-[11px] font-semibold text-white mt-0.5">Experiência nativa</div>
            <div className="text-[10px] text-txt-tertiary">Tela cheia fluida</div>
          </div>
        </div>

        {/* Checkbox "Não mostrar novamente" */}
        <label className="flex items-center gap-2.5 cursor-pointer text-xs text-txt-secondary hover:text-white transition-colors">
          <input
            type="checkbox"
            checked={neverShowAgain}
            onChange={(e) => setNeverShowAgain(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-white/5 text-accent-primary focus:ring-accent-primary/50 cursor-pointer"
          />
          <span>Não mostrar esta mensagem novamente</span>
        </label>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={handleNotNow}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-txt-secondary hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
          >
            Agora não
          </button>
          <button
            type="button"
            onClick={handleInstallClick}
            disabled={isInstalling}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-accent-primary hover:bg-accent-primary-hover shadow-lg shadow-accent-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isInstalling ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Instalando…</span>
              </>
            ) : environment.canPromptNative ? (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Instalar Nuvio</span>
              </>
            ) : (
              <span>Entendi</span>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
