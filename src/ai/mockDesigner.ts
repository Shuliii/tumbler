/**
 * MOCK AI. Pretends to be Claude so the frontend can be demoed without a
 * backend. It reads simple keywords ("pattern", "hearts", "add text ...",
 * "pink") and edits the current recipe. The real AI will understand far more,
 * but must return the same DesignRecipe shape.
 */
import { DesignRecipe, FontId, FONT_IDS, Layout, PatternShape, PhotoShape, normalizeRecipe } from '../recipe';
import { darken, lighten, luminance, readableOn, saturation } from '../color';
import type { DesignRequest, DesignResponse } from './designer';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const COLOR_WORDS: [RegExp, string][] = [
  [/\b(light|baby|sky) blue\b/, '#9cd3f2'],
  [/\bnavy( blue)?\b/, '#1f3a68'],
  [/\bhot pink\b/, '#e8458b'],
  [/\bpink\b/, '#f4a6c1'],
  [/\bred\b/, '#d94141'],
  [/\borange\b/, '#f39a4a'],
  [/\byellow\b/, '#f6d55c'],
  [/\bgold(en)?\b/, '#d4a73a'],
  [/\bmint\b/, '#a8e6cf'],
  [/\bgreen\b/, '#5fae6e'],
  [/\bteal\b/, '#2a9d8f'],
  [/\bblue\b/, '#3b7dd8'],
  [/\b(lavender|lilac)\b/, '#c8b6e2'],
  [/\bpurple\b/, '#7b4fb0'],
  [/\bblack\b/, '#1d1d1f'],
  [/\bwhite\b/, '#ffffff'],
  [/\b(grey|gray)\b/, '#9aa0a6'],
  [/\b(cream|beige)\b/, '#f3e9d2'],
  [/\bbrown\b/, '#8b5e3c'],
];

const SHAPE_WORDS: [RegExp, PatternShape][] = [
  [/\bhearts?\b/, 'hearts'],
  [/\bstars?\b/, 'stars'],
  [/\b(dots|polka|spots)\b/, 'dots'],
  [/\b(paws?|paw prints?)\b/, 'paws'],
  [/\bconfetti\b/, 'confetti'],
  [/\b(stripes?|striped)\b/, 'stripes'],
  [/\b(waves?|wavy)\b/, 'waves'],
];

const FONT_WORDS: [RegExp, FontId][] = [
  [/\b(script|cursive|fancy|handwriting)\b/, 'pacifico'],
  [/\b(bold|sport|sporty|strong|block|caps)\b/, 'bebas'],
  [/\b(elegant|classy|wedding|serif|classic)\b/, 'playfair'],
  [/\b(cute|fun|playful|kids?|rounded font)\b/, 'baloo'],
  [/\b(marker|hand[- ]?drawn|grunge|messy)\b/, 'marker'],
];

const LAYOUT_LABEL: Record<Layout, string> = {
  centered: 'Centred photo',
  pattern: 'Photo pattern',
  'two-sides': 'Front & back',
  'full-wrap': 'Full wrap',
};

const TIPS = [
  'Try “make it a repeating pattern”, “add hearts” or “photo on both sides”.',
  'You can add a name or message, e.g. add text "Best Dog Mom".',
  'Want different colours? Try “pastel pink and mint” or “darker”.',
  'Try a photo shape: “circle”, “arch” or “soft edges”.',
  'Say “surprise me” for a completely different idea.',
];

/** The most colourful palette colour makes the best accent. */
function accentOf(palette: string[]) {
  return [...palette].sort((a, b) => saturation(b) - saturation(a))[0] ?? '#888888';
}

function patternColorFor(bg: string, accent: string) {
  return luminance(bg) > 0.6 ? accent : '#ffffff';
}

function firstDesign(req: DesignRequest): { recipe: DesignRecipe; reply: string } {
  const p = req.image.palette;
  const accent = accentOf(p);
  const second = p.find((c) => c !== accent) ?? accent;

  if (req.image.hasTransparency) {
    const bg = lighten(accent, 0.85);
    return {
      recipe: normalizeRecipe({
        title: 'Logo on the front',
        layout: 'centered',
        background: { style: 'solid', colors: [bg] },
        pattern: { shape: 'none', color: accent, opacity: 0.2, size: 1 },
        photo: { shape: 'plain', size: 0.55, offsetY: 0, zoom: 1, border: null, shadow: false, repeatCount: 5 },
        text: null,
      }),
      reply:
        'That looks like a logo with a transparent background, so I kept it uncropped and placed it on the front over a clean tint of its main colour.\n\nTry “make it a repeating pattern” or add a slogan, e.g. add text "Since 2019".',
    };
  }

  const top = lighten(accent, 0.72);
  const bottom = lighten(second, 0.35);
  return {
    recipe: normalizeRecipe({
      title: 'Soft gradient portrait',
      layout: 'centered',
      background: { style: 'vertical-gradient', colors: [top, bottom] },
      pattern: { shape: 'dots', color: '#ffffff', opacity: 0.35, size: 0.8 },
      photo: { shape: 'rounded', size: 0.7, offsetY: 0, focusX: 0.5, focusY: 0.42, zoom: 1, border: { color: '#ffffff', width: 0.012 }, shadow: true, repeatCount: 5 },
      text: null,
    }),
    reply:
      'Great photo! I picked colours from it and made a first design: your photo centred on the front, a soft gradient in the photo’s own colours, and a light dot pattern.\n\nWhat’s it for? A gift, a pet, a business? You can ask for things like:\n• add text "Best Dog Mom"\n• make it a repeating pattern\n• pink with hearts\n• photo on both sides',
  };
}

let surpriseIndex = 0;

function surprise(cur: DesignRecipe, palette: string[]): { recipe: DesignRecipe; change: string } {
  const accent = accentOf(palette);
  const second = palette.find((c) => c !== accent) ?? accent;
  const r = structuredClone(cur);
  const options: (() => string)[] = [
    () => {
      r.layout = 'pattern';
      r.photo = { ...r.photo, shape: 'circle', size: 0.3, repeatCount: 5, border: { color: '#ffffff', width: 0.008 }, shadow: false };
      r.background = { style: 'solid', colors: [lighten(accent, 0.8)] };
      r.pattern = { shape: 'hearts', color: accent, opacity: 0.25, size: 0.6 };
      return 'made a playful repeating pattern of circle photos with little hearts';
    },
    () => {
      r.layout = 'two-sides';
      r.photo = { ...r.photo, shape: 'arch', size: 0.62, border: { color: '#ffffff', width: 0.01 }, shadow: true };
      r.background = { style: 'vertical-gradient', colors: [lighten(second, 0.6), lighten(accent, 0.3)] };
      r.pattern = { shape: 'waves', color: '#ffffff', opacity: 0.35, size: 1 };
      return 'put an arch-shaped photo on both sides with gentle waves behind';
    },
    () => {
      r.layout = 'full-wrap';
      r.photo = { ...r.photo, zoom: 1 };
      r.background = { style: 'solid', colors: [darken(accent, 0.2)] };
      r.pattern = { ...r.pattern, shape: 'none' };
      if (r.text) r.text = { ...r.text, band: '#ffffff', color: darken(accent, 0.35), position: 'bottom' };
      return 'made the photo cover the whole tumbler, fading softly at the seam';
    },
    () => {
      r.layout = 'centered';
      r.photo = { ...r.photo, shape: 'circle', size: 0.62, border: { color: lighten(accent, 0.6), width: 0.016 }, shadow: true };
      r.background = { style: 'horizontal-gradient', colors: [darken(second, 0.25), accent] };
      r.pattern = { shape: 'stars', color: '#ffffff', opacity: 0.4, size: 0.8 };
      return 'went bolder: a circle photo with a ring, a colour sweep around the cup and stars';
    },
  ];
  const change = options[surpriseIndex++ % options.length]();
  r.title = LAYOUT_LABEL[r.layout];
  return { recipe: r, change };
}

/** Pull the text the customer wants printed, e.g. add text "Best Mom". */
function extractText(msg: string): { text: string | null; rest: string } {
  const quoted = msg.match(/["“”]([^"“”]{1,40})["“”]/);
  if (quoted) return { text: quoted[1].trim(), rest: msg.replace(quoted[0], ' ') };
  const plain = msg.match(/\b(?:add (?:the )?(?:text|words|name|message)|write|that says|saying)\s*[:\-]?\s+(.{1,40})$/i);
  if (plain) return { text: plain[1].trim().replace(/[.!]+$/, ''), rest: msg.replace(plain[0], ' ') };
  return { text: null, rest: msg };
}

function placePhotoForText(r: DesignRecipe) {
  if (r.layout === 'pattern' || r.layout === 'full-wrap') {
    if (r.text && !r.text.band) {
      r.text.band = lighten(r.background.colors[0], 0.7);
      r.text.color = readableOn(r.text.band);
    }
    return;
  }
  if (!r.text) {
    r.photo.offsetY = 0;
    return;
  }
  r.photo.size = Math.min(r.photo.size, 0.62);
  r.photo.offsetY = r.text.position === 'bottom' ? -0.08 : 0.08;
}

function interpret(message: string, cur: DesignRecipe, palette: string[]) {
  const r = structuredClone(cur);
  const changes: string[] = [];
  const { text, rest } = extractText(message);
  const m = ' ' + rest.toLowerCase() + ' ';
  const accent = accentOf(palette);
  const has = (re: RegExp) => re.test(m);

  // --- layout
  const shapeMentioned = SHAPE_WORDS.some(([re]) => re.test(m));
  let layout: Layout | null = null;
  if (has(/\b(repeat|repeating|repeated|tile|tiled|all over|collage)\b/) || (has(/\bpattern\b/) && !shapeMentioned && !has(/\bno pattern\b/)))
    layout = 'pattern';
  else if (has(/\b(two|both) sides?\b|\bfront and back\b|\btwice\b/)) layout = 'two-sides';
  else if (has(/\bfull[- ]?wrap\b|\bwhole (cup|tumbler)\b|\bedge to edge\b|\ball the way around\b|\bcover\b/)) layout = 'full-wrap';
  else if (has(/\b(cent(er|re)d?|single|just one|only once)\b/)) layout = 'centered';
  if (layout && layout !== r.layout) {
    r.layout = layout;
    if (layout === 'pattern') {
      r.photo.size = 0.3;
      r.photo.repeatCount = 5;
      if (r.photo.shape === 'soft') r.photo.shape = 'circle';
    }
    if (layout === 'two-sides') r.photo.size = 0.62;
    if (layout === 'centered') r.photo.size = 0.7;
    changes.push(
      {
        pattern: 'turned your photo into a repeating pattern',
        'two-sides': 'put the photo on both sides',
        'full-wrap': 'made the photo wrap the whole tumbler',
        centered: 'went back to one photo on the front',
      }[layout],
    );
  }

  // --- text
  if (has(/\b(no|remove|without|delete|drop)( the)? (text|words|name|writing)\b/)) {
    if (r.text) changes.push('removed the text');
    r.text = null;
  } else if (text) {
    const bg = r.background.colors[0];
    r.text = r.text
      ? { ...r.text, content: text }
      : { content: text, font: 'pacifico', color: readableOn(bg), outline: null, position: 'bottom', size: 0.11, band: null };
    changes.push(`added the text “${text}”`);
  }
  if (r.text) {
    if (has(/\btop\b/) && r.text.position !== 'top') {
      r.text.position = 'top';
      changes.push('moved the text to the top');
    } else if (has(/\bbottom\b/) && r.text.position !== 'bottom') {
      r.text.position = 'bottom';
      changes.push('moved the text to the bottom');
    }
    const font = FONT_WORDS.find(([re]) => re.test(m))?.[1];
    if (font && font !== r.text.font) {
      r.text.font = font;
      changes.push('changed the font');
    } else if (has(/\b(different|another|new|change( the)?) font\b/)) {
      r.text.font = FONT_IDS[(FONT_IDS.indexOf(r.text.font) + 1) % FONT_IDS.length];
      changes.push('tried a different font');
    }
    if (has(/\b(no|remove)( the)? (banner|band|ribbon)\b/)) {
      r.text.band = null;
      r.text.color = readableOn(r.background.colors[0]);
      changes.push('removed the banner');
    } else if (has(/\b(banner|band|ribbon)\b/)) {
      r.text.band = darken(accent, 0.1);
      r.text.color = readableOn(r.text.band);
      changes.push('put the text on a banner');
    }
    if (has(/\boutline\b/)) {
      r.text.outline = r.text.outline ? null : readableOn(r.text.color) === '#ffffff' ? '#2b2b2b' : '#ffffff';
      changes.push(r.text.outline ? 'outlined the text' : 'removed the outline');
    }
    if (has(/\b(bigger|larger) (text|font|writing)\b/)) {
      r.text.size = Math.min(0.16, r.text.size * 1.2);
      changes.push('made the text bigger');
    } else if (has(/\bsmaller (text|font|writing)\b/)) {
      r.text.size = Math.max(0.05, r.text.size * 0.83);
      changes.push('made the text smaller');
    }
  }

  // --- colours (for the text if they mention text/font, otherwise the background)
  const found: { at: number; hex: string }[] = [];
  let scan = m;
  for (const [re, hex] of COLOR_WORDS) {
    const hit = scan.match(re);
    if (hit && hit.index !== undefined) {
      found.push({ at: hit.index, hex });
      scan = scan.replace(re, ' '.repeat(hit[0].length));
    }
  }
  const colors = found.sort((a, b) => a.at - b.at).map((f) => f.hex);
  let bgChanged = false;
  if (colors.length && r.text && has(/\b(text|font|letters|writing|words)\b/) && !text) {
    r.text.color = colors[0];
    changes.push('recoloured the text');
  } else if (colors.length) {
    if (colors.length === 1) {
      const c = colors[0];
      r.background = luminance(c) > 0.85 ? { style: 'solid', colors: [c] } : { style: 'vertical-gradient', colors: [lighten(c, 0.45), c] };
    } else {
      r.background = { style: r.background.style === 'solid' ? 'vertical-gradient' : r.background.style, colors: colors.slice(0, 3) };
    }
    bgChanged = true;
    changes.push('changed the background colours');
  }
  if (has(/\b(from|match|matching) (the |my )?(photo|picture|image)\b/)) {
    r.background = { style: 'vertical-gradient', colors: [lighten(accent, 0.7), lighten(palette[1] ?? accent, 0.3)] };
    bgChanged = true;
    changes.push('matched the colours to your photo');
  }
  if (has(/\b(pastel|softer|lighter|brighter)\b/)) {
    r.background.colors = r.background.colors.map((c) => lighten(c, 0.4));
    bgChanged = true;
    changes.push('softened the colours');
  } else if (has(/\b(dark|darker|deeper|night|moody)\b/)) {
    r.background.colors = r.background.colors.map((c) => darken(c, 0.35));
    bgChanged = true;
    changes.push('made it darker');
  }
  if (has(/\bsolid\b/) && r.background.style !== 'solid') {
    r.background.style = 'solid';
    bgChanged = true;
    changes.push('used a solid background');
  } else if (has(/\bgradient\b/) && r.background.style === 'solid') {
    r.background = { style: 'vertical-gradient', colors: [r.background.colors[0], darken(r.background.colors[0], 0.25)] };
    bgChanged = true;
    changes.push('added a gradient');
  } else if (has(/\b(around|sideways|horizontal)\b/) && r.background.colors.length > 1) {
    r.background.style = 'horizontal-gradient';
    bgChanged = true;
    changes.push('made the colours sweep around the cup');
  }
  if (bgChanged) {
    r.pattern.color = patternColorFor(r.background.colors[0], accent);
    if (r.text && !r.text.band && !changes.includes('recoloured the text')) r.text.color = readableOn(r.background.colors[0]);
  }

  // --- background pattern
  if (has(/\b(no|remove|without|plain)( the)? (pattern|shapes|background pattern|background)\b|\bplain\b/)) {
    if (r.pattern.shape !== 'none') changes.push('removed the background pattern');
    r.pattern.shape = 'none';
  } else {
    const shape = SHAPE_WORDS.find(([re]) => re.test(m))?.[1];
    if (shape) {
      r.pattern = { ...r.pattern, shape, opacity: Math.max(r.pattern.opacity, 0.3), color: patternColorFor(r.background.colors[0], accent) };
      changes.push(`added ${shape === 'paws' ? 'paw prints' : shape}`);
    }
  }
  if (r.pattern.shape !== 'none') {
    if (has(/\b(subtle|fainter|lighter pattern|less busy)\b/)) {
      r.pattern.opacity = Math.max(0.1, r.pattern.opacity * 0.6);
      changes.push('made the pattern more subtle');
    } else if (has(/\b(stronger|more visible|pop)\b/)) {
      r.pattern.opacity = Math.min(0.9, r.pattern.opacity * 1.5);
      changes.push('made the pattern stand out more');
    }
  }

  // --- photo shape & size
  const photoShape: [RegExp, PhotoShape][] = [
    [/\brounded\b/, 'rounded'],
    [/\b(circle|circular|round)\b/, 'circle'],
    [/\b(square|rectangle|sharp corners)\b/, 'rect'],
    [/\barch\b/, 'arch'],
    [/\b(soft|fade|faded|blend|vignette|feather)\b/, 'soft'],
    [/\b(cut ?out|uncropped|no crop|logo)\b/, 'plain'],
  ];
  const ps = photoShape.find(([re]) => re.test(m))?.[1];
  if (ps && ps !== r.photo.shape && r.layout !== 'full-wrap') {
    r.photo.shape = ps;
    changes.push(ps === 'soft' ? 'gave the photo soft, faded edges' : ps === 'plain' ? 'showed the image uncropped' : `made the photo ${ps === 'rect' ? 'square-cornered' : ps === 'circle' ? 'a circle' : ps === 'arch' ? 'an arch' : 'rounded'}`);
  }
  if (has(/\b(no|remove|without)( the)? (border|frame)\b/)) {
    if (r.photo.border) changes.push('removed the border');
    r.photo.border = null;
  } else if (has(/\b(border|frame)\b/) && !r.photo.border) {
    r.photo.border = { color: colors[0] ?? '#ffffff', width: 0.012 };
    changes.push('added a border');
  }
  if (has(/\bno shadow\b/)) {
    r.photo.shadow = false;
    changes.push('removed the shadow');
  } else if (has(/\bshadow\b/)) {
    r.photo.shadow = true;
    changes.push('added a shadow');
  }
  if (r.layout === 'pattern' && has(/\b(more|extra) (photos|copies|pictures)\b/)) {
    r.photo.repeatCount = Math.min(8, r.photo.repeatCount + 1);
    r.photo.size = Math.max(0.18, r.photo.size * 0.88);
    changes.push('added more copies');
  } else if (r.layout === 'pattern' && has(/\b(fewer|less) (photos|copies|pictures)\b/)) {
    r.photo.repeatCount = Math.max(3, r.photo.repeatCount - 1);
    changes.push('used fewer copies');
  }
  if (has(/\b(bigger|larger|enlarge)\b/) && !has(/\b(bigger|larger) (text|font|writing)\b/)) {
    r.photo.size = Math.min(0.95, r.photo.size * 1.15);
    changes.push('made the photo bigger');
  } else if (has(/\bsmaller\b/) && !has(/\bsmaller (text|font|writing)\b/)) {
    r.photo.size = Math.max(0.15, r.photo.size * 0.85);
    changes.push('made the photo smaller');
  }
  if (has(/\b(zoom in|closer|crop in|tighter)\b/)) {
    r.photo.zoom = Math.min(3, r.photo.zoom + 0.35);
    changes.push('zoomed in on the photo');
  } else if (has(/\b(zoom out|show more|less crop|wider)\b/)) {
    r.photo.zoom = Math.max(1, r.photo.zoom - 0.35);
    changes.push('zoomed out');
  }

  if (changes.length) placePhotoForText(r);
  r.title = LAYOUT_LABEL[r.layout];
  return { recipe: r, changes };
}

export async function mockDesign(req: DesignRequest): Promise<DesignResponse> {
  await sleep(650 + Math.random() * 700);

  if (!req.current || !req.message.trim()) {
    const { recipe, reply } = firstDesign(req);
    if (!req.current) return { recipe, reply };
    // They already picked a background (e.g. played with colours before uploading): keep it.
    recipe.background = req.current.background;
    recipe.pattern.color = patternColorFor(recipe.background.colors[0], accentOf(req.image.palette));
    return {
      recipe,
      reply: reply
        .replace('I picked colours from it and made', 'I kept your background colours and made')
        .replace(', a soft gradient in the photo’s own colours, and', ' with'),
    };
  }

  const wantsNew = /\b(surprise|another (idea|design|option)|something (else|different)|new idea|different (design|idea|style)|random)\b/i.test(req.message);
  if (!wantsNew) {
    const { recipe, changes } = interpret(req.message, req.current, req.image.palette);
    if (changes.length) {
      const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
      return { recipe: normalizeRecipe(recipe), reply: `Done! I ${changes.join(', ')}.\n\n${tip}` };
    }
  }

  const { recipe, change } = surprise(req.current, req.image.palette);
  placePhotoForText(recipe);
  const intro = wantsNew ? 'Here’s a different idea:' : 'I’m not sure exactly what to change there (I’m the demo AI, so I only know a few words), so here’s a fresh idea:';
  return { recipe: normalizeRecipe(recipe), reply: `${intro} I ${change}.\n\n${TIPS[surpriseIndex % TIPS.length]}` };
}
