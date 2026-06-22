// Web Worker: builds a 360° equirectangular environment map from photos that
// each know which direction they were shot (azimuth + elevation). For every
// output pixel we look up which photos see that direction and blend them,
// feathering toward each photo's edges so overlaps fade together.
//
// This is "sensor-assisted projection", not feature-matching — honest, light,
// and runs entirely on-device. Seams are expected (sensor drift, no lens
// calibration), but it produces a real equirectangular map.

type PhotoInput = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  az: number; // azimuth in degrees (relative to Front)
  el: number; // elevation in degrees (-90 floor … +90 ceiling)
};

type StitchRequest = {
  type: 'stitch';
  width: number;
  height: number;
  hfovDeg: number;
  photos: PhotoInput[];
};

// Type `self` loosely to avoid DOM/WebWorker lib type clashes.
const worker = self as unknown as {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage: (msg: unknown, transfer?: Transferable[]) => void;
};

type Vec3 = [number, number, number];

function basis(azDeg: number, elDeg: number): { f: Vec3; r: Vec3; u: Vec3 } {
  const az = (azDeg * Math.PI) / 180;
  const el = (elDeg * Math.PI) / 180;
  const f: Vec3 = [
    Math.cos(el) * Math.sin(az),
    Math.sin(el),
    Math.cos(el) * Math.cos(az),
  ];
  // Right vector stays horizontal; falls back near the poles.
  let r: Vec3 = [f[2], 0, -f[0]];
  const rlen = Math.hypot(r[0], r[2]);
  if (rlen < 1e-4) {
    r = [Math.cos(az), 0, -Math.sin(az)];
  } else {
    r = [r[0] / rlen, 0, r[2] / rlen];
  }
  // Up = f × r
  const u: Vec3 = [
    f[1] * r[2] - f[2] * r[1],
    f[2] * r[0] - f[0] * r[2],
    f[0] * r[1] - f[1] * r[0],
  ];
  return { f, r, u };
}

worker.onmessage = (e: MessageEvent) => {
  const msg = e.data as StitchRequest;
  if (msg.type !== 'stitch') return;
  const { width: W, height: H, photos, hfovDeg } = msg;

  // Precompute the world direction for each output pixel once.
  const dirX = new Float32Array(W * H);
  const dirY = new Float32Array(W * H);
  const dirZ = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const lat = Math.PI / 2 - ((y + 0.5) / H) * Math.PI;
    const cl = Math.cos(lat);
    const sl = Math.sin(lat);
    for (let x = 0; x < W; x++) {
      const lon = ((x + 0.5) / W) * 2 * Math.PI - Math.PI;
      const i = y * W + x;
      dirX[i] = cl * Math.sin(lon);
      dirY[i] = sl;
      dirZ[i] = cl * Math.cos(lon);
    }
  }

  const colAccum = new Float32Array(W * H * 3);
  const wAccum = new Float32Array(W * H);
  const tanLong = Math.tan(((hfovDeg * Math.PI) / 180) / 2);
  const N = W * H;

  for (let p = 0; p < photos.length; p++) {
    const ph = photos[p];
    const { f, r, u } = basis(ph.az, ph.el);
    const pw = ph.width;
    const phh = ph.height;
    const pd = ph.data;
    // Field of view applies to the photo's long side.
    let tanH: number;
    let tanV: number;
    if (pw >= phh) {
      tanH = tanLong;
      tanV = (tanLong * phh) / pw;
    } else {
      tanV = tanLong;
      tanH = (tanLong * pw) / phh;
    }

    for (let i = 0; i < N; i++) {
      const dx = dirX[i];
      const dy = dirY[i];
      const dz = dirZ[i];
      const cf = dx * f[0] + dy * f[1] + dz * f[2];
      if (cf <= 0.01) continue; // behind the camera
      const xn = (dx * r[0] + dy * r[1] + dz * r[2]) / cf;
      const yn = (dx * u[0] + dy * u[1] + dz * u[2]) / cf;
      const ax = Math.abs(xn) / tanH;
      const ay = Math.abs(yn) / tanV;
      if (ax >= 1 || ay >= 1) continue; // outside this photo's view
      // Feather: full weight at center, fading to 0 at the edges.
      const m = ax > ay ? ax : ay;
      const w = (1 - m) * (1 - m);
      if (w <= 0) continue;

      const sx = (0.5 + 0.5 * (xn / tanH)) * (pw - 1);
      const sy = (0.5 - 0.5 * (yn / tanV)) * (phh - 1);
      const si = (((sy | 0) * pw) + (sx | 0)) * 4;
      const ci = i * 3;
      colAccum[ci] += pd[si] * w;
      colAccum[ci + 1] += pd[si + 1] * w;
      colAccum[ci + 2] += pd[si + 2] * w;
      wAccum[i] += w;
    }

    worker.postMessage({ type: 'progress', value: (p + 1) / photos.length });
  }

  const out = new Uint8ClampedArray(N * 4);
  for (let i = 0; i < N; i++) {
    const w = wAccum[i];
    const oi = i * 4;
    if (w > 0) {
      out[oi] = colAccum[i * 3] / w;
      out[oi + 1] = colAccum[i * 3 + 1] / w;
      out[oi + 2] = colAccum[i * 3 + 2] / w;
      out[oi + 3] = 255;
    } else {
      // Uncovered area — dark fill so gaps are obvious, not garbage.
      out[oi] = 10;
      out[oi + 1] = 14;
      out[oi + 2] = 31;
      out[oi + 3] = 255;
    }
  }

  worker.postMessage({ type: 'done', width: W, height: H, data: out.buffer }, [
    out.buffer,
  ]);
};
