/**
 * Lets the customer set the tumbler background by hand: solid or gradient,
 * colours from their photo, a few presets, or any custom colour.
 * Edits the recipe directly; no AI call needed.
 */
import { useState } from 'react';
import type { BackgroundRecipe } from '../recipe';
import { darken } from '../color';

const PRESETS = ['#ffffff', '#1d1d1f', '#f4a6c1', '#c8b6e2', '#9cd3f2', '#1f3a68', '#a8e6cf', '#f6d55c', '#f3e9d2', '#d94141'];

interface Props {
  background: BackgroundRecipe;
  palette: string[];
  onChange(bg: BackgroundRecipe): void;
}

export function BackgroundPicker({ background, palette, onChange }: Props) {
  const isGradient = background.style !== 'solid' && background.colors.length > 1;
  const colors = isGradient ? background.colors.slice(0, 2) : [background.colors[0]];
  const [slot, setSlot] = useState(0);
  const active = Math.min(slot, colors.length - 1);

  const setColor = (c: string) => {
    const next = [...colors];
    next[active] = c.toLowerCase();
    onChange({ style: isGradient ? background.style : 'solid', colors: next });
  };

  const setGradient = (on: boolean) => {
    if (on === isGradient) return;
    if (on) {
      onChange({ style: 'vertical-gradient', colors: [colors[0], darken(colors[0], 0.25)] });
      setSlot(1);
    } else {
      onChange({ style: 'solid', colors: [colors[active]] });
      setSlot(0);
    }
  };

  const swatch = (c: string, key: string) => (
    <button
      key={key}
      className={`swatch ${colors[active] === c ? 'selected' : ''}`}
      style={{ background: c }}
      title={c}
      aria-label={`Use colour ${c}`}
      onClick={() => setColor(c)}
    />
  );

  return (
    <div className="bg-picker">
      <div className="bg-picker-head">
        <span className="bg-label">Background</span>
        <div className="seg">
          <button className={!isGradient ? 'active' : ''} onClick={() => setGradient(false)}>
            Solid
          </button>
          <button className={isGradient ? 'active' : ''} onClick={() => setGradient(true)}>
            Gradient
          </button>
        </div>
        <div className="slots">
          {colors.map((c, i) => (
            <button
              key={i}
              className={`slot ${i === active ? 'active' : ''}`}
              onClick={() => setSlot(i)}
              title={colors.length > 1 ? (i === 0 ? 'Top colour' : 'Bottom colour') : 'Background colour'}
            >
              <span style={{ background: c }} />
              {colors.length > 1 && (i === 0 ? 'Top' : 'Bottom')}
            </button>
          ))}
        </div>
      </div>

      <div className="swatches">
        {palette.length > 0 && (
          <>
            <span className="swatch-group">From photo</span>
            {palette.map((c) => swatch(c, 'p' + c))}
            <span className="swatch-sep" />
          </>
        )}
        {PRESETS.map((c) => swatch(c, 's' + c))}
        <label className="swatch custom" title="Pick any colour">
          <input type="color" value={colors[active]} onChange={(e) => setColor(e.target.value)} aria-label="Custom colour" />
        </label>
      </div>
    </div>
  );
}
