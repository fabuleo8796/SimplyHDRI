// A dense set of aim points spread across the whole sphere, so that hitting
// them all gives overlapping coverage with no black gaps. Plus the math that
// places each point on screen based on where the phone currently points.
export type TargetPoint = {
  id: string;
  az: number; // azimuth (compass) relative to "Front"
  el: number; // elevation: 0 = horizon, +90 = up, -90 = down
  pole: boolean; // straight up/down (azimuth doesn't matter)
};

// Rings of targets at several elevations. Spacing is closer than the camera's
// field of view (~65–70°) so neighbouring shots overlap.
function buildPoints(): TargetPoint[] {
  const rings: { el: number; count: number }[] = [
    { el: 0, count: 8 }, // horizon, every 45°
    { el: 40, count: 6 }, // up a bit
    { el: -40, count: 6 }, // down a bit
    { el: 70, count: 4 }, // high
    { el: -70, count: 4 }, // low
  ];
  const points: TargetPoint[] = [];
  for (const ring of rings) {
    for (let k = 0; k < ring.count; k++) {
      const az = (360 / ring.count) * k;
      points.push({
        id: `e${ring.el}a${Math.round(az)}`,
        az,
        el: ring.el,
        pole: false,
      });
    }
  }
  points.push({ id: 'zenith', az: 0, el: 90, pole: true });
  points.push({ id: 'nadir', az: 0, el: -90, pole: true });
  return points;
}

export const TARGET_POINTS = buildPoints();

/** Normalise an angle to the range -180…180. */
export function shortestAngle(deg: number): number {
  return (((deg % 360) + 540) % 360) - 180;
}

export type TargetView = {
  id: string;
  x: number; // horizontal position, % of view (50 = center)
  y: number; // vertical position, % of view (50 = center)
  visible: boolean;
  dist: number; // angular distance from center, degrees
  done: boolean;
  pole: boolean;
};

const SCALE = 0.8; // % of screen per degree
const FOV = 55; // half field-of-view for showing a dot
const ALIGN = 12; // within this many degrees of center = "on target"

/**
 * Project every target point to screen space given where the camera points,
 * and report which undone point (if any) the reticle is locked onto.
 */
export function projectTargets(
  camAz: number,
  camEl: number,
  done: Set<string>,
): { views: TargetView[]; aligned: string | null } {
  const views: TargetView[] = TARGET_POINTS.map((p) => {
    const dAz = p.pole ? 0 : shortestAngle(p.az - camAz);
    const dEl = p.el - camEl;
    const dist = p.pole ? Math.abs(dEl) : Math.hypot(dAz, dEl);
    const visible = p.pole
      ? Math.abs(dEl) <= FOV
      : Math.abs(dAz) <= FOV && Math.abs(dEl) <= FOV;
    return {
      id: p.id,
      x: 50 + dAz * SCALE,
      y: 50 - dEl * SCALE,
      visible,
      dist,
      done: done.has(p.id),
      pole: p.pole,
    };
  });

  let aligned: string | null = null;
  let best = ALIGN;
  for (const v of views) {
    if (!v.done && v.dist < best) {
      best = v.dist;
      aligned = v.id;
    }
  }

  return { views, aligned };
}
