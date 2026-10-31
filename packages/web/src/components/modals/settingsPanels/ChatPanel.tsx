import React from 'react';
import { useWinkStore } from '../../../stores/winkStore';
import { SparklesIcon } from '../../ui/icons';

export function ChatPanel() {
  const { settings, updateSettings } = useWinkStore();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-txt-primary mb-1">Chat</h2>
        <p className="text-xs text-txt-secondary">
          Personalize sua experiência de mensagens diretas e animações.
        </p>
      </div>

      {/* Winks Settings Section */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-5 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent-primary/20 text-accent-primary flex items-center justify-center">
            <SparklesIcon width="20" height="20" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Winks</h3>
            <p className="text-xs text-txt-secondary">
              Efeitos animados e sonoros estilo MSN Messenger exclusivos para mensagens diretas.
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-2 border-t border-white/[0.06]">
          {/* Autoplay Winks */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-txt-primary">Reproduzir Winks automaticamente</div>
              <div className="text-[11px] text-txt-tertiary">
                Executa animações recebidas assim que chegam na conversa aberta.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoplay}
              onClick={() => updateSettings({ autoplay: !settings.autoplay })}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                settings.autoplay ? 'bg-accent-primary' : 'bg-white/20'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings.autoplay ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Play sounds */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-txt-primary">Reproduzir sons dos Winks</div>
              <div className="text-[11px] text-txt-tertiary">
                Toca efeitos sonoros e músicas proceduralmente sincronizadas com as animações.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.playAudio}
              onClick={() => updateSettings({ playAudio: !settings.playAudio })}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                settings.playAudio ? 'bg-accent-primary' : 'bg-white/20'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings.playAudio ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Volume slider */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-txt-primary">Volume dos Winks</span>
              <span className="text-txt-tertiary font-mono">{settings.volume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.volume}
              disabled={!settings.playAudio}
              onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent-primary disabled:opacity-40"
            />
          </div>

          {/* Reduce animations */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="text-xs font-medium text-txt-primary">Reduzir animações</div>
              <div className="text-[11px] text-txt-tertiary">
                Substitui movimentos intensos por prévias simplificadas e leves.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.reduceMotion}
              onClick={() => updateSettings({ reduceMotion: !settings.reduceMotion })}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                settings.reduceMotion ? 'bg-accent-primary' : 'bg-white/20'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings.reduceMotion ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Disable incoming winks */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="text-xs font-medium text-txt-primary">Desativar Winks recebidos automaticamente</div>
              <div className="text-[11px] text-txt-tertiary">
                Não reproduz Winks na tela ao receber mensagens; apenas permite reprodução manual no histórico.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.disableIncoming}
              onClick={() => updateSettings({ disableIncoming: !settings.disableIncoming })}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                settings.disableIncoming ? 'bg-accent-primary' : 'bg-white/20'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings.disableIncoming ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
