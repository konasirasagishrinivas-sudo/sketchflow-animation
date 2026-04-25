// Export project frames to MP4 (WebCodecs) or animated GIF (gif.js).
import GIF from "gif.js.optimized";
import type { Frame, Project } from "./types";
import { compositeFrame } from "./compositor";

export interface ExportOpts {
  project: Project;
  frames: Frame[];
  onProgress?: (done: number, total: number) => void;
}

/** Composite source/sketch/strokes into an HTMLCanvas-ready image per frame. */
async function getFrameCanvas(project: Project, frame: Frame): Promise<HTMLCanvasElement> {
  const c = document.createElement("canvas");
  c.width = project.width;
  c.height = project.height;
  await compositeFrame(c, project, frame, { background: "white" });
  return c;
}

export async function exportGif(opts: ExportOpts): Promise<Blob> {
  const { project, frames, onProgress } = opts;
  return new Promise(async (resolve, reject) => {
    try {
      const gif = new GIF({
        workers: 2,
        quality: 10,
        width: project.width,
        height: project.height,
        workerScript: "/gif.worker.js",
      });
      for (let i = 0; i < frames.length; i++) {
        const c = await getFrameCanvas(project, frames[i]);
        gif.addFrame(c, { delay: frames[i].duration || Math.round(1000 / project.fps) });
        onProgress?.(i + 1, frames.length);
      }
      gif.on("finished", (blob: Blob) => resolve(blob));
      gif.on("abort", () => reject(new Error("GIF aborted")));
      gif.render();
    } catch (e) {
      reject(e);
    }
  });
}

/** WebM via MediaRecorder (universal, no WebCodecs requirement). */
export async function exportWebm(opts: ExportOpts): Promise<Blob> {
  const { project, frames, onProgress } = opts;
  const canvas = document.createElement("canvas");
  canvas.width = project.width;
  canvas.height = project.height;
  const ctx = canvas.getContext("2d")!;
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as any;

  const chunks: BlobPart[] = [];
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((res) => (rec.onstop = () => res()));
  rec.start();

  for (let i = 0; i < frames.length; i++) {
    const c = await getFrameCanvas(project, frames[i]);
    ctx.drawImage(c, 0, 0);
    if (track.requestFrame) track.requestFrame();
    const dur = frames[i].duration || Math.round(1000 / project.fps);
    await new Promise((r) => setTimeout(r, dur));
    onProgress?.(i + 1, frames.length);
  }
  // Hold last frame briefly
  await new Promise((r) => setTimeout(r, 80));
  rec.stop();
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  return new Blob(chunks, { type: mime });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
