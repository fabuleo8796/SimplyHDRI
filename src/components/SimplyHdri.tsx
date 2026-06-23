import BorderGlow from './BorderGlow';
import { ProximityText } from './ProximityText';

type SimplyHdriProps = {
  onEnvMap: () => void;
  onBack: () => void;
};

export function SimplyHdri({ onEnvMap, onBack }: SimplyHdriProps) {
  return (
    <div className="app-shell">
      <section className="hero hero--sub">
        <h1 className="hero__title">
          <ProximityText>SimplyHDRI</ProximityText>
        </h1>
        <p className="hero__tag">
          Capture a 360° environment map of your surroundings — for reflections,
          backgrounds &amp; lighting in Blender.
        </p>
      </section>

      <div className="choice-grid">
        <BorderGlow
          animated
          borderRadius={22}
          glowRadius={36}
          glowIntensity={1}
          backgroundColor="#120F17"
          colors={['#38bdf8', '#22d3ee', '#818cf8']}
        >
          <button className="choice-card" onClick={onEnvMap}>
            <span className="choice-card__emoji">🌍</span>
            <span className="choice-card__name">
              <ProximityText>Create Environment Map</ProximityText>
            </span>
            <span className="choice-card__desc">
              Point your phone around the room and capture every direction.
              Exports as JPG or PNG — load it straight into Blender.
            </span>
            <span className="choice-card__badge choice-card__badge--ready">
              Ready
            </span>
          </button>
        </BorderGlow>
      </div>

      <button className="btn btn-ghost" onClick={onBack}>
        ← Back to SimplyVoxel
      </button>
    </div>
  );
}
