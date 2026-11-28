/**
 * Where customer photos are kept. Only the PhotoStore interface is used by
 * the rest of the backend, so a local folder (now) can be swapped for S3 /
 * MinIO / Cloudflare R2 later without touching the routes.
 *
 * Photos are personal data: never served publicly, only via the admin API.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;
export type PhotoType = keyof typeof PHOTO_TYPES;

export interface PhotoStore {
  save(bytes: Buffer, type: PhotoType): Promise<string>;
  get(id: string): Promise<{ bytes: Buffer; type: PhotoType } | null>;
  /** Delete photos older than `ageMs` (ordered or not). Returns how many were deleted. */
  deleteOlderThan(ageMs: number): Promise<number>;
}

/** Check the file really is the image type it claims, by its first bytes. */
export function sniffPhotoType(b: Buffer): PhotoType | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

const ID = /^[0-9a-f-]{36}$/;

export class LocalPhotoStore implements PhotoStore {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = path.join(dir, 'photos');
  }

  async save(bytes: Buffer, type: PhotoType) {
    await mkdir(this.dir, { recursive: true });
    const id = randomUUID();
    await writeFile(path.join(this.dir, `${id}.${PHOTO_TYPES[type]}`), bytes);
    return id;
  }

  async get(id: string) {
    if (!ID.test(id)) return null; // ids are UUIDs: also blocks "../" tricks
    for (const [type, ext] of Object.entries(PHOTO_TYPES) as [PhotoType, string][]) {
      try {
        return { bytes: await readFile(path.join(this.dir, `${id}.${ext}`)), type };
      } catch {
        /* try next extension */
      }
    }
    return null;
  }

  async deleteOlderThan(ageMs: number) {
    let names: string[];
    try {
      names = await readdir(this.dir);
    } catch {
      return 0; // no photos folder yet
    }
    const cutoff = Date.now() - ageMs;
    let deleted = 0;
    for (const name of names) {
      const file = path.join(this.dir, name);
      if ((await stat(file)).mtimeMs < cutoff) {
        await unlink(file);
        deleted++;
      }
    }
    return deleted;
  }
}
