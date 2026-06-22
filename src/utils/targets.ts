// The six directions we want the user to photograph for a full surround,
// plus the math that places each one as a floating dot on screen based on
// where the phone is currently pointing.
export type TargetId = 'front' | 'right' | 'back' | 'left' | 'ceiling' | 'floor';

export type Target = {
  id: TargetId;
  label: string;
  icon: string;
};

export const TARGETS: Target[] = [
  { id: 'front', label: 'Front', icon: '⬆️' },
  { id: 'right', label: 'Right', icon: '➡️' },
  { id: 'back', label: 'Back', icon: '⬇️' },
  { id: 'left', label: 'Left', icon: '⬅️' },
  { id: 'ceiling', label: 'Ceiling', icon: '🔼' },
  { id: 'floor', label: 'Floor', icon: '🔽' },
];

/** Normalise an angle to the range -180…180. */
export function shortestAngle(deg: number): number {
  return (((deg % 360) + 540) % 360) - 180;
}

type TargetDef = {
  id: TargetId;
  az: number; // azimuth (compass) the target sits at, relative to "Front"
  el: number; // elevation: 0 = horizon, +90 = straight up, -90 = straight down
  anyAzimuth: boolean; // ceiling/floor don't care which way you face
};

const DEFS: TargetDef[] = [
  { id: 'front', az: 0, el: 0, anyAzimuth: false },
  { id: 'right', az: 90, el: 0, anyAzimuth: false },
  { id: 'back', az: 180, el: 0, anyAzimuth: false },
  { id: 'left', az: 270, el: 0, anyAzimuth: false },
  { id: 'ceiling', az: 0, el: 90, anyAzimuth: true },
  { id: 'floor', az: 0, el: -90, anyAzimuth: true },
];

export type TargetView = {
  id: TargetId;
  label: string;
  icon: string;
  x: number; // horizontal position, in % of the view (50 = center)
  y: number; // vertical position, in % of the view (50 = center)
  visible: boolean; // is it within the on-screen field of view?
  dist: number; // angular distance from the center reticle, in degrees
  done: boolean;
};

const SCALE = 0.8; // % of the screen per degree of difference
const FOV = 55; // half field-of-view: show a dot when within this many degrees
const ALIGN = 14; // within this many degrees of center = "on target"

/**
 * Given where the camera points (azimuth + elevation) and which targets are
 * done, work out where every target dot should appear and which one (if any)
 * the reticle is locked onto.
 */
export function projectTargets(
  camAz: number,
  camEl: number,
  done: Set<TargetId>,
): { views: TargetView[]; aligned: TargetId | null } {
  const views: TargetView[] = DEFS.map((d) => {
    const meta = TARGETS.find((t) => t.id === d.id)!;
    const dAz = d.anyAzimuth ? 0 : shortestAngle(d.az - camAz);
    const dEl = d.el - camEl;
    const dist = d.anyAzimuth ? Math.abs(dEl) : Math.hypot(dAz, dEl);
    const visible = d.anyAzimuth
      ? Math.abs(dEl) <= FOV
      : Math.abs(dAz) <= FOV && Math.abs(dEl) <= FOV;
    return {
      id: d.id,
      label: meta.label,
      icon: meta.icon,
      x: 50 + dAz * SCALE,
      y: 50 - dEl * SCALE,
      visible,
      dist,
      done: done.has(d.id),
    };
  });

  let aligned: TargetId | null = null;
  let best = ALIGN;
  for (const v of views) {
    if (!v.done && v.dist < best) {
      best = v.dist;
      aligned = v.id;
    }
  }

  return { views, aligned };
}
