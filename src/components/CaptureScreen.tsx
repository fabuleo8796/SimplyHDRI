// Guided capture + environment-map build (Milestones 2, 3, 5).
// The orientation-driven parts run inside CaptureOverlay's own loop, so this
// screen only re-renders when photos/coverage actually change — keeping the
// live scan smooth.
import { useEffect, useRef, useState } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useOrientation } from '../hooks/useOrientation';
import { captureFrameToBlob, reencode, saveImage } from '../utils/image';
import { buildEquirect } from '../utils/stitch';
import { isStandalone, isMobile } from '../utils/platform';
import { projectTargets, TARGET_POINTS } from '../utils/targets';
import { applyAz, applyEl } from '../utils/calibration';
import type { Calibration } from '../utils/calibration';
import { InstallSteps } from './InstallSteps';
import { ProximityText } from './ProximityText';
import { CaptureOverlay } from './CaptureOverlay';
import { CalibrationStep } from './CalibrationStep';
import { PreviewMap } from './PreviewMap';
import { DeviceNotice } from './DeviceNotice';

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
// In guided mode, require a reasonably complete sweep before building — a
// sparse scan makes a mostly-black map, and black = no light in Blender.
// (Tune this single number to make the requirement looser or stricter.)
const MIN_COVERAGE = 0.6;

export function CaptureScreen({ onBack }: CaptureScreenProps) {
  const { videoRef, status, errorMsg, start, stop } = useCamera();
  const { status: oriStatus, dataRef, enable: enableOri } = useOrientation();

  const [shots, setShots] = useState<Shot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [building, setBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);
  const [panoUrl, setPanoUrl] = useState<string | null>(null);
  const [panoBlob, setPanoBlob] = useState<Blob | null>(null);
  const [buildError, setBuildError] = useState('');
  const installed = isStandalone();
  const onPhone = isMobile();
  const isReady = status === 'ready';
  const guiding = isReady && oriStatus === 'granted';
  // Guided scanning only begins once the six anchors are calibrated.
  const calibrated = calibration != null;
  const calibrating = guiding && !calibrated;
  const scanning = guiding && calibrated;

  // Coverage = how many distinct target dots have been captured. We gate the
  // build button on this when guided aiming is available.
  const guidedMode = oriStatus === 'granted';
  const coverage = done.size;
  const coverageRatio = TOTAL ? coverage / TOTAL : 0;
  const coveragePct = Math.round(coverageRatio * 100);
  const enoughCoverage = !guidedMode || coverageRatio >= MIN_COVERAGE;

  // Live refs the overlay's loop reads (no re-render on sensor ticks).
  const calibrationRef = useRef<Calibration | null>(null);
  const doneRef = useRef<Set<string>>(done);
  calibrationRef.current = calibration;
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

  // On a computer there's no rear camera or motion sensors, so capturing can't
  // work here. Instead of a dead camera box, point the user to their phone.
  if (!onPhone) {
    return (
      <div className="app-shell">
        <header className="brand">
          <img src="/pwa-192x192.png" alt="SimplyHDRI icon" />
          <div>
            <h1>
              <ProximityText>Capture</ProximityText>
            </h1>
            <div className="tagline">Use your iPhone for this</div>
          </div>
        </header>
        <DeviceNotice />
        <button className="btn btn-ghost" onClick={onBack}>
          ← Back
        </button>
      </div>
    );
  }

  // The scan needs the rear camera + motion sensors, which are only reliable
  // (and fully permitted) when the app runs from the Home Screen. In a plain
  // Safari tab we block scanning and show how to install. (Skipped during local
  // `npm run dev` so LAN testing in Safari still works — enforced in the build.)
  if (!installed && !import.meta.env.DEV) {
    return (
      <div className="app-shell">
        <header className="brand">
          <img src="/pwa-192x192.png" alt="SimplyVoxel icon" />
          <div>
            <h1>
              <ProximityText>Add to Home Screen</ProximityText>
            </h1>
            <div className="tagline">Scanning runs from the installed app</div>
          </div>
        </header>

        <section className="card">
          <h2>
            📲 <ProximityText>Install to scan</ProximityText>
          </h2>
          <p>
            The scanner uses your camera and motion sensors, which only work
            reliably when SimplyVoxel is added to your Home Screen. It takes a
            few seconds — then open it like a normal app and scan away. 🧊
          </p>
          <InstallSteps />
        </section>

        <button className="btn btn-ghost" onClick={onBack}>
          ← Back
        </button>
      </div>
    );
  }

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
    const cal = calibration;
    const az = cal ? applyAz(cal, d.heading) : (((d.heading % 360) + 360) % 360);
    const el = cal ? applyEl(cal, d.elevation) : d.elevation;

    captureFrameToBlob(video).then((blob) => {
      if (!blob) return;
      const shot: Shot = {
        id: crypto.randomUUID(),
        blob,
        url: URL.createObjectURL(blob),
        target,
        orientation:
          oriStatus === 'granted'
            ? { yaw: d.yaw, pitch: d.pitch, roll: d.roll, az, el }
            : null,
      };
      setShots((prev) => [shot, ...prev]);
      if (target) {
        setDone((prev) => new Set(prev).add(target));
        navigator.vibrate?.(30);
      }
    });
  };

  // Manual shutter: capture whatever dot we're nearest to (if scanning).
  const handleShutter = () => {
    if (!scanning || !calibration) {
      capture(null);
      return;
    }
    const d = dataRef.current;
    const az = applyAz(calibration, d.heading);
    const el = applyEl(calibration, d.elevation);
    const { aligned } = projectTargets(az, el, done);
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
      await saveImage(png, `simplyhdri-${stamp}.png`);
    } else {
      await saveImage(shot.blob, `simplyhdri-${stamp}.jpg`);
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
      await saveImage(png, `simplyhdri-pano-${stamp}.png`);
    } else {
      await saveImage(panoBlob, `simplyhdri-pano-${stamp}.jpg`);
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
        {scanning && (
          <CaptureOverlay
            dataRef={dataRef}
            calibrationRef={calibrationRef}
            doneRef={doneRef}
            total={TOTAL}
            onCapture={capture}
          />
        )}
        {flash && <div className="cam-flash" />}
      </div>

      {errorMsg && <p className="camera-error">{errorMsg}</p>}

      {/* Required calibration before any scanning starts. */}
      {calibrating && (
        <CalibrationStep dataRef={dataRef} onComplete={setCalibration} />
      )}

      {/* Controls */}
      {isReady ? (
        calibrating ? (
          <div className="cam-controls">
            <button className="cam-stop" onClick={stop}>
              Stop
            </button>
          </div>
        ) : (
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
              {scanning && (
                <button className="cam-stop" onClick={() => setCalibration(null)}>
                  Recalibrate
                </button>
              )}
            </div>
          </div>
        )
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
      {scanning && (
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
            <>
              {guidedMode && (
                <div className="build-progress">
                  <div className="build-bar">
                    <div
                      className="build-bar__fill"
                      style={{ width: `${coveragePct}%` }}
                    />
                  </div>
                  <span className="note">
                    Coverage: {coverage} / {TOTAL} dots ({coveragePct}%)
                  </span>
                </div>
              )}
              <button
                className="btn btn-primary"
                onClick={buildPano}
                disabled={!enoughCoverage}
              >
                {enoughCoverage
                  ? '🧩 Build Environment Map'
                  : `🔒 Complete the scan to build (${coveragePct}%)`}
              </button>
              {!enoughCoverage && (
                <p className="note">
                  Park the ring on more dots first — aim for about{' '}
                  {Math.round(MIN_COVERAGE * 100)}% so your map isn’t full of
                  black gaps (black = no light in Blender).
                </p>
              )}
            </>
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

      <button className="btn btn-ghost" onClick={onBack}>
        ← Back
      </button>
    </div>
  );
}
