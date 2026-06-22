// Camera capture with guided, aim-and-hold direction targeting (Milestones 2+3).
// - Live rear-camera preview with floating direction dots
// - Aim the reticle at a dot and hold steady → auto-capture
// - A live environment preview fills in as you go
// - Gallery with delete + JPG/PNG download
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useOrientation } from '../hooks/useOrientation';
import { captureFrameToBlob, reencode, downloadBlob } from '../utils/image';
import { isStandalone } from '../utils/platform';
import { projectTargets, TARGETS } from '../utils/targets';
import type { TargetId } from '../utils/targets';
import { InstallSteps } from './InstallSteps';
import { ProximityText } from './ProximityText';
import { CaptureOverlay } from './CaptureOverlay';
import { PreviewMap } from './PreviewMap';

type CaptureScreenProps = {
  onBack: () => void;
};

type Shot = {
  id: string;
  blob: Blob;
  url: string;
  target: TargetId | null;
  orientation: { yaw: number; pitch: number; roll: number; az: number; el: number } | null;
};

const DWELL_MS = 900; // how long to hold steady on a target before auto-capture
const targetLabel = (id: TargetId) =>
  TARGETS.find((t) => t.id === id)?.label ?? id;

export function CaptureScreen({ onBack }: CaptureScreenProps) {
  const { videoRef, status, errorMsg, start, stop } = useCamera();
  const { status: oriStatus, data: ori, enable: enableOri } = useOrientation();

  const [shots, setShots] = useState<Shot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [frontOffset, setFrontOffset] = useState<number | null>(null);
  const [done, setDone] = useState<Set<TargetId>>(new Set());
  const [dwell, setDwell] = useState(0);
  const installed = isStandalone();
  const isReady = status === 'ready';

  // Keep the latest capture function reachable from timers without stale state.
  const captureRef = useRef<(t: TargetId | null) => void>(() => {});

  // Clean up thumbnail URLs on unmount.
  useEffect(() => {
    return () => {
      shots.forEach((shot) => URL.revokeObjectURL(shot.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // First time orientation is granted, treat the current heading as "Front".
  useEffect(() => {
    if (oriStatus === 'granted' && frontOffset === null) {
      setFrontOffset(ori.heading);
    }
  }, [oriStatus, frontOffset, ori.heading]);

  // Camera direction relative to the calibrated front.
  const headingRel =
    frontOffset == null ? ori.heading : ((ori.heading - frontOffset) % 360 + 360) % 360;
  const elevation = ori.elevation;

  // One tap starts everything: rear camera + motion sensors together.
  const startScan = () => {
    start();
    if (oriStatus !== 'granted') enableOri();
  };

  // Where every dot is and which one we're locked onto.
  const guiding = isReady && oriStatus === 'granted' && frontOffset !== null;
  const { views, aligned } = useMemo(() => {
    if (!guiding) return { views: [], aligned: null };
    return projectTargets(headingRel, elevation, done);
  }, [guiding, headingRel, elevation, done]);

  const capture = (target: TargetId | null) => {
    const video = videoRef.current;
    if (!video) return;
    setFlash(true);
    window.setTimeout(() => setFlash(false), 180);

    captureFrameToBlob(video).then((blob) => {
      if (!blob) return;
      const shot: Shot = {
        id: crypto.randomUUID(),
        blob,
        url: URL.createObjectURL(blob),
        target,
        orientation:
          oriStatus === 'granted'
            ? { yaw: ori.yaw, pitch: ori.pitch, roll: ori.roll, az: headingRel, el: elevation }
            : null,
      };
      setShots((prev) => [shot, ...prev]);
      if (target) {
        setDone((prev) => new Set(prev).add(target));
        navigator.vibrate?.(30);
      }
    });
  };
  captureRef.current = capture;

  // Auto-capture: while locked on an undone target, fill the dwell ring; when
  // it completes, take the shot. Moving off the target resets it.
  useEffect(() => {
    if (!aligned) {
      setDwell(0);
      return;
    }
    let rafId = 0;
    const t0 = performance.now();
    const loop = () => {
      const p = Math.min(1, (performance.now() - t0) / DWELL_MS);
      setDwell(p);
      if (p >= 1) {
        captureRef.current(aligned);
      } else {
        rafId = requestAnimationFrame(loop);
      }
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [aligned]);

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

      {/* Live camera preview with the guided-capture overlay on top. */}
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
        {guiding && (
          <CaptureOverlay
            views={views}
            aligned={aligned}
            dwell={dwell}
            doneCount={done.size}
            total={TARGETS.length}
          />
        )}
        {flash && <div className="cam-flash" />}
      </div>

      {errorMsg && <p className="camera-error">{errorMsg}</p>}

      {/* Controls */}
      {isReady ? (
        <div className="cam-controls">
          <div className="cam-side">
            <button className="cam-stop" onClick={stop}>
              Stop
            </button>
          </div>
          <button className="shutter" onClick={() => capture(aligned)} aria-label="Capture photo">
            <span />
          </button>
          <div className="cam-side right">
            {oriStatus === 'granted' && (
              <button className="cam-stop" onClick={() => setFrontOffset(ori.heading)}>
                Set Front
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          className="btn btn-primary"
          onClick={startScan}
          disabled={status === 'requesting'}
        >
          {status === 'requesting'
            ? 'Starting…'
            : status === 'denied' || status === 'error'
              ? 'Try Again'
              : '▶ Start Scan'}
        </button>
      )}

      {/* Only shown if motion access is blocked or unavailable — the normal
          flow grants it during "Start Scan", so nothing pops in mid-scan. */}
      {isReady && oriStatus === 'denied' && (
        <section className="card">
          <h2>
            🧭 <ProximityText>Guided aiming is off</ProximityText>
          </h2>
          <p className="camera-error">
            Motion access was blocked. Enable it in Safari (aA menu → Website
            Settings → Motion &amp; Orientation), then tap below.
          </p>
          <button className="btn btn-ghost" onClick={enableOri}>
            Enable guided aiming
          </button>
        </section>
      )}
      {isReady && oriStatus === 'unsupported' && (
        <p className="note">
          This device doesn’t report orientation — capture manually with the
          shutter button.
        </p>
      )}

      {/* Live environment preview that fills in as you capture. */}
      {guiding && shots.some((s) => s.orientation) && (
        <section className="card">
          <h2>
            <ProximityText>Live preview</ProximityText>
          </h2>
          <PreviewMap shots={shots} />
          <div className="targets">
            {TARGETS.map((t) => {
              const isDone = done.has(t.id);
              const isActive = aligned === t.id;
              return (
                <div
                  key={t.id}
                  className={`target ${isDone ? 'is-done' : ''} ${isActive ? 'is-active' : ''}`}
                >
                  <span className="target__icon">{isDone ? '✅' : t.icon}</span>
                  <span className="target__label">{t.label}</span>
                </div>
              );
            })}
          </div>
        </section>
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
                <button className="btn btn-ghost" onClick={() => download(selected, 'jpg')}>
                  ⬇️ JPG
                </button>
                <button className="btn btn-ghost" onClick={() => download(selected, 'png')}>
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
