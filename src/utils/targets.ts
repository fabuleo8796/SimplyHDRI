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
    // High/low rings sit at ±60° (not ±70°) so they're well clear of the
    // zenith/nadir poles — that gap stops the lock flickering between a ring
    // dot and the pole when you aim near-vertical.
    { el: 60, count: 4 }, // high
    { el: -60, count: 4 }, // low
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
const ALIGN_RELEASE = 18; // keep an existing lock until you drift past this (hysteresis)
const POLE_LOCK = 72; // aim steeper than this (up/down) and we go for the pole
const POLE_RELEASE = 62; // once locked on a pole, hold it until you drop below this
// As you tilt from here up to POLE_LOCK, the pole dot glides to dead-center and
// the (compass-jittery) ring dots fade out — so the only thing left is one calm
// target sitting right under the reticle. This is what kills the "ceiling dot
// runs away" problem: near vertical we stop trusting the compass entirely.
const POLE_ENGAGE_START = 50;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
/** Smooth 0→1 ramp between two edges (eases in and out, no hard snap). */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Project every target point to screen space given where the camera points,
 * and report which undone point (if any) the reticle is locked onto.
 *
 * `prevAligned` is what we were locked onto last frame. It powers the
 * stickiness that stops the reticle bouncing around (especially near vertical,
 * where the compass is meaningless and the elevation reading is twitchy):
 *  • poles win outright when you aim steeply up/down,
 *  • the engaged pole dot is pinned toward screen-center so it can't drift, and
 *  • whichever target is currently locked keeps a wider release radius.
 */
export function projectTargets(
  camAz: number,
  camEl: number,
  done: Set<string>,
  prevAligned: string | null = null,
): { views: TargetView[]; aligned: string | null } {
  // How "committed" we are to a pole right now (0 = not, 1 = fully). Near
  // vertical this approaches 1, and we stop trusting azimuth-based placement.
  const poleField = smoothstep(POLE_ENGAGE_START, POLE_LOCK, Math.abs(camEl));
  const facingPole = camEl >= 0 ? 'zenith' : 'nadir';

  const views: TargetView[] = TARGET_POINTS.map((p) => {
    const dAz = p.pole ? 0 : shortestAngle(p.az - camAz);
    const dEl = p.el - camEl;
    const dist = p.pole ? Math.abs(dEl) : Math.hypot(dAz, dEl);

    let x = 50 + dAz * SCALE;
    let y = 50 - dEl * SCALE;
    let visible = p.pole
      ? Math.abs(dEl) <= FOV
      : Math.abs(dAz) <= FOV && Math.abs(dEl) <= FOV;

    if (p.pole && p.id === facingPole) {
      // The pole we're tilting toward: glide it to dead-center (under the
      // reticle) as we commit, and always keep it on screen once engaged.
      x = 50; // azimuth is meaningless here anyway
      y = lerp(y, 50, poleField);
      if (poleField > 0.05) visible = true;
    } else if (!p.pole) {
      // Ring dots: fade out as the pole takes over, so they stop swimming
      // around from compass jitter and don't distract / steal the lock.
      if (poleField >= 0.6) visible = false;
    }

    return {
      id: p.id,
      x,
      y,
      visible,
      dist,
      done: done.has(p.id),
      pole: p.pole,
    };
  });

  const undone = (id: string): TargetView | null => {
    const v = views.find((x) => x.id === id);
    return v && !v.done ? v : null;
  };

  // 1) Poles take priority when you tilt steeply. The compass is unreliable
  //    near vertical, so don't let a jittery ring dot steal the lock. The
  //    threshold is lower once you're already locked on the pole (sticky).
  const zLock = prevAligned === 'zenith' ? POLE_RELEASE : POLE_LOCK;
  if (camEl >= zLock && undone('zenith')) return { views, aligned: 'zenith' };
  const nLock = prevAligned === 'nadir' ? POLE_RELEASE : POLE_LOCK;
  if (camEl <= -nLock && undone('nadir')) return { views, aligned: 'nadir' };

  // 2) Otherwise: the nearest undone, visible ring dot within ALIGN. (Skipping
  //    hidden dots means the ones faded out near a pole can't steal the lock.)
  let nearest: string | null = null;
  let best = ALIGN;
  for (const v of views) {
    if (v.done || v.pole || !v.visible) continue;
    if (v.dist < best) {
      best = v.dist;
      nearest = v.id;
    }
  }

  // Hysteresis: if we were locked on a ring dot, keep it until we drift past
  // ALIGN_RELEASE or another dot is clearly closer — no flickering on the edge.
  if (prevAligned && prevAligned !== nearest && prevAligned !== 'zenith' && prevAligned !== 'nadir') {
    const prev = undone(prevAligned);
    if (prev && prev.dist <= ALIGN_RELEASE && (nearest === null || best > prev.dist - 3)) {
      return { views, aligned: prevAligned };
    }
  }

  return { views, aligned: nearest };
}
