import { useState, useEffect, useRef, useCallback } from "react";
import type { Frame } from "@/lib/types";
import { interpolateSequence } from "@/lib/interpolation";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";

interface Props {
  frames: Frame[];
  fps: number;
  width: number;
  height: number;
  onFrameChange: (index: number) => void;
  currentIndex: number;
}

export function AnimationPlayer({
  frames, fps, width, height, onFrameChange, currentIndex,
}: Props) {
  const [playing, setPlaying] = useState(false);
  const [inBetweenFrames, setInBetweenFrames] = useState(3);
  const [easing, setEasing] = useState<"linear" | "ease-in" | "ease-out" | "ease-in-out">("ease-in-out");
  const [interpolatedFrames, setInterpolatedFrames] = useState<Blob[]>([]);
  const [interpolating, setInterpolating] = useState(false);
  const playRef = useRef<number | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Generate interpolated frames when keyframes or settings change
  useEffect(() => {
    if (frames.length < 2) return;

    (async () => {
      setInterpolating(true);
      try {
        const keyframeBlobs = frames.map((f) => f.sketchBlob);
        const interpolated = await interpolateSequence(keyframeBlobs, width, height, {
          inBetweenFrames,
          easing,
        });
        setInterpolatedFrames(interpolated);
      } catch (err) {
        console.error("Interpolation failed:", err);
      } finally {
        setInterpolating(false);
      }
    })();
  }, [frames, width, height, inBetweenFrames, easing]);

  // Playback loop
  useEffect(() => {
    if (!playing || interpolatedFrames.length === 0) {
      if (playRef.current) clearTimeout(playRef.current);
      return;
    }

    const frameDuration = (1000 / fps) / playbackSpeed;
    playRef.current = window.setTimeout(() => {
      onFrameChange((currentIndex + 1) % interpolatedFrames.length);
    }, frameDuration);

    return () => {
      if (playRef.current) clearTimeout(playRef.current);
    };
  }, [playing, currentIndex, interpolatedFrames.length, fps, playbackSpeed, onFrameChange]);

  const displayFrameCount = interpolatedFrames.length || frames.length;
  const displayIndex = Math.min(currentIndex, displayFrameCount - 1);

  return (
    <div className="space-y-3 p-3 bg-paper-shade/20 rounded-md border border-border/40">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Animation</h3>
        <span className="text-xs text-ink-soft">
          {interpolatedFrames.length ? `${displayIndex + 1}/${displayFrameCount}` : "N/A"}
        </span>
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="outline"
          onClick={() => onFrameChange(0)}
          title="First frame"
          className="h-8 w-8"
        >
          <SkipBack className="size-3" />
        </Button>
        <Button
          size="icon"
          variant={playing ? "default" : "outline"}
          onClick={() => setPlaying(!playing)}
          title={playing ? "Pause" : "Play"}
          className="h-8 w-8"
        >
          {playing ? <Pause className="size-3" /> : <Play className="size-3" />}
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => onFrameChange(displayFrameCount - 1)}
          title="Last frame"
          className="h-8 w-8"
        >
          <SkipForward className="size-3" />
        </Button>

        {/* Playback speed */}
        <div className="ml-auto flex items-center gap-2">
          <Label htmlFor="playback-speed" className="text-xs">Speed</Label>
          <Select value={String(playbackSpeed)} onValueChange={(v) => setPlaybackSpeed(Number(v))}>
            <SelectTrigger className="w-16 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.5">0.5x</SelectItem>
              <SelectItem value="1">1x</SelectItem>
              <SelectItem value="1.5">1.5x</SelectItem>
              <SelectItem value="2">2x</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Interpolation settings */}
      <div className="space-y-2 pt-2 border-t border-border/40">
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="in-between" className="text-xs">In-between frames</Label>
            <span className="text-xs text-ink-soft font-mono">{inBetweenFrames}</span>
          </div>
          <Slider
            id="in-between"
            value={[inBetweenFrames]}
            min={0}
            max={10}
            step={1}
            onValueChange={(v) => setInBetweenFrames(v[0])}
            disabled={interpolating}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="easing" className="text-xs">Easing</Label>
          <Select value={easing} onValueChange={(v) => setEasing(v as any)}>
            <SelectTrigger className="h-8 mt-1 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="linear">Linear</SelectItem>
              <SelectItem value="ease-in">Ease in</SelectItem>
              <SelectItem value="ease-out">Ease out</SelectItem>
              <SelectItem value="ease-in-out">Ease in-out</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {interpolating && (
          <p className="text-xs text-ink-soft italic">Generating smooth frames…</p>
        )}
      </div>

      {/* Frame slider */}
      <div className="space-y-1 pt-2 border-t border-border/40">
        <Slider
          value={[displayIndex]}
          min={0}
          max={Math.max(0, displayFrameCount - 1)}
          step={1}
          onValueChange={(v) => onFrameChange(v[0])}
          disabled={interpolating || displayFrameCount === 0}
          className="mt-2"
        />
      </div>
    </div>
  );
}
