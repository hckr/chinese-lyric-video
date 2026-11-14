import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { type Project, removeAppearance } from "./domain.ts";
import {
  createGroup,
  groupColor,
  groupRange,
  groupWarnings,
  sidebarUnits,
  type LyricGroup,
} from "./lyric-groups.ts";
import { formatTime, timingNotices } from "./timing.ts";

function GroupWarning({ text }: { text: string }) {
  const id = useId();
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const show = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(rect.right - 280, window.innerWidth - 288)),
      top: rect.bottom + 8,
    });
  };
  return (
    <span
      className="group-warning-indicator"
      role="img"
      tabIndex={0}
      aria-label={text}
      aria-describedby={position ? id : undefined}
      onMouseEnter={(event) => show(event.currentTarget)}
      onMouseLeave={() => setPosition(null)}
      onFocus={(event) => show(event.currentTarget)}
      onBlur={() => setPosition(null)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setPosition(null);
      }}
    >
      ⚠
      {position &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            className="dictionary-pinyin-bubble group-warning-bubble"
            style={{ left: position.left, top: position.top }}
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}

function GroupDialog({
  group,
  kind,
  onClose,
  onApply,
}: {
  group: LyricGroup;
  kind: "rename" | "delete";
  onClose: () => void;
  onApply: (name: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    [name, setName] = useState(group.name);
  useEffect(() => {
    const element = ref.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="remove-dialog group-action-dialog"
      onCancel={onClose}
      aria-labelledby="group-dialog-title"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onApply(name.trim());
        }}
      >
        <h2 id="group-dialog-title">
          {kind === "rename" ? "Rename group" : "Delete group?"}
        </h2>
        {kind === "rename" ? (
          <label>
            Group name
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        ) : (
          <p>
            Delete “{group.name}” and its {group.occurrenceIds.length}{" "}
            appearances? Unused lyric content will also be removed. Undo can
            restore everything.
          </p>
        )}
        <div className="remove-dialog-actions">
          <button type="button" autoFocus={kind === "delete"} onClick={onClose}>
            Cancel
          </button>
          <button disabled={!name.trim()}>
            {kind === "rename" ? "Save name" : "Delete group"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
export function GroupSidebar({
  project,
  selectedId,
  selectedGroup,
  onSelect,
  onChange,
  onDuplicate,
  duration,
}: {
  project: Project;
  selectedId?: string;
  selectedGroup?: string;
  onSelect: (id: string) => void;
  onChange: (project: Project, id: string) => void;
  onDuplicate: (group: LyricGroup) => void;
  duration?: number;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [range, setRange] = useState<{
    first?: string;
    last?: string;
    name: string;
  } | null>(null);
  const [hovered, setHovered] = useState<string>();
  const [error, setError] = useState("");
  const [menu, setMenu] = useState<{
    group: LyricGroup;
    x: number;
    y: number;
  } | null>(null);
  const [action, setAction] = useState<{
    group: LyricGroup;
    kind: "rename" | "delete";
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement | null>(null);
  const units = sidebarUnits(project),
    rows = units.flatMap((unit) => unit.members);
  const first = rows.findIndex((cue) => cue.id === range?.first),
    last = rows.findIndex((cue) => cue.id === (hovered ?? range?.last));
  const included = range?.first
    ? rows
        .slice(
          Math.min(first, last < 0 ? first : last),
          Math.max(first, last < 0 ? first : last) + 1,
        )
        .map((cue) => cue.id)
    : [];
  const eligible =
    !!range?.last &&
    !hovered &&
    included.length >= 2 &&
    !project.lyricGroups?.some((g) =>
      g.occurrenceIds.some((id) => included.includes(id)),
    );
  useEffect(() => {
    if (!menu && !range) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(null);
        setRange(null);
        trigger.current?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [menu, range]);
  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);
  const rangeOpen = range !== null;
  useEffect(() => {
    if (!rangeOpen) return;
    const frame = requestAnimationFrame(() => {
      const list = document.querySelector<HTMLElement>(
        ".timing-occurrence-list",
      );
      const item = list?.querySelector<HTMLElement>(".range-selected");
      if (list && item)
        list.scrollTo({
          top:
            list.scrollTop +
            item.getBoundingClientRect().top -
            list.getBoundingClientRect().top,
          behavior: "smooth",
        });
    });
    return () => cancelAnimationFrame(frame);
  }, [rangeOpen]);
  const row = (cue: Project["occurrences"][number]) => (
    <button
      key={cue.id}
      data-occurrence={cue.id}
      className={`${cue.id === selectedId ? "selected" : ""} ${included.includes(cue.id) ? "range-selected" : ""}`}
      aria-pressed={cue.id === selectedId}
      onMouseEnter={() => {
        if (range?.first && !range.last) {
          const target = rows.findIndex((item) => item.id === cue.id);
          const segment = rows.slice(
            Math.min(first, target),
            Math.max(first, target) + 1,
          );
          if (
            !project.lyricGroups?.some((group) =>
              group.occurrenceIds.some((id) =>
                segment.some((item) => item.id === id),
              ),
            )
          )
            setHovered(cue.id);
        }
      }}
      onMouseLeave={() => setHovered(undefined)}
      onClick={() => {
        if (range) {
          if (range.last || cue.id === range.first) return;
          setHovered(undefined);
          const target = rows.findIndex((item) => item.id === cue.id);
          const segment = rows.slice(
            Math.min(first < 0 ? target : first, target),
            Math.max(first, target) + 1,
          );
          if (
            project.lyricGroups?.some((group) =>
              group.occurrenceIds.some((id) =>
                segment.some((item) => item.id === id),
              ),
            )
          )
            return;
          setRange({
            ...range,
            ...(!range.first ? { first: cue.id } : { last: cue.id }),
          });
        } else onSelect(cue.id);
      }}
    >
      {range && (
        <span className="range-boundary">
          {cue.id === included[0] ? "First lyric" : ""}
          {cue.id === included.at(-1) && included.length > 1
            ? "Last lyric"
            : ""}
        </span>
      )}
      <strong>
        {project.phrases.find((p) => p.id === cue.phraseId)?.lyricKey}
      </strong>
      <span>
        {formatTime(cue.startMs)} → {formatTime(cue.endMs)}
      </span>
      {timingNotices(
        project.occurrences,
        project.occurrences.findIndex((o) => o.id === cue.id),
        duration,
      ).map((notice) => (
        <span className="timing-notice" key={notice}>
          {notice}
        </span>
      ))}
    </button>
  );
  return (
    <section className="timing-occurrences" aria-label="Ordered occurrences">
      <div className="group-sidebar-heading">
        <h2>
          Lyrics <span className="muted">{rows.length}</span>
        </h2>
        <button
          onClick={() => {
            setHovered(undefined);
            setRange({
              name: "",
              first: project.lyricGroups?.some((group) =>
                group.occurrenceIds.includes(selectedId ?? ""),
              )
                ? undefined
                : selectedId,
            });
            setError("");
          }}
        >
          + Group
        </button>
      </div>
      {range && (
        <form
          className="group-range-form"
          onSubmit={(event) => {
            event.preventDefault();
            try {
              const next = createGroup(
                { ...project, occurrences: rows },
                range.name,
                included[0],
                included.at(-1)!,
              );
              onChange(next, range.first!);
              setRange(null);
            } catch (e) {
              setError(String(e));
            }
          }}
        >
          <p role="status">
            {error ||
              (!range.first
                ? "Choose the first lyric."
                : !range.last
                  ? "Select the last lyric."
                  : `${included.length} lyrics selected. Ready to create.`)}
          </p>
          <label>
            Group name
            <input
              placeholder="Group name"
              value={range.name}
              onChange={(e) => setRange({ ...range, name: e.target.value })}
            />
          </label>
          <div className="actions group-range-actions">
            <button type="button" onClick={() => setRange(null)}>
              Cancel
            </button>
            <button
              type="button"
              disabled={!range.last}
              onClick={() => {
                setHovered(undefined);
                setRange({ ...range, last: undefined });
              }}
            >
              Adjust range
            </button>
            <button
              className="primary"
              disabled={!eligible || !range.name.trim()}
            >
              Create
            </button>
          </div>
        </form>
      )}
      <div className="timing-occurrence-list">
        {units.map((unit) => {
          if (!unit.group) return row(unit.members[0]);
          const group = unit.group,
            bounds = groupRange(unit.members),
            warnings = groupWarnings(project, group, duration),
            warningText = `Warning: ${warnings.map((warning) => warning.replace(/^Warning:\s*/i, "")).join(", ")}`;
          return (
            <div
              className={`spec-lyric-group ${selectedGroup === group.id ? "group-selected" : ""}`}
              key={unit.id}
              data-group={group.id}
              style={{ "--group-color": groupColor(group.id) } as CSSProperties}
            >
              <div className="spec-group-header">
                <button
                  className="group-header-toggle"
                  aria-label={`${collapsed.has(group.id) ? "Expand" : "Collapse"} ${group.name}`}
                  aria-expanded={!collapsed.has(group.id)}
                  onClick={() =>
                    setCollapsed((previous) => {
                      const next = new Set(previous);
                      if (next.has(group.id)) next.delete(group.id);
                      else next.add(group.id);
                      return next;
                    })
                  }
                >
                  <span className="group-chevron" aria-hidden="true">
                    {collapsed.has(group.id) ? "▸" : "▾"}
                  </span>
                  <span className="group-summary">
                    <strong>{group.name}</strong>
                    <span>
                      {unit.members.length} lyrics
                      {bounds.start !== null
                        ? ` · ${formatTime(bounds.start)} → ${formatTime(bounds.end)}`
                        : " · Unassigned"}
                    </span>
                  </span>
                </button>
                {warnings.length > 0 && <GroupWarning text={warningText} />}
                <button
                  className="group-menu-trigger"
                  aria-label={`Actions for ${group.name}`}
                  aria-haspopup="menu"
                  aria-expanded={menu?.group.id === group.id}
                  onClick={(e) => {
                    trigger.current = e.currentTarget;
                    const rect = e.currentTarget.getBoundingClientRect();
                    setMenu({
                      group,
                      x: Math.max(
                        8,
                        Math.min(innerWidth - 200, rect.right - 185),
                      ),
                      y: Math.max(
                        8,
                        Math.min(innerHeight - 210, rect.bottom + 4),
                      ),
                    });
                  }}
                >
                  …
                </button>
              </div>
              {!collapsed.has(group.id) && unit.members.map(row)}
            </div>
          );
        })}
      </div>
      {menu &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="group-overflow-menu"
            style={{ position: "fixed", left: menu.x, top: menu.y }}
          >
            {["Duplicate…", "Rename…", "Ungroup", "Delete group"].map(
              (label) => (
                <button
                  role="menuitem"
                  key={label}
                  onClick={() => {
                    const group = menu.group;
                    setMenu(null);
                    if (label === "Duplicate…") onDuplicate(group);
                    else if (label === "Rename…")
                      setAction({ group, kind: "rename" });
                    else if (label === "Delete group")
                      setAction({ group, kind: "delete" });
                    else
                      onChange(
                        {
                          ...project,
                          lyricGroups: project.lyricGroups!.filter(
                            (g) => g.id !== group.id,
                          ),
                        },
                        selectedId ?? group.occurrenceIds[0],
                      );
                  }}
                >
                  {label}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
      {action && (
        <GroupDialog
          group={action.group}
          kind={action.kind}
          onClose={() => setAction(null)}
          onApply={(name) => {
            let next = project;
            if (action.kind === "rename")
              next = {
                ...project,
                lyricGroups: project.lyricGroups!.map((g) =>
                  g.id === action.group.id ? { ...g, name } : g,
                ),
              };
            else
              for (const id of action.group.occurrenceIds)
                next = removeAppearance(next, id);
            onChange(
              next,
              next.occurrences.find((o) => o.id === selectedId)?.id ??
                next.occurrences[0]?.id ??
                "",
            );
            setAction(null);
          }}
        />
      )}
    </section>
  );
}
