import { useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { CaptureScreen } from './components/CaptureScreen';
import DotGrid from './components/DotGrid';
import ClickSpark from './components/ClickSpark';

// We only have two screens so far, so a simple string is enough to track
// which one is showing. (We'll switch to a proper router only if we ever
// truly need one.)
type Screen = 'home' | 'capture';

function App() {
  const [screen, setScreen] = useState<Screen>('home');

  return (
    <ClickSpark
      sparkColor="#ffffff"
      sparkSize={10}
      sparkRadius={15}
      sparkCount={8}
      duration={400}
    >
      {/* Animated background sits behind everything (see global.css). */}
      <DotGrid
        dotSize={5}
        gap={15}
        baseColor="#2F293A"
        activeColor="#5227FF"
        proximity={120}
        shockRadius={250}
        shockStrength={5}
        resistance={750}
        returnDuration={1.5}
      />

      {screen === 'capture' ? (
        <CaptureScreen onBack={() => setScreen('home')} />
      ) : (
        <LandingPage onStartCapture={() => setScreen('capture')} />
      )}
    </ClickSpark>
  );
}

export default App;
