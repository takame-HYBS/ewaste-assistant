import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { query } from '../db/pool.js';

// Photo paths are stored relative to the upload dir; resolve and confirm they stay inside it.
export function photoFullPath(relative) {
  const full = path.resolve(config.uploadDir, relative);
  if (!full.startsWith(path.resolve(config.uploadDir) + path.sep)) throw new Error('Invalid photo path');
  return full;
}

export async function removePhotoFile(relative) {
  if (!relative) return;
  try {
    await unlink(photoFullPath(relative));
  } catch {
    /* already gone */
  }
}

export async function deleteAssessmentPhotos(deviceId) {
  const { rows } = await query('SELECT photo_path FROM assessments WHERE device_id = $1 AND photo_path IS NOT NULL', [deviceId]);
  await Promise.all(rows.map((r) => removePhotoFile(r.photo_path)));
}

// Lightweight content sniffing so a renamed file can't masquerade as an image.
export function sniffImageType(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}
