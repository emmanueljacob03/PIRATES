/**
 * Resize and re-encode images in the browser so uploads stay under serverless body limits (e.g. Vercel ~4.5MB).
 */

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image file'));
    };
    img.src = url;
  });
}

export type CompressOptions = {
  /** Longest edge in pixels */
  maxEdge?: number;
  /** Target max file size in bytes */
  maxBytes?: number;
};

/**
 * Returns a JPEG file suitable for upload. Falls back to original file if already small or on failure.
 */
export async function compressImageForUpload(file: File, options?: CompressOptions): Promise<File> {
  const maxEdge = options?.maxEdge ?? 1600;
  const maxBytes = options?.maxBytes ?? 1_600_000; // ~1.6MB — safe under function payload limits

  if (!file.type.startsWith('image/')) return file;
  if (file.size <= maxBytes * 0.85 && file.type === 'image/jpeg') {
    return file;
  }

  let img: HTMLImageElement;
  try {
    img = await loadImageFromFile(file);
  } catch {
    return file;
  }

  let width = img.naturalWidth;
  let height = img.naturalHeight;
  if (width < 1 || height < 1) return file;

  if (width > maxEdge || height > maxEdge) {
    if (width >= height) {
      height = Math.max(1, Math.round((height * maxEdge) / width));
      width = maxEdge;
    } else {
      width = Math.max(1, Math.round((width * maxEdge) / height));
      height = maxEdge;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.88;
  let blob: Blob | null = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
    });
    if (!blob) break;
    if (blob.size <= maxBytes) {
      const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
      return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
    }
    quality = Math.max(0.45, quality - 0.08);
  }

  if (blob && blob.size < file.size) {
    const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  }

  return file;
}
