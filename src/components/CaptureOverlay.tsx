// The guided-capture overlay that sits on top of the live camera.
// Floating dots mark each direction and move as you turn the phone; aim the
// center reticle at a dot and hold steady to auto-capture. A guidance arrow
// points toward the nearest target when it's off screen.
import type { TargetView, TargetId } from '../utils/targets';

type CaptureOverlayProps = {
  views: TargetView[];
  aligned: TargetId | null;
  dwell: number; // 0..1 hold progress
  doneCount: number;
  total: number;
};

const RING_R = 48;
const RING_C = 2 * Math.PI * RING_R;

export function CaptureOverlay({
  views,
  aligned,
  dwell,
  doneCount,
  total,
}: CaptureOverlayProps) {
  // Nearest target still to do — used for the off-screen guidance arrow.
  const undone = views.filter((v) => !v.done);
  const nearest = undone.reduce<TargetView | null>(
    (best, v) => (!best || v.dist < best.dist ? v : best),
    null,
  );
  const showArrow = !!nearest && !nearest.visible && aligned == null;
  const arrowAngle = nearest
    ? (Math.atan2(nearest.y - 50, nearest.x - 50) * 180) / Math.PI
    : 0;

  return (
    <div className="overlay">
      <div className="overlay__progress">
        {doneCount === total ? 'All directions captured 🎉' : `${doneCount} / ${total}`}
      </div>

      {/* Floating, world-locked direction dots */}
      {views.map(
        (v) =>
          v.visible && (
            <div
              key={v.id}
              className={`dot ${v.done ? 'is-done' : ''} ${
                aligned === v.id ? 'is-aligned' : ''
              }`}
              style={{ left: `${v.x}%`, top: `${v.y}%` }}
            >
              <span className="dot__icon">{v.done ? '✓' : v.icon}</span>
              <span className="dot__label">{v.label}</span>
            </div>
          ),
      )}

      {/* Center reticle with a dwell-progress ring */}
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

      {/* Off-screen guidance arrow */}
      {showArrow && (
        <div className="overlay__arrow-wrap">
          <div
            className="overlay__arrow"
            style={{ transform: `rotate(${arrowAngle}deg)` }}
          >
            ➤
          </div>
          <div className="overlay__arrow-hint">Turn to {nearest?.label}</div>
        </div>
      )}
    </div>
  );
}
