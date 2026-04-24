import Dexie, { type Table } from "dexie";
import type { Frame, Project } from "./types";

class InkframeDB extends Dexie {
  projects!: Table<Project, string>;
  frames!: Table<Frame, string>;

  constructor() {
    super("inkframe");
    this.version(1).stores({
      projects: "id, updatedAt, name",
      frames: "id, projectId, [projectId+index]",
    });
  }
}

export const db = new InkframeDB();

export async function listProjects(): Promise<Project[]> {
  return db.projects.orderBy("updatedAt").reverse().toArray();
}

export async function getProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id);
}

export async function saveProject(p: Project): Promise<void> {
  p.updatedAt = Date.now();
  await db.projects.put(p);
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction("rw", db.projects, db.frames, async () => {
    await db.frames.where("projectId").equals(id).delete();
    await db.projects.delete(id);
  });
}

export async function listFrames(projectId: string): Promise<Frame[]> {
  const frames = await db.frames.where("projectId").equals(projectId).toArray();
  return frames.sort((a, b) => a.index - b.index);
}

export async function putFrame(f: Frame): Promise<void> {
  await db.frames.put(f);
}

export async function putFrames(frames: Frame[]): Promise<void> {
  await db.frames.bulkPut(frames);
}

export async function deleteFrame(id: string): Promise<void> {
  await db.frames.delete(id);
}

export async function reindexFrames(projectId: string, ordered: Frame[]): Promise<void> {
  const updated = ordered.map((f, i) => ({ ...f, index: i }));
  await db.frames.bulkPut(updated);
}

/** Helper to read a blob as object URL with cleanup. */
export function blobUrl(blob: Blob | undefined | null): string | undefined {
  if (!blob) return undefined;
  return URL.createObjectURL(blob);
}
