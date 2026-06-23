// Visual "Add to Home Screen" steps with icons.
// Used on the capture screen when the app is opened in a browser
// (rather than already installed to the Home Screen).
import type { ReactNode } from 'react';
import { ProximityText } from './ProximityText';

// --- Simple line icons (inherit color via currentColor) ----------------------
function SafariIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <polygon points="16,8 11,11 8,16 13,13" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15V4" />
      <path d="M8 7l4-4 4 4" />
      <path d="M6 12v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6" />
    </svg>
  );
}

function AddBoxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11l8-7 8 7" />
      <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
      <rect x="10" y="14" width="4" height="6" />
    </svg>
  );
}

type Step = { icon: ReactNode; title: string; text: string };

const steps: Step[] = [
  {
    icon: <SafariIcon />,
    title: 'Open in Safari',
    text: 'Make sure you are in Safari — not inside another app.',
  },
  {
    icon: <ShareIcon />,
    title: 'Tap the Share button',
    text: 'The square with an arrow pointing up.',
  },
  {
    icon: <AddBoxIcon />,
    title: 'Add to Home Screen',
    text: 'Scroll down the share menu and tap it, then tap Add.',
  },
  {
    icon: <HomeIcon />,
    title: 'Open SimplyVoxel',
    text: 'Launch it from your Home Screen like a real app.',
  },
];

export function InstallSteps() {
  return (
    <ol className="install-steps">
      {steps.map((step, i) => (
        <li className="install-step" key={i}>
          <span className="install-step__icon">{step.icon}</span>
          <span className="install-step__body">
            <span className="install-step__title">
              {i + 1}. <ProximityText>{step.title}</ProximityText>
            </span>
            <span className="install-step__text">{step.text}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
