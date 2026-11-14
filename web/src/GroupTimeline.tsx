import type { TimelineLayout } from "./timeline-layout.ts";
import { useRef, useState, type CSSProperties } from "react";
import { type Project, type Occurrence } from "./domain.ts";
import { groupColor, groupRange, type LyricGroup } from "./lyric-groups.ts";
import { formatTime } from "./timing.ts";
export type DuplicatePreview = {
  group: LyricGroup;
  name: string;
  offset: number;
  extent: number;
};
export function GroupTimeline({
  project,
  displayed,
  timelineMs,
  selected,
  layout,
  preview,
  onSelect,
  onDrag,
  onOffset,
  onCommit,
}: {
  project: Project;
  displayed: Occurrence[];
  timelineMs: number;
  selected?: string;
  layout: TimelineLayout;
  preview: DuplicatePreview | null;
  onSelect: (id: string) => void;
  onDrag: (group: LyricGroup, delta: number, ghost: boolean) => number;
  onOffset: (group: LyricGroup, offset: number, ghost: boolean) => void;
  onCommit: (group: LyricGroup, offset: number) => void;
}) {
  const [dragInfo, setDragInfo] = useState<{
    id: string;
    ghost: boolean;
    offset: number;
  } | null>(null);
  const gesture = useRef<{
    group: LyricGroup;
    baseProject: Project;
    x: number;
    scale: number;
    pointer: number;
    ghost: boolean;
    base: number;
    offset: number;
  } | null>(null);
  const handle = (group: LyricGroup, ghost: boolean, index: number) => {
    const members = displayed.filter((cue) =>
        group.occurrenceIds.includes(cue.id),
      ),
      range = groupRange(members);
    const source = groupRange(
      project.occurrences.filter((cue) => group.occurrenceIds.includes(cue.id)),
    );
    if (range.start === null || range.end === null) return null;
    const offset = ghost ? (preview?.offset ?? 0) : 0;
    const start = ghost ? source.start! + offset : range.start,
      end = ghost ? source.end! + offset : range.end;
    return (
      <div
        key={ghost ? "ghost" : group.id}
        className={`timeline-group-rail ${ghost ? "ghost-rail" : ""} ${selected === group.id ? "rail-selected" : ""}`}
        data-rail={ghost ? "ghost" : group.id}
        style={
          {
            left: `${(start / timelineMs) * 100}%`,
            width: `${((end - start) / timelineMs) * 100}%`,
            top: ghost
              ? layout.height + (layout.rails.get(group.id) ?? 8)
              : (layout.rails.get(group.id) ?? 8),
            "--group-color": groupColor(group.id),
            zIndex: ghost ? 30 : selected === group.id ? 20 : 5 + (index % 3),
          } as CSSProperties
        }
      >
        <button
          type="button"
          className={
            dragInfo?.id === group.id && dragInfo.ghost === ghost
              ? "group-handle-dragging"
              : undefined
          }
          aria-label={ghost ? "Move ghost copy" : `Move group ${group.name}`}
          disabled={!ghost && !!preview}
          onFocus={() => {
            if (!ghost) onSelect(group.id);
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            if (!ghost) onSelect(group.id);
            event.currentTarget.setPointerCapture(event.pointerId);
            const board =
              event.currentTarget.closest<HTMLElement>(".timing-track")!;
            setDragInfo({
              id: group.id,
              ghost,
              offset: ghost ? preview!.offset : 0,
            });
            gesture.current = {
              group,
              baseProject: project,
              x: event.clientX,
              scale: timelineMs / board.getBoundingClientRect().width,
              pointer: event.pointerId,
              ghost,
              base: ghost ? preview!.offset : 0,
              offset: ghost ? preview!.offset : 0,
            };
          }}
          onPointerMove={(event) => {
            const current = gesture.current;
            if (!current || current.pointer !== event.pointerId) return;
            if (current.baseProject !== project) {
              gesture.current = null;
              return;
            }
            current.offset = onDrag(
              current.group,
              current.base +
                Math.round((event.clientX - current.x) * current.scale),
              current.ghost,
            );
            setDragInfo({
              id: current.group.id,
              ghost: current.ghost,
              offset: current.offset,
            });
            onOffset(current.group, current.offset, current.ghost);
          }}
          onPointerUp={(event) => {
            const current = gesture.current;
            if (!current || current.pointer !== event.pointerId) return;
            if (current.baseProject !== project) {
              gesture.current = null;
              return;
            }
            gesture.current = null;
            setDragInfo(null);
            if (!current.ghost) onCommit(current.group, current.offset);
          }}
          onPointerCancel={() => {
            const current = gesture.current;
            gesture.current = null;
            setDragInfo(null);
            if (current && !current.ghost) onOffset(current.group, 0, false);
          }}
          title={
            ghost
              ? "Drag to preview the copy's position"
              : `Move ${group.name} together`
          }
        >
          ⠿ <span>{ghost ? preview!.name : group.name}</span>
          {dragInfo?.id === group.id && dragInfo.ghost === ghost && (
            <span className="group-drag-status">
              {" "}
              · {group.occurrenceIds.length} lyrics ·{" "}
              {dragInfo.offset >= 0 ? "+" : ""}
              {(dragInfo.offset / 1000).toFixed(3)} s
            </span>
          )}
        </button>
      </div>
    );
  };
  return (
    <>
      {(project.lyricGroups ?? []).map((group, index) =>
        handle(group, false, index),
      )}
      {preview && handle(preview.group, true, 0)}
      {preview &&
        project.occurrences
          .filter(
            (cue) =>
              preview.group.occurrenceIds.includes(cue.id) &&
              cue.startMs !== null &&
              cue.endMs !== null,
          )
          .map((cue) => (
            <div
              key={cue.id}
              className="group-ghost timing-block"
              style={
                {
                  left: `${((cue.startMs! + preview.offset) / timelineMs) * 100}%`,
                  width: `${((cue.endMs! - cue.startMs!) / timelineMs) * 100}%`,
                  top: layout.height + (layout.tops.get(cue.id) ?? 36),
                  "--group-color": groupColor(preview.group.id),
                } as CSSProperties
              }
            >
              <strong>
                {project.phrases.find((p) => p.id === cue.phraseId)?.lyricKey}
              </strong>
              <span>
                {formatTime(cue.startMs! + preview.offset)} →{" "}
                {formatTime(cue.endMs! + preview.offset)}
              </span>
            </div>
          ))}
    </>
  );
}
