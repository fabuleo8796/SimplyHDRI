// Guided capture + environment-map build (Milestones 2, 3, 5).
// - Live rear-camera preview with many floating direction dots
// - Aim the reticle at a dot and hold steady → auto-capture
// - Live preview fills in; build a 360° equirectangular map; export JPG/PNG
import { useEffect, useMemo, useRef, useState } from 'react';
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

const DWELL_MS = 900; // how long to hold steady on a target before auto-capture
const TOTAL = TARGET_POINTS.length;

export function CaptureScreen({ onBack }: CaptureScreenProps) {
  const { videoRef, status, errorMsg, start, stop } = useCamera();
  const { status: oriStatus, data: ori, enable: enableOri } = useOrientation();

  const [shots, setShots] = useState<Shot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [frontOffset, setFrontOffset] = useState<number | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [dwell, setDwell] = useState(0);
  const [building, setBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);
  const [panoUrl, setPanoUrl] = useState<string | null>(null);
  const [panoBlob, setPanoBlob] = useState<Blob | null>(null);
  const [buildError, setBuildError] = useState('');
  const installed = isStandalone();
  const isReady = status === 'ready';

  const captureRef = useRef<(t: string | null) => void>(() => {});

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

  const headingRel =
    frontOffset == null ? ori.heading : ((ori.heading - frontOffset) % 360 + 360) % 360;
  const elevation = ori.elevation;

  const startScan = () => {
    start();
    if (oriStatus !== 'granted') enableOri();
  };

  const guiding = isReady && oriStatus === 'granted' && frontOffset !== null;
  const { views, aligned } = useMemo(() => {
    if (!guiding) return { views: [], aligned: null };
    return projectTargets(headingRel, elevation, done);
  }, [guiding, headingRel, elevation, done]);

  const capture = (target: string | null) => {
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

  // Auto-capture: hold steady on a dot to fill the ring, then snap it.
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

  // Release the panorama object URL when replaced / on unmount.
  useEffect(() => {
    return () => {
      if (panoUrl) URL.revokeObjectURL(panoUrl);
    };
  }, [panoUrl]);

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
            views={views}
            aligned={aligned}
            dwell={dwell}
            doneCount={done.size}
            total={TOTAL}
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
          Sweep around and aim the ring at every dot — the more you fill, the
          less black in your map. {done.size} / {TOTAL} angles captured.
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
