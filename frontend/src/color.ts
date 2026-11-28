/** Small colour helpers + palette extraction from the uploaded photo. */

type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
}

/** Blend a towards b by t (0 = a, 1 = b). */
export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

export const lighten = (c: string, t: number) => mix(c, '#ffffff', t);
export const darken = (c: string, t: number) => mix(c, '#000000', t);

export function withAlpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Perceived brightness 0–1. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function saturation(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

/** Dark text on light backgrounds, white text on dark ones. */
export const readableOn = (bg: string) => (luminance(bg) > 0.6 ? '#2b2b2b' : '#ffffff');

const dist = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export interface PhotoAnalysis {
  /** Up to 5 distinct colours, most characteristic first. */
  palette: string[];
  /** True if a noticeable part of the image is transparent (typical for logos). */
  hasTransparency: boolean;
}

/**
 * Downscale the image, bucket similar colours together, and pick a handful of
 * distinct ones. Colourful buckets get a boost so we don't just return
 * "beige, beige, grey" for most photos.
 */
export function analyzePhoto(img: HTMLImageElement): PhotoAnalysis {
  const max = 72;
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const buckets = new Map<number, { sum: RGB; n: number }>();
  let transparent = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) {
      transparent++;
      continue;
    }
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key) ?? { sum: [0, 0, 0] as RGB, n: 0 };
    bucket.sum[0] += r;
    bucket.sum[1] += g;
    bucket.sum[2] += b;
    bucket.n++;
    buckets.set(key, bucket);
  }

  const candidates = [...buckets.values()]
    .map(({ sum, n }) => {
      const rgb: RGB = [sum[0] / n, sum[1] / n, sum[2] / n];
      const hex = rgbToHex(rgb);
      return { rgb, hex, score: n * (0.4 + saturation(hex) * 1.6) };
    })
    .sort((a, b) => b.score - a.score);

  const picked: typeof candidates = [];
  for (const cand of candidates) {
    if (picked.every((p) => dist(p.rgb, cand.rgb) > 60)) picked.push(cand);
    if (picked.length === 5) break;
  }

  return {
    palette: picked.length ? picked.map((p) => p.hex) : ['#cccccc'],
    hasTransparency: transparent / (w * h) > 0.05,
  };
}
