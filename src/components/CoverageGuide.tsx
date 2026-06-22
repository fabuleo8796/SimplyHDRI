// Visual guide showing the phone's orientation and which of the six
// capture targets are done. Includes a compass for the four horizontal
// directions plus chips for all six (including ceiling/floor).
import type { OrientationData } from '../hooks/useOrientation';
import { TARGETS, HORIZONTAL_ANGLES } from '../utils/targets';
import type { TargetId } from '../utils/targets';

type CoverageGuideProps = {
  data: OrientationData;
  frontOffset: number | null;
  active: TargetId | null;
  done: Set<TargetId>;
  onSetFront: () => void;
};

// Convert an angle (clockwise from top) to an x/y on a circle.
function pointOnCircle(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

export function CoverageGuide({
  data,
  frontOffset,
  active,
  done,
  onSetFront,
}: CoverageGuideProps) {
  const headingRel =
    frontOffset == null ? data.heading : ((data.heading - frontOffset) % 360 + 360) % 360;

  const cx = 80;
  const cy = 80;
  const r = 58;
  const needle = pointOnCircle(cx, cy, r - 12, headingRel);

  const horizontal: { id: TargetId; angle: number; short: string }[] = [
    { id: 'front', angle: HORIZONTAL_ANGLES.front, short: 'F' },
    { id: 'right', angle: HORIZONTAL_ANGLES.right, short: 'R' },
    { id: 'back', angle: HORIZONTAL_ANGLES.back, short: 'B' },
    { id: 'left', angle: HORIZONTAL_ANGLES.left, short: 'L' },
  ];

  const activeLabel = active
    ? TARGETS.find((t) => t.id === active)?.label
    : null;

  return (
    <section className="card coverage">
      <div className="coverage__top">
        <h2>🧭 Coverage</h2>
        <button className="cam-stop" onClick={onSetFront}>
          Set Front
        </button>
      </div>

      <div className="coverage__readout">
        Yaw {data.yaw}° · Pitch {data.pitch}° · Roll {data.roll}°
      </div>

      {/* Compass for the four horizontal directions */}
      <svg className="compass" viewBox="0 0 160 160" role="img" aria-label="Compass">
        <circle cx={cx} cy={cy} r={r} className="compass__ring" />
        {/* Needle showing where you're currently facing */}
        <line
          x1={cx}
          y1={cy}
          x2={needle.x}
          y2={needle.y}
          className="compass__needle"
        />
        <circle cx={cx} cy={cy} r="4" className="compass__hub" />
        {horizontal.map(({ id, angle, short }) => {
          const p = pointOnCircle(cx, cy, r, angle);
          const isDone = done.has(id);
          const isActive = active === id;
          return (
            <g key={id}>
              <circle
                cx={p.x}
                cy={p.y}
                r="11"
                className={`compass__dot ${isDone ? 'is-done' : ''} ${
                  isActive ? 'is-active' : ''
                }`}
              />
              <text x={p.x} y={p.y + 4} className="compass__label">
                {isDone ? '✓' : short}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Active hint */}
      <p className="coverage__hint">
        {active
          ? done.has(active)
            ? `${activeLabel} captured ✓ — move to the next direction`
            : `Aim at ${activeLabel}, hold steady, and tap the shutter`
          : 'Point the camera at one of the targets'}
      </p>

      {/* All six targets as chips */}
      <div className="targets">
        {TARGETS.map((t) => {
          const isDone = done.has(t.id);
          const isActive = active === t.id;
          return (
            <div
              key={t.id}
              className={`target ${isDone ? 'is-done' : ''} ${
                isActive ? 'is-active' : ''
              }`}
            >
              <span className="target__icon">{isDone ? '✅' : t.icon}</span>
              <span className="target__label">{t.label}</span>
            </div>
          );
        })}
      </div>

      <p className="note">
        {done.size} of {TARGETS.length} directions captured
      </p>
    </section>
  );
}
