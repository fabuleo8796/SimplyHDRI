// Guided capture + environment-map build (Milestones 2, 3, 5).
// The orientation-driven parts run inside CaptureOverlay's own loop, so this
// screen only re-renders when photos/coverage actually change — keeping the
// live scan smooth.
import { useEffect, useRef, useState } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useOrientation } from '../hooks/useOrientation';
import { captureFrameToBlob, reencode, downloadBlob } from '../utils/image';
import { buildEquirect } from '../utils/stitch';
import { isStandalone } from '../utils/platform';
import { projectTargets, TARGET_POINTS } from '../utils/targets';
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
  target: string | null;
  orientation: { yaw: number; pitch: number; roll: number; az: number; el: number } | null;
};

const TOTAL = TARGET_POINTS.length;

export function CaptureScreen({ onBack }: CaptureScreenProps) {
  const { videoRef, status, errorMsg, start, stop } = useCamera();
  const { status: oriStatus, dataRef, enable: enableOri } = useOrientation();

  const [shots, setShots] = useState<Shot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [frontOffset, setFrontOffset] = useState<number | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [building, setBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);
  const [panoUrl, setPanoUrl] = useState<string | null>(null);
  const [panoBlob, setPanoBlob] = useState<Blob | null>(null);
  const [buildError, setBuildError] = useState('');
  const installed = isStandalone();
  const isReady = status === 'ready';
  const guiding = isReady && oriStatus === 'granted';

  // Live refs the overlay's loop reads (no re-render on sensor ticks).
  const frontOffsetRef = useRef<number | null>(null);
  const doneRef = useRef<Set<string>>(done);
  frontOffsetRef.current = frontOffset;
  doneRef.current = done;

  // Clean up thumbnail URLs on unmount.
  useEffect(() => {
    return () => {
      shots.forEach((shot) => URL.revokeObjectURL(shot.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Release the panorama object URL when replaced / on unmount.
  useEffect(() => {
    return () => {
      if (panoUrl) URL.revokeObjectURL(panoUrl);
    };
  }, [panoUrl]);

  const startScan = () => {
    start();
    if (oriStatus !== 'granted') enableOri();
  };

  const capture = (target: string | null) => {
    const video = videoRef.current;
    if (!video) return;
    setFlash(true);
    window.setTimeout(() => setFlash(false), 180);

    const d = dataRef.current;
    const front = frontOffset ?? d.heading;
    const az = (((d.heading - front) % 360) + 360) % 360;

    captureFrameToBlob(video).then((blob) => {
      if (!blob) return;
      const shot: Shot = {
        id: crypto.randomUUID(),
        blob,
        url: URL.createObjectURL(blob),
        target,
        orientation:
          oriStatus === 'granted'
            ? { yaw: d.yaw, pitch: d.pitch, roll: d.roll, az, el: d.elevation }
            : null,
      };
      setShots((prev) => [shot, ...prev]);
      if (target) {
        setDone((prev) => new Set(prev).add(target));
        navigator.vibrate?.(30);
      }
    });
  };

  // Manual shutter: capture whatever dot we're nearest to (if guiding).
  const handleShutter = () => {
    if (!guiding) {
      capture(null);
      return;
    }
    const d = dataRef.current;
    const front = frontOffset ?? d.heading;
    const az = (((d.heading - front) % 360) + 360) % 360;
    const { aligned } = projectTargets(az, d.elevation, done);
    capture(aligned);
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

  const orientedShots = shots.filter((s) => s.orientation);

  const buildPano = async () => {
    setBuilding(true);
    setBuildProgress(0);
    setBuildError('');
    try {
      const blob = await buildEquirect(
        orientedShots.map((s) => ({
          blob: s.blob,
          az: s.orientation!.az,
          el: s.orientation!.el,
        })),
        { width: 2048, height: 1024, hfovDeg: 70, onProgress: setBuildProgress },
      );
      setPanoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      setPanoBlob(blob);
    } catch (err) {
      setBuildError((err as Error)?.message || 'Could not build the map.');
    } finally {
      setBuilding(false);
    }
  };

  const downloadPano = async (format: 'jpg' | 'png') => {
    if (!panoBlob) return;
    const stamp = Date.now();
    if (format === 'png') {
      const png = await reencode(panoBlob, 'image/png');
      downloadBlob(png, `simplyhdri-pano-${stamp}.png`);
    } else {
      downloadBlob(panoBlob, `simplyhdri-pano-${stamp}.jpg`);
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
            {status === 'idle' && 'Tap “Start Scan” to begin.'}
            {(status === 'denied' || status === 'error') && '📷'}
          </div>
        )}
        {guiding && (
          <CaptureOverlay
            dataRef={dataRef}
            frontOffsetRef={frontOffsetRef}
            doneRef={doneRef}
            total={TOTAL}
            onCapture={capture}
            onSetFront={(h) => setFrontOffset(h)}
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
          <button className="shutter" onClick={handleShutter} aria-label="Capture photo">
            <span />
          </button>
          <div className="cam-side right">
            {oriStatus === 'granted' && (
              <button
                className="cam-stop"
                onClick={() => setFrontOffset(dataRef.current.heading)}
              >
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
      {guiding && (
        <p className="note scan-tip">
          Sweep around and park the ring on every dot — the more you fill, the
          less black in your map.
        </p>
      )}

      {/* Live environment preview that fills in as you capture. */}
      {guiding && shots.some((s) => s.orientation) && (
        <section className="card">
          <h2>
            <ProximityText>Live preview</ProximityText>
          </h2>
          <PreviewMap shots={shots} />
        </section>
      )}

      {/* Build the 360° environment map from the captured directions. */}
      {orientedShots.length >= 2 && (
        <section className="card">
          <h2>
            🌍 <ProximityText>Environment map</ProximityText>
          </h2>
          <p>
            Stitch your {orientedShots.length} directional photos into a 360°
            equirectangular map you can load into Blender.
          </p>

          {building ? (
            <div className="build-progress">
              <div className="build-bar">
                <div
                  className="build-bar__fill"
                  style={{ width: `${Math.round(buildProgress * 100)}%` }}
                />
              </div>
              <span className="note">Building… {Math.round(buildProgress * 100)}%</span>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={buildPano}>
              🧩 Build Environment Map
            </button>
          )}

          {buildError && <p className="camera-error">{buildError}</p>}

          {panoUrl && !building && (
            <div className="pano-result">
              <img className="pano" src={panoUrl} alt="360° environment map" />
              <div className="btn-row">
                <button className="btn btn-ghost" onClick={() => downloadPano('jpg')}>
                  ⬇️ JPG
                </button>
                <button className="btn btn-ghost" onClick={() => downloadPano('png')}>
                  ⬇️ PNG
                </button>
              </div>
              <p className="note">
                In Blender: World Properties → Color → Environment Texture → open
                this file (already equirectangular). Black areas = directions you
                haven’t captured yet.
              </p>
            </div>
          )}
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
