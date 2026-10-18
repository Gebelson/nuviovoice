import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVoiceStore } from '../../../stores/voiceStore';
import { AudioManager } from '../../../audio/AudioManager';
import { NoiseSuppressionController } from '../../../audio/processors/NoiseSuppressionController';
import type { NoiseSuppressionMode, NoiseSuppressionStatus } from '../../../audio/processors/types';

export function NoiseSuppressionSection() {
  const { t } = useTranslation(['settings', 'common']);
  const mode = useVoiceStore((s) => s.noiseSuppressionMode);
  const setMode = useVoiceStore((s) => s.setNoiseSuppressionMode);

  const [status, setStatus] = useState<NoiseSuppressionStatus>(() =>
    NoiseSuppressionController.getInstance().getStatus()
  );
  const [isTesting, setIsTesting] = useState(false);
  const [previewFilter, setPreviewFilter] = useState<'filtered' | 'original'>('filtered');
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);

  const animFrameRef = useRef<number>(0);

  // Subscribe to controller state changes (loading, fallback, readiness)
  useEffect(() => {
    const controller = NoiseSuppressionController.getInstance();
    const unsubscribe = controller.subscribe((newStatus) => {
      setStatus(newStatus);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Ensure AudioContext is ready and synchronized with store mode
  useEffect(() => {
    const am = AudioManager.getInstance();
    am.setNoiseSuppressionMode(mode).catch(() => {});
  }, [mode]);

  // Real-time dual meter animation loop (Input vs Output)
  useEffect(() => {
    let stopped = false;
    const am = AudioManager.getInstance();
    const rawAnalyser = am.getRawInputAnalyser();
    const procAnalyser = am.getProcessedAnalyser();

    const rawData = new Uint8Array(rawAnalyser.frequencyBinCount);
    const procData = new Uint8Array(procAnalyser.frequencyBinCount);

    const tick = () => {
      if (stopped) return;
      if (am.hasActiveStream() || isTesting) {
        rawAnalyser.getByteFrequencyData(rawData);
        procAnalyser.getByteFrequencyData(procData);

        const rawAvg = rawData.reduce((a, b) => a + b, 0) / rawData.length;
        const procAvg = procData.reduce((a, b) => a + b, 0) / procData.length;

        // Apply a gentle curve for visual responsiveness
        setInputLevel(Math.min(1, (rawAvg / 110)));
        setOutputLevel(Math.min(1, (procAvg / 110)));
      } else {
        setInputLevel(0);
        setOutputLevel(0);
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };

    tick();
    return () => {
      stopped = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isTesting]);

  // Clean up mic test on unmount
  useEffect(() => {
    return () => {
      AudioManager.getInstance().stopMicTest();
    };
  }, []);

  const handleModeSelect = async (newMode: NoiseSuppressionMode) => {
    setMode(newMode);
    await AudioManager.getInstance().setNoiseSuppressionMode(newMode);
  };

  const toggleTest = async () => {
    const am = AudioManager.getInstance();
    if (isTesting) {
      am.stopMicTest();
      setIsTesting(false);
    } else {
      setIsTesting(true);
      await am.startMicTest();
      am.setMicTestListening(true, previewFilter === 'filtered' ? 'processed' : 'original');
    }
  };

  const handlePreviewModeChange = (filter: 'filtered' | 'original') => {
    setPreviewFilter(filter);
    if (isTesting) {
      AudioManager.getInstance().setMicTestListening(true, filter === 'filtered' ? 'processed' : 'original');
    }
  };

  const modes: Array<{
    id: NoiseSuppressionMode;
    title: string;
    description: string;
    badge?: string;
  }> = [
    {
      id: 'disabled',
      title: t('settings:voice.noiseSuppression.modes.disabled.title'),
      description: t('settings:voice.noiseSuppression.modes.disabled.description'),
    },
    {
      id: 'standard',
      title: t('settings:voice.noiseSuppression.modes.standard.title'),
      description: t('settings:voice.noiseSuppression.modes.standard.description'),
    },
    {
      id: 'smart',
      title: t('settings:voice.noiseSuppression.modes.smart.title'),
      description: t('settings:voice.noiseSuppression.modes.smart.description'),
      badge: t('settings:voice.noiseSuppression.recommendedBadge'),
    },
    {
      id: 'advanced',
      title: t('settings:voice.noiseSuppression.modes.advanced.title'),
      description: t('settings:voice.noiseSuppression.modes.advanced.description'),
    },
  ];

  const meterBars = 24;
  const activeInputBars = Math.round(inputLevel * meterBars);
  const activeOutputBars = Math.round(outputLevel * meterBars);

  return (
    <div>
      <div className="text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider mb-1.5">
        {t('settings:voice.noiseSuppression.sectionTitle')}
      </div>
      <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-3.5 space-y-4">
        {/* Modes Grid / List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {modes.map((m) => {
            const isSelected = mode === m.id;
            const isProcessingSelected = isSelected && status.isLoading;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => handleModeSelect(m.id)}
                className={`text-left p-3 rounded-lg border transition-all relative flex flex-col justify-between ${
                  isSelected
                    ? 'border-accent-primary bg-accent-primary/10 shadow-sm'
                    : 'border-white/[0.06] bg-surface-base hover:bg-interactive-hover hover:border-white/[0.12]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors ${
                          isSelected ? 'border-accent-primary bg-accent-primary' : 'border-txt-tertiary'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span className="text-[13px] font-medium text-txt-primary">{m.title}</span>
                    </div>
                    {m.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-accent-primary/20 text-accent-primary uppercase tracking-wide">
                        {m.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-txt-tertiary leading-relaxed mt-1">{m.description}</p>
                </div>

                {isProcessingSelected && (
                  <div className="flex items-center gap-1.5 mt-2 text-[11px] text-accent-primary font-medium animate-pulse">
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                    <span>{t('settings:voice.noiseSuppression.loadingModel')}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Fallback Notice if advanced mode could not be loaded */}
        {status.error && status.mode === 'advanced' && (
          <div className="flex items-start gap-2.5 p-3 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0 mt-0.5">
              <path d="M12 2L1 21h22L12 2zm1 14h-2v-2h2v2zm0-4h-2V8h2v4z" />
            </svg>
            <div>
              <div className="font-semibold">{t('settings:voice.noiseSuppression.fallbackNotice')}</div>
              <div className="text-[11px] opacity-80 mt-0.5">{status.error}</div>
            </div>
          </div>
        )}

        {/* Dual Live Meters: Raw Mic vs Processed Voice */}
        <div className="space-y-3 pt-2 border-t border-white/[0.04]">
          {/* Input Meter (Unfiltered) */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-txt-secondary font-medium">
                {t('settings:voice.noiseSuppression.test.inputMeter')}
              </span>
              <span className="text-[11px] text-txt-tertiary tabular-nums">
                {Math.round(inputLevel * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-[2px] h-[6px] bg-surface-base rounded-[2px] p-[1px]">
              {Array.from({ length: meterBars }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-full rounded-[1px] transition-colors duration-75 ${
                    i < activeInputBars
                      ? i > meterBars * 0.8
                        ? 'bg-rose-500'
                        : i > meterBars * 0.5
                        ? 'bg-amber-400'
                        : 'bg-txt-secondary'
                      : 'bg-white/[0.04]'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Output Meter (Processed) */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-txt-secondary font-medium">
                {t('settings:voice.noiseSuppression.test.outputMeter')}
              </span>
              <span className="text-[11px] text-txt-tertiary tabular-nums">
                {Math.round(outputLevel * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-[2px] h-[6px] bg-surface-base rounded-[2px] p-[1px]">
              {Array.from({ length: meterBars }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-full rounded-[1px] transition-colors duration-75 ${
                    i < activeOutputBars
                      ? i > meterBars * 0.8
                        ? 'bg-rose-500'
                        : i > meterBars * 0.5
                        ? 'bg-amber-400'
                        : 'bg-status-online'
                      : 'bg-white/[0.04]'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Microphone Test & A/B Comparison Controls */}
        <div className="pt-2 border-t border-white/[0.04] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTest}
              className={`px-3.5 py-2 rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                isTesting
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-accent-primary hover:bg-accent-primary-hover text-white'
              }`}
            >
              {isTesting ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  {t('settings:voice.noiseSuppression.test.stop')}
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                  {t('settings:voice.noiseSuppression.test.start')}
                </>
              )}
            </button>

            {isTesting && (
              <div className="inline-flex rounded-md p-0.5 bg-surface-base border border-white/[0.06] text-xs">
                <button
                  type="button"
                  onClick={() => handlePreviewModeChange('filtered')}
                  className={`px-2.5 py-1.5 rounded text-[11px] font-medium transition-colors ${
                    previewFilter === 'filtered'
                      ? 'bg-accent-primary text-white shadow-sm'
                      : 'text-txt-tertiary hover:text-txt-primary'
                  }`}
                >
                  {t('settings:voice.noiseSuppression.test.listeningFiltered')}
                </button>
                <button
                  type="button"
                  onClick={() => handlePreviewModeChange('original')}
                  className={`px-2.5 py-1.5 rounded text-[11px] font-medium transition-colors ${
                    previewFilter === 'original'
                      ? 'bg-accent-primary text-white shadow-sm'
                      : 'text-txt-tertiary hover:text-txt-primary'
                  }`}
                >
                  {t('settings:voice.noiseSuppression.test.listeningOriginal')}
                </button>
              </div>
            )}
          </div>

          {isTesting && (
            <div className="text-[11px] text-txt-tertiary italic">
              {t('settings:voice.noiseSuppression.test.headphoneTip')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
