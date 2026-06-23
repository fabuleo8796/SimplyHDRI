// A real, playable 3×3 Rubik's cube — pure CSS 3D, no libraries.
//
// How it stays correct: each of the 27 cubies has a grid position `g` and an
// orientation matrix `rm`. A face turn multiplies both by the same 90° rotation
// matrix. We animate by *prepending* a `rotate3d(axis, angle)` to the cubie's
// constant `matrix3d(model)` — CSS interpolates just the angle, and because
// `matrix3d(newModel) === rotate3d(90°)·matrix3d(oldModel)` exactly, committing
// the logical turn at the end produces no visible jump.
import { useEffect, useRef, useState } from 'react';

type V3 = [number, number, number];
type M3 = [V3, V3, V3];

const I3: M3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

// Sticker palette + the dark interior colour for non-surface faces.
const RED = '#d4322c';
const ORANGE = '#ff7a27';
const WHITE = '#f6f6f6';
const YELLOW = '#ffd500';
const GREEN = '#1fae4d';
const BLUE = '#2a6cf0';
const INNER = '#0b0b0b';

const S = 56; // cubie size (px)
const H = S / 2; // half — how far each face sits from the cubie centre
const GAP = 4;
const U = S + GAP; // spacing between cubie centres

const TURN_MS = 340;

function mulMV(m: M3, v: V3): V3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

function mulMM(a: M3, b: M3): M3 {
  const r: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += a[i][k] * b[k][j];
      r[i][j] = s;
    }
  return r as M3;
}

function round3(v: V3): V3 {
  return [Math.round(v[0]), Math.round(v[1]), Math.round(v[2])];
}

// 90° rotation matrix about a principal axis. These match CSS rotate3d exactly
// (same right-handed convention), so animation and logic never disagree.
function turnMat(axis: number, s: number): M3 {
  if (axis === 0)
    return s > 0
      ? [
          [1, 0, 0],
          [0, 0, -1],
          [0, 1, 0],
        ]
      : [
          [1, 0, 0],
          [0, 0, 1],
          [0, -1, 0],
        ];
  if (axis === 1)
    return s > 0
      ? [
          [0, 0, 1],
          [0, 1, 0],
          [-1, 0, 0],
        ]
      : [
          [0, 0, -1],
          [0, 1, 0],
          [1, 0, 0],
        ];
  return s > 0
    ? [
        [0, -1, 0],
        [1, 0, 0],
        [0, 0, 1],
      ]
    : [
        [0, 1, 0],
        [-1, 0, 0],
        [0, 0, 1],
      ];
}

function modelMatrix(rm: M3, g: V3): string {
  const px = g[0] * U;
  const py = g[1] * U;
  const pz = g[2] * U;
  // Column-major matrix3d: rotation in the top-left 3×3, translation in col 4.
  const m = [
    rm[0][0], rm[1][0], rm[2][0], 0,
    rm[0][1], rm[1][1], rm[2][1], 0,
    rm[0][2], rm[1][2], rm[2][2], 0,
    px, py, pz, 1,
  ];
  return `matrix3d(${m.join(',')})`;
}

// The six face transforms (which way each face of a cubie points) and a helper
// that colours a cubie's faces from its solved-state position.
const FACE_TRANSFORMS = [
  `rotateY(90deg) translateZ(${H}px)`, // +X  Right
  `rotateY(-90deg) translateZ(${H}px)`, // -X  Left
  `rotateX(90deg) translateZ(${H}px)`, // -Y  Up (top of screen)
  `rotateX(-90deg) translateZ(${H}px)`, // +Y  Down
  `translateZ(${H}px)`, // +Z  Front
  `rotateY(180deg) translateZ(${H}px)`, // -Z  Back
];

type Cubie = { id: number; g: V3; rm: M3; colors: string[] };

function solvedCube(): Cubie[] {
  const cs: Cubie[] = [];
  let id = 0;
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++) {
        const colors = [
          x === 1 ? RED : INNER,
          x === -1 ? ORANGE : INNER,
          y === -1 ? WHITE : INNER,
          y === 1 ? YELLOW : INNER,
          z === 1 ? GREEN : INNER,
          z === -1 ? BLUE : INNER,
        ];
        cs.push({ id: id++, g: [x, y, z], rm: I3, colors });
      }
  return cs;
}

const FACE_DEFS: Record<string, { axis: number; layer: number }> = {
  U: { axis: 1, layer: -1 },
  D: { axis: 1, layer: 1 },
  R: { axis: 0, layer: 1 },
  L: { axis: 0, layer: -1 },
  F: { axis: 2, layer: 1 },
  B: { axis: 2, layer: -1 },
};
const FACE_KEYS = ['U', 'D', 'L', 'R', 'F', 'B'];

type Anim = {
  ids: Set<number>;
  axisStr: string;
  angle: number;
  animate: boolean;
};

export function RubiksCube() {
  const [cubies, setCubies] = useState<Cubie[]>(solvedCube);
  const [anim, setAnim] = useState<Anim | null>(null);
  const [reverse, setReverse] = useState(false);

  const busy = useRef(false);
  const cubeRef = useRef<HTMLDivElement>(null);
  const rx = useRef(-24);
  const ry = useRef(-32);
  const drag = useRef<{ x: number; y: number } | null>(null);

  const applyView = () => {
    if (cubeRef.current)
      cubeRef.current.style.transform = `rotateX(${rx.current}deg) rotateY(${ry.current}deg)`;
  };
  useEffect(applyView, []);

  const turn = (face: string, sIn?: number) => {
    if (busy.current) return;
    const s = sIn ?? (reverse ? -1 : 1);
    const def = FACE_DEFS[face];
    const ids = new Set(
      cubies.filter((c) => c.g[def.axis] === def.layer).map((c) => c.id),
    );
    const axisStr = def.axis === 0 ? '1,0,0' : def.axis === 1 ? '0,1,0' : '0,0,1';

    busy.current = true;
    setAnim({ ids, axisStr, angle: 0, animate: false });
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        setAnim((a) => (a ? { ...a, angle: s * 90, animate: true } : a)),
      ),
    );
    window.setTimeout(() => {
      const tm = turnMat(def.axis, s);
      setCubies((prev) =>
        prev.map((c) =>
          ids.has(c.id)
            ? { ...c, g: round3(mulMV(tm, c.g)), rm: mulMM(tm, c.rm) }
            : c,
        ),
      );
      setAnim(null);
      busy.current = false;
    }, TURN_MS);
  };

  const scramble = () => {
    if (busy.current) return;
    let cs = cubies;
    for (let i = 0; i < 24; i++) {
      const axis = Math.floor(Math.random() * 3);
      const layer = Math.random() < 0.5 ? -1 : 1;
      const s = Math.random() < 0.5 ? -1 : 1;
      const tm = turnMat(axis, s);
      cs = cs.map((c) =>
        c.g[axis] === layer
          ? { ...c, g: round3(mulMV(tm, c.g)), rm: mulMM(tm, c.rm) }
          : c,
      );
    }
    setCubies(cs);
  };

  const reset = () => {
    if (busy.current) return;
    setCubies(solvedCube());
  };

  // Drag to orbit the whole cube (touch + mouse).
  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    ry.current += dx * 0.4;
    rx.current = Math.max(-88, Math.min(88, rx.current - dy * 0.4));
    applyView();
  };
  const onUp = () => {
    drag.current = null;
  };

  return (
    <div className="rubik">
      <div
        className="rubik__scene"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        <div className="rubik__cube" ref={cubeRef}>
          {cubies.map((c) => {
            const turning = anim?.ids.has(c.id);
            const base = modelMatrix(c.rm, c.g);
            const transform =
              turning && anim
                ? `rotate3d(${anim.axisStr}, ${anim.angle}deg) ${base}`
                : base;
            const transition =
              turning && anim?.animate ? `transform ${TURN_MS}ms ease` : 'none';
            return (
              <div
                key={c.id}
                className="rubik__cubie"
                style={{ transform, transition }}
              >
                {FACE_TRANSFORMS.map((t, fi) => (
                  <div
                    key={fi}
                    className="rubik__face"
                    style={{ transform: t, background: c.colors[fi] }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rubik__hint">Drag the cube to look around 🔄</div>

      <div className="rubik__faces">
        {FACE_KEYS.map((f) => (
          <button key={f} className="rubik__btn" onClick={() => turn(f)}>
            {f}
            {reverse ? '′' : ''}
          </button>
        ))}
      </div>

      <div className="rubik__util">
        <button
          className={`rubik__chip ${reverse ? 'is-on' : ''}`}
          onClick={() => setReverse((r) => !r)}
        >
          {reverse ? '↺ Reverse: on' : '↻ Reverse: off'}
        </button>
        <button className="rubik__chip" onClick={scramble}>
          🔀 Scramble
        </button>
        <button className="rubik__chip" onClick={reset}>
          ✅ Solve
        </button>
      </div>
    </div>
  );
}
