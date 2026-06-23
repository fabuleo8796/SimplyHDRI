// About Me — Fabuleo's story behind SimplyVoxel, with a little Rubik's cube
// easter-egg game at the bottom.
import { ProximityText } from './ProximityText';
import { RubiksCube } from './RubiksCube';

type AboutProps = {
  onBack: () => void;
};

export function About({ onBack }: AboutProps) {
  return (
    <div className="app-shell">
      <section className="hero hero--sub">
        <h1 className="hero__title">
          <ProximityText>About Me</ProximityText>
        </h1>
        <p className="hero__tag">The story behind SimplyVoxel.</p>
      </section>

      <section className="card about__card">
        <p>Hello, I'm Fabuleo. I really enjoy animation, modeling, and doing VFX shots.</p>
        <p>
          But something that bothers me is that I don't have all the equipment,
          so lots of things like HDRI, Digi-doubles and more are limited to me!
          I'm not the only one who feels like this, and people have invented
          solutions you can find in the App Store! But unfortunately, they cost
          20$ a month!
        </p>
        <p>
          So I decided to create something for <strong>FREE</strong> so everyone
          can use it. I know it's not the best, but it works. Hope you enjoy our
          tools!
        </p>
      </section>

      <section className="card about__game">
        <h2>
          🎮 <ProximityText>Enjoy a game!</ProximityText>
        </h2>
        <p className="note">Take a break and mess with the cube. 🧊</p>
        <RubiksCube />
      </section>

      <button className="btn btn-ghost" onClick={onBack}>
        ← Back to SimplyVoxel
      </button>
    </div>
  );
}
