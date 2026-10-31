import fs from 'node:fs';
import path from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { getDb, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import type { WinkStatus } from '@concord/shared/src/winks.js';

const execFile = promisify(execFileCb);

export const WINKS_DIR = path.resolve(process.env.DATA_DIR || './data', 'winks');
export const WINKS_ORIGINAL_DIR = path.join(WINKS_DIR, 'original');
export const WINKS_PROCESSED_DIR = path.join(WINKS_DIR, 'processed');
export const WINKS_TEMP_DIR = path.join(WINKS_DIR, 'temp');

export function ensureWinksDirectories(): void {
  for (const dir of [WINKS_DIR, WINKS_ORIGINAL_DIR, WINKS_PROCESSED_DIR, WINKS_TEMP_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export interface ProbeResult {
  videoCodec: string | null;
  audioCodec: string | null;
  width: number;
  height: number;
  fps: number;
  durationMs: number;
  hasAlpha: boolean;
  hasAudio: boolean;
  pixFmt: string | null;
  sizeBytes: number;
}

const ALPHA_PIX_FMTS = ['yuva', 'rgba', 'bgra', 'argb', 'abgr', 'ya8', 'gbrpa', 'gbrap'];

export async function probeVideoFile(filePath: string): Promise<ProbeResult> {
  const probeTimeout = 20_000;

  // 1. Probe video stream
  const { stdout: videoJson } = await execFile('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=codec_name,pix_fmt,profile,width,height,r_frame_rate,duration',
    '-of', 'json',
    filePath,
  ], { timeout: probeTimeout });

  const parsedVideo = JSON.parse(videoJson || '{}');
  const videoStream = parsedVideo.streams?.[0];

  if (!videoStream) {
    throw new Error('Arquivo não contém um fluxo de vídeo válido ou legível');
  }

  // 2. Probe audio stream
  let audioStream: any = null;
  try {
    const { stdout: audioJson } = await execFile('ffprobe', [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_name,channels,duration',
      '-of', 'json',
      filePath,
    ], { timeout: probeTimeout });
    const parsedAudio = JSON.parse(audioJson || '{}');
    audioStream = parsedAudio.streams?.[0] || null;
  } catch {
    audioStream = null;
  }

  // 3. Probe container format
  const { stdout: formatJson } = await execFile('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration,size',
    '-of', 'json',
    filePath,
  ], { timeout: probeTimeout });
  const parsedFormat = JSON.parse(formatJson || '{}');
  const format = parsedFormat.format || {};

  const pixFmt = (videoStream.pix_fmt || '').toLowerCase();
  const profile = (videoStream.profile || '').toLowerCase();

  const hasAlpha = ALPHA_PIX_FMTS.some((fmt) => pixFmt.includes(fmt)) || profile.includes('4444');

  const durStr = videoStream.duration || format.duration || '0';
  const durationSec = parseFloat(durStr);
  const durationMs = Math.round(durationSec * 1000);

  const [num, den] = (videoStream.r_frame_rate || '30/1').split('/').map(Number);
  const fps = den && den > 0 ? Math.round(num / den) : 30;

  const sizeBytes = parseInt(format.size || '0', 10) || (fs.existsSync(filePath) ? fs.statSync(filePath).size : 0);

  return {
    videoCodec: videoStream.codec_name || null,
    audioCodec: audioStream?.codec_name || null,
    width: videoStream.width || 0,
    height: videoStream.height || 0,
    fps,
    durationMs: durationMs > 0 ? durationMs : 4000,
    hasAlpha,
    hasAudio: !!audioStream,
    pixFmt,
    sizeBytes,
  };
}

export async function processWinkMedia(winkId: string): Promise<void> {
  ensureWinksDirectories();
  const db = getDb();

  const record = db.select().from(schema.winks).where(eq(schema.winks.id, winkId)).get();
  if (!record || !record.videoPath || !fs.existsSync(record.videoPath)) {
    throw new Error(`Arquivo fonte do Wink ${winkId} não encontrado no disco`);
  }

  const sourceFile = record.videoPath;

  const updateStatus = (status: WinkStatus, errorMsg: string | null = null, extra: Record<string, any> = {}) => {
    db.update(schema.winks)
      .set({
        status,
        errorMessage: errorMsg,
        updatedAt: Date.now(),
        ...extra,
      })
      .where(eq(schema.winks.id, winkId))
      .run();
  };

  try {
    updateStatus('validating');

    // 1. Probe video
    const probe = await probeVideoFile(sourceFile);

    // Limit checks: duration max 30.5 seconds
    if (probe.durationMs > 30_500) {
      throw new Error(`Duração excede o limite máximo permitido de 30 segundos (${Math.round(probe.durationMs / 1000)}s)`);
    }

    updateStatus('processing', null, {
      width: probe.width,
      height: probe.height,
      fps: probe.fps,
      durationMs: probe.durationMs,
      hasAlpha: probe.hasAlpha ? 1 : 0,
      hasAudio: probe.hasAudio ? 1 : 0,
      videoCodec: probe.videoCodec,
      audioCodec: probe.audioCodec,
    });

    const webmFile = path.join(WINKS_PROCESSED_DIR, `${winkId}.webm`);
    const mp4File = path.join(WINKS_PROCESSED_DIR, `${winkId}.mp4`);
    const thumbFile = path.join(WINKS_PROCESSED_DIR, `${winkId}_thumb.webp`);

    const convTimeout = 180_000; // 3 minutes timeout for conversion

    // 2. Generate WebM VP9
    // If alpha is detected, use yuva420p and disable alt-ref so transparency is preserved!
    const webmArgs = [
      '-y',
      '-i', sourceFile,
      '-c:v', 'libvpx-vp9',
      '-b:v', '2M',
      '-crf', '26',
    ];

    if (probe.hasAlpha) {
      webmArgs.push('-pix_fmt', 'yuva420p', '-auto-alt-ref', '0');
    }

    if (probe.hasAudio) {
      webmArgs.push('-c:a', 'libopus', '-b:a', '128k');
    } else {
      webmArgs.push('-an');
    }

    webmArgs.push(webmFile);

    await execFile('ffmpeg', webmArgs, { timeout: convTimeout });

    if (!fs.existsSync(webmFile) || fs.statSync(webmFile).size === 0) {
      throw new Error('Falha ao gerar arquivo WebM VP9 otimizado');
    }

    // 3. Generate MP4 (H.264 fallback)
    const mp4Args = [
      '-y',
      '-i', sourceFile,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-profile:v', 'high',
      '-level', '4.0',
      '-movflags', '+faststart',
    ];

    if (probe.hasAudio) {
      mp4Args.push('-c:a', 'aac', '-b:a', '128k');
    } else {
      mp4Args.push('-an');
    }

    mp4Args.push(mp4File);

    await execFile('ffmpeg', mp4Args, { timeout: convTimeout });

    if (!fs.existsSync(mp4File) || fs.statSync(mp4File).size === 0) {
      throw new Error('Falha ao gerar arquivo MP4 H.264 de compatibilidade');
    }

    // 4. Generate WebP Thumbnail
    const seekTime = probe.durationMs > 1000 ? '0.5' : '0';
    const thumbArgs = [
      '-y',
      '-ss', seekTime,
      '-i', sourceFile,
      '-frames:v', '1',
      '-vf', 'scale=320:320:force_original_aspect_ratio=decrease',
      '-c:v', 'libwebp',
      '-quality', '85',
      thumbFile,
    ];

    try {
      await execFile('ffmpeg', thumbArgs, { timeout: 30_000 });
    } catch {
      // Fallback to start frame 0 if 0.5 failed
      await execFile('ffmpeg', [
        '-y',
        '-ss', '0',
        '-i', sourceFile,
        '-frames:v', '1',
        '-vf', 'scale=320:320:force_original_aspect_ratio=decrease',
        '-c:v', 'libwebp',
        '-quality', '85',
        thumbFile,
      ], { timeout: 30_000 });
    }

    // 5. Final update to DB: completed!
    updateStatus('completed', null, {
      webmPath: webmFile,
      webmUrl: `/api/winks/media/${winkId}.webm`,
      mp4Path: mp4File,
      mp4Url: `/api/winks/media/${winkId}.mp4`,
      thumbnailPath: fs.existsSync(thumbFile) ? thumbFile : null,
      thumbnailUrl: fs.existsSync(thumbFile) ? `/api/winks/media/${winkId}_thumb.webp` : null,
    });
  } catch (err: any) {
    const message = err?.message || String(err);
    console.error(`[winkProcessor] Failed to process wink ${winkId}:`, err);
    updateStatus('failed', message);
  }
}

// Queue worker to run in background
const queue: string[] = [];
let isProcessing = false;

async function processQueue(): Promise<void> {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;
  const winkId = queue.shift()!;
  try {
    await processWinkMedia(winkId);
  } catch (err) {
    console.error(`[winkProcessor] Unexpected queue error on ${winkId}:`, err);
  } finally {
    isProcessing = false;
    if (queue.length > 0) {
      setImmediate(() => {
        void processQueue();
      });
    }
  }
}

export function queueWinkProcessing(winkId: string): void {
  if (!queue.includes(winkId)) {
    queue.push(winkId);
  }
  setImmediate(() => {
    void processQueue();
  });
}
