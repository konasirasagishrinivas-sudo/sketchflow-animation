import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Loader2, Download } from "lucide-react";
import { exportGif, exportWebm, downloadBlob } from "@/lib/exporter";
import type { Frame, Project } from "@/lib/types";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  project: Project;
  frames: Frame[];
}

export function ExportDialog({ open, onOpenChange, project, frames }: Props) {
  const [format, setFormat] = useState<"gif" | "webm">("gif");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const run = async () => {
    if (frames.length === 0) {
      toast.error("No frames to export");
      return;
    }
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
      downloadBlob(blob, `${project.name.replace(/\s+/g, "_")}.${ext}`);
      toast.success(`Exported as ${ext.toUpperCase()}`);
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
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
                  onClick={() => setFormat(f)}
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={run} disabled={busy} className="bg-accent text-accent-foreground hover:bg-accent/90">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
