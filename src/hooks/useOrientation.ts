// Reads the phone's orientation sensors (heading / tilt) and handles the
// iOS permission prompt, which must be triggered by a user tap.
import { useCallback, useEffect, useRef, useState } from 'react';

export type OrientationStatus =
  | 'idle' // not enabled yet
  | 'granted' // receiving sensor data
  | 'denied' // user blocked motion access
  | 'unsupported'; // device/browser has no orientation sensors

export type OrientationData = {
  heading: number; // compass heading, 0–360 (0 = North-ish)
  yaw: number; // rounded heading, for display
  pitch: number; // beta: front/back tilt
  roll: number; // gamma: left/right tilt
};

// iOS 13+ exposes a requestPermission() function on DeviceOrientationEvent.
type DOEWithPermission = {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};
// iOS also adds a true-compass heading on the event.
type IOSOrientationEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

export function useOrientation() {
  const [status, setStatus] = useState<OrientationStatus>('idle');
  const [data, setData] = useState<OrientationData>({
    heading: 0,
    yaw: 0,
    pitch: 90,
    roll: 0,
  });
  const handlerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);

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
        // Prefer the iOS true-compass heading; otherwise approximate from alpha.
        const heading =
          typeof ev.webkitCompassHeading === 'number'
            ? ev.webkitCompassHeading
            : e.alpha != null
              ? (360 - e.alpha) % 360
              : 0;
        setData({
          heading,
          yaw: Math.round(heading),
          pitch: Math.round(e.beta ?? 90),
          roll: Math.round(e.gamma ?? 0),
        });
      };

      handlerRef.current = handler;
      window.addEventListener('deviceorientation', handler, true);
      setStatus('granted');
    } catch {
      setStatus('denied');
    }
  }, [needsPermission]);

  // Remove the listener if the component goes away.
  useEffect(() => {
    return () => {
      if (handlerRef.current) {
        window.removeEventListener('deviceorientation', handlerRef.current, true);
      }
    };
  }, []);

  return { status, data, enable, needsPermission };
}
