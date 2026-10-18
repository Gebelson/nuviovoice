import { RnnoiseProcessor } from './RnnoiseProcessor';
import { GtcrnProcessor } from './GtcrnProcessor';
import type { INoiseSuppressorProcessor, NoiseSuppressionMode, NoiseSuppressionStatus } from './types';

export class NoiseSuppressionController {
  private static instance: NoiseSuppressionController | null = null;

  private rnnoiseProcessor = new RnnoiseProcessor();
  private gtcrnProcessor = new GtcrnProcessor();

  private activeProcessor: INoiseSuppressorProcessor | null = null;
  private currentMode: NoiseSuppressionMode = 'smart';
  private effectiveMode: NoiseSuppressionMode = 'smart';
  private isReady = false;
  private isLoading = false;
  private error: string | null = null;

  private listeners = new Set<(status: NoiseSuppressionStatus) => void>();

  private constructor() {}

  static getInstance(): NoiseSuppressionController {
    if (!NoiseSuppressionController.instance) {
      NoiseSuppressionController.instance = new NoiseSuppressionController();
    }
    return NoiseSuppressionController.instance;
  }

  getStatus(): NoiseSuppressionStatus {
    return {
      mode: this.currentMode,
      effectiveMode: this.effectiveMode,
      isReady: this.isReady,
      isLoading: this.isLoading,
      error: this.error,
    };
  }

  subscribe(listener: (status: NoiseSuppressionStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach((cb) => {
      try {
        cb(status);
      } catch (err) {
        console.error('[NoiseSuppressionController] Listener error:', err);
      }
    });
  }

  getActiveNode(): AudioNode | null {
    return this.activeProcessor?.getNode() ?? null;
  }

  getActiveProcessor(): INoiseSuppressorProcessor | null {
    return this.activeProcessor;
  }

  async setMode(mode: NoiseSuppressionMode, ctx: AudioContext | null): Promise<AudioNode | null> {
    this.currentMode = mode;
    this.error = null;

    if (mode === 'disabled' || mode === 'standard') {
      if (this.activeProcessor) {
        await this.activeProcessor.destroy();
        this.activeProcessor = null;
      }
      this.effectiveMode = mode;
      this.isReady = true;
      this.isLoading = false;
      this.notify();
      return null;
    }

    if (!ctx) {
      // AudioContext not yet created; mark pending
      this.effectiveMode = mode;
      this.isReady = false;
      this.isLoading = false;
      this.notify();
      return null;
    }

    this.isLoading = true;
    this.isReady = false;
    this.notify();

    if (mode === 'advanced') {
      try {
        if (this.activeProcessor && this.activeProcessor !== this.gtcrnProcessor) {
          await this.activeProcessor.destroy();
        }
        const node = await this.gtcrnProcessor.initNode(ctx);
        this.activeProcessor = this.gtcrnProcessor;
        this.effectiveMode = 'advanced';
        this.isReady = true;
        this.isLoading = false;
        this.notify();
        return node;
      } catch (err: any) {
        console.warn('[NoiseSuppressionController] GTCRN failed, attempting fallback to RNNoise:', err);
        this.error = err?.message || 'Falha ao carregar GTCRN';
        // Fallback to RNNoise (smart)
        try {
          const node = await this.rnnoiseProcessor.initNode(ctx);
          this.activeProcessor = this.rnnoiseProcessor;
          this.effectiveMode = 'smart';
          this.isReady = true;
          this.isLoading = false;
          this.notify();
          return node;
        } catch (rnnoiseErr: any) {
          console.error('[NoiseSuppressionController] RNNoise fallback also failed, falling back to standard WebRTC:', rnnoiseErr);
          this.activeProcessor = null;
          this.effectiveMode = 'standard';
          this.isReady = true;
          this.isLoading = false;
          this.notify();
          return null;
        }
      }
    }

    // mode === 'smart' (RNNoise)
    try {
      if (this.activeProcessor && this.activeProcessor !== this.rnnoiseProcessor) {
        await this.activeProcessor.destroy();
      }
      const node = await this.rnnoiseProcessor.initNode(ctx);
      this.activeProcessor = this.rnnoiseProcessor;
      this.effectiveMode = 'smart';
      this.isReady = true;
      this.isLoading = false;
      this.notify();
      return node;
    } catch (err: any) {
      console.error('[NoiseSuppressionController] RNNoise failed, falling back to standard WebRTC:', err);
      this.error = err?.message || 'Falha ao carregar RNNoise';
      this.activeProcessor = null;
      this.effectiveMode = 'standard';
      this.isReady = true;
      this.isLoading = false;
      this.notify();
      return null;
    }
  }

  async cleanup(): Promise<void> {
    if (this.rnnoiseProcessor) {
      await this.rnnoiseProcessor.destroy();
    }
    if (this.gtcrnProcessor) {
      await this.gtcrnProcessor.destroy();
    }
    this.activeProcessor = null;
    this.isReady = false;
    this.isLoading = false;
  }
}
