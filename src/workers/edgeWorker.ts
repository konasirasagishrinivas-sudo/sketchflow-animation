/**
 * Sobel edge-detection in a Web Worker.
 * Receives ImageBitmap frames, returns PNG Blobs (sketch outlines).
 *
 * Message in: { id: number, bitmap: ImageBitmap, style: "thin"|"thick"|"sketchy" }
 * Message out: { id, blob: Blob }
 */
/// <reference lib="webworker" />

interface InMsg {
  id: number;
  bitmap: ImageBitmap;
  style: "thin" | "thick" | "sketchy";
  width: number;
  height: number;
}

self.onmessage = async (e: MessageEvent<InMsg>) => {
  const { id, bitmap, style, width, height } = e.data;
  const blob = await sobel(bitmap, width, height, style);
  bitmap.close();
  (self as any).postMessage({ id, blob });
};

async function sobel(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  style: "thin" | "thick" | "sketchy",
): Promise<Blob> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  const src = ctx.getImageData(0, 0, width, height);
  const dst = ctx.createImageData(width, height);

  // Grayscale
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; i < src.data.length; i += 4, j++) {
    gray[j] = (src.data[i] * 0.299 + src.data[i + 1] * 0.587 + src.data[i + 2] * 0.114) | 0;
  }

  // Sobel kernels
  const gxK = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const gyK = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  const threshold = style === "thin" ? 110 : style === "thick" ? 70 : 90;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0, k = 0;
      for (let yy = -1; yy <= 1; yy++) {
        for (let xx = -1; xx <= 1; xx++) {
          const v = gray[(y + yy) * width + (x + xx)];
          gx += gxK[k] * v;
          gy += gyK[k] * v;
          k++;
        }
      }
      let mag = Math.sqrt(gx * gx + gy * gy);
      if (style === "sketchy") {
        // Add a touch of jitter for hand-drawn feel
        mag += (Math.random() - 0.5) * 30;
      }
      const idx = (y * width + x) * 4;
      const isEdge = mag > threshold;
      const v = isEdge ? 0 : 255;
      dst.data[idx] = v;
      dst.data[idx + 1] = v;
      dst.data[idx + 2] = v;
      dst.data[idx + 3] = 255;
    }
  }

  // White margin
  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      const i = (y * width + x) * 4;
      dst.data[i] = dst.data[i + 1] = dst.data[i + 2] = 255;
      dst.data[i + 3] = 255;
    }
  }
  for (let y = 0; y < height; y++) {
    for (const x of [0, width - 1]) {
      const i = (y * width + x) * 4;
      dst.data[i] = dst.data[i + 1] = dst.data[i + 2] = 255;
      dst.data[i + 3] = 255;
    }
  }

  ctx.putImageData(dst, 0, 0);

  // Thickening pass for thick style
  if (style === "thick") {
    ctx.filter = "blur(0.6px) contrast(1.4)";
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = "none";
  }

  return await canvas.convertToBlob({ type: "image/png" });
}

export {};
