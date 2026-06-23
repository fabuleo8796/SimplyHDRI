// SimplyVoxel company hub: a hero + a grid of tools. SimplyHDRI is live; the
// rest are placeholders for what's coming (auto-rigger, etc.).
import BorderGlow from './BorderGlow';
import { ProximityText } from './ProximityText';

type HomeProps = {
  onOpenSimplyHdri: () => void;
};

type Tool = {
  emoji: string;
  name: string;
  desc: string;
  ready: boolean;
};

const TOOLS: Tool[] = [
  {
    emoji: '🌍',
    name: 'SimplyHDRI',
    desc: 'Capture 360° environment maps on your phone.',
    ready: true,
  },
  {
    emoji: '🦴',
    name: 'SimplyRig',
    desc: 'Auto-rig characters in a few taps.',
    ready: false,
  },
  {
    emoji: '✨',
    name: 'More coming',
    desc: 'New free tools for 3D & VFX artists.',
    ready: false,
  },
];

export function Home({ onOpenSimplyHdri }: HomeProps) {
  return (
    <div className="app-shell">
      <section className="hero">
        <h1 className="hero__title">
          <ProximityText>SimplyVoxel</ProximityText>
        </h1>
        <p className="hero__tag">
          Pro tools for 3D &amp; VFX artists — <strong>made simple</strong>. Free,
          on your phone, nothing leaves your device.
        </p>
      </section>

      <div className="tool-grid">
        {TOOLS.map((tool) => (
          <BorderGlow
            key={tool.name}
            animated
            borderRadius={22}
            glowRadius={34}
            glowIntensity={tool.ready ? 1 : 0.4}
            backgroundColor="#120F17"
            colors={
              tool.ready
                ? ['#c084fc', '#f472b6', '#38bdf8']
                : ['#3a3550', '#2a2740', '#3a3550']
            }
          >
            <button
              className={`tool-card ${tool.ready ? '' : 'is-soon'}`}
              onClick={tool.ready ? onOpenSimplyHdri : undefined}
              disabled={!tool.ready}
            >
              <span className="tool-card__emoji">{tool.emoji}</span>
              <span className="tool-card__name">
                <ProximityText>{tool.name}</ProximityText>
              </span>
              <span className="tool-card__desc">{tool.desc}</span>
              <span className="tool-card__cta">
                {tool.ready ? 'Open →' : 'Coming soon'}
              </span>
            </button>
          </BorderGlow>
        ))}
      </div>

      <footer className="footer">
        Free · Works offline · Your captures never leave your device
      </footer>
    </div>
  );
}
