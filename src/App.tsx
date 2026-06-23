import { useState } from 'react';
import { Home } from './components/Home';
import { SimplyHdri } from './components/SimplyHdri';
import { CaptureScreen } from './components/CaptureScreen';
import { About } from './components/About';
import { NavBar } from './components/NavBar';
import { SideMenu } from './components/SideMenu';
import type { NavTarget } from './components/SideMenu';
import DotGrid from './components/DotGrid';
import ClickSpark from './components/ClickSpark';

type Screen = 'home' | 'simplyhdri' | 'envmap' | 'about';

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [menuOpen, setMenuOpen] = useState(false);

  const navigate = (target: NavTarget) => setScreen(target);

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

      <NavBar onMenu={() => setMenuOpen(true)} onHome={() => setScreen('home')} />
      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={navigate}
      />

      {screen === 'home' && (
        <Home onOpenSimplyHdri={() => setScreen('simplyhdri')} />
      )}
      {screen === 'simplyhdri' && (
        <SimplyHdri
          onEnvMap={() => setScreen('envmap')}
          onBack={() => setScreen('home')}
        />
      )}
      {screen === 'envmap' && (
        <CaptureScreen onBack={() => setScreen('simplyhdri')} />
      )}
      {screen === 'about' && <About onBack={() => setScreen('home')} />}
    </ClickSpark>
  );
}

export default App;
