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
}

const MAX_BYTES = 25 * 1024 * 1024;

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
  return { el, url, name: file.name, file, width: el.naturalWidth, height: el.naturalHeight, palette, hasTransparency };
}
