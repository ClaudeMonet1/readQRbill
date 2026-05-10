// iOS Safari has a hard cap (~30-80 MB depending on device) on decoded image
// bitmap memory per page. Showing two camera-resolution photos as <img> blows
// past it and the images render as blank boxes. Use this to produce small
// JPEG thumbnails for display only — keep the original blob for anything that
// needs full resolution.
export async function downscaleBlob(
  blob: Blob,
  maxDim: number,
  quality = 0.85,
): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) return blob;

    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
        'image/jpeg',
        quality,
      );
    });
  } finally {
    bitmap.close();
  }
}
