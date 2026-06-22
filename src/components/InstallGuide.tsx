// Shows iPhone users how to add the app to their Home Screen.
// We only show this when the app is NOT already installed.
import { ProximityText } from './ProximityText';

export function InstallGuide() {
  return (
    <section className="card">
      <h2>
        📲 <ProximityText>Install on your iPhone</ProximityText>
      </h2>
      <p>For the best experience, add SimplyHDRI to your Home Screen:</p>
      <ol className="steps">
        <li>
          Open this page in{' '}
          <strong>
            <ProximityText>Safari</ProximityText>
          </strong>{' '}
          (not inside another app).
        </li>
        <li>
          Tap the{' '}
          <strong>
            <ProximityText>Share</ProximityText>
          </strong>{' '}
          button (the square with an up arrow).
        </li>
        <li>
          Scroll down and tap{' '}
          <strong>
            <ProximityText>Add to Home Screen</ProximityText>
          </strong>
          .
        </li>
        <li>
          Tap{' '}
          <strong>
            <ProximityText>Add</ProximityText>
          </strong>
          , then open SimplyHDRI from your Home Screen.
        </li>
      </ol>
    </section>
  );
}
