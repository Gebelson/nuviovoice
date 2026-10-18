import type { Track, AudioProcessorOptions } from 'livekit-client';
import type { INoiseSuppressorProcessor, NoiseSuppressionMode } from './types';

const registeredContexts = new WeakSet<AudioContext>();
let cachedWasmBinary: ArrayBuffer | null = null;

async function detectSimd(): Promise<boolean> {
  try {
    return await WebAssembly.validate(new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11
    ]));
  } catch {
    return false;
  }
}

export class RnnoiseProcessor implements INoiseSuppressorProcessor {
  readonly id = 'rnnoise';
  readonly name = 'nuvio-rnnoise';
  readonly mode: NoiseSuppressionMode = 'smart';

  private node: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private destNode: MediaStreamAudioDestinationNode | null = null;
  processedTrack?: MediaStreamTrack;

  async initNode(ctx: AudioContext): Promise<AudioNode> {
    if (this.node) {
      return this.node;
    }

    if (!registeredContexts.has(ctx)) {
      await ctx.audioWorklet.addModule('/worklets/rnnoise-worklet.js');
      registeredContexts.add(ctx);
    }

    if (!cachedWasmBinary) {
      const hasSimd = await detectSimd();
      const wasmPath = hasSimd ? '/wasm/rnnoise_simd.wasm' : '/wasm/rnnoise.wasm';
      const res = await fetch(wasmPath);
      if (!res.ok) {
        throw new Error(`Failed to load RNNoise WASM from ${wasmPath} (status ${res.status})`);
      }
      cachedWasmBinary = await res.arrayBuffer();
    }

    this.node = new AudioWorkletNode(ctx, 'nuvio-rnnoise-processor', {
      processorOptions: {
        maxChannels: 1,
        wasmBinary: cachedWasmBinary,
      },
      channelCount: 1,
      channelCountMode: 'explicit',
    });

    return this.node;
  }

  getNode(): AudioNode | null {
    return this.node;
  }

  // LiveKit TrackProcessor implementation
  async init(opts: AudioProcessorOptions): Promise<void> {
    await this.initNode(opts.audioContext);
    if (!this.node) throw new Error('RNNoise worklet node failed to initialize');

    this.sourceNode = opts.audioContext.createMediaStreamSource(new MediaStream([opts.track]));
    this.destNode = opts.audioContext.createMediaStreamDestination();

    this.sourceNode.connect(this.node);
    this.node.connect(this.destNode);

    this.processedTrack = this.destNode.stream.getAudioTracks()[0];
  }

  async restart(opts: AudioProcessorOptions): Promise<void> {
    await this.destroy();
    await this.init(opts);
  }

  async destroy(): Promise<void> {
    if (this.node) {
      try {
        this.node.port.postMessage('destroy');
      } catch {}
      try {
        this.node.disconnect();
      } catch {}
      this.node = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }

    if (this.destNode) {
      try {
        this.destNode.disconnect();
      } catch {}
      this.destNode = null;
    }

    if (this.processedTrack) {
      try {
        this.processedTrack.stop();
      } catch {}
      this.processedTrack = undefined;
    }
  }
}
