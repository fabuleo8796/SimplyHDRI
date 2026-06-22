// Placeholder capture screen for Milestone 1.
// The real camera will be built in Milestone 2 — we are being honest
// here rather than faking a feature that doesn't exist yet.

type CaptureScreenProps = {
  onBack: () => void;
};

export function CaptureScreen({ onBack }: CaptureScreenProps) {
  return (
    <div className="app-shell">
      <header className="brand">
        <img src="/pwa-192x192.png" alt="SimplyHDRI icon" />
        <div>
          <h1>Capture</h1>
          <div className="tagline">Environment map capture</div>
        </div>
      </header>

      <section className="card placeholder">
        <span className="badge">Coming in the next step</span>
        <h2>Camera capture is on the way</h2>
        <p>
          In the next milestone this screen will open your rear camera and guide
          you to photograph all around you. For now, this confirms navigation
          works.
        </p>
      </section>

      <button className="btn btn-ghost" onClick={onBack}>
        ← Back
      </button>
    </div>
  );
}
