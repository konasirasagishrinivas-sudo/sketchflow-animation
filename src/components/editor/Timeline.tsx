import { useEffect, useMemo, useState } from "react";
import { blobUrl } from "@/lib/db";
import type { Frame } from "@/lib/types";
import { Copy, Trash2, GripVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DndContext, PointerSensor, closestCenter, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, horizontalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  frames: Frame[];
  activeIdx: number;
  onSelect: (i: number) => void;
  onReorder: (frames: Frame[]) => void;
  onDuplicate: (i: number) => void;
  onDelete: (i: number) => void;
  onAddBlank: () => void;
}

export function Timeline({
  frames, activeIdx, onSelect, onReorder, onDuplicate, onDelete, onAddBlank,
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldI = frames.findIndex((f) => f.id === active.id);
    const newI = frames.findIndex((f) => f.id === over.id);
    if (oldI < 0 || newI < 0) return;
    onReorder(arrayMove(frames, oldI, newI));
  };

  return (
    <div className="border-t border-border/60 bg-paper px-3 py-2 overflow-x-auto scrollbar-thin">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="flex items-center gap-1 min-h-[100px]">
          <SortableContext items={frames.map((f) => f.id)} strategy={horizontalListSortingStrategy}>
            {frames.map((f, i) => (
              <SortableThumb
                key={f.id}
                frame={f}
                index={i}
                active={i === activeIdx}
                onSelect={() => onSelect(i)}
                onDuplicate={() => onDuplicate(i)}
                onDelete={() => onDelete(i)}
              />
            ))}
          </SortableContext>
          <button
            onClick={onAddBlank}
            className="shrink-0 w-[112px] h-[72px] rounded-md border-2 border-dashed border-border hover:border-accent flex items-center justify-center text-ink-soft hover:text-accent transition-colors"
            title="Add blank frame"
          >
            <Plus className="size-5" />
          </button>
        </div>
      </DndContext>
    </div>
  );
}

function SortableThumb({
  frame, index, active, onSelect, onDuplicate, onDelete,
}: {
  frame: Frame; index: number; active: boolean;
  onSelect: () => void; onDuplicate: () => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: frame.id });
  const url = useMemo(() => blobUrl(frame.thumbBlob ?? frame.sketchBlob), [frame.thumbBlob, frame.sketchBlob]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="group relative shrink-0"
    >
      <button
        onClick={onSelect}
        className={`block w-[112px] h-[72px] rounded-md overflow-hidden border-2 transition-all ${
          active ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-ink-soft"
        }`}
        title={`Frame ${index + 1}`}
      >
        {url ? (
          <img src={url} alt="" className="w-full h-full object-cover bg-white" />
        ) : (
          <div className="w-full h-full bg-white" />
        )}
      </button>
      <span className="absolute bottom-0.5 left-1 text-[10px] font-mono text-ink-soft bg-paper/80 px-1 rounded">
        {index + 1}
      </span>
      <button
        {...attributes} {...listeners}
        className="absolute top-0.5 left-0.5 p-0.5 rounded bg-paper/80 text-ink-soft opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
        title="Drag to reorder"
        aria-label="Drag"
      >
        <GripVertical className="size-3" />
      </button>
      <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100">
        <Button size="icon" variant="ghost" onClick={onDuplicate}
          className="h-5 w-5 bg-paper/80 hover:bg-paper text-ink-soft" title="Duplicate">
          <Copy className="size-3" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onDelete}
          className="h-5 w-5 bg-paper/80 hover:bg-paper text-ink-soft hover:text-destructive" title="Delete">
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
  );
}
