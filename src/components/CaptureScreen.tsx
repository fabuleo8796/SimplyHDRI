// Placeholder capture screen for Milestone 1.
// The real camera will be built in Milestone 2 — we are being honest
// here rather than faking a feature that doesn't exist yet.
//
// When opened in a browser (not installed), we show the user how to add
// SimplyHDRI to their Home Screen, since the camera works best as an
// installed app. When already installed, we show the "coming soon" note.
import { isStandalone } from '../utils/platform';
import { InstallSteps } from './InstallSteps';

type CaptureScreenProps = {
  onBack: () => void;
};

export function CaptureScreen({ onBack }: CaptureScreenProps) {
  const installed = isStandalone();

  return (
    <div className="app-shell">
      <header className="brand">
        <img src="/pwa-192x192.png" alt="SimplyHDRI icon" />
        <div>
          <h1>Capture</h1>
          <div className="tagline">Environment map capture</div>
        </div>
      </header>

      {installed ? (
        <section className="card placeholder">
          <span className="badge">Coming in the next step</span>
          <h2>Camera capture is on the way</h2>
          <p>
            In the next milestone this screen will open your rear camera and
            guide you to photograph all around you. For now, this confirms
            navigation works.
          </p>
        </section>
      ) : (
        <section className="card">
          <h2>📲 Add SimplyHDRI to your Home Screen</h2>
          <p>
            The camera works best when SimplyHDRI is installed as an app. Add it
            to your Home Screen in four quick steps:
          </p>
          <InstallSteps />
        </section>
      )}

      <button className="btn btn-ghost" onClick={onBack}>
        ← Back
      </button>
    </div>
  );
}
