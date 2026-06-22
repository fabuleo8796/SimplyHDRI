// Reads the phone's orientation sensors and handles the iOS permission tap.
// Produces a robust "elevation" (where the rear camera points vertically) and
// smooths everything so the on-screen guides glide instead of jitter.
import { useCallback, useEffect, useRef, useState } from 'react';

export type OrientationStatus =
  | 'idle'
  | 'granted'
  | 'denied'
  | 'unsupported';

export type OrientationData = {
  heading: number; // compass heading 0–360
  yaw: number; // rounded heading for display
  pitch: number; // raw beta, for display
  roll: number; // raw gamma, for display
  elevation: number; // camera vertical aim: -90 = floor, 0 = horizon, +90 = ceiling
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

// How strongly to smooth (0 = frozen, 1 = no smoothing). 0.2 feels responsive.
const SMOOTH = 0.2;

export function useOrientation() {
  const [status, setStatus] = useState<OrientationStatus>('idle');
  const [data, setData] = useState<OrientationData>({
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
  // Last values pushed to React (so we only re-render on real movement).
  const emitted = useRef({ heading: -999, el: -999, roll: -999 });

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

        // Robust camera elevation: rotate the device's "out the back" axis into
        // world space and read its vertical component. Correct for the full
        // range and unaffected by side-to-side roll — fixes ceiling/floor mixups.
        const b = (beta * Math.PI) / 180;
        const g = (gamma * Math.PI) / 180;
        const rawEl =
          (Math.asin(
            Math.max(-1, Math.min(1, -Math.cos(b) * Math.cos(g))),
          ) *
            180) /
          Math.PI;

        // Exponential smoothing (heading handled across the 0/360 seam).
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

        // Skip the state update when nothing meaningful changed.
        const dH = Math.abs(shortestAngle(sHeading.current - emitted.current.heading));
        const dE = Math.abs(sEl.current - emitted.current.el);
        const dR = Math.abs(sRoll.current - emitted.current.roll);
        if (dH < 0.4 && dE < 0.4 && dR < 0.6) return;

        emitted.current = {
          heading: sHeading.current,
          el: sEl.current,
          roll: sRoll.current,
        };
        setData({
          heading: sHeading.current,
          yaw: Math.round(sHeading.current),
          pitch: Math.round(sPitch.current),
          roll: Math.round(sRoll.current),
          elevation: sEl.current,
        });
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

  return { status, data, enable, needsPermission };
}
