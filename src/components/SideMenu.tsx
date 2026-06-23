// Animated slide-in navigation drawer. The backdrop fades and the panel slides
// in from the right; menu items stagger in. Everything is driven by a single
// `open` prop toggling CSS classes, so the animation is pure CSS.
import { ProximityText } from './ProximityText';

export type NavTarget = 'home' | 'simplyhdri';

type Item = {
  label: string;
  target?: NavTarget; // present = navigable
  hint?: string; // small grey subtitle
  disabled?: boolean;
};

const ITEMS: Item[] = [
  { label: 'Home', target: 'home' },
  { label: 'SimplyHDRI', target: 'simplyhdri', hint: '360° maps & HDRIs' },
  { label: 'About Us', hint: 'Coming soon', disabled: true },
  { label: 'More tools coming', hint: 'Auto-rigger & more', disabled: true },
];

type SideMenuProps = {
  open: boolean;
  onClose: () => void;
  onNavigate: (target: NavTarget) => void;
};

export function SideMenu({ open, onClose, onNavigate }: SideMenuProps) {
  return (
    <div className={`menu ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="menu__backdrop" onClick={onClose} />

      <nav className="menu__panel" aria-label="Main menu">
        <div className="menu__head">
          <span className="menu__title">
            <ProximityText>Menu</ProximityText>
          </span>
          <button className="menu__close" onClick={onClose} aria-label="Close menu">
            ×
          </button>
        </div>

        <ul className="menu__list">
          {ITEMS.map((item, i) => (
            <li
              key={item.label}
              className="menu__item-wrap"
              style={{ '--i': i } as React.CSSProperties}
            >
              <button
                className={`menu__item ${item.disabled ? 'is-disabled' : ''}`}
                disabled={item.disabled}
                onClick={() => {
                  if (item.target) {
                    onNavigate(item.target);
                    onClose();
                  }
                }}
              >
                <span className="menu__item-label">
                  <ProximityText>{item.label}</ProximityText>
                </span>
                {item.hint && <span className="menu__item-hint">{item.hint}</span>}
              </button>
            </li>
          ))}
        </ul>

        <div className="menu__foot">SimplyTools · Free · On-device</div>
      </nav>
    </div>
  );
}
