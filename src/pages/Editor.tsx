import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { nanoid } from "nanoid";
import {
  getProject, listFrames, putFrame, putFrames, deleteFrame, reindexFrames, saveProject,
} from "@/lib/db";
import type { Frame, Project } from "@/lib/types";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft, Download, Pencil, Eraser, MousePointer2, Layers, Play, Pause, SkipBack,
  SkipForward, Sparkles, Map,
} from "lucide-react";
import { DrawingCanvas, type Tool } from "@/components/editor/DrawingCanvas";
import { Timeline } from "@/components/editor/Timeline";
import { AiDirection } from "@/components/editor/AiDirection";
import { MotionBlueprint } from "@/components/editor/MotionBlueprint";
import { AnimationPlayer } from "@/components/editor/AnimationPlayer";
import { ExportDialog } from "@/components/editor/ExportDialog";
import { toast } from "sonner";

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Tool state
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#1a1f2e");
  const [size, setSize] = useState(3);
  const [onion, setOnion] = useState(true);

  // Playback
  const [playing, setPlaying] = useState(false);
  const playRef = useRef<number | null>(null);

  // Right panel
  const [rightTab, setRightTab] = useState<"ai" | "blueprint" | "animation">("ai");
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    if (!id || id === ":id") {
      setLoading(false);
      setNotFound(true);
      return;
    }
    (async () => {
      try {
        const p = await getProject(id);
        if (!p) return setNotFound(true);
        setProject(p);
        setFrames(await listFrames(id));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const active = frames[activeIdx];
  const prev = frames[activeIdx - 1];
  const next = frames[activeIdx + 1];

  // Playback loop
  useEffect(() => {
    if (!playing || frames.length === 0 || !project) return;
    const dur = active?.duration || Math.round(1000 / project.fps);
    playRef.current = window.setTimeout(() => {
      setActiveIdx((i) => (i + 1) % frames.length);
    }, dur);
    return () => {
      if (playRef.current) clearTimeout(playRef.current);
    };
  }, [playing, activeIdx, frames.length, active?.duration, project]);

  const updateProject = useCallback((p: Project) => {
    setProject(p);
  }, []);

  const handleReorder = async (next: Frame[]) => {
    setFrames(next);
    await reindexFrames(project!.id, next);
  };

  const handleDuplicate = async (i: number) => {
    const src = frames[i];
    const clone: Frame = {
      ...src, id: nanoid(), index: i + 1, createdAt: Date.now(),
    };
    const next = [...frames.slice(0, i + 1), clone, ...frames.slice(i + 1)];
    setFrames(next);
    await reindexFrames(project!.id, next);
    if (project) await saveProject({ ...project, frameCount: next.length });
    setActiveIdx(i + 1);
  };

  const handleDelete = async (i: number) => {
    if (frames.length <= 1) {
      toast.error("Need at least one frame");
      return;
    }
    const target = frames[i];
    await deleteFrame(target.id);
    const next = frames.filter((_, j) => j !== i);
    setFrames(next);
    await reindexFrames(project!.id, next);
    if (project) await saveProject({ ...project, frameCount: next.length });
    setActiveIdx(Math.max(0, Math.min(activeIdx, next.length - 1)));
  };

  const addBlankFrame = async () => {
    if (!project) return;
    // Create a white sketch image
    const c = document.createElement("canvas");
    c.width = project.width; c.height = project.height;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, c.width, c.height);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
    const thumb = await makeThumb(blob);
    const f: Frame = {
      id: nanoid(),
      projectId: project.id,
      index: frames.length,
      duration: Math.round(1000 / project.fps),
      sketchBlob: blob,
      thumbBlob: thumb,
      createdAt: Date.now(),
    };
    await putFrame(f);
    const next = [...frames, f];
    setFrames(next);
    await saveProject({ ...project, frameCount: next.length });
    setActiveIdx(next.length - 1);
  };

  const addImageFrame = async (dataUrl: string) => {
    if (!project) return;
    const blob = await (await fetch(dataUrl)).blob();
    // Resize/draw onto project-sized canvas
    const bmp = await createImageBitmap(blob);
    const c = document.createElement("canvas");
    c.width = project.width; c.height = project.height;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, c.width, c.height);
    // Contain
    const scale = Math.min(c.width / bmp.width, c.height / bmp.height);
    const dw = bmp.width * scale, dh = bmp.height * scale;
    ctx.drawImage(bmp, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
    bmp.close();
    const sketchBlob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
    const thumb = await makeThumb(sketchBlob);
    const f: Frame = {
      id: nanoid(),
      projectId: project.id,
      index: frames.length,
      duration: Math.round(1000 / project.fps),
      sketchBlob,
      thumbBlob: thumb,
      createdAt: Date.now(),
    };
    await putFrame(f);
    const next = [...frames, f];
    setFrames(next);
    await saveProject({ ...project, frameCount: next.length });
    setActiveIdx(next.length - 1);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft") setActiveIdx((i) => Math.max(0, i - 1));
      else if (e.key === "ArrowRight") setActiveIdx((i) => Math.min(frames.length - 1, i + 1));
      else if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
      else if (e.key === "p") setTool("pen");
      else if (e.key === "e") setTool("eraser");
      else if (e.key === "v") setTool("select");
      else if (e.key === "o") setOnion((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [frames.length]);

  if (loading) {
    return (
      <div className="min-h-screen paper-plain flex items-center justify-center">
        <p className="text-ink-soft">Loading project…</p>
      </div>
    );
  }
  if (notFound || !project) {
    return (
      <div className="min-h-screen paper-plain flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <h2 className="font-display text-2xl mb-2">Project not found</h2>
          <p className="text-ink-soft mb-4">Head back to the home page to create or open one.</p>
          <Button asChild>
            <Link to="/"><ArrowLeft className="size-4 mr-2" /> Back to projects</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col paper-plain overflow-hidden">
      {/* Header */}
      <header className="border-b border-border/60 bg-paper/80 backdrop-blur shrink-0">
        <div className="px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/" aria-label="Back to projects"><ArrowLeft className="size-4" /></Link>
            </Button>
            <Logo />
            <span className="text-ink-soft">/</span>
            <span className="truncate font-medium">{project.name}</span>
            <span className="text-xs text-ink-soft hidden md:inline">
              {project.fps}fps · {project.width}×{project.height} · {frames.length} frames
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setActiveIdx(0)} title="First frame">
              <SkipBack className="size-4" />
            </Button>
            <Button
              variant={playing ? "default" : "outline"}
              size="icon"
              onClick={() => setPlaying((p) => !p)}
              title="Play / pause (space)"
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setActiveIdx(frames.length - 1)} title="Last frame">
              <SkipForward className="size-4" />
            </Button>
            <Button onClick={() => setExportOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90" size="sm">
              <Download className="size-4" /> Export
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-rows-[1fr_auto] min-h-0">
        <div className="grid grid-cols-[64px_1fr_360px] min-h-0">
          {/* Left tools rail */}
          <div className="border-r border-border/60 bg-paper-shade/40 p-2 flex flex-col items-center gap-2">
            <Toggle pressed={tool === "select"} onPressedChange={() => setTool("select")} title="Select (V)" aria-label="Select">
              <MousePointer2 className="size-4" />
            </Toggle>
            <Toggle pressed={tool === "pen"} onPressedChange={() => setTool("pen")} title="Pen (P)" aria-label="Pen">
              <Pencil className="size-4" />
            </Toggle>
            <Toggle pressed={tool === "eraser"} onPressedChange={() => setTool("eraser")} title="Eraser (E)" aria-label="Eraser">
              <Eraser className="size-4" />
            </Toggle>
            <div className="w-full border-t border-border/60 my-1" />
            <Toggle pressed={onion} onPressedChange={setOnion} title="Onion skin (O)" aria-label="Onion">
              <Layers className="size-4" />
            </Toggle>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="size-10 rounded-md border border-border bg-paper cursor-pointer p-1"
              title="Stroke color"
            />
            <div className="w-full px-1 mt-1">
              <Slider
                value={[size]}
                min={1} max={30} step={1}
                onValueChange={(v) => setSize(v[0])}
                aria-label="Brush size"
                orientation="vertical"
                className="h-24 mx-auto"
              />
              <p className="text-[10px] text-center text-ink-soft mt-1 font-mono">{size}px</p>
            </div>
          </div>

          {/* Canvas area */}
          <div className="relative paper min-h-0 overflow-hidden">
            {active ? (
              <DrawingCanvas
                project={project}
                frame={active}
                prevFrame={prev}
                nextFrame={next}
                onionEnabled={onion}
                tool={tool}
                color={color}
                size={size}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-center">
                <div className="max-w-sm">
                  <h2 className="font-display text-2xl">No frames yet</h2>
                  <p className="text-ink-soft mt-2">Add a blank frame from the timeline, or use AI Direction to generate keyframes.</p>
                </div>
              </div>
            )}
          </div>

          {/* Right side panel */}
          <aside className="border-l border-border/60 bg-paper-shade/30 min-h-0 flex flex-col">
            <Tabs value={rightTab} onValueChange={(v) => setRightTab(v as any)} className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid grid-cols-3 m-2">
                <TabsTrigger value="ai"><Sparkles className="size-3 mr-1" /> AI</TabsTrigger>
                <TabsTrigger value="animation">Play</TabsTrigger>
                <TabsTrigger value="blueprint"><Map className="size-3 mr-1" /> Blueprint</TabsTrigger>
              </TabsList>
              <TabsContent value="ai" className="flex-1 overflow-auto px-4 pb-4 mt-0">
                <AiDirection project={project} onAddImageFrame={addImageFrame} />
              </TabsContent>
              <TabsContent value="animation" className="flex-1 overflow-auto px-4 pb-4 mt-0">
                <AnimationPlayer
                  frames={frames}
                  fps={project.fps}
                  width={project.width}
                  height={project.height}
                  currentIndex={activeIdx}
                  onFrameChange={setActiveIdx}
                />
              </TabsContent>
              <TabsContent value="blueprint" className="flex-1 min-h-0 mt-0">
                <MotionBlueprint
                  project={project}
                  totalFrames={Math.max(1, frames.length)}
                  currentFrame={activeIdx}
                  onChange={updateProject}
                />
              </TabsContent>
            </Tabs>
          </aside>
        </div>

        {/* Timeline */}
        <Timeline
          frames={frames}
          activeIdx={activeIdx}
          onSelect={setActiveIdx}
          onReorder={handleReorder}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onAddBlank={addBlankFrame}
        />
      </div>

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} project={project} frames={frames} />
    </div>
  );
}

async function makeThumb(blob: Blob, maxW = 160): Promise<Blob> {
  const img = await createImageBitmap(blob);
  const scale = Math.min(1, maxW / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(img, 0, 0, w, h);
  img.close();
  return await new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
}
