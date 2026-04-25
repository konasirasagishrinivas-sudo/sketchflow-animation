import { supabase } from "@/integrations/supabase/client";
import type { Project } from "./types";

/** Map a DB row → app Project shape. */
function rowToProject(row: any): Project {
  return {
    id: row.id,
    name: row.name,
    fps: row.fps,
    width: row.width,
    height: row.height,
    outlineStyle: row.outline_style,
    blueprint: row.blueprint || { stageSize: { w: row.width, h: row.height }, perspective: "top-down", actors: [], camera: [], beats: [] },
    characterRefDataUrl: row.character_ref_url ?? undefined,
    thumbDataUrl: row.thumb_url ?? undefined,
    frameCount: row.frame_count ?? 0,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export async function cloudListProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToProject);
}

export async function cloudUpsertProject(p: Project): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from("projects").upsert({
    id: p.id,
    user_id: user.id,
    name: p.name,
    fps: p.fps,
    width: p.width,
    height: p.height,
    outline_style: p.outlineStyle,
    blueprint: p.blueprint as any,
    character_ref_url: p.characterRefDataUrl ?? null,
    thumb_url: p.thumbDataUrl ?? null,
    frame_count: p.frameCount,
  });
  if (error) throw error;
}

export async function cloudDeleteProject(id: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}
