// Self-driven guided-capture overlay. It runs its OWN animation loop, reading
// the live orientation from a ref, so the rest of the screen never re-renders
// while you scan. It positions the dots, handles aim-and-hold, and calls back
// only when a photo should be taken.
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { OrientationData } from '../hooks/useOrientation';
import { projectTargets } from '../utils/targets';
import type { TargetView } from '../utils/targets';

type CaptureOverlayProps = {
  dataRef: RefObject<OrientationData>;
  frontOffsetRef: RefObject<number | null>;
  doneRef: RefObject<Set<string>>;
  total: number;
  onCapture: (id: string) => void;
  onSetFront: (heading: number) => void;
};

const RING_R = 48;
const RING_C = 2 * Math.PI * RING_R;
const DWELL_MS = 900;

export function CaptureOverlay({
  dataRef,
  frontOffsetRef,
  doneRef,
  total,
  onCapture,
  onSetFront,
}: CaptureOverlayProps) {
  const [views, setViews] = useState<TargetView[]>([]);
  const [aligned, setAligned] = useState<string | null>(null);
  const [dwell, setDwell] = useState(0);

  // Keep callbacks fresh without restarting the loop.
  const onCaptureRef = useRef(onCapture);
  const onSetFrontRef = useRef(onSetFront);
  onCaptureRef.current = onCapture;
  onSetFrontRef.current = onSetFront;

  useEffect(() => {
    let rafId = 0;
    let dwellTarget: string | null = null;
    let dwellStart = 0;
    let lastFired: string | null = null;
    let frontRequested = false;
    // Last emitted values, to avoid re-rendering when nothing moved.
    let lastCamAz = 999;
    let lastEl = 999;
    let lastAligned: string | null = null;
    let lastDwell = -1;

    const loop = () => {
      const d = dataRef.current;

      // Auto-set "Front" to wherever you're facing on the first frame.
      if (frontOffsetRef.current == null && !frontRequested) {
        frontRequested = true;
        onSetFrontRef.current(d.heading);
      }
      const front = frontOffsetRef.current ?? d.heading;
      const camAz = (((d.heading - front) % 360) + 360) % 360;
      const done = doneRef.current ?? new Set<string>();

      const { views: v, aligned: a } = projectTargets(camAz, d.elevation, done);

      // Aim-and-hold timing.
      const now = performance.now();
      let dwellValue = 0;
      if (a) {
        if (dwellTarget !== a) {
          dwellTarget = a;
          dwellStart = now;
        }
        dwellValue = Math.min(1, (now - dwellStart) / DWELL_MS);
        if (dwellValue >= 1 && lastFired !== a) {
          lastFired = a;
          onCaptureRef.current(a);
        }
      } else {
        dwellTarget = null;
        lastFired = null;
      }

      // Only push to React when something visibly changed.
      const movedAz = Math.abs(camAz - lastCamAz);
      const movedEl = Math.abs(d.elevation - lastEl);
      const dwellChanged = Math.abs(dwellValue - lastDwell) > 0.02;
      if (
        movedAz > 0.3 ||
        movedEl > 0.3 ||
        a !== lastAligned ||
        dwellChanged
      ) {
        lastCamAz = camAz;
        lastEl = d.elevation;
        lastAligned = a;
        lastDwell = dwellValue;
        setViews(v);
        setAligned(a);
        setDwell(dwellValue);
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [dataRef, frontOffsetRef, doneRef]);

  const doneCount = views.filter((v) => v.done).length;
  const nearest = views.reduce<TargetView | null>(
    (best, v) => (!v.done && (!best || v.dist < best.dist) ? v : best),
    null,
  );
  const showArrow = !!nearest && !nearest.visible && aligned == null;
  const arrowAngle = nearest
    ? (Math.atan2(nearest.y - 50, nearest.x - 50) * 180) / Math.PI
    : 0;

  return (
    <div className="overlay">
      <div className="overlay__progress">
        {doneCount >= total ? 'Full coverage 🎉' : `${doneCount} / ${total}`}
      </div>

      {views.map(
        (v) =>
          v.visible && (
            <div
              key={v.id}
              className={`adot ${v.done ? 'is-done' : ''} ${
                aligned === v.id ? 'is-aligned' : ''
              }`}
              style={{ left: `${v.x}%`, top: `${v.y}%` }}
            >
              {v.done ? '✓' : ''}
            </div>
          ),
      )}

      <div className={`reticle ${aligned ? 'is-armed' : ''}`}>
        <svg viewBox="0 0 110 110">
          <circle className="reticle__bg" cx="55" cy="55" r={RING_R} />
          <circle
            className="reticle__fg"
            cx="55"
            cy="55"
            r={RING_R}
            style={{
              strokeDasharray: RING_C,
              strokeDashoffset: RING_C * (1 - dwell),
            }}
          />
          <circle className="reticle__center" cx="55" cy="55" r="4" />
        </svg>
      </div>

      {showArrow && (
        <div className="overlay__arrow-wrap">
          <div
            className="overlay__arrow"
            style={{ transform: `rotate(${arrowAngle}deg)` }}
          >
            ➤
          </div>
          <div className="overlay__arrow-hint">Turn to the next dot</div>
        </div>
      )}
    </div>
  );
}
