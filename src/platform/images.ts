// Downscales a picked photo to JPEG before it is stored.

export const FULL_SIZE = 1600;
export const THUMB_SIZE = 480;

async function encode(bitmap: ImageBitmap, maxSide: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.convertToBlob({ type: 'image/jpeg', quality });
}

/** A full-size and a thumbnail JPEG, honouring EXIF orientation. */
export async function processPhoto(file: Blob): Promise<{ full: Blob; thumb: Blob }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    return { full: await encode(bitmap, FULL_SIZE, 0.84), thumb: await encode(bitmap, THUMB_SIZE, 0.78) };
  } finally {
    bitmap.close();
  }
}
