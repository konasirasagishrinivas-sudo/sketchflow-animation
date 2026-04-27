import { useState, useRef } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Loader2, Download, GripVertical, FileVideo, FileImage } from "lucide-react";
import { exportGif, exportWebm, downloadBlob } from "@/lib/exporter";
import type { Frame, Project } from "@/lib/types";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  project: Project;
  frames: Frame[];
}

interface Result {
  blob: Blob;
  filename: string;
  mime: string;
  url: string;
}

export function ExportDialog({ open, onOpenChange, project, frames }: Props) {
  const [format, setFormat] = useState<"gif" | "webm">("gif");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<Result | null>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  const cleanupResult = () => {
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);
  };

  const run = async () => {
    if (frames.length === 0) {
      toast.error("No frames to export");
      return;
    }
    cleanupResult();
    setBusy(true);
    setProgress({ done: 0, total: frames.length });
    try {
      const opts = {
        project,
        frames,
        onProgress: (done: number, total: number) => setProgress({ done, total }),
      };
      const blob = format === "gif" ? await exportGif(opts) : await exportWebm(opts);
      const ext = format === "gif" ? "gif" : "webm";
      const mime = format === "gif" ? "image/gif" : "video/webm";
      const filename = `${project.name.replace(/\s+/g, "_")}.${ext}`;
      const url = URL.createObjectURL(blob);
      setResult({ blob, filename, mime, url });
      toast.success(`Ready — drag the file out or click download`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    downloadBlob(result.blob, result.filename);
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (!result) return;
    // DownloadURL format: "mime:filename:url" — lets the OS receive a real file on drop
    e.dataTransfer.setData(
      "DownloadURL",
      `${result.mime}:${result.filename}:${result.url}`
    );
    e.dataTransfer.setData("text/uri-list", result.url);
    e.dataTransfer.setData("text/plain", result.filename);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleOpenChange = (v: boolean) => {
    if (busy) return;
    if (!v) cleanupResult();
    onOpenChange(v);
  };

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Export animation</DialogTitle>
          <DialogDescription>
            {frames.length} frames · {project.fps}fps · {project.width}×{project.height}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Format</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["gif", "webm"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => { setFormat(f); cleanupResult(); }}
                  disabled={busy}
                  className={`rounded-md border p-3 text-left transition-colors ${
                    format === f ? "border-accent bg-accent/5" : "border-border hover:bg-paper-shade"
                  }`}
                >
                  <div className="font-medium uppercase text-sm">{f}</div>
                  <div className="text-xs text-ink-soft mt-0.5">
                    {f === "gif" ? "Animated GIF, easy to share" : "Video (MP4-style), smaller & smoother"}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-soft">
              MP4 is exported as WebM (H.264-equivalent) — playable in browsers and most editors.
            </p>
          </div>

          {busy && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-ink-soft">
                  <Loader2 className="size-4 animate-spin" /> Rendering…
                </span>
                <span className="font-mono text-ink-soft">{progress.done}/{progress.total}</span>
              </div>
              <Progress value={pct} />
            </div>
          )}

          {result && !busy && (
            <div className="space-y-2">
              <Label>Your file is ready</Label>
              <div
                ref={dragRef}
                draggable
                onDragStart={handleDragStart}
                title="Drag this file to your desktop or any folder"
                className="group flex items-center gap-3 rounded-md border-2 border-dashed border-accent/60 bg-accent/5 p-4 cursor-grab active:cursor-grabbing hover:bg-accent/10 transition-colors"
              >
                <GripVertical className="size-5 text-ink-soft shrink-0" />
                {format === "gif" ? (
                  <FileImage className="size-8 text-accent shrink-0" />
                ) : (
                  <FileVideo className="size-8 text-accent shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{result.filename}</div>
                  <div className="text-xs text-ink-soft">
                    Drag this out to your desktop, or click Download
                  </div>
                </div>
                <span className="text-xs uppercase tracking-wide text-ink-soft opacity-0 group-hover:opacity-100 transition-opacity">
                  Drag me
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>
            Close
          </Button>
          {result ? (
            <Button onClick={handleDownload} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Download className="size-4" />
              Download
            </Button>
          ) : (
            <Button onClick={run} disabled={busy} className="bg-accent text-accent-foreground hover:bg-accent/90">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Export
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
