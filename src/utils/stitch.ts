// Prepares captured photos and runs the stitching worker to produce a 360°
// equirectangular environment map as an image Blob.

export type StitchPhoto = {
  blob: Blob;
  az: number;
  el: number;
};

export type StitchOptions = {
  width: number;
  height: number;
  hfovDeg: number;
  onProgress?: (value: number) => void;
};

type PreparedPhoto = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  az: number;
  el: number;
};

// Decode a photo and shrink it (faster stitch, plenty of detail for a map).
async function prepare(photo: StitchPhoto, maxSize: number): Promise<PreparedPhoto> {
  const bmp = await createImageBitmap(photo.blob);
  const scale = Math.min(1, maxSize / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const img = ctx.getImageData(0, 0, w, h);
  return { width: w, height: h, data: img.data, az: photo.az, el: photo.el };
}

export async function buildEquirect(
  photos: StitchPhoto[],
  opts: StitchOptions,
): Promise<Blob> {
  const prepared: PreparedPhoto[] = [];
  for (const photo of photos) {
    prepared.push(await prepare(photo, 900));
  }

  const worker = new Worker(
    new URL('../workers/stitch.worker.ts', import.meta.url),
    { type: 'module' },
  );

  return new Promise<Blob>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === 'progress') {
        opts.onProgress?.(m.value as number);
        return;
      }
      if (m.type === 'done') {
        const data = new Uint8ClampedArray(m.data as ArrayBuffer);
        const canvas = document.createElement('canvas');
        canvas.width = m.width;
        canvas.height = m.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          worker.terminate();
          reject(new Error('Canvas not available'));
          return;
        }
        ctx.putImageData(new ImageData(data, m.width, m.height), 0, 0);
        canvas.toBlob(
          (blob) => {
            worker.terminate();
            blob ? resolve(blob) : reject(new Error('Could not encode image'));
          },
          'image/jpeg',
          0.92,
        );
      }
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(err.error ?? new Error('Stitching failed'));
    };

    const transfer = prepared.map((p) => p.data.buffer);
    worker.postMessage(
      {
        type: 'stitch',
        width: opts.width,
        height: opts.height,
        hfovDeg: opts.hfovDeg,
        photos: prepared,
      },
      transfer,
    );
  });
}
