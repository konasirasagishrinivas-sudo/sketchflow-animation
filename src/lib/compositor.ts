// Composite a frame's sketch + user strokes onto a target canvas.
import type { Frame, Project } from "./types";

const bitmapCache = new WeakMap<Blob, ImageBitmap>();

async function getBitmap(blob: Blob): Promise<ImageBitmap> {
  let b = bitmapCache.get(blob);
  if (b) return b;
  b = await createImageBitmap(blob);
  bitmapCache.set(blob, b);
  return b;
}

export async function compositeFrame(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  project: Project,
  frame: Frame,
  opts: { background?: string; sketchOpacity?: number } = {},
): Promise<void> {
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const w = project.width;
  const h = project.height;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  if (opts.background) {
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, w, h);
  }
  if (frame.sketchBlob) {
    const bmp = await getBitmap(frame.sketchBlob);
    ctx.globalAlpha = opts.sketchOpacity ?? 1;
    ctx.drawImage(bmp, 0, 0, w, h);
    ctx.globalAlpha = 1;
  }
  if (frame.strokesBlob) {
    const bmp = await getBitmap(frame.strokesBlob);
    ctx.drawImage(bmp, 0, 0, w, h);
  }
  ctx.restore();
}
