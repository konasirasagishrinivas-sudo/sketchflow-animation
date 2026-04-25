import { useEffect, useRef, useState } from "react";
import type { Frame, Project } from "@/lib/types";
import { putFrame } from "@/lib/db";

export type Tool = "pen" | "eraser" | "select";

interface Props {
  project: Project;
  frame: Frame;
  prevFrame?: Frame;
  nextFrame?: Frame;
  onionEnabled: boolean;
  tool: Tool;
  color: string;
  size: number;
}

/**
 * The drawing canvas — composites: sketch (locked) + onion skin layers + strokes (editable).
 * Strokes are persisted back to frame.strokesBlob via putFrame on stroke end.
 */
export function DrawingCanvas({
  project, frame, prevFrame, nextFrame, onionEnabled, tool, color, size,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);    // sketch + onion (read-only display)
  const strokeRef = useRef<HTMLCanvasElement>(null);  // user strokes (editable)
  const [scale, setScale] = useState(1);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  // Fit canvas to wrapper
  useEffect(() => {
    const fit = () => {
      const el = wrapRef.current;
      if (!el) return;
      const pad = 32;
      const sw = (el.clientWidth - pad) / project.width;
      const sh = (el.clientHeight - pad) / project.height;
      setScale(Math.max(0.1, Math.min(1.5, Math.min(sw, sh))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [project.width, project.height]);

  // Render base layer (sketch + onion)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = baseRef.current;
      if (!c) return;
      c.width = project.width;
      c.height = project.height;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, c.width, c.height);

      if (onionEnabled && prevFrame?.sketchBlob) {
        const bmp = await createImageBitmap(prevFrame.sketchBlob);
        if (cancelled) return bmp.close();
        ctx.globalAlpha = 0.22;
        ctx.globalCompositeOperation = "multiply";
        ctx.filter = "hue-rotate(140deg) saturate(2)";
        ctx.drawImage(bmp, 0, 0, c.width, c.height);
        ctx.filter = "none";
        bmp.close();
      }
      if (onionEnabled && nextFrame?.sketchBlob) {
        const bmp = await createImageBitmap(nextFrame.sketchBlob);
        if (cancelled) return bmp.close();
        ctx.globalAlpha = 0.22;
        ctx.globalCompositeOperation = "multiply";
        ctx.filter = "hue-rotate(-30deg) saturate(2)";
        ctx.drawImage(bmp, 0, 0, c.width, c.height);
        ctx.filter = "none";
        bmp.close();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      if (frame.sketchBlob) {
        const bmp = await createImageBitmap(frame.sketchBlob);
        if (cancelled) return bmp.close();
        ctx.globalCompositeOperation = "multiply";
        ctx.drawImage(bmp, 0, 0, c.width, c.height);
        ctx.globalCompositeOperation = "source-over";
        bmp.close();
      }
    })();
    return () => { cancelled = true; };
  }, [frame.id, frame.sketchBlob, prevFrame?.id, nextFrame?.id, onionEnabled, project.width, project.height]);

  // Render stroke layer
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = strokeRef.current;
      if (!c) return;
      c.width = project.width;
      c.height = project.height;
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, c.width, c.height);
      if (frame.strokesBlob) {
        const bmp = await createImageBitmap(frame.strokesBlob);
        if (cancelled) return bmp.close();
        ctx.drawImage(bmp, 0, 0, c.width, c.height);
        bmp.close();
      }
    })();
    return () => { cancelled = true; };
  }, [frame.id, frame.strokesBlob, project.width, project.height]);

  const toCanvasCoords = (clientX: number, clientY: number) => {
    const c = strokeRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * c.width,
      y: ((clientY - r.top) / r.height) * c.height,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (tool === "select") return;
    (e.target as Element).setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = toCanvasCoords(e.clientX, e.clientY);
    drawSegment(last.current, last.current);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const p = toCanvasCoords(e.clientX, e.clientY);
    if (last.current) drawSegment(last.current, p);
    last.current = p;
  };

  const onPointerUp = async (e: React.PointerEvent) => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    (e.target as Element).releasePointerCapture(e.pointerId);
    // Persist strokes
    const c = strokeRef.current!;
    const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), "image/png"));
    await putFrame({ ...frame, strokesBlob: blob });
  };

  const drawSegment = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const ctx = strokeRef.current!.getContext("2d")!;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = size;
    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
    }
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  };

  const w = project.width * scale;
  const h = project.height * scale;

  return (
    <div ref={wrapRef} className="w-full h-full flex items-center justify-center overflow-hidden p-4">
      <div
        className="relative bg-white paper-shadow border border-border rounded-md overflow-hidden"
        style={{ width: w, height: h }}
      >
        <canvas
          ref={baseRef}
          className="absolute inset-0 w-full h-full pointer-events-none select-none"
        />
        <canvas
          ref={strokeRef}
          className="absolute inset-0 w-full h-full touch-none"
          style={{ cursor: tool === "eraser" ? "cell" : tool === "pen" ? "crosshair" : "default" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
    </div>
  );
}
