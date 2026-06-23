// The required calibration step. Before any scanning starts, the user sets six
// anchors — Front, Right, Back, Left, Top, Bottom — so the orientation sensors
// map accurately onto the sphere. All six are mandatory; the "Start scanning"
// button stays locked until every one is recorded.
//
// It runs its own light loop (10×/sec) to show a live readout for the anchor
// you're currently setting, without re-rendering the camera underneath.
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { OrientationData } from '../hooks/useOrientation';
import {
  ALL_ANCHORS,
  buildCalibration,
  isComplete,
} from '../utils/calibration';
import type { AnchorId, Calibration, RawAnchors } from '../utils/calibration';
import { ProximityText } from './ProximityText';

type Axis = 'h' | 'v';

type StepDef = {
  id: AnchorId;
  icon: string;
  label: string;
  instruction: string;
  axis: Axis;
  target: string; // what a good reading looks like
};

const STEPS: StepDef[] = [
  {
    id: 'front',
    icon: '⬆️',
    label: 'Front',
    instruction: 'Stand where you’ll scan. Point the phone straight ahead at the horizon and hold it level.',
    axis: 'h',
    target: 'horizon',
  },
  {
    id: 'right',
    icon: '➡️',
    label: 'Right',
    instruction: 'Turn a quarter-turn to your right. Keep the phone level at the horizon.',
    axis: 'h',
    target: 'horizon',
  },
  {
    id: 'back',
    icon: '⬇️',
    label: 'Back',
    instruction: 'Turn to face directly behind you. Phone level at the horizon.',
    axis: 'h',
    target: 'horizon',
  },
  {
    id: 'left',
    icon: '⬅️',
    label: 'Left',
    instruction: 'Turn a quarter-turn to your left. Phone level at the horizon.',
    axis: 'h',
    target: 'horizon',
  },
  {
    id: 'top',
    icon: '🔼',
    label: 'Top',
    instruction: 'Tilt the phone up until it points straight at the ceiling / sky.',
    axis: 'v',
    target: '+90°',
  },
  {
    id: 'bottom',
    icon: '🔽',
    label: 'Bottom',
    instruction: 'Tilt the phone down until it points straight at the floor.',
    axis: 'v',
    target: '-90°',
  },
];

type CalibrationStepProps = {
  dataRef: RefObject<OrientationData>;
  onComplete: (cal: Calibration) => void;
};

export function CalibrationStep({ dataRef, onComplete }: CalibrationStepProps) {
  const [raw, setRaw] = useState<RawAnchors>({});
  const [live, setLive] = useState({ heading: 0, elevation: 0 });
  const rawRef = useRef(raw);
  rawRef.current = raw;

  // Light live readout — 10×/sec is plenty for a number and keeps it cheap.
  useEffect(() => {
    const id = window.setInterval(() => {
      const d = dataRef.current;
      setLive({ heading: d.heading, elevation: d.elevation });
    }, 100);
    return () => window.clearInterval(id);
  }, [dataRef]);

  // The active step is the first one not yet recorded.
  const activeIndex = STEPS.findIndex((s) => raw[s.id] == null);
  const active = activeIndex >= 0 ? STEPS[activeIndex] : null;
  const doneCount = ALL_ANCHORS.filter((id) => raw[id] != null).length;
  const complete = isComplete(raw);
  const cal = complete ? buildCalibration(raw) : null;

  const setAnchor = (step: StepDef) => {
    const d = dataRef.current;
    const value = step.axis === 'h' ? d.heading : d.elevation;
    setRaw((prev) => ({ ...prev, [step.id]: value }));
    navigator.vibrate?.(20);
  };

  const redo = (id: AnchorId) => {
    setRaw((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const liveValue =
    active?.axis === 'h'
      ? `${Math.round(live.heading)}°`
      : `${Math.round(live.elevation)}°`;

  return (
    <section className="card calib">
      <h2>
        🎯 <ProximityText>Calibrate first</ProximityText>
      </h2>
      <p className="note">
        Set all six anchors so your scan lines up with the real world. This is
        what makes the map accurate — no guessing.
      </p>

      {/* The anchor you're setting right now. */}
      {active && (
        <div className="calib__active">
          <div className="calib__active-head">
            <span className="calib__icon">{active.icon}</span>
            <span className="calib__step">
              Step {activeIndex + 1} / {STEPS.length}: Set {active.label}
            </span>
          </div>
          <p className="calib__instruction">{active.instruction}</p>
          <div className="calib__readout">
            <span className="calib__readout-num">{liveValue}</span>
            <span className="calib__readout-label">
              {active.axis === 'h'
                ? 'compass heading'
                : `tilt — aim for ${active.target}`}
            </span>
          </div>
          <button className="btn btn-primary" onClick={() => setAnchor(active)}>
            {active.icon} Set {active.label}
          </button>
        </div>
      )}

      {/* Checklist of all six. Tap a done one to redo it. */}
      <ul className="calib__list">
        {STEPS.map((s, i) => {
          const isDone = raw[s.id] != null;
          const isActive = i === activeIndex;
          return (
            <li
              key={s.id}
              className={`calib__item ${isDone ? 'is-done' : ''} ${
                isActive ? 'is-active' : ''
              }`}
            >
              <span className="calib__item-icon">{isDone ? '✓' : s.icon}</span>
              <span className="calib__item-label">{s.label}</span>
              <span className="calib__item-val">
                {isDone
                  ? `${Math.round(raw[s.id] as number)}°`
                  : isActive
                    ? 'now'
                    : '—'}
              </span>
              {isDone && (
                <button className="calib__redo" onClick={() => redo(s.id)}>
                  redo
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {cal && (!cal.ringValid || !cal.elValid) && (
        <p className="camera-error">
          ⚠️ Some anchors look inconsistent
          {!cal.ringValid && ' (left/right/back vs. front)'}
          {!cal.elValid && ' (top/bottom)'}. You can still scan, but redo them
          for the best accuracy.
        </p>
      )}

      <button
        className="btn btn-primary"
        disabled={!cal}
        onClick={() => cal && onComplete(cal)}
      >
        {cal
          ? '✅ Calibrated — Start scanning'
          : `🔒 Set all anchors (${doneCount} / ${STEPS.length})`}
      </button>
    </section>
  );
}
