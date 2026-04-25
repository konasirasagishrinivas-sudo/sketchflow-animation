import { useEffect, useRef, useState } from "react";
import type { Actor, ActorKeyframe, MotionBlueprint, Project } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Users } from "lucide-react";
import { saveProject } from "@/lib/db";
import { nanoid } from "nanoid";

interface Props {
  project: Project;
  totalFrames: number;
  currentFrame: number;
  onChange: (project: Project) => void;
}

const ACTOR_COLORS = ["14 72% 48%", "200 70% 45%", "150 55% 40%", "270 50% 50%", "40 85% 50%"];

export function MotionBlueprint({ project, totalFrames, currentFrame, onChange }: Props) {
  const blueprint = project.blueprint;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [draggingActor, setDraggingActor] = useState<string | null>(null);
  const [selectedActor, setSelectedActor] = useState<string | null>(blueprint.actors[0]?.id ?? null);

  // Render stage
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const w = c.width;
    const h = c.height;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = "hsl(36 14% 85%)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += w / 12) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += h / 8) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Stage outline
    ctx.strokeStyle = "hsl(220 18% 12%)";
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    // Draw each actor's path + position at current frame
    for (const actor of blueprint.actors) {
      if (actor.path.length === 0) continue;
      const pts = actor.path.map((k) => ({ x: (k.x / 100) * w, y: (k.y / 100) * h, frame: k.frame }));

      // Path line
      ctx.strokeStyle = `hsl(${actor.color})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke();
      ctx.setLineDash([]);

      // Keyframe dots
      pts.forEach((p) => {
        ctx.fillStyle = `hsl(${actor.color})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "white";
        ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
      });

      // Current interpolated position
      const cur = interpolate(actor.path, currentFrame);
      if (cur) {
        const cx = (cur.x / 100) * w;
        const cy = (cur.y / 100) * h;
        ctx.fillStyle = `hsl(${actor.color})`;
        ctx.strokeStyle = "white";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "white";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(actor.name.slice(0, 2).toUpperCase(), cx, cy);
      }
    }
  }, [blueprint, currentFrame]);

  const update = async (next: MotionBlueprint) => {
    const updated = { ...project, blueprint: next };
    onChange(updated);
    await saveProject(updated);
  };

  const addActor = () => {
    const idx = blueprint.actors.length;
    const a: Actor = {
      id: nanoid(),
      name: `Actor ${idx + 1}`,
      color: ACTOR_COLORS[idx % ACTOR_COLORS.length],
      path: [{ frame: 0, x: 30 + idx * 8, y: 50, easing: "ease-in-out" }],
    };
    update({ ...blueprint, actors: [...blueprint.actors, a] });
    setSelectedActor(a.id);
  };

  const removeActor = (id: string) => {
    update({ ...blueprint, actors: blueprint.actors.filter((a) => a.id !== id) });
    if (selectedActor === id) setSelectedActor(null);
  };

  const renameActor = (id: string, name: string) => {
    update({ ...blueprint, actors: blueprint.actors.map((a) => a.id === id ? { ...a, name } : a) });
  };

  const handleStageClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedActor) return;
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    const actor = blueprint.actors.find((a) => a.id === selectedActor);
    if (!actor) return;
    const existing = actor.path.find((k) => k.frame === currentFrame);
    let newPath: ActorKeyframe[];
    if (existing) {
      newPath = actor.path.map((k) => k.frame === currentFrame ? { ...k, x, y } : k);
    } else {
      newPath = [...actor.path, { frame: currentFrame, x, y, easing: "ease-in-out" as const }]
        .sort((a, b) => a.frame - b.frame);
    }
    update({
      ...blueprint,
      actors: blueprint.actors.map((a) => a.id === selectedActor ? { ...a, path: newPath } : a),
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border/60">
        <h3 className="font-display text-lg flex items-center gap-2">
          <Users className="size-4 text-accent" /> Motion Blueprint
        </h3>
        <p className="text-xs text-ink-soft mt-1">
          Click the stage to set the selected actor's position at the current frame ({currentFrame + 1}/{totalFrames}).
        </p>
      </div>

      <div className="flex-1 p-4 flex items-center justify-center bg-paper-shade/30 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={720}
          height={480}
          onClick={handleStageClick}
          className="max-w-full max-h-full border border-border rounded-md cursor-crosshair bg-white paper-shadow"
          style={{ aspectRatio: "3/2" }}
        />
      </div>

      <div className="border-t border-border/60 p-3 space-y-2 max-h-[40%] overflow-auto scrollbar-thin">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Actors</Label>
          <Button size="sm" variant="outline" onClick={addActor}>
            <Plus className="size-3" /> Add actor
          </Button>
        </div>
        {blueprint.actors.length === 0 && (
          <p className="text-xs text-ink-soft py-3 text-center">No actors yet — add one to start blocking.</p>
        )}
        {blueprint.actors.map((a) => (
          <div
            key={a.id}
            className={`flex items-center gap-2 rounded-md border p-2 cursor-pointer ${
              selectedActor === a.id ? "border-accent bg-accent/5" : "border-border bg-paper"
            }`}
            onClick={() => setSelectedActor(a.id)}
          >
            <span className="size-3 rounded-full" style={{ background: `hsl(${a.color})` }} />
            <Input
              value={a.name}
              onChange={(e) => renameActor(a.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="h-7 text-xs flex-1"
            />
            <span className="text-[10px] text-ink-soft">{a.path.length} keys</span>
            <Button
              size="icon" variant="ghost"
              onClick={(e) => { e.stopPropagation(); removeActor(a.id); }}
              className="h-7 w-7 text-ink-soft hover:text-destructive"
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function interpolate(path: ActorKeyframe[], frame: number) {
  if (path.length === 0) return null;
  if (frame <= path[0].frame) return path[0];
  if (frame >= path[path.length - 1].frame) return path[path.length - 1];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    if (frame >= a.frame && frame <= b.frame) {
      const t = (frame - a.frame) / Math.max(1, b.frame - a.frame);
      const e = ease(t, a.easing);
      return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
    }
  }
  return path[path.length - 1];
}

function ease(t: number, mode: ActorKeyframe["easing"]): number {
  switch (mode) {
    case "linear": return t;
    case "ease-in": return t * t;
    case "ease-out": return 1 - (1 - t) * (1 - t);
    case "ease-in-out": return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case "snap": return t < 1 ? 0 : 1;
    case "hold": return 0;
    default: return t;
  }
}
