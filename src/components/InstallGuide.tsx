// Shows iPhone users how to add the app to their Home Screen.
// We only show this when the app is NOT already installed.

export function InstallGuide() {
  return (
    <section className="card">
      <h2>📲 Install on your iPhone</h2>
      <p>For the best experience, add SimplyHDRI to your Home Screen:</p>
      <ol className="steps">
        <li>Open this page in <strong>Safari</strong> (not inside another app).</li>
        <li>Tap the <strong>Share</strong> button (the square with an up arrow).</li>
        <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
        <li>Tap <strong>Add</strong>, then open SimplyHDRI from your Home Screen.</li>
      </ol>
    </section>
  );
}
