/**
 * Smart Client-Side Background Removal Engine
 * 
 * Provides fast, 100% in-browser background removal for stickers and overlay images:
 * 1. Smart Edge/Perimeter BFS Flood-Fill (preserves internal details like white shirts, eyes, teeth)
 * 2. Color keying (White, Black, Green screen, or custom eyedropper color)
 * 3. Adjustable tolerance & edge feathering (anti-aliasing)
 * 4. Zero external server dependencies or API costs
 */

export interface BackgroundRemovalOptions {
  mode?: 'auto' | 'white' | 'black' | 'green' | 'custom';
  targetColorHex?: string; // e.g. '#ffffff'
  customRgb?: { r: number; g: number; b: number };
  tolerance?: number; // 1 - 100 (percentage, default ~25)
  feather?: number; // 0 - 20 (pixel feathering / softness, default ~3)
  contiguousOnly?: boolean; // true = flood fill from edges only; false = remove color everywhere in image
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace(/^#/, '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return { r: 255, g: 255, b: 255 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function colorDistance(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number
): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Samples image perimeter (corners and outer border) to detect dominant background color
 */
export function detectBorderBackgroundColor(
  data: Uint8ClampedArray,
  width: number,
  height: number
): { r: number; g: number; b: number } {
  const samples: { r: number; g: number; b: number }[] = [];
  const step = Math.max(1, Math.floor(Math.min(width, height) / 40));

  // Sample top & bottom rows
  for (let x = 0; x < width; x += step) {
    const topIdx = (0 * width + x) * 4;
    if (data[topIdx + 3] > 30) {
      samples.push({ r: data[topIdx], g: data[topIdx + 1], b: data[topIdx + 2] });
    }
    const btmIdx = ((height - 1) * width + x) * 4;
    if (data[btmIdx + 3] > 30) {
      samples.push({ r: data[btmIdx], g: data[btmIdx + 1], b: data[btmIdx + 2] });
    }
  }

  // Sample left & right columns
  for (let y = 0; y < height; y += step) {
    const leftIdx = (y * width + 0) * 4;
    if (data[leftIdx + 3] > 30) {
      samples.push({ r: data[leftIdx], g: data[leftIdx + 1], b: data[leftIdx + 2] });
    }
    const rightIdx = (y * width + (width - 1)) * 4;
    if (data[rightIdx + 3] > 30) {
      samples.push({ r: data[rightIdx], g: data[rightIdx + 1], b: data[rightIdx + 2] });
    }
  }

  if (samples.length === 0) {
    return { r: 255, g: 255, b: 255 }; // Default white
  }

  let sumR = 0, sumG = 0, sumB = 0;
  for (const s of samples) {
    sumR += s.r;
    sumG += s.g;
    sumB += s.b;
  }
  return {
    r: Math.round(sumR / samples.length),
    g: Math.round(sumG / samples.length),
    b: Math.round(sumB / samples.length),
  };
}

/**
 * Loads an image from URL or data URL, handling CORS if possible
 */
export async function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = async () => {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          const retryImg = new Image();
          retryImg.onload = () => resolve(retryImg);
          retryImg.onerror = () => reject(new Error('Failed to load image for background removal'));
          retryImg.src = blobUrl;
          return;
        } catch {
          reject(new Error('Failed to load image due to CORS restrictions. Please upload the image directly.'));
          return;
        }
      }
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

/**
 * Removes background from image and returns a transparent PNG Data URL
 */
export async function removeImageBackground(
  imageUrl: string,
  options: BackgroundRemovalOptions = {}
): Promise<string> {
  const {
    mode = 'auto',
    targetColorHex,
    customRgb,
    tolerance = 25,
    feather = 3,
    contiguousOnly = true,
  } = options;

  const img = await loadImageElement(imageUrl);

  const canvas = document.createElement('canvas');
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  ctx.drawImage(img, 0, 0, width, height);

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const totalPixels = width * height;

  // Determine target background color
  let targetR = 255;
  let targetG = 255;
  let targetB = 255;

  if (mode === 'white') {
    targetR = 255; targetG = 255; targetB = 255;
  } else if (mode === 'black') {
    targetR = 0; targetG = 0; targetB = 0;
  } else if (mode === 'green') {
    targetR = 0; targetG = 255; targetB = 0;
  } else if (mode === 'custom') {
    if (customRgb) {
      targetR = customRgb.r; targetG = customRgb.g; targetB = customRgb.b;
    } else if (targetColorHex) {
      const rgb = hexToRgb(targetColorHex);
      targetR = rgb.r; targetG = rgb.g; targetB = rgb.b;
    }
  } else {
    // 'auto' mode: auto-detect from perimeter
    const detected = detectBorderBackgroundColor(data, width, height);
    targetR = detected.r; targetG = detected.g; targetB = detected.b;
  }

  // Calculate distance thresholds
  const maxDistance = Math.sqrt(255 * 255 * 3); // ~441.67
  const tolDistance = (Math.max(1, Math.min(100, tolerance)) / 100) * maxDistance;
  const featherDist = (Math.max(0, Math.min(30, feather)) / 100) * maxDistance * 0.4;
  const hardCutoff = Math.max(0, tolDistance - featherDist);

  if (contiguousOnly) {
    // Smart BFS Flood-Fill from all 4 borders
    const isBg = new Uint8Array(totalPixels);
    const queue = new Int32Array(totalPixels);
    let queueStart = 0;
    let queueEnd = 0;

    const pushPixel = (x: number, y: number) => {
      const idx = y * width + x;
      if (isBg[idx] === 1) return;
      const pIdx = idx * 4;
      // If already transparent, mark as bg and propagate
      if (data[pIdx + 3] < 20) {
        isBg[idx] = 1;
        queue[queueEnd++] = idx;
        return;
      }
      const dist = colorDistance(data[pIdx], data[pIdx + 1], data[pIdx + 2], targetR, targetG, targetB);
      if (dist <= tolDistance) {
        isBg[idx] = 1;
        queue[queueEnd++] = idx;
      }
    };

    // Push top and bottom edges
    for (let x = 0; x < width; x++) {
      pushPixel(x, 0);
      pushPixel(x, height - 1);
    }
    // Push left and right edges
    for (let y = 0; y < height; y++) {
      pushPixel(0, y);
      pushPixel(width - 1, y);
    }

    // BFS Expansion
    while (queueStart < queueEnd) {
      const currIdx = queue[queueStart++];
      const cx = currIdx % width;
      const cy = Math.floor(currIdx / width);

      const neighbors = [
        cx > 0 ? currIdx - 1 : -1,
        cx < width - 1 ? currIdx + 1 : -1,
        cy > 0 ? currIdx - width : -1,
        cy < height - 1 ? currIdx + width : -1,
      ];

      for (let i = 0; i < 4; i++) {
        const nIdx = neighbors[i];
        if (nIdx < 0 || isBg[nIdx] === 1) continue;

        const npIdx = nIdx * 4;
        if (data[npIdx + 3] < 20) {
          isBg[nIdx] = 1;
          queue[queueEnd++] = nIdx;
          continue;
        }

        const dist = colorDistance(data[npIdx], data[npIdx + 1], data[npIdx + 2], targetR, targetG, targetB);
        if (dist <= tolDistance) {
          isBg[nIdx] = 1;
          queue[queueEnd++] = nIdx;
        }
      }
    }

    // Apply transparency and feathering
    for (let i = 0; i < totalPixels; i++) {
      if (isBg[i] === 1) {
        const pIdx = i * 4;
        const dist = colorDistance(data[pIdx], data[pIdx + 1], data[pIdx + 2], targetR, targetG, targetB);
        
        if (featherDist > 0 && dist > hardCutoff) {
          const ratio = (dist - hardCutoff) / featherDist;
          const targetAlpha = Math.min(255, Math.max(0, Math.round(ratio * 255)));
          data[pIdx + 3] = Math.min(data[pIdx + 3], targetAlpha);
        } else {
          data[pIdx + 3] = 0;
        }
      }
    }
  } else {
    // Global color removal
    for (let i = 0; i < totalPixels; i++) {
      const pIdx = i * 4;
      if (data[pIdx + 3] < 10) continue;

      const dist = colorDistance(data[pIdx], data[pIdx + 1], data[pIdx + 2], targetR, targetG, targetB);
      if (dist <= hardCutoff) {
        data[pIdx + 3] = 0;
      } else if (dist <= tolDistance && featherDist > 0) {
        const ratio = (dist - hardCutoff) / featherDist;
        const targetAlpha = Math.min(255, Math.max(0, Math.round(ratio * 255)));
        data[pIdx + 3] = Math.min(data[pIdx + 3], targetAlpha);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}
