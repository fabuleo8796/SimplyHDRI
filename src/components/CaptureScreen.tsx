// Milestone 2 + 3: camera capture with orientation guidance.
// - Start/Stop the rear camera, live preview, capture to a gallery
// - Delete a shot, or download it as JPG / PNG
// - Track which of the six directions you've covered using the motion sensors
import { useEffect, useState } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useOrientation } from '../hooks/useOrientation';
import { captureFrameToBlob, reencode, downloadBlob } from '../utils/image';
import { isStandalone } from '../utils/platform';
import { activeTarget, TARGETS } from '../utils/targets';
import type { TargetId } from '../utils/targets';
import { InstallSteps } from './InstallSteps';
import { ProximityText } from './ProximityText';
import { CoverageGuide } from './CoverageGuide';

type CaptureScreenProps = {
  onBack: () => void;
};

// One captured photo held in memory while the screen is open.
type Shot = {
  id: string;
  blob: Blob;
  url: string; // object URL for showing the thumbnail
  target: TargetId | null; // which direction it was aimed at (if known)
  orientation: { yaw: number; pitch: number; roll: number } | null;
};

const targetLabel = (id: TargetId) =>
  TARGETS.find((t) => t.id === id)?.label ?? id;

export function CaptureScreen({ onBack }: CaptureScreenProps) {
  const { videoRef, status, errorMsg, start, stop } = useCamera();
  const {
    status: oriStatus,
    data: ori,
    enable: enableOri,
  } = useOrientation();

  const [shots, setShots] = useState<Shot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [frontOffset, setFrontOffset] = useState<number | null>(null);
  const [done, setDone] = useState<Set<TargetId>>(new Set());
  const installed = isStandalone();

  // Release all the thumbnail object URLs when the screen closes.
  useEffect(() => {
    return () => {
      shots.forEach((shot) => URL.revokeObjectURL(shot.url));
    };
    // We intentionally clean up only on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When orientation is first enabled, treat the current heading as "Front".
  useEffect(() => {
    if (oriStatus === 'granted' && frontOffset === null) {
      setFrontOffset(ori.heading);
    }
  }, [oriStatus, frontOffset, ori.heading]);

  // Heading relative to the calibrated front, and the target we're aimed at.
  const headingRel =
    frontOffset == null
      ? ori.heading
      : ((ori.heading - frontOffset) % 360 + 360) % 360;
  const active =
    oriStatus === 'granted' ? activeTarget(headingRel, ori.pitch) : null;

  const capture = async () => {
    const video = videoRef.current;
    if (!video) return;
    // Quick white flash for tactile "shutter" feedback.
    setFlash(true);
    window.setTimeout(() => setFlash(false), 180);

    const blob = await captureFrameToBlob(video);
    if (!blob) return;

    const target = active;
    const shot: Shot = {
      id: crypto.randomUUID(),
      blob,
      url: URL.createObjectURL(blob),
      target,
      orientation:
        oriStatus === 'granted'
          ? { yaw: ori.yaw, pitch: ori.pitch, roll: ori.roll }
          : null,
    };
    setShots((prev) => [shot, ...prev]);
    if (target) {
      setDone((prev) => new Set(prev).add(target));
    }
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

      {/* Orientation guidance (Milestone 3) */}
      {isReady &&
        (oriStatus === 'granted' ? (
          <CoverageGuide
            data={ori}
            frontOffset={frontOffset}
            active={active}
            done={done}
            onSetFront={() => setFrontOffset(ori.heading)}
          />
        ) : (
          <section className="card">
            <h2>
              🧭 <ProximityText>Orientation guidance</ProximityText>
            </h2>
            {oriStatus === 'unsupported' ? (
              <p>
                This device doesn’t report orientation, so direction guidance
                isn’t available. You can still capture photos freely.
              </p>
            ) : oriStatus === 'denied' ? (
              <>
                <p className="camera-error">
                  Motion access was blocked. Enable it in Safari settings, then
                  try again.
                </p>
                <button className="btn btn-ghost" onClick={enableOri}>
                  Try Again
                </button>
              </>
            ) : (
              <>
                <p>
                  Turn on motion sensors for a live compass that tracks all six
                  directions as you capture them.
                </p>
                <button className="btn btn-ghost" onClick={enableOri}>
                  Enable orientation
                </button>
              </>
            )}
          </section>
        ))}

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
                {shot.target && (
                  <span className="shot__tag">{targetLabel(shot.target)}</span>
                )}
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
