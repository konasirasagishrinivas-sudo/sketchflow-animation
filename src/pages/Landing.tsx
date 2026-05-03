import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { ArrowRight, Film, Pencil, Clapperboard, Sparkles } from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) navigate("/app", { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen paper-plain overflow-hidden">
      {/* Header */}
      <header className="container flex h-20 items-center justify-between animate-fade-in">
        <Logo />
        <nav className="flex items-center gap-6">
          <a href="#features" className="hidden sm:inline text-sm text-ink-soft story-link">
            Features
          </a>
          <a href="#how" className="hidden sm:inline text-sm text-ink-soft story-link">
            How it works
          </a>
          <Link to="/auth">
            <Button variant="ghost" className="text-sm">Sign in</Button>
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="container relative pt-16 md:pt-24 pb-24">
        {/* Floating ink doodles */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <svg
            className="absolute -top-10 -right-10 w-[420px] h-[420px] opacity-[0.07] animate-fade-in"
            viewBox="0 0 200 200"
            style={{ animationDuration: "1.6s" }}
          >
            <path
              d="M20 120 C 60 20, 140 20, 180 120 S 140 200, 100 160 S 20 200, 20 120Z"
              stroke="hsl(var(--ink))"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="1000"
              strokeDashoffset="1000"
              className="animate-ink-draw"
            />
          </svg>
          <svg
            className="absolute bottom-0 -left-16 w-[360px] h-[360px] opacity-[0.06]"
            viewBox="0 0 200 200"
          >
            <path
              d="M30 100 Q 80 30 130 100 T 180 100"
              stroke="hsl(var(--accent))"
              strokeWidth="2"
              fill="none"
              strokeDasharray="800"
              strokeDashoffset="800"
              className="animate-ink-draw"
              style={{ animationDelay: "0.4s" }}
            />
            <circle cx="160" cy="60" r="6" fill="hsl(var(--accent))" />
          </svg>
        </div>

        <div className="relative max-w-3xl mx-auto text-center">
          <div
            className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-paper/60 px-3 py-1 text-xs text-ink-soft animate-fade-in-up backdrop-blur"
            style={{ animationDelay: "120ms" }}
          >
            <Sparkles className="size-3.5 text-accent" /> Hand-drawn animation, made effortless
          </div>

          <h1
            className="font-display text-5xl md:text-7xl leading-[1.02] tracking-tight text-balance mt-6 animate-fade-in-up"
            style={{ animationDelay: "240ms" }}
          >
            Turn footage into
            <br />
            <span className="text-accent italic">living ink</span>.
          </h1>

          <p
            className="mt-6 text-lg md:text-xl text-ink-soft max-w-2xl mx-auto text-balance animate-fade-in-up"
            style={{ animationDelay: "380ms" }}
          >
            Inkframe traces your video frame-by-frame into clean line art,
            then gives you a full studio — onion skinning, motion blueprints,
            and AI direction. Sketch the world you imagine.
          </p>

          <div
            className="mt-10 flex flex-wrap items-center justify-center gap-3 animate-fade-in-up"
            style={{ animationDelay: "520ms" }}
          >
            <Link to="/auth">
              <Button
                size="lg"
                className="bg-accent text-accent-foreground hover:bg-accent/90 ink-shadow group h-12 px-6 text-base"
              >
                Get started
                <ArrowRight className="size-4 transition-transform duration-300 ease-smooth group-hover:translate-x-1" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline" className="h-12 px-6 text-base">
                See how it works
              </Button>
            </a>
          </div>

          <p
            className="mt-6 text-xs text-ink-soft animate-fade-in"
            style={{ animationDelay: "720ms", animationDuration: "1.2s" }}
          >
            No credit card · Free to start
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container pb-24">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              icon: Film,
              title: "Auto-traced frames",
              body: "Sobel edge detection on every frame, three line styles to choose from.",
            },
            {
              icon: Clapperboard,
              title: "Motion Blueprint",
              body: "Plan actor paths, camera moves and beats spatially — like a real storyboard.",
            },
            {
              icon: Pencil,
              title: "Draw on top",
              body: "Pen, eraser, onion skin. Export as MP4 or GIF when you're done.",
            },
          ].map((f, i) => (
            <div
              key={f.title}
              style={{ animationDelay: `${i * 120 + 200}ms` }}
              className="group glass-card rounded-xl p-6 hover-lift animate-fade-in-up"
            >
              <div className="size-10 rounded-lg bg-accent/10 flex items-center justify-center mb-4 transition-transform duration-500 ease-smooth group-hover:scale-110 group-hover:rotate-3">
                <f.icon className="size-5 text-accent" />
              </div>
              <h3 className="font-display text-xl">{f.title}</h3>
              <p className="text-sm text-ink-soft mt-2 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="container pb-32">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <h2 className="font-display text-4xl tracking-tight animate-fade-in-up">
            Three steps. <span className="text-accent">Endless stories.</span>
          </h2>
        </div>
        <div className="grid gap-8 md:grid-cols-3 max-w-4xl mx-auto">
          {[
            { n: "01", t: "Drop a video", d: "Any clip. We handle the rest." },
            { n: "02", t: "Watch it ink", d: "Frames are traced into hand-drawn art." },
            { n: "03", t: "Direct & export", d: "Refine, animate, export to MP4 or GIF." },
          ].map((s, i) => (
            <div
              key={s.n}
              style={{ animationDelay: `${i * 140}ms` }}
              className="animate-fade-in-up"
            >
              <div className="font-display text-5xl text-accent/80">{s.n}</div>
              <h3 className="font-display text-xl mt-3">{s.t}</h3>
              <p className="text-sm text-ink-soft mt-2">{s.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-20 text-center">
          <Link to="/auth">
            <Button
              size="lg"
              className="bg-accent text-accent-foreground hover:bg-accent/90 ink-shadow group h-12 px-8 text-base"
            >
              Start drawing free
              <ArrowRight className="size-4 transition-transform duration-300 ease-smooth group-hover:translate-x-1" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-ink-soft">
        Inkframe — sketch the moving image.
      </footer>
    </div>
  );
}
