// The six directions we want the user to photograph for a full surround.
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

// Where each horizontal target sits, in degrees clockwise from "Front".
export const HORIZONTAL_ANGLES: Record<'front' | 'right' | 'back' | 'left', number> = {
  front: 0,
  right: 90,
  back: 180,
  left: 270,
};

/** Shortest distance between two angles (0–180). */
export function angleDistance(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return Math.min(d, 360 - d);
}

/**
 * Work out which target the phone is currently aimed at.
 * - pitch (beta) near 90 = held upright → looking at the horizon
 * - pitch high = tilted back → ceiling
 * - pitch low = tilted down → floor
 * - otherwise pick the nearest of front/right/back/left from the heading
 *
 * `headingRel` is the compass heading relative to the calibrated "Front".
 * Returns null if not clearly aimed at any single target.
 */
export function activeTarget(headingRel: number, pitch: number): TargetId | null {
  if (pitch > 135) return 'ceiling';
  if (pitch < 45) return 'floor';

  let best: TargetId | null = null;
  let bestDist = Infinity;
  (Object.keys(HORIZONTAL_ANGLES) as (keyof typeof HORIZONTAL_ANGLES)[]).forEach(
    (id) => {
      const dist = angleDistance(headingRel, HORIZONTAL_ANGLES[id]);
      if (dist < bestDist) {
        bestDist = dist;
        best = id;
      }
    },
  );
  // Only count it if we're reasonably pointed that way (within 45°).
  return bestDist <= 45 ? best : null;
}
