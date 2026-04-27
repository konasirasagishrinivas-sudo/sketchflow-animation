import { useState, useRef } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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

type Format = "gif" | "webm";

interface Result {
  id: string;
  format: Format;
  blob: Blob;
  filename: string;
  mime: string;
  url: string;
}

const FORMAT_META: Record<Format, { label: string; mime: string; ext: string; desc: string }> = {
  gif: { label: "GIF", mime: "image/gif", ext: "gif", desc: "Animated GIF, easy to share" },
  webm: { label: "WebM", mime: "video/webm", ext: "webm", desc: "Video (MP4-style), smaller & smoother" },
};

export function ExportDialog({ open, onOpenChange, project, frames }: Props) {
  const [selected, setSelected] = useState<Record<Format, boolean>>({ gif: true, webm: false });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: "" });
  const [results, setResults] = useState<Result[]>([]);
  const idCounter = useRef(0);

  const cleanupResults = () => {
    setResults((prev) => {
      prev.forEach((r) => URL.revokeObjectURL(r.url));
      return [];
    });
  };

  const toggle = (f: Format) => {
    setSelected((s) => ({ ...s, [f]: !s[f] }));
  };

  const run = async () => {
    if (frames.length === 0) {
      toast.error("No frames to export");
      return;
    }
    const formats = (Object.keys(selected) as Format[]).filter((f) => selected[f]);
    if (formats.length === 0) {
      toast.error("Pick at least one format");
      return;
    }
    cleanupResults();
    setBusy(true);
    const newResults: Result[] = [];
    try {
      for (let i = 0; i < formats.length; i++) {
        const fmt = formats[i];
        const meta = FORMAT_META[fmt];
        setProgress({ done: 0, total: frames.length, label: `Rendering ${meta.label} (${i + 1}/${formats.length})` });
        const opts = {
          project,
          frames,
          onProgress: (done: number, total: number) =>
            setProgress({ done, total, label: `Rendering ${meta.label} (${i + 1}/${formats.length})` }),
        };
        const blob = fmt === "gif" ? await exportGif(opts) : await exportWebm(opts);
        const id = `r${++idCounter.current}`;
        const filename = `${project.name.replace(/\s+/g, "_")}.${meta.ext}`;
        const url = URL.createObjectURL(blob);
        newResults.push({ id, format: fmt, blob, filename, mime: meta.mime, url });
        // Show progressively as each finishes
        setResults([...newResults]);
      }
      toast.success(`Exported ${newResults.length} file${newResults.length === 1 ? "" : "s"} — drag them out or download`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Export failed");
    } finally {
      setBusy(false);
      setProgress({ done: 0, total: 0, label: "" });
    }
  };

  const handleDownload = (r: Result) => downloadBlob(r.blob, r.filename);

  const handleDownloadAll = () => {
    results.forEach((r, i) => setTimeout(() => downloadBlob(r.blob, r.filename), i * 200));
  };

  const handleDragStart = (e: React.DragEvent, r: Result) => {
    e.dataTransfer.setData("DownloadURL", `${r.mime}:${r.filename}:${r.url}`);
    e.dataTransfer.setData("text/uri-list", r.url);
    e.dataTransfer.setData("text/plain", r.filename);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleOpenChange = (v: boolean) => {
    if (busy) return;
    if (!v) cleanupResults();
    onOpenChange(v);
  };

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const selectedCount = (Object.keys(selected) as Format[]).filter((f) => selected[f]).length;

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
            <Label>Formats to export</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(FORMAT_META) as Format[]).map((f) => {
                const meta = FORMAT_META[f];
                const checked = selected[f];
                return (
                  <label
                    key={f}
                    className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                      checked ? "border-accent bg-accent/5" : "border-border hover:bg-paper-shade"
                    } ${busy ? "opacity-60 pointer-events-none" : ""}`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(f)}
                      disabled={busy}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-medium uppercase text-sm">{meta.label}</div>
                      <div className="text-xs text-ink-soft mt-0.5">{meta.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-ink-soft">
              Tick multiple to render them in one batch — you'll get a draggable card per file.
            </p>
          </div>

          {busy && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-ink-soft">
                  <Loader2 className="size-4 animate-spin" /> {progress.label || "Rendering…"}
                </span>
                <span className="font-mono text-ink-soft">{progress.done}/{progress.total}</span>
              </div>
              <Progress value={pct} />
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{results.length} file{results.length === 1 ? "" : "s"} ready</Label>
                {results.length > 1 && (
                  <button
                    onClick={handleDownloadAll}
                    className="text-xs text-accent hover:underline"
                  >
                    Download all
                  </button>
                )}
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {results.map((r) => (
                  <div
                    key={r.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, r)}
                    title="Drag this file to your desktop or any folder"
                    className="group flex items-center gap-3 rounded-md border-2 border-dashed border-accent/60 bg-accent/5 p-3 cursor-grab active:cursor-grabbing hover:bg-accent/10 transition-colors"
                  >
                    <GripVertical className="size-5 text-ink-soft shrink-0" />
                    {r.format === "gif" ? (
                      <FileImage className="size-7 text-accent shrink-0" />
                    ) : (
                      <FileVideo className="size-7 text-accent shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{r.filename}</div>
                      <div className="text-xs text-ink-soft">Drag out, or click the icon to download</div>
                    </div>
                    <button
                      onClick={() => handleDownload(r)}
                      className="p-1.5 rounded hover:bg-accent/20 text-ink-soft hover:text-accent transition-colors"
                      title="Download"
                    >
                      <Download className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>
            Close
          </Button>
          <Button
            onClick={run}
            disabled={busy || selectedCount === 0}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {results.length > 0 ? "Re-export" : `Export ${selectedCount || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
