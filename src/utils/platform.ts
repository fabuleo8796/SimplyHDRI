// Small helpers to understand where the app is running.
// These only READ the environment; they never change anything.

/** True when the app was opened from the iPhone Home Screen (installed PWA). */
export function isStandalone(): boolean {
  // iOS Safari exposes a non-standard navigator.standalone boolean.
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  // Other browsers report it through a media query.
  const displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;
  return iosStandalone || displayModeStandalone;
}

/** True on iPhone / iPad / iPod. */
export function isIOS(): boolean {
  const ua = window.navigator.userAgent;
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
  // Modern iPads report as "Macintosh" but have a touch screen.
  const isIPadOS = ua.includes('Macintosh') && 'ontouchend' in document;
  return isAppleMobile || isIPadOS;
}

/** True on a phone or tablet (touch device), false on a desktop/laptop. */
export function isMobile(): boolean {
  if (isIOS()) return true;
  const ua = window.navigator.userAgent;
  if (/Android|webOS|BlackBerry|Windows Phone|Mobile/i.test(ua)) return true;
  // Fallback: a coarse pointer with no hover is almost always a touch device.
  return (
    window.matchMedia('(pointer: coarse)').matches &&
    window.matchMedia('(hover: none)').matches
  );
}

/** True on a computer (the inverse of isMobile). */
export function isDesktop(): boolean {
  return !isMobile();
}
