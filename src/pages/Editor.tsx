import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getProject, listFrames, blobUrl } from "@/lib/db";
import type { Frame, Project } from "@/lib/types";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Construction } from "lucide-react";

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const p = await getProject(id);
      if (p) setProject(p);
      setFrames(await listFrames(id));
    })();
  }, [id]);

  const active = frames[activeIdx];
  const activeUrl = useMemo(() => blobUrl(active?.sketchBlob), [active]);

  useEffect(() => {
    return () => {
      if (activeUrl) URL.revokeObjectURL(activeUrl);
    };
  }, [activeUrl]);

  if (!project) {
    return (
      <div className="min-h-screen paper-plain flex items-center justify-center">
        <p className="text-ink-soft">Loading project…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col paper-plain">
      {/* Header */}
      <header className="border-b border-border/60 bg-paper/80 backdrop-blur">
        <div className="px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/" aria-label="Back to projects"><ArrowLeft className="size-4" /></Link>
            </Button>
            <Logo />
            <span className="text-ink-soft">/</span>
            <span className="truncate font-medium">{project.name}</span>
            <span className="text-xs text-ink-soft hidden sm:inline">
              {project.fps}fps · {project.width}×{project.height} · {frames.length} frames
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>Export</Button>
          </div>
        </div>
      </header>

      {/* Body — provisional layout, full editor wired in next pass */}
      <div className="flex-1 grid grid-rows-[1fr_auto] min-h-0">
        <div className="grid grid-cols-[64px_1fr_320px] min-h-0">
          {/* Left tools rail */}
          <div className="border-r border-border/60 bg-paper-shade/40 p-2 flex flex-col items-center gap-2">
            <div className="size-10 rounded-md bg-paper border border-border" />
            <div className="size-10 rounded-md bg-paper border border-border" />
            <div className="size-10 rounded-md bg-paper border border-border" />
          </div>

          {/* Canvas area */}
          <div className="relative flex items-center justify-center p-6 overflow-auto paper">
            {active ? (
              <div className="bg-paper paper-shadow border border-border rounded-md overflow-hidden">
                <img
                  src={activeUrl}
                  alt={`Frame ${activeIdx + 1}`}
                  style={{ width: project.width / 2, height: project.height / 2 }}
                  className="block"
                />
              </div>
            ) : (
              <div className="text-center max-w-md">
                <Construction className="size-8 mx-auto text-ink-soft mb-3" />
                <h2 className="font-display text-2xl">No frames yet</h2>
                <p className="text-ink-soft mt-2">
                  This is a blank project. Frame import, drawing tools, AI direction and Motion
                  Blueprint are being added in the next steps.
                </p>
              </div>
            )}
          </div>

          {/* Right side panel */}
          <aside className="border-l border-border/60 bg-paper-shade/30 p-4">
            <h3 className="font-display text-lg mb-2">AI Direction</h3>
            <p className="text-sm text-ink-soft">
              Coming next: storyboard generator, AI keyframes, Motion Blueprint mode.
            </p>
          </aside>
        </div>

        {/* Timeline */}
        <div className="border-t border-border/60 bg-paper px-3 py-2 overflow-x-auto scrollbar-thin">
          <div className="flex items-center gap-1 min-h-[88px]">
            {frames.length === 0 && (
              <span className="text-xs text-ink-soft px-2">Timeline appears here once frames exist.</span>
            )}
            {frames.map((f, i) => (
              <FrameThumb
                key={f.id}
                frame={f}
                index={i}
                active={i === activeIdx}
                onSelect={() => setActiveIdx(i)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FrameThumb({
  frame,
  index,
  active,
  onSelect,
}: {
  frame: Frame;
  index: number;
  active: boolean;
  onSelect: () => void;
}) {
  const url = useMemo(() => blobUrl(frame.thumbBlob ?? frame.sketchBlob), [frame]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return (
    <button
      onClick={onSelect}
      className={`shrink-0 w-[112px] h-[72px] rounded-md overflow-hidden border-2 transition-all ${
        active ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-ink-soft"
      }`}
      title={`Frame ${index + 1}`}
    >
      <img src={url} alt="" className="w-full h-full object-cover" />
    </button>
  );
}
