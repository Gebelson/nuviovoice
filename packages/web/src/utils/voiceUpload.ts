import { useTransferStore } from '../stores/transferStore';
import type { Attachment } from '@concord/shared';

export interface UploadVoiceOptions {
  channelId: string;
  duration: number;
  waveform: number[];
  origin?: string;
  onProgress?: (progress: number) => void;
}

/**
 * Uploads a voice message blob with duration and waveform metadata via transferStore.
 * Resolves with the finalized Attachment record upon completion.
 */
export async function uploadVoiceAttachment(
  file: Blob,
  opts: UploadVoiceOptions,
): Promise<Attachment> {
  const store = useTransferStore.getState();

  const transferId = await store.startUpload(file, {
    channelId: opts.channelId,
    tray: false, // Don't show voice messages in the bottom file-transfer tray
    origin: opts.origin,
    duration: opts.duration,
    waveform: opts.waveform,
  });

  return new Promise<Attachment>((resolve, reject) => {
    // Check if it already completed synchronously
    const initial = useTransferStore.getState().get(transferId);
    if (initial?.state === 'completed' && initial.attachment) {
      resolve(initial.attachment);
      return;
    }

    const unsubscribe = useTransferStore.subscribe((state) => {
      const current = state.transfers.get(transferId);
      if (!current) {
        unsubscribe();
        reject(new Error('Upload transfer not found'));
        return;
      }

      if (opts.onProgress && current.progress && current.file.size > 0) {
        opts.onProgress(current.progress.loaded / current.file.size);
      }

      if (current.state === 'completed') {
        unsubscribe();
        if (current.attachment) {
          resolve(current.attachment);
        } else {
          // Fallback if attachment object was not fully hydrated
          const fallbackAtt: Attachment = {
            id: current.attachmentId || transferId,
            messageId: '',
            filename: current.attachmentFilename || current.file.name,
            originalName: current.file.name,
            mimetype: current.file.mimetype,
            size: current.file.size,
            duration: opts.duration,
            waveform: JSON.stringify(opts.waveform),
            createdAt: Date.now(),
          };
          resolve(fallbackAtt);
        }
      } else if (current.state === 'failed') {
        unsubscribe();
        reject(new Error(current.error?.message || 'Voice message upload failed'));
      } else if (current.state === 'aborted') {
        unsubscribe();
        reject(new Error('Voice message upload cancelled'));
      }
    });
  });
}
