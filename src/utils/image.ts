// Helpers for capturing a video frame and downloading it.

/** Draw the current video frame to a JPEG blob (good quality, small size). */
export function captureFrameToBlob(
  video: HTMLVideoElement,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    // videoWidth/Height are the camera's real pixel size (0 until ready).
    if (!video.videoWidth || !video.videoHeight) {
      resolve(null);
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve(null);
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
  });
}

/** Re-encode an existing image blob into a different type (e.g. PNG). */
export function reencode(blob: Blob, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas not available'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((out) => {
        URL.revokeObjectURL(url);
        out ? resolve(out) : reject(new Error('Could not re-encode image'));
      }, type);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image'));
    };
    img.src = url;
  });
}

/** Trigger a classic file download for a blob (works on desktop browsers). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Large files (a lossless PNG map can be several MB) need time to flush to
  // disk before we release the URL — too-early revoke can truncate the file.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

type ShareNavigator = Navigator & {
  canShare?: (data: { files?: File[] }) => boolean;
  share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
};

/**
 * Save an image the way the current device actually supports.
 *
 * On iPhone the `download` attribute is unreliable — Safari tends to open the
 * image inline instead of saving a real file, which is why a map could look
 * fine on screen yet fail to import into Blender. The Web Share API
 * (`navigator.share` with files) is the correct iOS path: it opens the share
 * sheet so the user can pick **Save to Files** and get a genuine .png/.jpg they
 * can move to their computer. Everywhere else we fall back to a normal download.
 */
export async function saveImage(blob: Blob, filename: string): Promise<void> {
  const nav = navigator as ShareNavigator;
  const file = new File([blob], filename, { type: blob.type });

  if (
    typeof nav.share === 'function' &&
    typeof nav.canShare === 'function' &&
    nav.canShare({ files: [file] })
  ) {
    try {
      await nav.share({ files: [file], title: 'SimplyHDRI environment map' });
      return;
    } catch (err) {
      // The user dismissed the share sheet — that's a cancel, not an error.
      if ((err as Error)?.name === 'AbortError') return;
      // Anything else: fall through to a plain download.
    }
  }

  downloadBlob(blob, filename);
}
