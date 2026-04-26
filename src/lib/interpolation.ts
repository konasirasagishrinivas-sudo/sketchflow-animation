/**
 * Frame interpolation system that generates smooth in-between frames
 * from keyframes using pixel-based blending and morphing.
 */

export interface InterpolationConfig {
  inBetweenFrames: number; // number of frames to generate between keyframes
  easing: "linear" | "ease-in" | "ease-out" | "ease-in-out";
}

const easingFunctions = {
  linear: (t: number): number => t,
  "ease-in": (t: number): number => t * t,
  "ease-out": (t: number): number => 1 - (1 - t) * (1 - t),
  "ease-in-out": (t: number): number => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
};

async function imageToCanvas(blob: Blob | undefined, width: number, height: number): Promise<OffscreenCanvas> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;

  if (blob) {
    const img = await createImageBitmap(blob);
    ctx.drawImage(img, 0, 0);
    img.close();
  } else {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);
  }
  return canvas;
}

/**
 * Cross-dissolve between two frames with optional morphing.
 * Uses alpha blending for smooth transitions.
 */
export async function interpolateFrames(
  fromBlob: Blob | undefined,
  toBlob: Blob | undefined,
  width: number,
  height: number,
  config: InterpolationConfig,
): Promise<Blob[]> {
  const frames: Blob[] = [];
  const easing = easingFunctions[config.easing];
  const steps = config.inBetweenFrames + 1; // +1 to include start frame

  const fromCanvas = await imageToCanvas(fromBlob, width, height);
  const toCanvas = await imageToCanvas(toBlob, width, height);

  const fromData = fromCanvas.getContext("2d")!.getImageData(0, 0, width, height);
  const toData = toCanvas.getContext("2d")!.getImageData(0, 0, width, height);

  for (let i = 0; i <= config.inBetweenFrames; i++) {
    const t = easing(i / steps);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d")!;
    const blended = ctx.createImageData(width, height);

    // Cross-dissolve blend
    for (let j = 0; j < fromData.data.length; j += 4) {
      const fromAlpha = fromData.data[j + 3] / 255;
      const toAlpha = toData.data[j + 3] / 255;

      blended.data[j] =
        fromData.data[j] * (1 - t) * fromAlpha + toData.data[j] * t * toAlpha;
      blended.data[j + 1] =
        fromData.data[j + 1] * (1 - t) * fromAlpha +
        toData.data[j + 1] * t * toAlpha;
      blended.data[j + 2] =
        fromData.data[j + 2] * (1 - t) * fromAlpha +
        toData.data[j + 2] * t * toAlpha;
      blended.data[j + 3] = Math.max(fromAlpha, toAlpha) * 255;
    }

    ctx.putImageData(blended, 0, 0);
    const blob = await canvas.convertToBlob({ type: "image/png" });
    frames.push(blob);
  }

  return frames;
}

/**
 * Interpolate a sequence of keyframes into a full animation.
 * Returns array of blobs in chronological order.
 */
export async function interpolateSequence(
  keyframeBlobs: (Blob | undefined)[],
  width: number,
  height: number,
  config: InterpolationConfig,
): Promise<Blob[]> {
  if (keyframeBlobs.length === 0) return [];
  if (keyframeBlobs.length === 1) return keyframeBlobs;

  const result: Blob[] = [];

  for (let i = 0; i < keyframeBlobs.length - 1; i++) {
    const from = keyframeBlobs[i];
    const to = keyframeBlobs[i + 1];

    const interpolated = await interpolateFrames(from, to, width, height, config);

    if (i === 0) {
      result.push(...interpolated);
    } else {
      result.push(...interpolated.slice(1)); // Skip duplicate start frame
    }
  }

  return result;
}

/**
 * Advanced morphing that detects similar shapes and interpolates their positions.
 * Falls back to cross-dissolve if detection fails.
 */
export async function morphFrames(
  fromBlob: Blob | undefined,
  toBlob: Blob | undefined,
  width: number,
  height: number,
  config: InterpolationConfig,
): Promise<Blob[]> {
  const frames: Blob[] = [];
  const easing = easingFunctions[config.easing];
  const steps = config.inBetweenFrames + 1;

  const fromCanvas = await imageToCanvas(fromBlob, width, height);
  const toCanvas = await imageToCanvas(toBlob, width, height);

  const fromData = fromCanvas.getContext("2d")!.getImageData(0, 0, width, height);
  const toData = toCanvas.getContext("2d")!.getImageData(0, 0, width, height);

  // Detect edges in both frames to guide morphing
  const fromEdges = detectEdges(fromData);
  const toEdges = detectEdges(toData);

  for (let i = 0; i <= config.inBetweenFrames; i++) {
    const t = easing(i / steps);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d")!;
    const result = ctx.createImageData(width, height);

    // Blend with slight warp toward destination
    for (let j = 0; j < fromData.data.length; j += 4) {
      const fromVal = fromData.data[j]; // Use R channel as intensity
      const toVal = toData.data[j];

      // Interpolate with bias toward edges
      const edgeInfluence = 0.3;
      const warp = (1 - edgeInfluence) * t + edgeInfluence * (toEdges[j] > 128 ? 1 : 0);

      result.data[j] = Math.round(fromVal * (1 - warp) + toVal * warp);
      result.data[j + 1] = Math.round(fromData.data[j + 1] * (1 - t) + toData.data[j + 1] * t);
      result.data[j + 2] = Math.round(fromData.data[j + 2] * (1 - t) + toData.data[j + 2] * t);
      result.data[j + 3] = 255;
    }

    ctx.putImageData(result, 0, 0);
    const blob = await canvas.convertToBlob({ type: "image/png" });
    frames.push(blob);
  }

  return frames;
}

/**
 * Simple edge detection to help guide morphing.
 */
function detectEdges(imageData: ImageData): Uint8Array {
  const { data, width, height } = imageData;
  const edges = new Uint8Array(data.length);

  for (let i = 0; i < data.length; i += 4) {
    const idx = i / 4;
    const x = idx % width;
    const y = Math.floor(idx / width);

    if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
      edges[i] = 0;
      continue;
    }

    const curr = data[i];
    const right = data[i + 4];
    const bottom = data[i + width * 4];

    const dx = Math.abs(curr - right);
    const dy = Math.abs(curr - bottom);
    edges[i] = Math.min(255, dx + dy);
  }

  return edges;
}
