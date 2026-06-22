// Reads the phone's orientation sensors and handles the iOS permission tap.
// Exposes the live values through a *ref* (updated ~60×/sec) rather than React
// state, so consumers can read them in their own animation loop WITHOUT making
// the whole screen re-render on every sensor tick. This keeps capture smooth.
import { useCallback, useEffect, useRef, useState } from 'react';

export type OrientationStatus = 'idle' | 'granted' | 'denied' | 'unsupported';

export type OrientationData = {
  heading: number; // compass heading 0–360
  yaw: number; // rounded heading
  pitch: number; // raw beta
  roll: number; // raw gamma
  elevation: number; // camera vertical aim: -90 floor, 0 horizon, +90 ceiling
};

type DOEWithPermission = {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};
type IOSOrientationEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

function shortestAngle(deg: number) {
  return (((deg % 360) + 540) % 360) - 180;
}

const SMOOTH = 0.2; // 0 = frozen, 1 = no smoothing

export function useOrientation() {
  const [status, setStatus] = useState<OrientationStatus>('idle');
  // Live values — read these from an animation loop; they never trigger renders.
  const dataRef = useRef<OrientationData>({
    heading: 0,
    yaw: 0,
    pitch: 90,
    roll: 0,
    elevation: 0,
  });
  const handlerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);

  // Smoothed running values.
  const sHeading = useRef<number | null>(null);
  const sPitch = useRef(90);
  const sRoll = useRef(0);
  const sEl = useRef(0);

  const needsPermission =
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof (DeviceOrientationEvent as unknown as DOEWithPermission)
      .requestPermission === 'function';

  const enable = useCallback(async () => {
    if (typeof DeviceOrientationEvent === 'undefined') {
      setStatus('unsupported');
      return;
    }

    try {
      if (needsPermission) {
        const req = (DeviceOrientationEvent as unknown as DOEWithPermission)
          .requestPermission!;
        const result = await req();
        if (result !== 'granted') {
          setStatus('denied');
          return;
        }
      }

      const handler = (e: DeviceOrientationEvent) => {
        const ev = e as IOSOrientationEvent;
        const rawHeading =
          typeof ev.webkitCompassHeading === 'number'
            ? ev.webkitCompassHeading
            : e.alpha != null
              ? (360 - e.alpha) % 360
              : 0;
        const beta = e.beta ?? 90;
        const gamma = e.gamma ?? 0;

        // Robust camera elevation (roll-proof; fixes ceiling/floor mixups).
        const b = (beta * Math.PI) / 180;
        const g = (gamma * Math.PI) / 180;
        const rawEl =
          (Math.asin(Math.max(-1, Math.min(1, -Math.cos(b) * Math.cos(g)))) *
            180) /
          Math.PI;

        if (sHeading.current == null) {
          sHeading.current = rawHeading;
        } else {
          sHeading.current =
            ((sHeading.current +
              shortestAngle(rawHeading - sHeading.current) * SMOOTH) %
              360 +
              360) %
            360;
        }
        sPitch.current += (beta - sPitch.current) * SMOOTH;
        sRoll.current += (gamma - sRoll.current) * SMOOTH;
        sEl.current += (rawEl - sEl.current) * SMOOTH;

        // Update the ref only — no setState, no re-render.
        dataRef.current = {
          heading: sHeading.current,
          yaw: Math.round(sHeading.current),
          pitch: Math.round(sPitch.current),
          roll: Math.round(sRoll.current),
          elevation: sEl.current,
        };
      };

      handlerRef.current = handler;
      window.addEventListener('deviceorientation', handler, true);
      setStatus('granted');
    } catch {
      setStatus('denied');
    }
  }, [needsPermission]);

  useEffect(() => {
    return () => {
      if (handlerRef.current) {
        window.removeEventListener('deviceorientation', handlerRef.current, true);
      }
    };
  }, []);

  return { status, dataRef, enable, needsPermission };
}
