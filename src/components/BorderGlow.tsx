// A rounded container with a glowing, multi-colour gradient border.
//
// On a computer it can follow the pointer (the bright part of the ring turns
// toward your cursor, and lights up when you're near an edge). On a phone —
// where there's no hover — it gently rotates on its own so the cards still feel
// alive. Pass `animated` to force the rotating mode everywhere.
import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';

type BorderGlowProps = {
  children: ReactNode;
  edgeSensitivity?: number; // px from an edge before the glow lights up (pointer mode)
  glowColor?: string; // "r g b" base tint
  backgroundColor?: string; // inner fill
  borderRadius?: number; // px
  glowRadius?: number; // blur size of the halo, px
  glowIntensity?: number; // 0–1 halo opacity
  coneSpread?: number; // how concentrated the bright arc is
  animated?: boolean; // always rotate (vs. follow the pointer)
  colors?: string[]; // border gradient colours
  borderWidth?: number; // px
  className?: string;
  style?: CSSProperties;
};

export default function BorderGlow({
  children,
  edgeSensitivity = 30,
  glowColor = '40 80 80',
  backgroundColor = '#120F17',
  borderRadius = 28,
  glowRadius = 40,
  glowIntensity = 1,
  coneSpread = 25,
  animated = false,
  colors = ['#c084fc', '#f472b6', '#38bdf8'],
  borderWidth = 2,
  className = '',
  style,
}: BorderGlowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const angleRef = useRef(0);

  // Build the rotating conic gradient from the colour list (loop back to the
  // first colour so it joins seamlessly). coneSpread nudges how tight the
  // bright bands are by repeating the stops.
  const stops = colors.length ? colors : ['#c084fc', '#f472b6', '#38bdf8'];
  const spread = Math.max(8, coneSpread);
  const gradient = `conic-gradient(from var(--bg-angle), ${[...stops, stops[0]].join(
    ', ',
  )})`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const supportsHover = window.matchMedia('(hover: hover)').matches;

    // Touch screens (the iPhone!) can't hover, so always auto-rotate there.
    if (animated || !supportsHover) {
      let raf = 0;
      const tick = () => {
        angleRef.current = (angleRef.current + 0.5) % 360;
        el.style.setProperty('--bg-angle', `${angleRef.current}deg`);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }

    // Pointer mode: aim the bright part of the ring at the cursor and brighten
    // the halo when the pointer is near an edge.
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const ang =
        (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90;
      const edge = Math.min(
        e.clientX - r.left,
        r.right - e.clientX,
        e.clientY - r.top,
        r.bottom - e.clientY,
      );
      el.style.setProperty('--bg-angle', `${ang}deg`);
      el.style.setProperty(
        '--bg-glow-op',
        String(edge <= edgeSensitivity ? glowIntensity : glowIntensity * 0.3),
      );
    };
    const onLeave = () => el.style.setProperty('--bg-glow-op', '0');
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [animated, edgeSensitivity, glowIntensity]);

  const vars = {
    '--bg-radius': `${borderRadius}px`,
    '--bg-fill': backgroundColor,
    '--bg-border': `${borderWidth}px`,
    '--bg-blur': `${glowRadius}px`,
    '--bg-glow-op': animated ? String(glowIntensity) : '0.25',
    '--bg-gradient': gradient,
    '--bg-angle': '0deg',
    '--bg-tint': `rgb(${glowColor} / 0.4)`,
    '--bg-spread': String(spread),
    ...style,
  } as CSSProperties;

  return (
    <div ref={ref} className={`bglow ${className}`.trim()} style={vars}>
      <span className="bglow__glow" aria-hidden="true" />
      <div className="bglow__content">{children}</div>
      <span className="bglow__ring" aria-hidden="true" />
    </div>
  );
}
