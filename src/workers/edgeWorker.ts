/**
 * Improved edge detection worker using Gaussian blur + Sobel + morphological dilation.
 * Produces clean, continuous sketch outlines.
 *
 * Message in: { id: number, bitmap: ImageBitmap, style: "thin"|"thick"|"sketchy", width, height }
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
  const blob = await detectEdges(bitmap, width, height, style);
  bitmap.close();
  (self as any).postMessage({ id, blob });
};

/** Box blur approximation of Gaussian — fast and good enough for preprocessing. */
function gaussianBlur(gray: Float32Array, width: number, height: number, radius: number): Float32Array {
  const out = new Float32Array(gray.length);
  const tmp = new Float32Array(gray.length);
  const len = radius * 2 + 1;
  const inv = 1 / len;

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const xx = Math.max(0, Math.min(width - 1, x + k));
        sum += gray[y * width + xx];
      }
      tmp[y * width + x] = sum * inv;
    }
  }
  // Vertical pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const yy = Math.max(0, Math.min(height - 1, y + k));
        sum += tmp[yy * width + x];
      }
      out[y * width + x] = sum * inv;
    }
  }
  return out;
}

/**
 * Dilate binary edge map so thin/broken lines become thicker and connected.
 * radius=1 means 3x3 square structuring element.
 */
function dilate(edges: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const out = new Uint8Array(edges.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let hit = 0;
      outer: for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          if (edges[yy * width + xx]) { hit = 1; break outer; }
        }
      }
      out[y * width + x] = hit;
    }
  }
  return out;
}

/**
 * Non-maximum suppression along gradient direction to thin edges to 1px before
 * dilation. Produces crisper, more accurate edge localization.
 */
function nms(
  mag: Float32Array,
  gx: Float32Array,
  gy: Float32Array,
  width: number,
  height: number,
): Float32Array {
  const out = new Float32Array(mag.length);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const m = mag[idx];
      if (m === 0) continue;
      const angle = Math.atan2(gy[idx], gx[idx]); // -PI..PI
      const deg = ((angle * 180) / Math.PI + 180) % 180; // 0..180

      let n1: number, n2: number;
      if (deg < 22.5 || deg >= 157.5) {
        // Horizontal edge — compare left/right
        n1 = mag[y * width + (x - 1)];
        n2 = mag[y * width + (x + 1)];
      } else if (deg < 67.5) {
        // Diagonal /
        n1 = mag[(y - 1) * width + (x + 1)];
        n2 = mag[(y + 1) * width + (x - 1)];
      } else if (deg < 112.5) {
        // Vertical edge — compare top/bottom
        n1 = mag[(y - 1) * width + x];
        n2 = mag[(y + 1) * width + x];
      } else {
        // Diagonal \
        n1 = mag[(y - 1) * width + (x - 1)];
        n2 = mag[(y + 1) * width + (x + 1)];
      }
      out[idx] = m >= n1 && m >= n2 ? m : 0;
    }
  }
  return out;
}

/**
 * Double-threshold hysteresis to connect strong edges with neighbouring weak edges.
 * Produces continuous contours from the NMS output.
 */
function hysteresis(
  nmsMap: Float32Array,
  width: number,
  height: number,
  low: number,
  high: number,
): Uint8Array {
  const result = new Uint8Array(nmsMap.length);
  const strong = new Uint8Array(nmsMap.length);

  for (let i = 0; i < nmsMap.length; i++) {
    if (nmsMap[i] >= high) { strong[i] = 1; result[i] = 1; }
    else if (nmsMap[i] >= low) { result[i] = 2; } // weak
  }

  // BFS from strong pixels to connect weak neighbours
  const queue: number[] = [];
  for (let i = 0; i < strong.length; i++) {
    if (strong[i]) queue.push(i);
  }

  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const y = (idx / width) | 0;
    const x = idx % width;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const ny = y + dy, nx = x + dx;
        if (ny < 0 || ny >= height || nx < 0 || nx >= width) continue;
        const ni = ny * width + nx;
        if (result[ni] === 2 && !strong[ni]) {
          strong[ni] = 1;
          result[ni] = 1;
          queue.push(ni);
        }
      }
    }
  }

  // Discard orphaned weak edges
  for (let i = 0; i < result.length; i++) {
    if (result[i] === 2) result[i] = 0;
  }
  return result;
}

async function detectEdges(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  style: "thin" | "thick" | "sketchy",
): Promise<Blob> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  const src = ctx.getImageData(0, 0, width, height);

  // 1. Convert to float grayscale
  const gray = new Float32Array(width * height);
  for (let i = 0, j = 0; i < src.data.length; i += 4, j++) {
    gray[j] = src.data[i] * 0.299 + src.data[i + 1] * 0.587 + src.data[i + 2] * 0.114;
  }

  // 2. Gaussian blur to reduce noise (radius depends on style)
  const blurRadius = style === "thin" ? 1 : style === "thick" ? 2 : 1;
  const blurred = gaussianBlur(gray, width, height, blurRadius);

  // 3. Sobel gradient
  const gxArr = new Float32Array(width * height);
  const gyArr = new Float32Array(width * height);
  const magArr = new Float32Array(width * height);
  const gxK = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const gyK = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0, k = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const v = blurred[(y + dy) * width + (x + dx)];
          gx += gxK[k] * v;
          gy += gyK[k] * v;
          k++;
        }
      }
      const idx = y * width + x;
      gxArr[idx] = gx;
      gyArr[idx] = gy;
      magArr[idx] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  // 4. Find adaptive thresholds based on histogram (Otsu-inspired percentiles)
  const nonzero: number[] = [];
  for (let i = 0; i < magArr.length; i++) {
    if (magArr[i] > 0) nonzero.push(magArr[i]);
  }
  nonzero.sort((a, b) => a - b);

  let highPct: number, lowFactor: number, dilateRadius: number;
  switch (style) {
    case "thin":
      highPct = 0.88; lowFactor = 0.4; dilateRadius = 1; break;
    case "thick":
      highPct = 0.80; lowFactor = 0.35; dilateRadius = 2; break;
    case "sketchy":
      highPct = 0.84; lowFactor = 0.38; dilateRadius = 1; break;
  }

  const highThreshold = nonzero[Math.floor(nonzero.length * highPct)] ?? 100;
  const lowThreshold = highThreshold * lowFactor;

  // 5. Non-maximum suppression
  const suppressed = nms(magArr, gxArr, gyArr, width, height);

  // 6. Hysteresis thresholding — connects edge fragments into continuous contours
  let edges = hysteresis(suppressed, width, height, lowThreshold, highThreshold);

  // 7. Add random jitter for sketchy style before dilation
  if (style === "sketchy") {
    const jittered = new Uint8Array(edges.length);
    for (let i = 0; i < edges.length; i++) {
      jittered[i] = edges[i] || Math.random() < 0.004 ? edges[i] : 0;
    }
    // Slight random displacement
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (edges[y * width + x] && Math.random() < 0.15) {
          const dy = Math.round((Math.random() - 0.5) * 2);
          const dx = Math.round((Math.random() - 0.5) * 2);
          const ny = Math.max(0, Math.min(height - 1, y + dy));
          const nx = Math.max(0, Math.min(width - 1, x + dx));
          jittered[ny * width + nx] = 1;
        }
      }
    }
    edges = jittered;
  }

  // 8. Morphological dilation — closes gaps and thickens lines
  const dilated = dilate(edges, width, height, dilateRadius);

  // 9. Write to output canvas (black lines on white)
  const dst = ctx.createImageData(width, height);
  for (let i = 0; i < dilated.length; i++) {
    const v = dilated[i] ? 0 : 255;
    const p = i * 4;
    dst.data[p] = v;
    dst.data[p + 1] = v;
    dst.data[p + 2] = v;
    dst.data[p + 3] = 255;
  }

  ctx.putImageData(dst, 0, 0);
  return await canvas.convertToBlob({ type: "image/png" });
}

export {};
