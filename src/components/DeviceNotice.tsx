// Shown on a computer: SimplyHDRI needs a phone's rear camera and motion
// sensors, so we point desktop visitors to open the same address on their
// iPhone and add it to the Home Screen.
import { ProximityText } from './ProximityText';

export function DeviceNotice() {
  // The address the user should open on their phone (host + path, no protocol).
  const address = `${window.location.host}${window.location.pathname}`.replace(
    /\/$/,
    '',
  );

  return (
    <section className="card device-notice">
      <h2>
        📱 <ProximityText>Open this on your iPhone</ProximityText>
      </h2>
      <p>
        SimplyHDRI uses your phone's <strong>rear camera</strong> and{' '}
        <strong>motion sensors</strong>, so it runs on an iPhone — not a
        computer. On your phone, open <strong>Safari</strong> and go to:
      </p>
      <div className="device-notice__url">{address}</div>
      <p className="note">
        Then tap <strong>Share</strong> → <strong>Add to Home Screen</strong> to
        install it like an app.
      </p>
    </section>
  );
}
