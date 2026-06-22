import { InstallGuide } from './InstallGuide';
import { isStandalone } from '../utils/platform';

// The home screen of the app. It receives a function to call when the
// user wants to start capturing.
type LandingPageProps = {
  onStartCapture: () => void;
};

export function LandingPage({ onStartCapture }: LandingPageProps) {
  // If the app is already installed, there's no need to show the install guide.
  const installed = isStandalone();

  return (
    <div className="app-shell">
      <header className="brand">
        <img src="/pwa-192x192.png" alt="SimplyHDRI icon" />
        <div>
          <h1>SimplyHDRI</h1>
          <div className="tagline">Capture a 360° environment map</div>
        </div>
      </header>

      <section className="card">
        <h2>What this does</h2>
        <p>
          SimplyHDRI helps you photograph your surroundings and turn them into a
          360° <strong>environment map</strong> you can use in 3D tools like
          Blender. Everything stays on your iPhone — no account, no upload.
        </p>
      </section>

      <button className="btn btn-primary" onClick={onStartCapture}>
        Create Environment Map
      </button>

      {!installed && <InstallGuide />}

      <footer className="footer">
        Free · Works offline · Your photos never leave your device
      </footer>
    </div>
  );
}
