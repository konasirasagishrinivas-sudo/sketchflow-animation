import { nanoid } from "nanoid";
import type { Frame } from "./types";

export interface ExtractOptions {
  file: File;
  fps: number;
  maxWidth?: number;
  style: "thin" | "thick" | "sketchy";
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

interface WorkerJob {
  resolve: (b: Blob) => void;
  reject: (e: unknown) => void;
}

let worker: Worker | null = null;
const jobs = new Map<number, WorkerJob>();
let nextJobId = 1;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../workers/edgeWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ id: number; blob: Blob }>) => {
      const job = jobs.get(e.data.id);
      if (job) {
        job.resolve(e.data.blob);
        jobs.delete(e.data.id);
      }
    };
    worker.onerror = (err) => {
      jobs.forEach((j) => j.reject(err));
      jobs.clear();
    };
  }
  return worker;
}

function processFrame(bitmap: ImageBitmap, width: number, height: number, style: "thin" | "thick" | "sketchy"): Promise<Blob> {
  const w = getWorker();
  const id = nextJobId++;
  return new Promise((resolve, reject) => {
    jobs.set(id, { resolve, reject });
    w.postMessage({ id, bitmap, width, height, style }, [bitmap]);
  });
}

async function makeThumb(blob: Blob, maxW = 160): Promise<Blob> {
  const img = await createImageBitmap(blob);
  const scale = Math.min(1, maxW / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const c = new OffscreenCanvas(w, h);
  c.getContext("2d")!.drawImage(img, 0, 0, w, h);
  img.close();
  return await c.convertToBlob({ type: "image/png", quality: 0.85 });
}

export async function extractAndOutline(opts: ExtractOptions): Promise<{ frames: Frame[]; width: number; height: number }> {
  const { file, fps, style, maxWidth = 1280, onProgress, signal } = opts;
  const projectId = ""; // assigned later

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  await new Promise<void>((res, rej) => {
    video.onloadedmetadata = () => res();
    video.onerror = () => rej(new Error("Could not load video"));
  });

  const duration = video.duration;
  if (!isFinite(duration) || duration <= 0) {
    URL.revokeObjectURL(url);
    throw new Error("Video has no readable duration. Try a different file.");
  }

  const ratio = video.videoWidth / video.videoHeight;
  const targetW = Math.min(maxWidth, video.videoWidth);
  const targetH = Math.round(targetW / ratio);

  const totalFrames = Math.max(1, Math.floor(duration * fps));
  const step = 1 / fps;

  const captureCanvas = document.createElement("canvas");
  captureCanvas.width = targetW;
  captureCanvas.height = targetH;
  const cctx = captureCanvas.getContext("2d", { willReadFrequently: false })!;

  const frames: Frame[] = [];
  for (let i = 0; i < totalFrames; i++) {
    if (signal?.aborted) break;
    const t = Math.min(duration - 0.001, i * step);
    await seek(video, t);
    cctx.drawImage(video, 0, 0, targetW, targetH);

    const sourceBlob = await new Promise<Blob>((res) =>
      captureCanvas.toBlob((b) => res(b!), "image/jpeg", 0.78),
    );
    const bitmap = await createImageBitmap(captureCanvas);
    const sketchBlob = await processFrame(bitmap, targetW, targetH, style);
    const thumbBlob = await makeThumb(sketchBlob);

    frames.push({
      id: nanoid(),
      projectId,
      index: i,
      duration: Math.round(1000 / fps),
      sourceBlob,
      sketchBlob,
      thumbBlob,
      createdAt: Date.now(),
    });
    onProgress?.(i + 1, totalFrames);
  }

  URL.revokeObjectURL(url);
  return { frames, width: targetW, height: targetH };
}

function seek(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const handler = () => {
      video.removeEventListener("seeked", handler);
      resolve();
    };
    video.addEventListener("seeked", handler);
    video.currentTime = t;
  });
}
