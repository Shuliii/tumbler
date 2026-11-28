import { analyzePhoto } from './color';

export interface UploadedImage {
  /** The ORIGINAL, full-resolution image. Used for printing; never altered. */
  el: HTMLImageElement;
  url: string;
  name: string;
  file: File;
  width: number;
  height: number;
  palette: string[];
  hasTransparency: boolean;
  /** A small copy (max 1024 px) that is sent to the AI so it can see the photo. The original never leaves the browser. */
  ai: { mediaType: 'image/jpeg' | 'image/png'; data: string };
}

const MAX_BYTES = 25 * 1024 * 1024;
const AI_MAX_EDGE = 1024;

function aiCopy(el: HTMLImageElement, hasTransparency: boolean): UploadedImage['ai'] {
  const scale = Math.min(1, AI_MAX_EDGE / Math.max(el.naturalWidth, el.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(el.naturalWidth * scale));
  c.height = Math.max(1, Math.round(el.naturalHeight * scale));
  c.getContext('2d')!.drawImage(el, 0, 0, c.width, c.height);
  // Keep PNG for logos so the AI can see the transparent background; JPEG is much smaller for photos.
  const mediaType = hasTransparency ? 'image/png' : 'image/jpeg';
  const dataUrl = c.toDataURL(mediaType, 0.85);
  return { mediaType, data: dataUrl.slice(dataUrl.indexOf(',') + 1) };
}

export async function loadUploadedImage(file: File): Promise<UploadedImage> {
  if (/hei[cf]$/i.test(file.name) || /hei[cf]/i.test(file.type)) {
    throw new Error('iPhone HEIC photos aren’t supported yet. Please send it as a JPG or PNG (on iPhone: Settings → Camera → Formats → Most Compatible).');
  }
  if (!file.type.startsWith('image/')) throw new Error('That doesn’t look like an image. Please upload a JPG or PNG.');
  if (file.size > MAX_BYTES) throw new Error('That image is over 25 MB. Please upload a smaller version.');

  const url = URL.createObjectURL(file);
  const el = new Image();
  el.src = url;
  try {
    await el.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('Couldn’t read that image. Please try a JPG or PNG.');
  }
  const { palette, hasTransparency } = analyzePhoto(el);
  return {
    el,
    url,
    name: file.name,
    file,
    width: el.naturalWidth,
    height: el.naturalHeight,
    palette,
    hasTransparency,
    ai: aiCopy(el, hasTransparency),
  };
}
