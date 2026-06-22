// All the camera logic in one reusable hook, so the screen component
// stays focused on layout. It opens the rear camera, falls back to any
// camera, and reports clear status/permission states.
import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraStatus =
  | 'idle' // not started yet
  | 'requesting' // asking for permission / starting
  | 'ready' // live preview is showing
  | 'denied' // user blocked camera access
  | 'error'; // something else went wrong

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Turn the camera off and release the hardware (light goes off).
  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus('idle');
  }, []);

  const start = useCallback(async () => {
    // Older / non-secure contexts may not have camera support.
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error');
      setErrorMsg(
        'This browser cannot access the camera. Use Safari over an https:// address.',
      );
      return;
    }

    setStatus('requesting');
    setErrorMsg('');

    try {
      let stream: MediaStream;
      try {
        // Prefer the rear ("environment") camera.
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch {
        // Fallback: any available camera (e.g. front camera only).
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // play() can reject on iOS if not user-initiated; ignore that.
        await videoRef.current.play().catch(() => {});
      }
      setStatus('ready');
    } catch (err) {
      const e = err as DOMException;
      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
        setStatus('denied');
        setErrorMsg(
          'Camera access was blocked. Allow the camera in Safari (aA menu → Website Settings → Camera) and try again.',
        );
      } else if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') {
        setStatus('error');
        setErrorMsg('No usable camera was found on this device.');
      } else {
        setStatus('error');
        setErrorMsg(e?.message || 'Could not start the camera.');
      }
    }
  }, []);

  // Safety net: if this screen unmounts, make sure the camera is released.
  useEffect(() => stop, [stop]);

  return { videoRef, status, errorMsg, start, stop };
}
