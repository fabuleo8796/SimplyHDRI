// Self-driven guided-capture overlay. It runs its OWN animation loop, reading
// the live orientation from a ref, so the rest of the screen never re-renders
// while you scan. It positions the dots, handles aim-and-hold, and calls back
// only when a photo should be taken.
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { OrientationData } from '../hooks/useOrientation';
import { projectTargets } from '../utils/targets';
import type { TargetView } from '../utils/targets';
import { applyAz, applyEl } from '../utils/calibration';
import type { Calibration } from '../utils/calibration';

type CaptureOverlayProps = {
  dataRef: RefObject<OrientationData>;
  calibrationRef: RefObject<Calibration | null>;
  doneRef: RefObject<Set<string>>;
  total: number;
  onCapture: (id: string) => void;
};

const RING_R = 48;
const RING_C = 2 * Math.PI * RING_R;
const DWELL_MS = 900;

export function CaptureOverlay({
  dataRef,
  calibrationRef,
  doneRef,
  total,
  onCapture,
}: CaptureOverlayProps) {
  const [views, setViews] = useState<TargetView[]>([]);
  const [aligned, setAligned] = useState<string | null>(null);
  const [dwell, setDwell] = useState(0);

  // Keep callbacks fresh without restarting the loop.
  const onCaptureRef = useRef(onCapture);
  onCaptureRef.current = onCapture;

  useEffect(() => {
    let rafId = 0;
    let dwellTarget: string | null = null;
    let dwellStart = 0;
    let lastFired: string | null = null;
    let prevAligned: string | null = null; // last frame's lock (for hysteresis)
    // Last emitted values, to avoid re-rendering when nothing moved.
    let lastCamAz = 999;
    let lastEl = 999;
    let lastAligned: string | null = null;
    let lastDwell = -1;

    const loop = () => {
      const d = dataRef.current;
      const cal = calibrationRef.current;

      // Use the calibrated mapping set up before scanning. (Calibration is
      // required to reach this overlay, so `cal` is always present here.)
      const camAz = cal
        ? applyAz(cal, d.heading)
        : (((d.heading % 360) + 360) % 360);
      const camEl = cal ? applyEl(cal, d.elevation) : d.elevation;
      const done = doneRef.current ?? new Set<string>();

      const { views: v, aligned: a } = projectTargets(
        camAz,
        camEl,
        done,
        prevAligned,
      );
      prevAligned = a;

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
  }, [dataRef, calibrationRef, doneRef]);

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
