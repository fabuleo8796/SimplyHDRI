// Milestone 2: real camera capture.
// - Start/Stop the rear camera
// - Live preview
// - Capture frames to a thumbnail gallery
// - Delete a shot, or download it as JPG / PNG
import { useEffect, useState } from 'react';
import { useCamera } from '../hooks/useCamera';
import { captureFrameToBlob, reencode, downloadBlob } from '../utils/image';
import { isStandalone } from '../utils/platform';
import { InstallSteps } from './InstallSteps';
import { ProximityText } from './ProximityText';

type CaptureScreenProps = {
  onBack: () => void;
};

// One captured photo held in memory while the screen is open.
type Shot = {
  id: string;
  blob: Blob;
  url: string; // object URL for showing the thumbnail
};

export function CaptureScreen({ onBack }: CaptureScreenProps) {
  const { videoRef, status, errorMsg, start, stop } = useCamera();
  const [shots, setShots] = useState<Shot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const installed = isStandalone();

  // Release all the thumbnail object URLs when the screen closes.
  useEffect(() => {
    return () => {
      shots.forEach((shot) => URL.revokeObjectURL(shot.url));
    };
    // We intentionally clean up only on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capture = async () => {
    const video = videoRef.current;
    if (!video) return;
    // Quick white flash for tactile "shutter" feedback.
    setFlash(true);
    window.setTimeout(() => setFlash(false), 180);
    const blob = await captureFrameToBlob(video);
    if (!blob) return;
    const shot: Shot = {
      id: crypto.randomUUID(),
      blob,
      url: URL.createObjectURL(blob),
    };
    setShots((prev) => [shot, ...prev]);
  };

  const deleteShot = (id: string) => {
    setShots((prev) => {
      const found = prev.find((s) => s.id === id);
      if (found) URL.revokeObjectURL(found.url);
      return prev.filter((s) => s.id !== id);
    });
    if (selectedId === id) setSelectedId(null);
  };

  const download = async (shot: Shot, format: 'jpg' | 'png') => {
    const stamp = Date.now();
    if (format === 'png') {
      const png = await reencode(shot.blob, 'image/png');
      downloadBlob(png, `simplyhdri-${stamp}.png`);
    } else {
      downloadBlob(shot.blob, `simplyhdri-${stamp}.jpg`);
    }
  };

  const selected = shots.find((s) => s.id === selectedId) || null;
  const isReady = status === 'ready';

  return (
    <div className="app-shell">
      <header className="brand">
        <img src="/pwa-192x192.png" alt="SimplyHDRI icon" />
        <div>
          <h1>
            <ProximityText>Capture</ProximityText>
          </h1>
          <div className="tagline">Rear camera · {shots.length} captured</div>
        </div>
      </header>

      {/* Live camera preview (the video is always mounted so the camera
          hook can attach to it; a placeholder covers it until it's ready). */}
      <div className="camera-view">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={isReady ? '' : 'is-hidden'}
        />
        {!isReady && (
          <div className="camera-view__placeholder">
            {status === 'requesting' && 'Starting camera…'}
            {status === 'idle' && 'Tap “Start Camera” to begin.'}
            {(status === 'denied' || status === 'error') && '📷'}
          </div>
        )}
        {flash && <div className="cam-flash" />}
      </div>

      {errorMsg && <p className="camera-error">{errorMsg}</p>}

      {/* Controls change with the camera state. */}
      {isReady ? (
        <div className="cam-controls">
          <div className="cam-side">
            <button className="cam-stop" onClick={stop}>
              Stop
            </button>
          </div>
          <button
            className="shutter"
            onClick={capture}
            aria-label="Capture photo"
          >
            <span />
          </button>
          <div className="cam-side right" />
        </div>
      ) : (
        <button
          className="btn btn-primary"
          onClick={start}
          disabled={status === 'requesting'}
        >
          {status === 'requesting'
            ? 'Starting…'
            : status === 'denied' || status === 'error'
              ? 'Try Again'
              : 'Start Camera'}
        </button>
      )}

      {/* Thumbnail gallery */}
      {shots.length > 0 && (
        <section className="card">
          <h2>
            <ProximityText>Captured photos</ProximityText>
          </h2>
          <div className="shots">
            {shots.map((shot) => (
              <div
                key={shot.id}
                className={`shot ${selectedId === shot.id ? 'is-selected' : ''}`}
              >
                <button
                  className="shot__pick"
                  onClick={() => setSelectedId(shot.id)}
                  aria-label="Select photo"
                >
                  <img src={shot.url} alt="Captured frame" />
                </button>
                <button
                  className="shot__del"
                  onClick={() => deleteShot(shot.id)}
                  aria-label="Delete photo"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {selected && (
            <div className="shot-actions">
              <span className="note">Download selected photo:</span>
              <div className="btn-row">
                <button
                  className="btn btn-ghost"
                  onClick={() => download(selected, 'jpg')}
                >
                  ⬇️ JPG
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => download(selected, 'png')}
                >
                  ⬇️ PNG
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Gentle install hint on the web (the camera still works in Safari). */}
      {!installed && (
        <details className="install-tip">
          <summary>
            💡 <ProximityText>Tip: add SimplyHDRI to your Home Screen</ProximityText>
          </summary>
          <InstallSteps />
        </details>
      )}

      <button className="btn btn-ghost" onClick={onBack}>
        ← Back
      </button>
    </div>
  );
}
