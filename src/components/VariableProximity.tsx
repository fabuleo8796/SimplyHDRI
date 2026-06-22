// Variable-font proximity effect (adapted from the React Bits
// "VariableProximity", rewritten without framer-motion to avoid an extra
// dependency). Each letter's font weight/optical-size animates based on how
// close the pointer (or your dragging finger) is to it.
//
// iPhone note: phones have no hover, so letters only react while you DRAG a
// finger across the text. It needs a variable font (we load Roboto Flex).
import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';

type Falloff = 'linear' | 'exponential' | 'gaussian';

export type VariableProximityProps = {
  label: string;
  fromFontVariationSettings: string;
  toFontVariationSettings: string;
  radius?: number;
  falloff?: Falloff;
  className?: string;
  style?: CSSProperties;
};

export default function VariableProximity({
  label,
  fromFontVariationSettings,
  toFontVariationSettings,
  radius = 50,
  falloff = 'linear',
  className,
  style,
}: VariableProximityProps) {
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const lastRef = useRef({ x: Infinity, y: Infinity });

  // Parse "'wght' 400, 'opsz' 9" into a list of axes with from/to values.
  const parsed = useMemo(() => {
    const parse = (str: string) =>
      new Map(
        str.split(',').map((part) => {
          const [name, value] = part.trim().split(/\s+/);
          return [name.replace(/['"]/g, ''), parseFloat(value)] as [
            string,
            number,
          ];
        }),
      );
    const from = parse(fromFontVariationSettings);
    const to = parse(toFontVariationSettings);
    return Array.from(from.entries()).map(([axis, fromValue]) => ({
      axis,
      fromValue,
      toValue: to.get(axis) ?? fromValue,
    }));
  }, [fromFontVariationSettings, toFontVariationSettings]);

  // Track pointer and touch position (viewport coordinates).
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) mouseRef.current = { x: t.clientX, y: t.clientY };
    };
    window.addEventListener('mousemove', onMouse, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('touchmove', onTouch);
    };
  }, []);

  // Animate each frame — but skip all work when the pointer hasn't moved,
  // so it costs almost nothing when idle (important for phone battery).
  useEffect(() => {
    let rafId = 0;

    const computeFalloff = (distance: number) => {
      const norm = Math.min(Math.max(1 - distance / radius, 0), 1);
      if (falloff === 'exponential') return norm ** 2;
      if (falloff === 'gaussian')
        return Math.exp(-((distance / (radius / 2)) ** 2) / 2);
      return norm;
    };

    const tick = () => {
      const { x, y } = mouseRef.current;
      if (x !== lastRef.current.x || y !== lastRef.current.y) {
        lastRef.current = { x, y };
        letterRefs.current.forEach((el) => {
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dist = Math.hypot(x - cx, y - cy);
          if (dist >= radius) {
            el.style.fontVariationSettings = fromFontVariationSettings;
            return;
          }
          const f = computeFalloff(dist);
          el.style.fontVariationSettings = parsed
            .map(
              ({ axis, fromValue, toValue }) =>
                `'${axis}' ${fromValue + (toValue - fromValue) * f}`,
            )
            .join(', ');
        });
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [parsed, radius, falloff, fromFontVariationSettings]);

  // Split into words (so they wrap nicely) then code-point-safe characters.
  const words = label.split(' ');
  let letterIndex = 0;

  return (
    <span className={className} style={{ display: 'inline', ...style }}>
      {words.map((word, wi) => (
        <span key={wi} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
          {Array.from(word).map((ch) => {
            const i = letterIndex++;
            return (
              <span
                key={i}
                ref={(el) => {
                  letterRefs.current[i] = el;
                }}
                style={{
                  display: 'inline-block',
                  fontVariationSettings: fromFontVariationSettings,
                }}
                aria-hidden="true"
              >
                {ch}
              </span>
            );
          })}
          {wi < words.length - 1 && <span aria-hidden="true">&nbsp;</span>}
        </span>
      ))}
      {/* Keep the real text available to screen readers / copy-paste. */}
      <span className="sr-only">{label}</span>
    </span>
  );
}
