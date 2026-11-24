/**
 * The "design recipe": the JSON the AI returns.
 *
 * The AI never draws pixels. It only fills in this small, well-defined object,
 * and our own code (src/render) draws it at print size using the customer's
 * ORIGINAL photo. This file is the contract between the AI (mock today, Claude
 * later) and the renderer, so keep it small and keep every value bounded.
 *
 * Sizes are fractions of the wrap height (0–1) so the same recipe renders
 * identically at preview size and at full print size.
 */

/** 20oz skinny tumbler wrap at 300 DPI. Left and right edges meet at the seam. */
export const WRAP = {
  widthIn: 9.3,
  heightIn: 8.2,
  dpi: 300,
  widthPx: 2790,
  heightPx: 2460,
} as const;

export const LAYOUTS = ['centered', 'pattern', 'two-sides', 'full-wrap'] as const;
export const BACKGROUND_STYLES = ['solid', 'vertical-gradient', 'horizontal-gradient'] as const;
export const PATTERN_SHAPES = ['none', 'dots', 'hearts', 'stars', 'paws', 'confetti', 'stripes', 'waves'] as const;
export const PHOTO_SHAPES = ['rect', 'rounded', 'circle', 'arch', 'soft', 'plain'] as const;
export const FONT_IDS = ['pacifico', 'bebas', 'playfair', 'baloo', 'marker'] as const;
export const TEXT_POSITIONS = ['top', 'bottom'] as const;

export type Layout = (typeof LAYOUTS)[number];
export type BackgroundStyle = (typeof BACKGROUND_STYLES)[number];
export type PatternShape = (typeof PATTERN_SHAPES)[number];
/** 'soft' = feathered edges; 'plain' = no crop/mask (for logos with transparent backgrounds). */
export type PhotoShape = (typeof PHOTO_SHAPES)[number];
export type FontId = (typeof FONT_IDS)[number];
export type TextPosition = (typeof TEXT_POSITIONS)[number];

export interface BackgroundRecipe {
  style: BackgroundStyle;
  /** 1–3 hex colours, e.g. "#f4a6c1". */
  colors: string[];
}

export interface PatternRecipe {
  shape: PatternShape;
  color: string;
  /** 0–1 */
  opacity: number;
  /** 0.5–2, 1 = normal */
  size: number;
}

export interface PhotoRecipe {
  shape: PhotoShape;
  /** Photo height as a fraction of wrap height (0.15–0.95). Ignored for full-wrap. */
  size: number;
  /** Vertical shift as a fraction of wrap height (-0.3–0.3), positive = down. */
  offsetY: number;
  /** Point in the photo (0–1) to keep in view when cropping, e.g. the face. */
  focusX: number;
  focusY: number;
  /** 1 = show as much as fits, up to 3 = crop in tightly. */
  zoom: number;
  /** Border width is a fraction of wrap height (0–0.03). null = no border. */
  border: { color: string; width: number } | null;
  shadow: boolean;
  /** Pattern layout only: how many photos across the wrap (3–8). */
  repeatCount: number;
}

export interface TextRecipe {
  content: string;
  font: FontId;
  color: string;
  outline: string | null;
  position: TextPosition;
  /** Font size as a fraction of wrap height (0.05–0.16). Auto-shrinks to fit. */
  size: number;
  /** Optional full-width colour strip behind the text. */
  band: string | null;
}

export interface DesignRecipe {
  title: string;
  layout: Layout;
  background: BackgroundRecipe;
  pattern: PatternRecipe;
  photo: PhotoRecipe;
  text: TextRecipe | null;
}

export const FONTS: Record<FontId, { family: string; weight: number; label: string }> = {
  pacifico: { family: 'Pacifico', weight: 400, label: 'Script' },
  bebas: { family: 'Bebas Neue', weight: 400, label: 'Bold caps' },
  playfair: { family: 'Playfair Display', weight: 700, label: 'Elegant serif' },
  baloo: { family: 'Baloo 2', weight: 800, label: 'Rounded' },
  marker: { family: 'Permanent Marker', weight: 400, label: 'Hand-drawn' },
};

export const fontCss = (font: FontId, px: number) =>
  `${FONTS[font].weight} ${Math.round(px)}px "${FONTS[font].family}"`;

// ---------------------------------------------------------------------------
// Validation. Anything coming from an AI is untrusted: clamp every number,
// fall back to defaults for unknown values. The renderer only ever sees the
// output of normalizeRecipe().
// ---------------------------------------------------------------------------

const num = (v: unknown, min: number, max: number, dflt: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : dflt;

const oneOf = <T extends string>(v: unknown, opts: readonly T[], dflt: T): T =>
  (opts as readonly string[]).includes(v as string) ? (v as T) : dflt;

const hex = (v: unknown, dflt: string): string => {
  if (typeof v !== 'string') return dflt;
  const s = v.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) return '#' + [...s.slice(1)].map((c) => c + c).join('');
  return dflt;
};

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};

export function normalizeRecipe(raw: unknown): DesignRecipe {
  const r = obj(raw);
  const bg = obj(r.background);
  const pat = obj(r.pattern);
  const ph = obj(r.photo);
  const border = r.photo && ph.border ? obj(ph.border) : null;

  const colors = (Array.isArray(bg.colors) ? bg.colors : [])
    .map((c) => hex(c, ''))
    .filter(Boolean)
    .slice(0, 3);

  let text: TextRecipe | null = null;
  if (r.text) {
    const t = obj(r.text);
    const content = typeof t.content === 'string' ? t.content.trim().slice(0, 40) : '';
    if (content) {
      text = {
        content,
        font: oneOf(t.font, FONT_IDS, 'pacifico'),
        color: hex(t.color, '#222222'),
        outline: t.outline ? hex(t.outline, '#ffffff') : null,
        position: oneOf(t.position, TEXT_POSITIONS, 'bottom'),
        size: num(t.size, 0.05, 0.16, 0.11),
        band: t.band ? hex(t.band, '#ffffff') : null,
      };
    }
  }

  return {
    title: typeof r.title === 'string' && r.title.trim() ? r.title.trim().slice(0, 60) : 'My tumbler',
    layout: oneOf(r.layout, LAYOUTS, 'centered'),
    background: {
      style: oneOf(bg.style, BACKGROUND_STYLES, 'solid'),
      colors: colors.length ? colors : ['#ffffff'],
    },
    pattern: {
      shape: oneOf(pat.shape, PATTERN_SHAPES, 'none'),
      color: hex(pat.color, '#ffffff'),
      opacity: num(pat.opacity, 0, 1, 0.3),
      size: num(pat.size, 0.5, 2, 1),
    },
    photo: {
      shape: oneOf(ph.shape, PHOTO_SHAPES, 'rounded'),
      size: num(ph.size, 0.15, 0.95, 0.7),
      offsetY: num(ph.offsetY, -0.3, 0.3, 0),
      focusX: num(ph.focusX, 0, 1, 0.5),
      focusY: num(ph.focusY, 0, 1, 0.45),
      zoom: num(ph.zoom, 1, 3, 1),
      border: border ? { color: hex(border.color, '#ffffff'), width: num(border.width, 0, 0.03, 0.012) } : null,
      shadow: ph.shadow === true,
      repeatCount: Math.round(num(ph.repeatCount, 3, 8, 5)),
    },
    text,
  };
}
