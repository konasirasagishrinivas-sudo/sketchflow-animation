import { useState } from "react";
import { nanoid } from "nanoid";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Film, Loader2 } from "lucide-react";
import { extractAndOutline } from "@/lib/videoExtract";
import { saveProject, putFrames } from "@/lib/db";
import { defaultBlueprint, type Project } from "@/lib/types";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (projectId: string) => void;
}

export function ImportDialog({ open, onOpenChange, onCreated }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [fps, setFps] = useState(12);
  const [style, setStyle] = useState<"thin" | "thick" | "sketchy">("thin");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const reset = () => {
    setFile(null);
    setName("");
    setFps(12);
    setStyle("thin");
    setProgress({ done: 0, total: 0 });
    setBusy(false);
  };

  const handleClose = (v: boolean) => {
    if (!busy) {
      onOpenChange(v);
      if (!v) reset();
    }
  };

  const handleStart = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const projectId = nanoid();
      const { frames, width, height } = await extractAndOutline({
        file,
        fps,
        style,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      // Assign project id and save
      const finalFrames = frames.map((f) => ({ ...f, projectId }));
      // Build a thumb data URL from the first frame's sketch
      let thumbDataUrl: string | undefined;
      if (finalFrames[0]?.thumbBlob) {
        thumbDataUrl = await blobToDataUrl(finalFrames[0].thumbBlob);
      }
      const project: Project = {
        id: projectId,
        name: name.trim() || file.name.replace(/\.[^.]+$/, ""),
        fps,
        width,
        height,
        outlineStyle: style,
        blueprint: { ...defaultBlueprint(), stageSize: { w: width, h: height } },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        frameCount: finalFrames.length,
        thumbDataUrl,
      };
      await saveProject(project);
      await putFrames(finalFrames);
      toast.success(`Imported ${finalFrames.length} frames`);
      onOpenChange(false);
      reset();
      onCreated?.(projectId);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Import failed");
      setBusy(false);
    }
  };

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Import a video</DialogTitle>
          <DialogDescription>
            We'll extract frames at your chosen rate and trace each one into clean line art.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* File picker */}
          <div className="space-y-2">
            <Label>Video file</Label>
            <label className="group flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-paper-shade/40 p-6 cursor-pointer transition-all duration-200 ease-smooth hover:bg-paper-shade hover:border-accent/60 hover:-translate-y-0.5">
              <Film className="size-5 text-ink-soft transition-all duration-300 ease-smooth group-hover:text-accent group-hover:scale-110" />
              <span className="text-sm text-ink-soft transition-colors duration-200 group-hover:text-foreground">
                {file ? file.name : "Click to choose a video file"}
              </span>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                disabled={busy}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="proj-name">Project name</Label>
              <Input
                id="proj-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Untitled"
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proj-fps">Frame rate</Label>
              <select
                id="proj-fps"
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                disabled={busy}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm transition-all duration-200 ease-smooth hover:border-accent/50"
              >
                <option value={6}>6 fps · choppy</option>
                <option value={8}>8 fps · animation</option>
                <option value={12}>12 fps · standard</option>
                <option value={15}>15 fps · smooth</option>
                <option value={24}>24 fps · cinematic</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Outline style</Label>
            <RadioGroup
              value={style}
              onValueChange={(v) => setStyle(v as typeof style)}
              className="grid grid-cols-3 gap-2"
              disabled={busy}
            >
              {(["thin", "thick", "sketchy"] as const).map((s) => (
                <label
                  key={s}
                  className="flex items-center gap-2 rounded-md border border-border p-3 cursor-pointer transition-all duration-200 ease-smooth hover:bg-paper-shade hover:-translate-y-0.5 has-[:checked]:border-accent has-[:checked]:bg-accent/5 has-[:checked]:shadow-[0_0_0_1px_hsl(var(--accent)/0.4)]"
                >
                  <RadioGroupItem value={s} id={`style-${s}`} />
                  <span className="text-sm capitalize">{s}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {busy && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-ink-soft">
                  <Loader2 className="size-4 animate-spin" /> Tracing frames…
                </span>
                <span className="font-mono text-ink-soft">
                  {progress.done}/{progress.total}
                </span>
              </div>
              <div className="shimmer-overlay rounded-full">
                <Progress value={pct} className="transition-all duration-300 ease-smooth" />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={handleStart}
            disabled={!file || busy}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {busy ? "Working…" : "Trace frames"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}
