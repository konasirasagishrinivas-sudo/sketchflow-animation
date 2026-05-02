import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Project } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, ImagePlus } from "lucide-react";
import { toast } from "sonner";

interface Beat { label: string; description: string; }

interface Props {
  project: Project;
  onAddImageFrame: (dataUrl: string) => Promise<void>;
}

export function AiDirection({ project, onAddImageFrame }: Props) {
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(6);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [loadingStory, setLoadingStory] = useState(false);
  const [loadingFrame, setLoadingFrame] = useState<number | null>(null);

  const [rawResponse, setRawResponse] = useState<string>("");

  const generateStoryboard = async () => {
    if (!prompt.trim()) return;
    setLoadingStory(true);
    setRawResponse("");
    try {
      const res = await fetch(
        "https://viewing-mid-governments-simulation.trycloudflare.com/webhook/storyboard-to-video",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scene: prompt, beats: 6 }),
        }
      );
      const text = await res.text();
      let data: any = null;
      try { data = JSON.parse(text); } catch { /* keep as text */ }
      if (!res.ok) throw new Error(`Request failed (${res.status}): ${text.slice(0, 200)}`);

      setRawResponse(typeof data === "object" && data !== null ? JSON.stringify(data, null, 2) : text);

      const maybeBeats = data?.beats ?? data?.storyboard ?? (Array.isArray(data) ? data : null);
      if (Array.isArray(maybeBeats)) {
        setBeats(
          maybeBeats.map((b: any, i: number) => ({
            label: b?.label ?? b?.title ?? `Beat ${i + 1}`,
            description: b?.description ?? b?.text ?? (typeof b === "string" ? b : ""),
          }))
        );
      } else {
        setBeats([]);
      }
      toast.success("Response received");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate storyboard");
    } finally {
      setLoadingStory(false);
    }
  };

  const generateKeyframe = async (i: number) => {
    setLoadingFrame(i);
    try {
      const { data, error } = await supabase.functions.invoke("ai-direction", {
        body: {
          mode: "keyframe",
          prompt: beats[i].description,
          referenceDataUrl: project.characterRefDataUrl,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const url = (data as any).imageDataUrl as string;
      await onAddImageFrame(url);
      toast.success("Keyframe added to timeline");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate keyframe");
    } finally {
      setLoadingFrame(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-lg flex items-center gap-2">
          <Sparkles className="size-4 text-accent" /> AI Direction
        </h3>
        <p className="text-xs text-ink-soft mt-1">
          Describe a scene → get storyboard beats → generate keyframe sketches.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ai-prompt">Scene description</Label>
        <Textarea
          id="ai-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A fox sneaks across a moonlit rooftop, leaps over a chimney, and lands in a courtyard."
          rows={3}
        />
        <div className="flex items-center gap-2">
          <Label htmlFor="ai-count" className="text-xs">Beats</Label>
          <Input
            id="ai-count" type="number" min={2} max={12}
            value={count}
            onChange={(e) => setCount(Math.max(2, Math.min(12, Number(e.target.value) || 6)))}
            className="h-8 w-16"
          />
          <Button
            onClick={generateStoryboard}
            disabled={loadingStory || !prompt.trim()}
            className="ml-auto bg-accent text-accent-foreground hover:bg-accent/90"
            size="sm"
          >
            {loadingStory ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Generate
          </Button>
        </div>
      </div>

      {(loadingStory || rawResponse) && (
        <div className="space-y-2 pt-2 border-t border-border/60">
          <p className="text-xs uppercase tracking-wider text-ink-soft">Response</p>
          {loadingStory ? (
            <div className="rounded-md border border-border p-3 bg-paper flex items-center gap-2 text-xs text-ink-soft">
              <Loader2 className="size-3 animate-spin" /> Waiting for server response…
            </div>
          ) : (
            <pre className="rounded-md border border-border p-2 bg-paper text-[11px] max-h-48 overflow-auto whitespace-pre-wrap break-words">
{rawResponse}
            </pre>
          )}
        </div>
      )}

      {beats.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border/60">
          <p className="text-xs uppercase tracking-wider text-ink-soft">Storyboard</p>
          <div className="space-y-2 max-h-[420px] overflow-auto pr-1 scrollbar-thin">
            {beats.map((b, i) => (
              <div key={i} className="rounded-md border border-border p-2 bg-paper">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-medium">{i + 1}. {b.label}</p>
                  <Button
                    size="sm" variant="outline" className="h-7 px-2 text-xs"
                    onClick={() => generateKeyframe(i)}
                    disabled={loadingFrame !== null}
                  >
                    {loadingFrame === i
                      ? <Loader2 className="size-3 animate-spin" />
                      : <ImagePlus className="size-3" />}
                    Sketch
                  </Button>
                </div>
                <p className="text-xs text-ink-soft mt-1">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
