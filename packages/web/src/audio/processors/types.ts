import type { Track, TrackProcessor, AudioProcessorOptions } from 'livekit-client';

export type NoiseSuppressionMode = 'disabled' | 'standard' | 'smart' | 'advanced';

export interface NoiseSuppressionStatus {
  mode: NoiseSuppressionMode;
  effectiveMode: NoiseSuppressionMode;
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface INoiseSuppressorProcessor extends TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  readonly id: string;
  readonly mode: NoiseSuppressionMode;
  initNode(ctx: AudioContext): Promise<AudioNode>;
  getNode(): AudioNode | null;
  destroy(): Promise<void>;
}
