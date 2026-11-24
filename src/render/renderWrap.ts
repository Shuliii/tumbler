/**
 * Draws a DesignRecipe onto a canvas.
 *
 * The canvas is the flat wrap: x = 0 and x = width are the SAME line on the
 * tumbler (the seam), and x = width/2 is the front. Anything that crosses an
 * edge is drawn twice (once shifted by ±width) so the edges join perfectly.
 */
import { DesignRecipe, PatternRecipe, PhotoRecipe, TextRecipe, WRAP, fontCss } from '../recipe';
import { withAlpha } from '../color';

export interface RenderStats {
  /** Effective print resolution of the photo in pixels per inch (null = no photo). */
  photoPpi: number | null;
}

type Ctx = CanvasRenderingContext2D;

/** Fonts load lazily in the browser; call this before drawWrap so text renders in the right font. */
export async function prepareFonts(recipe: DesignRecipe | null): Promise<void> {
  if (!recipe?.text) return;
  await document.fonts.load(fontCss(recipe.text.font, 100), recipe.text.content);
}

export function drawWrap(canvas: HTMLCanvasElement, recipe: DesignRecipe | null, img: HTMLImageElement | null): RenderStats {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  if (!recipe) return { photoPpi: null };

  drawBackground(ctx, W, H, recipe);
  drawPattern(ctx, W, H, recipe.pattern);
  // No photo yet is fine: people can play with colours before uploading.
  const photoPpi = img ? drawPhotos(ctx, W, H, recipe, img) : null;
  if (recipe.text) drawText(ctx, W, H, recipe, recipe.text);
  return { photoPpi };
}

// ---------------------------------------------------------------- background

function drawBackground(ctx: Ctx, W: number, H: number, r: DesignRecipe) {
  const { style, colors } = r.background;
  if (style === 'solid' || colors.length === 1) {
    ctx.fillStyle = colors[0];
  } else if (style === 'vertical-gradient') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
    ctx.fillStyle = g;
  } else {
    // Horizontal: start and end on the same colour so the seam is invisible,
    // with the last colour landing on the front (x = W/2).
    const stops = [...colors, ...colors.slice(0, -1).reverse()];
    const g = ctx.createLinearGradient(0, 0, W, 0);
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
    ctx.fillStyle = g;
  }
  ctx.fillRect(0, 0, W, H);
}

// ------------------------------------------------------------------- pattern

/** Deterministic pseudo-random 0–1, so the pattern doesn't jump between renders. */
const rnd = (a: number, b: number, k = 0) => {
  const x = Math.sin(a * 127.1 + b * 311.7 + k * 74.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Draws `draw` at x, plus a copy across the seam if it would be cut off. */
function wrapped(W: number, x: number, halfWidth: number, draw: (x: number) => void) {
  draw(x);
  if (x - halfWidth < 0) draw(x + W);
  if (x + halfWidth > W) draw(x - W);
}

function shapePath(ctx: Ctx, shape: PatternRecipe['shape'], s: number) {
  ctx.beginPath();
  switch (shape) {
    case 'dots':
      ctx.arc(0, 0, s * 0.28, 0, Math.PI * 2);
      break;
    case 'hearts':
      ctx.moveTo(0, s * 0.32);
      ctx.bezierCurveTo(-s * 0.55, -s * 0.05, -s * 0.28, -s * 0.48, 0, -s * 0.2);
      ctx.bezierCurveTo(s * 0.28, -s * 0.48, s * 0.55, -s * 0.05, 0, s * 0.32);
      break;
    case 'stars': {
      const outer = s * 0.45, inner = s * 0.19;
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 ? inner : outer;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath();
      break;
    }
    case 'paws': {
      const pad = (cx: number, cy: number, rx: number, ry: number) => {
        ctx.moveTo(cx + rx, cy);
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      };
      pad(0, s * 0.14, s * 0.22, s * 0.18);
      pad(-s * 0.27, -s * 0.08, s * 0.085, s * 0.11);
      pad(-s * 0.1, -s * 0.24, s * 0.085, s * 0.11);
      pad(s * 0.1, -s * 0.24, s * 0.085, s * 0.11);
      pad(s * 0.27, -s * 0.08, s * 0.085, s * 0.11);
      break;
    }
    case 'confetti':
      ctx.roundRect(-s * 0.25, -s * 0.08, s * 0.5, s * 0.16, s * 0.05);
      break;
  }
}

function drawPattern(ctx: Ctx, W: number, H: number, pat: PatternRecipe) {
  if (pat.shape === 'none' || pat.opacity <= 0) return;
  ctx.save();
  ctx.globalAlpha = pat.opacity;
  ctx.fillStyle = pat.color;
  ctx.strokeStyle = pat.color;
  const cell = H * 0.11 * pat.size;

  if (pat.shape === 'stripes') {
    // 45° stripes; a whole number of them across W keeps the seam clean.
    const n = Math.max(4, Math.round(W / (cell * 1.3)));
    const p = W / n;
    for (let i = -Math.ceil(H / p) - 1; i <= n + 1; i++) {
      const x = i * p;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + p / 2, 0);
      ctx.lineTo(x + p / 2 + H, H);
      ctx.lineTo(x + H, H);
      ctx.closePath();
      ctx.fill();
    }
  } else if (pat.shape === 'waves') {
    const rows = Math.max(3, Math.round(H / (cell * 0.9)));
    const periods = Math.max(2, Math.round(W / (cell * 3))); // whole number => seamless
    const amp = cell * 0.18;
    ctx.lineWidth = cell * 0.09;
    ctx.lineCap = 'round';
    for (let r = 0; r < rows; r++) {
      const y0 = ((r + 0.5) * H) / rows;
      const phase = r % 2 ? Math.PI : 0;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 8) {
        const y = y0 + amp * Math.sin((2 * Math.PI * periods * x) / W + phase);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else {
    // Staggered grid with a whole number of columns => seamless.
    const cols = Math.max(4, Math.round(W / cell));
    const cw = W / cols;
    const rowH = cw * 0.9;
    const rows = Math.ceil(H / rowH) + 1;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = (col + (row % 2) * 0.5) * cw;
        const y = (row + 0.25) * rowH;
        const jitter = rnd(row, col);
        let s = cw * 0.55;
        let rot = 0;
        if (pat.shape === 'confetti') {
          s *= 0.7 + jitter * 0.6;
          rot = jitter * Math.PI * 2;
          ctx.globalAlpha = pat.opacity * (0.6 + rnd(row, col, 1) * 0.4);
        } else if (pat.shape !== 'dots') {
          rot = (jitter - 0.5) * 0.7;
        }
        wrapped(W, x, s, (xx) => {
          ctx.save();
          ctx.translate(xx, y);
          ctx.rotate(rot);
          shapePath(ctx, pat.shape, s);
          ctx.fill();
          ctx.restore();
        });
      }
    }
  }
  ctx.restore();
}

// --------------------------------------------------------------------- photo

/** Pick the part of the image to show for a given box shape (like CSS object-fit: cover). */
function coverCrop(img: HTMLImageElement, aspect: number, p: PhotoRecipe) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  let sw = iw;
  let sh = iw / aspect;
  if (sh > ih) {
    sh = ih;
    sw = ih * aspect;
  }
  sw /= p.zoom;
  sh /= p.zoom;
  const x = Math.min(iw - sw, Math.max(0, p.focusX * iw - sw / 2));
  const y = Math.min(ih - sh, Math.max(0, p.focusY * ih - sh / 2));
  return { x, y, w: sw, h: sh };
}

function framePath(ctx: Ctx, shape: PhotoRecipe['shape'], x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  switch (shape) {
    case 'circle':
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    case 'rounded':
      ctx.roundRect(x, y, w, h, Math.min(w, h) * 0.09);
      break;
    case 'arch':
      ctx.moveTo(x, y + h);
      ctx.lineTo(x, y + w / 2);
      ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      break;
    default:
      ctx.rect(x, y, w, h);
  }
}

/** Renders the photo once into its own canvas (cropped, masked, bordered) so it can be stamped repeatedly. */
function makePhotoTile(img: HTMLImageElement, p: PhotoRecipe, w: number, h: number, H: number) {
  const tile = document.createElement('canvas');
  tile.width = Math.max(1, Math.ceil(w));
  tile.height = Math.max(1, Math.ceil(h));
  const t = tile.getContext('2d')!;

  if (p.shape === 'plain') {
    t.drawImage(img, 0, 0, w, h);
    return { tile, srcWidth: img.naturalWidth };
  }

  const src = coverCrop(img, w / h, p);
  const bw = p.border && p.shape !== 'soft' ? p.border.width * H : 0;

  t.save();
  framePath(t, p.shape, bw / 2, bw / 2, w - bw, h - bw);
  t.clip();
  t.drawImage(img, src.x, src.y, src.w, src.h, 0, 0, w, h);
  t.restore();

  if (p.shape === 'soft') {
    // Feather the edges: keep the centre, fade to transparent at the rim.
    t.globalCompositeOperation = 'destination-in';
    t.translate(w / 2, h / 2);
    t.scale(w / 2, h / 2);
    const g = t.createRadialGradient(0, 0, 0.55, 0, 0, 1);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    t.fillStyle = g;
    t.fillRect(-1, -1, 2, 2);
  } else if (bw > 0 && p.border) {
    framePath(t, p.shape, bw / 2, bw / 2, w - bw, h - bw);
    t.lineWidth = bw;
    t.strokeStyle = p.border.color;
    t.stroke();
  }
  return { tile, srcWidth: src.w };
}

function photoAspect(img: HTMLImageElement, shape: PhotoRecipe['shape']) {
  const a = img.naturalWidth / img.naturalHeight;
  if (shape === 'circle') return 1;
  if (shape === 'arch') return 0.8;
  if (shape === 'plain') return a;
  return Math.min(1.33, Math.max(0.75, a));
}

function drawPhotos(ctx: Ctx, W: number, H: number, r: DesignRecipe, img: HTMLImageElement): number {
  const p = r.photo;
  const inchesPerPx = WRAP.widthIn / W;

  if (r.layout === 'full-wrap') {
    const src = coverCrop(img, W / H, p);
    ctx.drawImage(img, src.x, src.y, src.w, src.h, 0, 0, W, H);
    // A photo's left and right edges never match, so fade both into the
    // same background colour at the seam.
    const c = r.background.colors[0];
    const fade = W * 0.07;
    const left = ctx.createLinearGradient(0, 0, fade, 0);
    left.addColorStop(0, c);
    left.addColorStop(1, withAlpha(c, 0));
    ctx.fillStyle = left;
    ctx.fillRect(0, 0, fade, H);
    const right = ctx.createLinearGradient(W, 0, W - fade, 0);
    right.addColorStop(0, c);
    right.addColorStop(1, withAlpha(c, 0));
    ctx.fillStyle = right;
    ctx.fillRect(W - fade, 0, fade, H);
    return src.w / WRAP.widthIn;
  }

  const aspect = photoAspect(img, p.shape);
  let boxH = p.size * H;
  let boxW = boxH * aspect;
  // Only about a third of the wrap faces you at once; wider than that bends out of view.
  const maxW =
    r.layout === 'pattern' ? (W / p.repeatCount) * 0.82 : r.layout === 'two-sides' ? W * 0.34 : W * 0.4;
  if (boxW > maxW) {
    boxH *= maxW / boxW;
    boxW = maxW;
  }

  const positions: [number, number][] = [];
  if (r.layout === 'pattern') {
    // Leave the text strip free so the banner doesn't cover a row of photos.
    const top = r.text?.position === 'top' ? H * 0.25 : 0;
    const bottom = r.text?.position === 'bottom' ? H * 0.75 : H;
    const areaH = bottom - top;
    if (boxH > areaH * 0.9) {
      boxW *= (areaH * 0.9) / boxH;
      boxH = areaH * 0.9;
    }
    const cols = p.repeatCount;
    const rows = Math.max(1, Math.round(areaH / (boxH * 1.2)));
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++)
        positions.push([(col + 0.5 + (row % 2) * 0.5) * (W / cols), top + ((row + 0.5) * areaH) / rows]);
  } else {
    const y = Math.min(H - boxH / 2 - H * 0.03, Math.max(boxH / 2 + H * 0.03, H / 2 + p.offsetY * H));
    const xs = r.layout === 'two-sides' ? [W / 4, (3 * W) / 4] : [W / 2];
    xs.forEach((x) => positions.push([x, y]));
  }

  const { tile, srcWidth } = makePhotoTile(img, p, boxW, boxH, H);
  ctx.save();
  if (p.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = H * 0.025;
    ctx.shadowOffsetY = H * 0.008;
  }
  for (const [x, y] of positions) {
    wrapped(W, x, boxW / 2, (xx) => ctx.drawImage(tile, xx - boxW / 2, y - boxH / 2, boxW, boxH));
  }
  ctx.restore();
  return srcWidth / (boxW * inchesPerPx);
}

// ---------------------------------------------------------------------- text

function drawText(ctx: Ctx, W: number, H: number, r: DesignRecipe, t: TextRecipe) {
  const anchors = r.layout === 'two-sides' ? [W / 4, (3 * W) / 4] : [W / 2];
  const maxW = (anchors.length === 2 ? 0.3 : 0.36) * W;
  let size = t.size * H;
  ctx.font = fontCss(t.font, size);
  const measured = ctx.measureText(t.content).width;
  if (measured > maxW) {
    size *= maxW / measured;
    ctx.font = fontCss(t.font, size);
  }
  const y = t.position === 'top' ? H * 0.13 : H * 0.87;

  if (t.band) {
    ctx.fillStyle = t.band;
    ctx.fillRect(0, y - size * 0.85, W, size * 1.7);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const x of anchors) {
    if (t.outline) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.14;
      ctx.strokeStyle = t.outline;
      ctx.strokeText(t.content, x, y);
    }
    ctx.fillStyle = t.color;
    ctx.fillText(t.content, x, y);
  }
}
