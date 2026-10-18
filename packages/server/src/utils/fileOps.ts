import fs from 'node:fs';

/**
 * Move or rename a file safely across platforms, especially on Windows where
 * recent file writes, media analyzers, or background processes may hold an
 * ephemeral OS lock (EBUSY / EPERM / EXDEV).
 *
 * 1. Tries fs.renameSync(src, dst).
 * 2. If it fails with EBUSY, EPERM, or EXDEV, it falls back to copying (fs.copyFileSync)
 *    and unlinking src.
 * 3. If unlinking src fails due to an ephemeral lock, it schedules an asynchronous retry.
 */
export function safeMoveFile(src: string, dst: string): void {
  try {
    fs.renameSync(src, dst);
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'EBUSY' || code === 'EXDEV' || code === 'EPERM') {
      fs.copyFileSync(src, dst);
      try {
        fs.unlinkSync(src);
      } catch {
        const timer = setTimeout(() => {
          try {
            fs.unlinkSync(src);
          } catch {
            // best-effort cleanup
          }
        }, 1000);
        if (typeof timer.unref === 'function') timer.unref();
      }
    } else {
      throw err;
    }
  }
}
