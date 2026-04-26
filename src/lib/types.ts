export type FrameId = string;

export interface Frame {
  id: FrameId;
  projectId: string;
  index: number; // ordering
  duration: number; // ms (per-frame override, else uses project.fps)
  /** Original/source still extracted from video, optional. */
  sourceBlob?: Blob;
  /** Rendered sketch outline (PNG). */
  sketchBlob: Blob;
  /** User pen-stroke layer (PNG, transparent). */
  strokesBlob?: Blob;
  /** Cached small thumbnail. */
  thumbBlob?: Blob;
  createdAt: number;
}

export type StagePerspective = "top-down" | "side-on";

export interface Actor {
  id: string;
  name: string;
  color: string; // hsl string
  thumbnailDataUrl?: string;
  path: ActorKeyframe[];
}

export interface ActorKeyframe {
  frame: number;
  x: number;
  y: number;
  easing: "linear" | "ease-in" | "ease-out" | "ease-in-out" | "snap" | "hold";
}

export type CameraAngle = "low" | "eye" | "high" | "dutch";
export type CameraShake = "none" | "subtle" | "impact";

export interface CameraKeyframe {
  frame: number;
  x: number;
  y: number;
  zoom: number;
  angle: CameraAngle;
  shake: CameraShake;
}

export interface Beat {
  frame: number;
  label: string;
}

export interface MotionBlueprint {
  stageSize: { w: number; h: number };
  perspective: StagePerspective;
  actors: Actor[];
  camera: CameraKeyframe[];
  beats: Beat[];
}

export interface Project {
  id: string;
  name: string;
  fps: number;
  width: number;
  height: number;
  outlineStyle: "thin" | "thick" | "sketchy";
  blueprint: MotionBlueprint;
  /** Optional reference character image (data URL) for AI keyframe consistency. */
  characterRefDataUrl?: string;
  /** Animation interpolation settings */
  animationInBetweenFrames?: number;
  animationEasing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
  createdAt: number;
  updatedAt: number;
  thumbDataUrl?: string;
  frameCount: number;
}

export const defaultBlueprint = (): MotionBlueprint => ({
  stageSize: { w: 1280, h: 720 },
  perspective: "top-down",
  actors: [],
  camera: [],
  beats: [],
});
