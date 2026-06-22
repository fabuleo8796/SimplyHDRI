// A live "environment preview" that builds up as you capture. Each photo is
// dropped onto an equirectangular map at the spot it was taken (its azimuth +
// elevation). This is the same flat layout used by real 360° environment maps
// — it is NOT stitched, just placed, so you can see your coverage grow.
import { useEffect, useRef } from 'react';

export type PreviewShot = {
  id: string;
  blob: Blob;
  orientation: { az: number; el: number } | null;
};

const W = 512;
const H = 256;

export function PreviewMap({ shots }: { shots: PreviewShot[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Background + reference grid (horizon line and the four directions).
    ctx.fillStyle = '#0a0e1f';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2); // horizon
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '12px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    const labels: [string, number][] = [
      ['Front', 0],
      ['Right', 90],
      ['Back', 180],
      ['Left', 270],
    ];
    labels.forEach(([label, az]) => {
      const x = (az / 360) * W;
      ctx.fillText(label, x, H - 8);
    });

    let cancelled = false;
    (async () => {
      for (const shot of shots) {
        if (!shot.orientation) continue;
        try {
          const bmp = await createImageBitmap(shot.blob);
          if (cancelled) {
            bmp.close?.();
            return;
          }
          const az = ((shot.orientation.az % 360) + 360) % 360;
          const cx = (az / 360) * W;
          const cy = ((90 - shot.orientation.el) / 180) * H;
          const w = W * 0.22;
          const h = w * (bmp.height / bmp.width);
          ctx.drawImage(bmp, cx - w / 2, cy - h / 2, w, h);
          bmp.close?.();
        } catch {
          // Ignore a frame that fails to decode.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shots]);

  return (
    <canvas
      ref={canvasRef}
      className="preview-map"
      width={W}
      height={H}
      aria-label="Live environment preview"
    />
  );
}
