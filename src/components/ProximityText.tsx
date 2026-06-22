// Small convenience wrapper so we can apply the proximity effect to any
// bold text with just <ProximityText>your text</ProximityText>.
// Uses the settings from the React Bits example (weight 400→1000).
import VariableProximity from './VariableProximity';

export function ProximityText({ children }: { children: string }) {
  return (
    <VariableProximity
      label={children}
      className="proximity-text"
      fromFontVariationSettings="'wght' 400, 'opsz' 9"
      toFontVariationSettings="'wght' 1000, 'opsz' 40"
      radius={100}
      falloff="linear"
    />
  );
}
