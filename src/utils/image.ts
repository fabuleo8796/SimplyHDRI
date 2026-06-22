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

/** Trigger a file download for a blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give Safari a moment to start the download before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
