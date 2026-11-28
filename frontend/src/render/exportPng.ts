/**
 * Export the print canvas as a PNG tagged as 300 DPI.
 *
 * Browsers save canvas PNGs without a DPI value, so print software assumes
 * 72 DPI and opens the wrap at ~39 inches wide. We insert a standard "pHYs"
 * chunk (physical pixel size) right after the PNG header to fix that.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function withDpi(png: Blob, dpi: number): Promise<Blob> {
  const src = new Uint8Array(await png.arrayBuffer());
  const pxPerMetre = Math.round(dpi / 0.0254);

  // chunk = length(4) + type(4) + data(9) + crc(4)
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  view.setUint32(8, pxPerMetre);
  view.setUint32(12, pxPerMetre);
  chunk[16] = 1; // unit: metre
  view.setUint32(17, crc32(chunk.subarray(4, 17)));

  // PNG signature (8 bytes) + IHDR chunk (25 bytes) = 33; pHYs must come before image data.
  const at = 33;
  return new Blob([src.subarray(0, at), chunk, src.subarray(at)], { type: 'image/png' });
}

export async function downloadPng(canvas: HTMLCanvasElement, filename: string, dpi: number) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not create PNG');
  const url = URL.createObjectURL(await withDpi(blob, dpi));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
