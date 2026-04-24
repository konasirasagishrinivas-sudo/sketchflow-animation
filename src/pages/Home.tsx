import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { nanoid } from "nanoid";
import { listProjects, saveProject, deleteProject } from "@/lib/db";
import { defaultBlueprint, type Project } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { ImportDialog } from "@/components/ImportDialog";
import { formatRelative } from "@/lib/utils";
import { Plus, Trash2, Film, Pencil, Clapperboard } from "lucide-react";
import { toast } from "sonner";

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const navigate = useNavigate();

  const refresh = async () => setProjects(await listProjects());
  useEffect(() => {
    refresh();
  }, []);

  const createBlank = async () => {
    const p: Project = {
      id: nanoid(),
      name: "Untitled animation",
      fps: 12,
      width: 1280,
      height: 720,
      outlineStyle: "thin",
      blueprint: defaultBlueprint(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      frameCount: 0,
    };
    await saveProject(p);
    navigate(`/editor/${p.id}`);
  };

  const remove = async (id: string) => {
    await deleteProject(id);
    toast.success("Project deleted");
    refresh();
  };

  return (
    <div className="min-h-screen paper-plain">
      {/* Header */}
      <header className="border-b border-border/60 bg-paper/70 backdrop-blur sticky top-0 z-10">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={createBlank}>
              <Plus className="size-4" /> Blank project
            </Button>
            <Button onClick={() => setImportOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Film className="size-4" /> Import video
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container pt-16 pb-10">
        <div className="max-w-3xl animate-fade-in">
          <p className="text-sm uppercase tracking-[0.2em] text-ink-soft mb-4">Sketch animation studio</p>
          <h1 className="font-display text-5xl md:text-6xl leading-[1.05] tracking-tight text-balance">
            Drop a video.
            <br />
            <span className="text-accent">Get a hand-drawn</span> animation.
          </h1>
          <p className="mt-6 text-lg text-ink-soft max-w-2xl text-balance">
            Inkframe traces your footage frame-by-frame into clean line art, then hands you a full
            FlipaClip-style editor — onion skinning, drawing tools, motion blueprints and AI direction.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={() => setImportOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90 ink-shadow">
              <Film className="size-5" /> Start from a video
            </Button>
            <Button size="lg" variant="outline" onClick={createBlank}>
              <Pencil className="size-5" /> Start blank
            </Button>
          </div>
        </div>

        {/* Feature strip */}
        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            { icon: Film, title: "Auto-traced frames", body: "Sobel edge detection on every frame, three line styles." },
            { icon: Clapperboard, title: "Motion Blueprint", body: "Plan actor paths, camera moves and beats spatially." },
            { icon: Pencil, title: "Draw on top", body: "Pen, eraser, onion skin. Export as MP4 or GIF." },
          ].map((f) => (
            <Card key={f.title} className="p-5 paper-shadow border-border/70">
              <f.icon className="size-5 text-accent mb-3" />
              <h3 className="font-display text-lg">{f.title}</h3>
              <p className="text-sm text-ink-soft mt-1">{f.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Projects */}
      <section className="container pb-24">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="font-display text-2xl">Your projects</h2>
          <span className="text-sm text-ink-soft">{projects.length} saved</span>
        </div>

        {projects.length === 0 ? (
          <Card className="p-10 text-center border-dashed">
            <p className="text-ink-soft">No projects yet. Import a video or start blank.</p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Card key={p.id} className="group p-0 overflow-hidden paper-shadow border-border/70">
                <Link to={`/editor/${p.id}`} className="block">
                  <div className="aspect-video bg-paper-shade border-b border-border/60 flex items-center justify-center overflow-hidden">
                    {p.thumbDataUrl ? (
                      <img src={p.thumbDataUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Film className="size-10 text-ink-soft/40" />
                    )}
                  </div>
                </Link>
                <div className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/editor/${p.id}`} className="font-medium block truncate hover:underline">
                      {p.name}
                    </Link>
                    <p className="text-xs text-ink-soft mt-1">
                      {p.frameCount} frames · {p.fps}fps · {formatRelative(p.updatedAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(p.id)}
                    aria-label="Delete project"
                    className="text-ink-soft hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onCreated={(id) => navigate(`/editor/${id}`)}
      />

      <footer className="border-t border-border/60 py-8 text-center text-xs text-ink-soft">
        Inkframe — projects live in your browser. Never sent to a server.
      </footer>
    </div>
  );
}
