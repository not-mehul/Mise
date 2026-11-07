// ============================================================
// Text in photos, read on the phone by ML Kit (TextRecognitionPlugin.java).
// The web build has no recogniser; it says so and offers paste instead.
// ============================================================

import { registerPlugin } from '@capacitor/core';
import { bytesToBase64 } from '../lib/base64';
import type { TextBlock } from '../import/photo';
import { isNative } from './output';

interface Recognised {
  width: number;
  height: number;
  blocks: TextBlock[];
}

interface TextRecognitionPlugin {
  read(options: { image: string }): Promise<Recognised>;
}

const TextRecognition = registerPlugin<TextRecognitionPlugin>('TextRecognition');

export const canReadPhotos = isNative;

/** Large enough for small print, small enough to pass to the recogniser quickly. */
const OCR_SIDE = 2000;

/** The photo as an upright JPEG, base64, no longer than OCR_SIDE. */
async function upright(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, OCR_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
    return bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
  } finally {
    bitmap.close();
  }
}

export async function recognise(file: Blob): Promise<Recognised> {
  return TextRecognition.read({ image: await upright(file) });
}
