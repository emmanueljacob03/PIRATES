/**
 * Upscale + light contrast for scorecard photos so Tesseract reads small decimals (e.g. 3.4 overs).
 * Uses nearest-neighbor integer scale when possible so digit edges stay sharp.
 */

export async function upscaleImageBlobForOcr(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const longEdge = Math.max(bitmap.width, bitmap.height);
    /** Target ~2600px long edge for phone photos of tables (typical ~800–1200px). */
    const TARGET = 2600;
    let scale = longEdge < TARGET ? TARGET / longEdge : 1;
    if (scale > 3.5) scale = 3.5;
    if (scale < 1.02) scale = 1;

    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('canvas 2d unsupported');

    ctx.imageSmoothingEnabled = scale === 1 ? true : scale % 1 !== 0;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);

    const id = ctx.getImageData(0, 0, w, h);
    const d = id.data;
    const c = scale > 1 ? 1.18 : 1.1;
    const intercept = 128 * (1 - c);
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.min(255, Math.max(0, d[i] * c + intercept));
      d[i + 1] = Math.min(255, Math.max(0, d[i + 1] * c + intercept));
      d[i + 2] = Math.min(255, Math.max(0, d[i + 2] * c + intercept));
    }
    ctx.putImageData(id, 0, 0);

    return await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
    });
  } finally {
    bitmap.close();
  }
}
