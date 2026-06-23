// Calibration anchors the user sets BEFORE scanning, so the live orientation
// readings map accurately onto the sphere. Two corrections, both real (no
// guessing):
//
//  • Azimuth — front/back/left/right give four (target-az ↔ raw-heading) pairs.
//    We piecewise-interpolate between them, so "front" is truly 0°, a quarter
//    turn is truly 90°, etc. This cancels compass distortion/offset in the room.
//
//  • Elevation — top/bottom record the raw reading at true straight-up and
//    straight-down. We then linearly remap so up = +90° and down = -90°,
//    cancelling any pitch offset or gain in the sensor (kills vertical drift).

export type AnchorId = 'front' | 'right' | 'back' | 'left' | 'top' | 'bottom';

// The four horizontal anchors and the azimuth each one represents, in the
// order you sweep them (clockwise from front).
export const HORIZONTAL_ANCHORS: { id: AnchorId; az: number }[] = [
  { id: 'front', az: 0 },
  { id: 'right', az: 90 },
  { id: 'back', az: 180 },
  { id: 'left', az: 270 },
];

// Every anchor that must be set before scanning can begin.
export const ALL_ANCHORS: AnchorId[] = [
  'front',
  'right',
  'back',
  'left',
  'top',
  'bottom',
];

// Raw sensor values recorded at each anchor: a compass heading for the four
// horizontal ones, a raw elevation for top/bottom.
export type RawAnchors = Partial<Record<AnchorId, number>>;

export type Calibration = {
  ring: { az: number; heading: number }[]; // front,right,back,left
  ringValid: boolean; // piecewise az usable? else fall back to front offset only
  front: number; // raw heading at front (fallback offset)
  rawTop: number;
  rawBottom: number;
  elValid: boolean; // top/bottom far enough apart to remap elevation?
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** True once every one of the six anchors has been recorded. */
export function isComplete(raw: RawAnchors): boolean {
  return ALL_ANCHORS.every((id) => raw[id] != null);
}

/**
 * Turn the six recorded anchors into a Calibration. Returns null until all six
 * are set. Also self-checks the recordings: if the horizontal sweep doesn't
 * advance ~90° per step (e.g. anchors set out of order), `ringValid` is false
 * and azimuth gracefully falls back to a simple front offset.
 */
export function buildCalibration(raw: RawAnchors): Calibration | null {
  if (!isComplete(raw)) return null;

  const ring = HORIZONTAL_ANCHORS.map((a) => ({
    az: a.az,
    heading: raw[a.id] as number,
  }));

  // Each forward step (front→right→back→left→front) should advance the compass
  // by roughly a quarter turn. If any step is way off, the recordings are
  // inconsistent — don't trust the piecewise map.
  let ringValid = true;
  for (let i = 0; i < ring.length; i++) {
    const cur = ring[i].heading;
    const nxt = ring[(i + 1) % ring.length].heading;
    const dHead = (((nxt - cur) % 360) + 360) % 360;
    if (dHead < 30 || dHead > 170) {
      ringValid = false;
      break;
    }
  }

  const rawTop = raw.top as number;
  const rawBottom = raw.bottom as number;
  const elValid = Math.abs(rawTop - rawBottom) >= 60;

  return {
    ring,
    ringValid,
    front: raw.front as number,
    rawTop,
    rawBottom,
    elValid,
  };
}

/**
 * Map a live compass heading to a calibrated azimuth (0–360, relative to front)
 * using piecewise-linear interpolation across the four horizontal anchors.
 */
export function applyAz(cal: Calibration, rawHeading: number): number {
  if (cal.ringValid) {
    for (let i = 0; i < cal.ring.length; i++) {
      const cur = cal.ring[i];
      const nxt = cal.ring[(i + 1) % cal.ring.length];
      const dHead = (((nxt.heading - cur.heading) % 360) + 360) % 360;
      const off = (((rawHeading - cur.heading) % 360) + 360) % 360;
      if (off <= dHead && dHead > 0) {
        const dAz = (((nxt.az - cur.az) % 360) + 360) % 360; // ~90
        return (((cur.az + (off / dHead) * dAz) % 360) + 360) % 360;
      }
    }
  }
  // Fallback: plain offset from the front heading.
  return (((rawHeading - cal.front) % 360) + 360) % 360;
}

/**
 * Map a live raw elevation to a calibrated elevation (-90 floor … +90 ceiling)
 * by linearly remapping the recorded bottom→-90 and top→+90.
 */
export function applyEl(cal: Calibration, rawEl: number): number {
  if (!cal.elValid) return clamp(rawEl, -90, 90);
  const span = cal.rawTop - cal.rawBottom;
  const t = (rawEl - cal.rawBottom) / span; // 0 at bottom, 1 at top
  return clamp(-90 + t * 180, -90, 90);
}
