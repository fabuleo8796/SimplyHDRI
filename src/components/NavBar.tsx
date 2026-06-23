// Slim top bar: the SimplyTools wordmark plus a hamburger that opens the side
// menu. Stays at the top of every screen.
import { ProximityText } from './ProximityText';

type NavBarProps = {
  onMenu: () => void;
  onHome: () => void;
};

export function NavBar({ onMenu, onHome }: NavBarProps) {
  return (
    <header className="navbar">
      <button className="navbar__brand" onClick={onHome} aria-label="SimplyTools home">
        <img src="/pwa-192x192.png" alt="" />
        <span className="navbar__name">
          <ProximityText>SimplyTools</ProximityText>
        </span>
      </button>

      <button className="navbar__menu" onClick={onMenu} aria-label="Open menu">
        <span />
        <span />
        <span />
      </button>
    </header>
  );
}
