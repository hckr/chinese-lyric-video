import { AutomaticTiming } from "./AutomaticTiming";
import { timelineLayout, type TimelineLayout } from "./timeline-layout.ts";
import {
  orderGroupedProject,
  groupRange,
  groupColor,
  groupOffset,
  shiftGroup,
  duplicateGroup,
  groupWarnings,
} from "./lyric-groups.ts";
import { GroupSidebar } from "./GroupSidebar";
import { GroupTimeline, type DuplicatePreview } from "./GroupTimeline";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useMemo,
  type CSSProperties,
} from "react";
import type { Occurrence, Project } from "./domain.ts";
import { useWeakEstimate } from "./automatic-timing.ts";
import { defaultTimingSettings, linePinyin } from "./domain.ts";
import { LyricReading } from "./LyricReading";
import {
  validTiming,
  timingStatus,
  reviewTiming,
  nextUnreviewed,
  latestAutomatic,
  editTiming,
  formatTime,
  rulerTicks,
  formatRulerTime,
  followPlayhead,
  mediaMs,
  moveProjectTiming,
  activeLyrics,
  resetTiming,
  timingNotices,
  type Boundary,
  type Snap,
} from "./timing.ts";
import { useLocalAudio } from "./useLocalAudio.ts";

function smoothScroll(
  element: HTMLElement,
  position: { left?: number; top?: number },
) {
  element.scrollTo({
    ...position,
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
  });
}
type Props = {
  project: Project;
  active: boolean;
  selectedId?: string;
  onSelect: (id: string) => void;
  onChange: (project: Project, id: string, preserveOrder?: boolean) => void;
  onReview: (phraseId: string) => void;
  onRemove: (id: string) => void;
  onAudioMetadata: (audio: NonNullable<Project["audio"]>) => void;
  onUndo: () => void;
  onRedo: () => void;
};
type Gesture = {
  original: Occurrence;
  boundary: Boundary;
  x: number;
  scale: number;
  pointer: number;
  draft: Project;
  linkEdges: boolean;
};
function TimingFields({
  cue,
  onApply,
}: {
  cue: Occurrence;
  onApply: (start: string, end: string) => void;
}) {
  const [start, setStart] = useState(String(cue.startMs ?? "")),
    [end, setEnd] = useState(String(cue.endMs ?? ""));
  useEffect(() => {
    setStart(String(cue.startMs ?? ""));
    setEnd(String(cue.endMs ?? ""));
  }, [cue.id, cue.startMs, cue.endMs]);
  return (
    <form
      noValidate
      className="timing-fields"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(start, end);
      }}
    >
      <label>
        Start (ms)
        <input
          aria-label="Start milliseconds"
          type="number"
          step="1"
          min="0"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
      </label>
      <label>
        End (ms)
        <input
          aria-label="End milliseconds"
          type="number"
          step="1"
          min="0"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </label>
      <button type="submit">Apply timing</button>
    </form>
  );
}
export function TimingEditor({
  project: sourceProject,
  active,
  selectedId,
  onSelect,
  onChange,
  onReview,
  onRemove,
  onAudioMetadata,
  onUndo,
  onRedo,
}: Props) {
  const project = useMemo(
    () => orderGroupedProject(sourceProject),
    [sourceProject],
  );
  const [duplicate, setDuplicate] = useState<DuplicatePreview | null>(null);
  const [groupDraft, setGroupDraft] = useState<{
    id: string;
    offset: number;
    base: Project;
  } | null>(null);
  const duplicating = duplicate !== null;
  useEffect(() => {
    if (!duplicating) return;
    const elements = [
      ...document.querySelectorAll<HTMLElement>(
        ".navigation, main > header, .lyric-structure-actions, .lyric-structure-panel",
      ),
    ];
    const reveal = requestAnimationFrame(() => {
      const handle = track.current?.querySelector<HTMLElement>(
        '[data-rail="ghost"] button',
      );
      // Reveal through every scrolling ancestor, including the page itself.
      handle?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "center",
        inline: "center",
      });
    });
    const previous = elements.map((element) => element.inert);
    elements.forEach((element) => {
      element.inert = true;
    });
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDuplicate(null);
      }
      if (event.ctrlKey || event.metaKey) event.stopPropagation();
    };
    document.addEventListener("keydown", key, true);
    return () => {
      cancelAnimationFrame(reveal);
      elements.forEach((element, i) => {
        element.inert = previous[i];
      });
      document.removeEventListener("keydown", key, true);
    };
  }, [duplicating]);
  const index = Math.max(
    0,
    project.occurrences.findIndex((o) => o.id === selectedId),
  );
  const cue = project.occurrences[index];
  const automatic = cue?.automaticTiming;
  const automaticDiffers =
    !!automatic &&
    (automatic.startMs !== cue?.startMs || automatic.endMs !== cue?.endMs);
  const resetTarget = cue?.reviewedTiming ?? cue?.automaticTiming;
  const resetDiffers =
    !!cue &&
    !!resetTarget &&
    (cue.startMs !== resetTarget.startMs ||
      cue.endMs !== resetTarget.endMs ||
      (!!cue.reviewedTiming && cue.timingReview !== "reviewed"));
  const phrase = project.phrases.find((p) => p.id === cue?.phraseId);
  const selectedGroup = project.lyricGroups?.find((group) =>
    group.occurrenceIds.includes(cue?.id ?? ""),
  )?.id;
  const [error, setError] = useState("");
  const lockedScroll = useRef(0);
  const pan = useRef<{ x: number; left: number; pointer: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const settings = project.timingSettings ?? defaultTimingSettings;
  const { zoom, snap, linkEdges } = settings;
  const updateSettings = (patch: Partial<typeof settings>) =>
    onChange(
      { ...project, timingSettings: { ...settings, ...patch } },
      cue?.id ?? "",
      true,
    );
  const setZoom = (zoom: typeof settings.zoom) => updateSettings({ zoom });
  const setSnap = (snap: Snap) => updateSettings({ snap });
  const setLinkEdges = (linkEdges: boolean) => updateSettings({ linkEdges });
  const [boundary, setBoundary] = useState<Boundary>("both");
  const [showTranslations, setShowTranslations] = useState(true);
  const [loopEnabled, setLoopEnabled] = useState(false),
    [draft, setDraft] = useState<Project | null>(null);
  const [identityReady, setIdentityReady] = useState(false);
  const [automaticTimingOpen, setAutomaticTimingOpen] = useState(false);
  const automaticTimingTrigger = useRef<HTMLButtonElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPosition, setSettingsPosition] = useState<{
    left: number;
    top: number;
  }>();
  const settingsDialog = useRef<HTMLDivElement>(null);
  const settingsTrigger = useRef<HTMLButtonElement>(null);
  const closeSettings = (restoreFocus: boolean) => {
    setSettingsOpen(false);
    if (restoreFocus) settingsTrigger.current?.focus({ preventScroll: true });
  };
  useLayoutEffect(() => {
    if (!settingsOpen || !active || duplicate) return;
    const panel = settingsDialog.current!,
      trigger = settingsTrigger.current!;
    const position = () => {
      const anchor = trigger.getBoundingClientRect();
      const { width, height } = panel.getBoundingClientRect();
      const above = anchor.top - height - 8,
        right = anchor.right + 8;
      const headerBottom =
        document.querySelector("main > header")?.getBoundingClientRect()
          .bottom ?? 0;
      if (above >= headerBottom + 8 && anchor.top <= innerHeight)
        setSettingsPosition({
          top: above,
          left: Math.max(
            8,
            Math.min(anchor.right - width, innerWidth - width - 8),
          ),
        });
      else if (
        right + width + 8 <= innerWidth &&
        anchor.bottom >= 0 &&
        anchor.top < innerHeight
      )
        setSettingsPosition({
          top: Math.max(
            headerBottom + 8,
            Math.min(anchor.top, innerHeight - height - 8),
          ),
          left: right,
        });
      else
        setSettingsPosition({
          top: Math.max(
            headerBottom + 8,
            Math.min(anchor.bottom + 8, innerHeight - height - 8),
          ),
          left: Math.max(
            8,
            Math.min(anchor.right - width, innerWidth - width - 8),
          ),
        });
    };
    position();
    panel.querySelector("select")?.focus({ preventScroll: true });
    const dismiss = (event: PointerEvent) => {
      if (
        !panel.contains(event.target as Node) &&
        !trigger.contains(event.target as Node)
      )
        setSettingsOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.querySelector("dialog[open]"))
        return;
      event.preventDefault();
      setSettingsOpen(false);
      trigger.focus({ preventScroll: true });
    };
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [settingsOpen, active, duplicate]);
  useEffect(() => {
    if (!active || duplicate) setSettingsOpen(false);
  }, [active, duplicate]);
  const scroll = useRef<HTMLDivElement>(null),
    track = useRef<HTMLDivElement>(null),
    gesture = useRef<Gesture | null>(null);
  const [rulerWidth, setRulerWidth] = useState(560);
  useEffect(() => {
    const board = track.current;
    if (!board) return;
    const measure = () => {
      if (board.clientWidth > 0) setRulerWidth(board.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    return () => observer.disconnect();
  }, []);
  const audio = useLocalAudio(
    active,
    (metadata) => {
      if (!duplicate) onAudioMetadata(metadata);
    },
    null,
  );
  useEffect(() => {
    audio.cancelBounded();
    setLoopEnabled(false);
  }, [
    cue?.id,
    cue?.startMs,
    cue?.endMs,
    active,
    audio.url,
    settings.preRollMs,
    settings.postRollMs,
  ]);
  const duration = audio.durationMs;
  const resetOutsideAudio =
    !!resetTarget && !validTiming(resetTarget, duration);
  const canReset = resetDiffers && !resetOutsideAudio;
  const listen = (bounds: { startMs: number; endMs: number }, repeat = false) =>
    audio.playSegment(
      {
        startMs: bounds.startMs - settings.preRollMs,
        endMs: bounds.endMs + settings.postRollMs,
      },
      repeat,
    );
  const baseTimelineMs = Math.max(
    duration ?? 30000,
    1000,
    ...project.occurrences.map((o) => Math.max(o.startMs ?? 0, o.endMs ?? 0)),
  );
  const timelineMs = duplicate?.extent ?? baseTimelineMs;
  const ticks = useMemo(
    () => rulerTicks(timelineMs, rulerWidth),
    [timelineMs, rulerWidth],
  );
  useEffect(() => {
    const viewport = scroll.current;
    if (!viewport || !active) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          (entry.target as HTMLElement).style.visibility =
            entry.intersectionRatio >= 0.99 ? "visible" : "hidden";
      },
      { root: viewport, threshold: 0.99 },
    );
    viewport
      .querySelectorAll(".timing-ruler-label")
      .forEach((label) => observer.observe(label));
    return () => observer.disconnect();
  }, [active, ticks]);
  const available = duration !== undefined;
  const groupPreview =
    groupDraft && groupDraft.base === project
      ? shiftGroup(project, groupDraft.id, groupDraft.offset)
      : project;
  const displayed = (draft ?? groupPreview).occurrences;
  const playingLyrics = available
    ? activeLyrics(displayed, audio.positionMs)
    : [];
  const layoutHistory = useRef(new WeakMap<Project, TimelineLayout>());
  const layout = useMemo(
    () => layoutHistory.current.get(project) ?? timelineLayout(project),
    [project],
  );
  useEffect(() => {
    layoutHistory.current.set(project, layout);
  }, [layout, project]);
  const sidebar = useRef<HTMLDivElement>(null);
  const notices = timingNotices(project.occurrences, index, duration);
  const remainingUntimed = project.occurrences.filter(
    (o) => !validTiming(o, duration),
  ).length;
  const nextReviewId =
    cue && settings.autoAdvance && cue.timingReview !== "reviewed"
      ? nextUnreviewed(project.occurrences, cue.id, duration)
      : undefined;
  const allTimedReviewed = project.occurrences.every(
    (o) => !validTiming(o, duration) || o.timingReview === "reviewed",
  );
  const [showReviewCompletion, setShowReviewCompletion] = useState(false);
  useEffect(() => {
    if (!allTimedReviewed) setShowReviewCompletion(false);
  }, [allTimedReviewed]);
  const attempt = (action: () => void) => {
    try {
      setError("");
      action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const update = (patch: Partial<Pick<Occurrence, "startMs" | "endMs">>) => {
    if (cue)
      attempt(() =>
        onChange(editTiming(project, cue.id, patch, duration), cue.id),
      );
  };
  const capture = (edge: "startMs" | "endMs") => {
    if (available && audio.ref.current)
      update({ [edge]: mediaMs(audio.ref.current.currentTime) });
  };
  const nudge = (delta: number, edge = boundary) => {
    if (!cue) return;
    attempt(() => {
      onChange(
        moveProjectTiming(
          project,
          cue.id,
          delta,
          edge,
          duration,
          "off",
          linkEdges,
        ),
        cue.id,
      );
    });
  };
  useEffect(() => {
    if (!active || !cue) return;
    const list = sidebar.current?.querySelector<HTMLElement>(
      ".timing-occurrence-list",
    );
    const item =
      list &&
      [...list.querySelectorAll<HTMLElement>("[data-occurrence]")].find(
        (el) => el.dataset.occurrence === cue.id,
      );
    if (list && item) {
      const a = item.getBoundingClientRect(),
        b = list.getBoundingClientRect();
      if (a.top < b.top)
        smoothScroll(list, { top: list.scrollTop + a.top - b.top });
      else if (a.bottom > b.bottom)
        smoothScroll(list, { top: list.scrollTop + a.bottom - b.bottom });
    }
    const scroller = scroll.current,
      board = track.current;
    const previous = project.occurrences
      .slice(0, index)
      .reverse()
      .find((o) => o.endMs !== null);
    const following = project.occurrences
      .slice(index + 1)
      .find((o) => o.startMs !== null);
    const anchorMs = cue.startMs ?? previous?.endMs ?? following?.startMs;
    if (scroller && board && anchorMs != null && !gesture.current) {
      const start = (anchorMs / timelineMs) * board.clientWidth;
      const end = ((cue.endMs ?? anchorMs) / timelineMs) * board.clientWidth;
      if (
        start < scroller.scrollLeft ||
        end > scroller.scrollLeft + scroller.clientWidth
      )
        smoothScroll(scroller, {
          left: Math.max(0, start - scroller.clientWidth * 0.2),
        });
    }
    if (scroller && !gesture.current) {
      const block = [
        ...scroller.querySelectorAll<HTMLElement>("[data-cue]"),
      ].find((element) => element.dataset.cue === cue.id);
      if (block) {
        const blockRect = block.getBoundingClientRect();
        const viewportRect = scroller.getBoundingClientRect();
        if (
          blockRect.top < viewportRect.top ||
          blockRect.bottom > viewportRect.bottom
        )
          smoothScroll(scroller, {
            top: scroller.scrollTop + blockRect.top - viewportRect.top - 24,
          });
        // Page reveal must not race the timeline's own horizontal and vertical scroll.
        const headerBottom =
          document.querySelector("main > header")?.getBoundingClientRect()
            .bottom ?? 0;
        if (
          viewportRect.top > window.innerHeight - 180 ||
          viewportRect.bottom < headerBottom
        ) {
          window.scrollTo({
            top: window.scrollY + viewportRect.top - headerBottom - 12,
            behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "instant"
              : "smooth",
          });
        }
      }
    }
    // Selection changes reveal panels; dragging must retain its pointer coordinate space.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cue?.id, project.timingRun?.id, active]);
  useEffect(() => {
    const panel = scroll.current;
    if (!panel) return;
    lockedScroll.current = panel.scrollLeft;
    if (!audio.playing)
      panel.scrollTo({ left: panel.scrollLeft, behavior: "instant" });
  }, [audio.playing]);
  useEffect(() => {
    const panel = scroll.current,
      board = track.current;
    if (!audio.playing || !active || !panel || !board) return;
    const x = (audio.positionMs / timelineMs) * board.clientWidth;
    const left = followPlayhead(
      x,
      lockedScroll.current,
      panel.clientWidth,
      board.clientWidth,
    );
    if (Math.abs(left - lockedScroll.current) > 0.5) {
      lockedScroll.current = left;
      smoothScroll(panel, { left });
    }
  }, [audio.positionMs, audio.playing, active, timelineMs, zoom]);
  const select = (id: string, seek = true) => {
    audio.cancelBounded();
    setLoopEnabled(false);
    if (duplicate) return;
    onSelect(id);
    setError("");
    const next = project.occurrences.find((o) => o.id === id);
    if (seek && next?.startMs !== null && next?.startMs !== undefined)
      audio.seek(next.startMs);
  };
  const step = (delta: number) => {
    const next = project.occurrences[index + delta];
    if (next) select(next.id);
  };
  useEffect(() => {
    if (!active || duplicate) return;
    const key = (event: KeyboardEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (
        target.closest(
          "input, textarea, select, [contenteditable=true], [role=dialog], dialog",
        )
      )
        return;
      if (event.ctrlKey || event.metaKey) {
        if (event.key.toLowerCase() === "z") {
          event.preventDefault();
          if (event.shiftKey) onRedo();
          else onUndo();
        }
        return;
      }
      if (event.key === "Escape" && gesture.current) {
        gesture.current = null;
        setDraft(null);
        event.preventDefault();
        return;
      }
      const value = event.key.toLowerCase();
      if (value === " " && target.closest("button, summary")) return;
      if ([" ", "s", "e", "arrowleft", "arrowright", "[", "]"].includes(value))
        event.preventDefault();
      if (value === " ") {
        setLoopEnabled(false);
        audio.toggle();
      }
      if (value === "s") capture("startMs");
      if (value === "e") capture("endMs");
      if (value === "[") step(-1);
      if (value === "]") step(1);
      if (value === "arrowleft" || value === "arrowright") {
        const direction = value === "arrowleft" ? -1 : 1;
        if (event.altKey) nudge(direction * (event.shiftKey ? 100 : 10));
        else
          audio.seek(
            (audio.ref.current ? mediaMs(audio.ref.current.currentTime) : 0) +
              direction * (event.shiftKey ? 1000 : 100),
          );
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  });
  // A drag is one history entry. Undo/navigation during a gesture cancels it.
  useEffect(() => {
    gesture.current = null;
    setDraft(null);
  }, [project, active]);
  const zoomTo = (value: typeof settings.zoom) => {
    const scroller = scroll.current,
      board = track.current;
    const ratio = Math.min(
      1,
      Math.max(
        0,
        (available ? audio.positionMs : (cue?.startMs ?? 0)) / timelineMs,
      ),
    );
    const anchor = Math.max(
      20,
      Math.min(
        (scroller?.clientWidth ?? 560) - 40,
        board ? ratio * board.clientWidth - (scroller?.scrollLeft ?? 0) : 0,
      ),
    );
    setZoom(value);
    requestAnimationFrame(() => {
      if (scroller && board) {
        const left = Math.max(
          0,
          Math.min(
            board.clientWidth - scroller.clientWidth,
            ratio * board.clientWidth - anchor,
          ),
        );
        lockedScroll.current = left;
        smoothScroll(scroller, { left });
      }
    });
  };
  const pointerStart = (
    event: React.PointerEvent,
    original: Occurrence,
    edge: Boundary,
  ) => {
    if (event.button !== 0 || !track.current) return;
    event.preventDefault();
    event.stopPropagation();
    select(original.id, false);
    setBoundary(edge);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    gesture.current = {
      original,
      boundary: edge,
      x: event.clientX,
      scale: timelineMs / track.current.getBoundingClientRect().width,
      pointer: event.pointerId,
      draft: project,
      linkEdges,
    };
    setDraft(project);
  };
  const pointerMove = (event: React.PointerEvent) => {
    const current = gesture.current;
    if (!current || current.pointer !== event.pointerId) return;
    attempt(() => {
      current.draft = moveProjectTiming(
        project,
        current.original.id,
        Math.round((event.clientX - current.x) * current.scale),
        current.boundary,
        duration,
        snap,
        current.linkEdges,
      );
      setDraft(current.draft);
    });
  };
  const pointerEnd = (event: React.PointerEvent) => {
    const current = gesture.current;
    if (!current || current.pointer !== event.pointerId) return;
    gesture.current = null;
    setDraft(null);
    if (event.type === "pointerup")
      attempt(() => onChange(current.draft, current.original.id));
  };
  const blockKey = (
    event: React.KeyboardEvent,
    original: Occurrence,
    edge: Boundary,
  ) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    attempt(() => {
      onChange(
        moveProjectTiming(
          project,
          original.id,
          (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 100 : 10),
          edge,
          duration,
          "off",
          linkEdges,
        ),
        original.id,
      );
    });
  };
  return (
    <div className="timing-workspace">
      <section
        className="timing-transport"
        inert={!!duplicate}
        aria-label="Audio transport"
      >
        {/* The timing editor uses the media element as its clock, outside Remotion. */}
        {/* eslint-disable-next-line @remotion/warn-native-media-tag */}
        <audio
          ref={audio.ref}
          src={audio.url || undefined}
          preload="metadata"
          onLoadedMetadata={() => void audio.metadata()}
          onError={audio.mediaError}
        />
        <div className="timing-controls">
          <button
            className="primary"
            disabled={!available}
            onClick={() => {
              setLoopEnabled(false);
              audio.toggle();
            }}
          >
            {audio.playing ? "Pause" : "Play"}
          </button>
          <output className="timing-clock" aria-label="Audio time">
            {formatTime(audio.positionMs)} /{" "}
            {available ? formatTime(duration) : "No audio loaded"}
          </output>
          <label className="timing-speed">
            Speed
            <select
              aria-label="Playback speed"
              defaultValue="1"
              onChange={(e) => {
                if (audio.ref.current) {
                  audio.ref.current.defaultPlaybackRate = Number(
                    e.target.value,
                  );
                  audio.ref.current.playbackRate = Number(e.target.value);
                }
              }}
            >
              <option value="0.5">0.5×</option>
              <option value="0.75">0.75×</option>
              <option value="1">1×</option>
              <option value="1.25">1.25×</option>
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={loopEnabled}
              disabled={
                !available ||
                !cue ||
                cue.startMs === null ||
                cue.endMs === null ||
                cue.endMs <= cue.startMs ||
                cue.endMs > (duration ?? 0)
              }
              onChange={(e) => {
                setLoopEnabled(e.target.checked);
                if (e.target.checked && validTiming(cue, duration))
                  listen({ startMs: cue.startMs!, endMs: cue.endMs! }, true);
                else audio.cancelBounded();
              }}
            />
            Loop selected
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={showTranslations}
              onChange={(e) => setShowTranslations(e.target.checked)}
            />
            Show translations
          </label>
        </div>
        <div className="timing-source">
          <p className="muted timing-media-status">
            {available ? project.audio?.name : "No audio selected"}
          </p>
          <label
            className={`timing-file ${!available ? "timing-file-primary" : ""}`}
          >
            <span className="timing-file-button">
              {available ? "Replace audio" : "Choose local audio"}
            </span>
            <input
              aria-label="Local audio file"
              type="file"
              accept="audio/*,video/mp4,video/webm,.wav,.mp3,.m4a,.mp4,.ogg,.flac"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) audio.load(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <label className="timing-scrub">
          <input
            aria-label="Audio seek"
            type="range"
            min="0"
            max={duration ?? 1}
            step="1"
            value={Math.min(audio.positionMs, duration ?? 1)}
            disabled={!available}
            onChange={(e) => audio.seek(Number(e.target.value))}
          />
          <span className="timing-seek-labels" aria-hidden="true">
            <span>0:00.000</span>
            <span>{available ? formatTime(duration / 4) : ""}</span>
            <span>{available ? formatTime(duration / 2) : ""}</span>
            <span>{available ? formatTime((duration * 3) / 4) : ""}</span>
            <span>{available ? formatTime(duration) : "No audio"}</span>
          </span>
        </label>
      </section>
      {(error || audio.error) && (
        <p role="alert" className="error">
          {error || audio.error}
        </p>
      )}
      {available && (
        <div
          className={`timing-live-preview ${showTranslations ? "with-translations" : ""}`}
          role="region"
          aria-label="Current lyrics"
        >
          {playingLyrics.length ? (
            playingLyrics.map((o) => {
              const text = project.phrases.find((p) => p.id === o.phraseId);
              return text ? (
                <div key={o.id} data-playing-lyric={o.id}>
                  <LyricReading phrase={text} />
                  {showTranslations && (
                    <div className="playback-translations">
                      <p>{text.translation.en || "\u00a0"}</p>
                      <p>{text.translation.pl || "\u00a0"}</p>
                    </div>
                  )}
                </div>
              ) : null;
            })
          ) : (
            <p className="muted">
              {available
                ? "No lyrics at this time"
                : "Load audio to preview lyrics"}
            </p>
          )}
        </div>
      )}
      <AutomaticTiming
        expanded={automaticTimingOpen}
        onCollapse={() => setAutomaticTimingOpen(false)}
        revealTiming={automaticTimingTrigger}
        project={sourceProject}
        file={audio.file.current}
        duration={duration}
        selectedId={cue?.id}
        onViewLyric={(id) => {
          select(id);
          requestAnimationFrame(() => {
            const block = scroll.current?.querySelector<HTMLElement>(
              `[data-cue="${CSS.escape(id)}"] .timing-block-label`,
            );
            block?.focus({ preventScroll: true });
          });
        }}
        onChange={onChange}
        onListen={listen}
        onIdentityReady={setIdentityReady}
      />
      <div className="timing-grid">
        <div
          ref={sidebar}
          className="group-sidebar-wrapper"
          inert={!!duplicate}
        >
          <GroupSidebar
            project={project}
            selectedId={cue?.id}
            selectedGroup={selectedGroup}
            duration={duration}
            onSelect={(id) => select(id)}
            onChange={onChange}
            onDuplicate={(group) => {
              audio.ref.current?.pause();
              const range = groupRange(
                project.occurrences.filter((cue) =>
                  group.occurrenceIds.includes(cue.id),
                ),
              );
              const offset =
                range.start === null || range.end === null
                  ? 0
                  : range.end - range.start + 500;
              setGroupDraft(null);
              setDuplicate({
                group,
                name: `${group.name} (copy)`,
                offset,
                extent: Math.max(timelineMs, (range.end ?? 0) + offset + 5000),
              });
            }}
          />
        </div>
        <section className="timing-board" aria-label="Waveform timeline">
          <div className="timing-board-toolbar" inert={!!duplicate}>
            <div>
              <h2>Timeline</h2>
              {audio.waveStatus && (
                <p className="muted" role="status">
                  {audio.waveStatus}
                </p>
              )}
            </div>
            <div className="timing-toolbar-actions">
              {project.timingRun && (
                <button
                  ref={automaticTimingTrigger}
                  aria-controls="automatic-timing-content"
                  aria-expanded={automaticTimingOpen}
                  onClick={() => {
                    setAutomaticTimingOpen(!automaticTimingOpen);
                    if (!automaticTimingOpen)
                      requestAnimationFrame(() => {
                        const panel = document.getElementById(
                          "automatic-timing-content",
                        );
                        const headerBottom =
                          document
                            .querySelector("main > header")
                            ?.getBoundingClientRect().bottom ?? 0;
                        if (
                          panel &&
                          panel.getBoundingClientRect().bottom <= headerBottom
                        )
                          panel.scrollIntoView({
                            block: "start",
                            behavior: "instant",
                          });
                      });
                  }}
                >
                  {automaticTimingOpen
                    ? "Hide automatic timing"
                    : "Regenerate timing…"}
                </button>
              )}
              <button
                ref={settingsTrigger}
                className="timing-settings-trigger"
                aria-haspopup="dialog"
                aria-expanded={settingsOpen}
                aria-controls="timing-settings-panel"
                onClick={() => {
                  setSettingsPosition(undefined);
                  setSettingsOpen(!settingsOpen);
                }}
              >
                <span className="timing-settings-label">
                  <span aria-hidden="true">⚙</span> Timing settings
                </span>
                <span className="timing-settings-summary">
                  {zoom}× · {snap === "edges" ? "Edge snap" : "Snap off"} ·{" "}
                  {linkEdges ? "Edges linked" : "Edges unlinked"}
                </span>
              </button>
            </div>
            <div
              hidden={!settingsOpen}
              ref={settingsDialog}
              role={settingsOpen ? "dialog" : undefined}
              id="timing-settings-panel"
              className="timing-settings"
              aria-labelledby="timing-settings-title"
              style={
                settingsPosition
                  ? { position: "fixed", ...settingsPosition }
                  : { position: "fixed", top: 0 }
              }
            >
              <h2 id="timing-settings-title">Timing settings</h2>
              <label>
                Zoom
                <select
                  aria-label="Timeline zoom"
                  value={zoom}
                  onChange={(e) =>
                    zoomTo(Number(e.target.value) as typeof settings.zoom)
                  }
                >
                  {[1, 2, 4, 8, 16, 32].map((value) => (
                    <option key={value} value={value}>
                      {value}×
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Snap
                <select
                  aria-label="Timing snap"
                  value={snap}
                  onChange={(e) => setSnap(e.target.value as Snap)}
                >
                  <option value="off">Off</option>
                  <option value="edges">Neighboring edges</option>
                </select>
              </label>
              <label className="check">
                Link touching edges
                <input
                  type="checkbox"
                  checked={linkEdges}
                  onChange={(e) => setLinkEdges(e.target.checked)}
                />
              </label>
              <label>
                Before lyric (ms)
                <input
                  type="number"
                  min={0}
                  max={5000}
                  value={settings.preRollMs}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isInteger(n) && n >= 0 && n <= 5000)
                      updateSettings({ preRollMs: n });
                  }}
                />
              </label>
              <label>
                After lyric (ms)
                <input
                  type="number"
                  min={0}
                  max={5000}
                  value={settings.postRollMs}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isInteger(n) && n >= 0 && n <= 5000)
                      updateSettings({ postRollMs: n });
                  }}
                />
              </label>
              <label className="check">
                Auto-advance after review
                <input
                  type="checkbox"
                  checked={settings.autoAdvance}
                  onChange={(e) =>
                    updateSettings({ autoAdvance: e.target.checked })
                  }
                />
              </label>
              <button onClick={() => closeSettings(true)}>Done</button>
            </div>
          </div>
          <div
            className={`timing-scroll ${panning ? "is-panning" : ""} ${audio.playing ? "is-playing" : ""}`}
            ref={scroll}
            onPointerDownCapture={(e) => {
              if (
                audio.playing ||
                e.button !== 0 ||
                (e.target as HTMLElement).closest("button, input, select")
              )
                return;
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.scrollTo({
                left: e.currentTarget.scrollLeft,
                behavior: "instant",
              });
              pan.current = {
                x: e.clientX,
                left: e.currentTarget.scrollLeft,
                pointer: e.pointerId,
              };
              e.currentTarget.setPointerCapture(e.pointerId);
              setPanning(true);
            }}
            onPointerMove={(e) => {
              const start = pan.current;
              if (start && start.pointer === e.pointerId)
                e.currentTarget.scrollLeft = start.left - (e.clientX - start.x);
            }}
            onPointerUp={(e) => {
              const start = pan.current;
              if (!start || start.pointer !== e.pointerId) return;
              pan.current = null;
              setPanning(false);
              if (
                !duplicate &&
                Math.abs(e.clientX - start.x) < 4 &&
                track.current
              ) {
                const rect = track.current.getBoundingClientRect();
                audio.seek(((e.clientX - rect.left) / rect.width) * timelineMs);
              }
            }}
            onPointerCancel={() => {
              pan.current = null;
              setPanning(false);
            }}
            style={{
              touchAction: "pan-y",
              overflowX: audio.playing ? "hidden" : "auto",
            }}
          >
            <div
              ref={track}
              className="timing-track"
              style={{ width: `${zoom * 100}%`, minWidth: 560 }}
            >
              <div
                className="timing-ruler"
                role="slider"
                aria-label="Timeline seek"
                aria-valuemin={0}
                aria-valuemax={timelineMs}
                aria-valuenow={audio.positionMs}
                aria-disabled={!available || !!duplicate}
                inert={!!duplicate}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (
                    ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
                  ) {
                    e.preventDefault();
                    e.stopPropagation();
                    audio.seek(
                      e.key === "Home"
                        ? 0
                        : e.key === "End"
                          ? timelineMs
                          : audio.positionMs +
                            (e.key === "ArrowRight" ? 100 : -100),
                    );
                  }
                }}
                onPointerDown={(e) => {
                  if (duplicate) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  audio.seek(
                    ((e.clientX - rect.left) / rect.width) * timelineMs,
                  );
                }}
              >
                {ticks.flatMap((time, index, ticks) =>
                  index === 0
                    ? []
                    : [1, 2, 3].map((part) => (
                        <i
                          aria-hidden="true"
                          key={`${index}-${part}`}
                          style={{
                            left: `${((ticks[index - 1] + ((time - ticks[index - 1]) * part) / 4) / timelineMs) * 100}%`,
                          }}
                        />
                      )),
                )}
                {ticks.map((time) => (
                  <span
                    key={time}
                    style={{ left: `${(time / timelineMs) * 100}%` }}
                  >
                    <span className="timing-ruler-label">
                      {formatRulerTime(time)}
                    </span>
                  </span>
                ))}
              </div>
              <div
                className="timing-wave"
                onPointerDown={(e) => {
                  if (duplicate) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  audio.seek(
                    ((e.clientX - rect.left) / rect.width) * timelineMs,
                  );
                }}
                aria-hidden="true"
              >
                {audio.peaks.length > 0 ? (
                  <svg
                    style={{
                      width: `${((duration ?? timelineMs) / timelineMs) * 100}%`,
                    }}
                    viewBox={`0 0 ${audio.peaks.length} 100`}
                    preserveAspectRatio="none"
                  >
                    {audio.peaks.map((peak, i) => (
                      <line
                        key={i}
                        x1={i}
                        x2={i}
                        y1={50 - peak * 48}
                        y2={50 + peak * 48}
                      />
                    ))}
                  </svg>
                ) : (
                  <span className="muted">
                    {available
                      ? "Ruler available without waveform"
                      : "Load local audio for waveform and playback"}
                  </span>
                )}
              </div>
              <div
                className="timing-lanes"
                style={{
                  height: layout.height + (duplicate ? layout.height + 80 : 0),
                }}
              >
                <GroupTimeline
                  project={project}
                  displayed={displayed}
                  timelineMs={timelineMs}
                  selected={selectedGroup}
                  layout={layout}
                  preview={duplicate}
                  onSelect={(id) => {
                    const group = project.lyricGroups?.find(
                      (group) => group.id === id,
                    );
                    if (
                      group &&
                      !group.occurrenceIds.includes(selectedId ?? "")
                    )
                      onSelect(group.occurrenceIds[0]);
                  }}
                  onDrag={(group, delta) =>
                    groupOffset(project, group, delta, snap)
                  }
                  onOffset={(group, offset, ghost) => {
                    if (ghost)
                      setDuplicate((current) =>
                        current ? { ...current, offset } : null,
                      );
                    else setGroupDraft({ id: group.id, offset, base: project });
                  }}
                  onCommit={(group, offset) => {
                    setGroupDraft(null);
                    onChange(
                      shiftGroup(project, group.id, offset),
                      group.occurrenceIds[0],
                    );
                  }}
                />
                {displayed
                  .filter((o) => layout.tops.has(o.id))
                  .map((o) => (
                    <div
                      key={o.id}
                      data-cue={o.id}
                      data-timing-status={timingStatus(o, duration)}
                      title={`${project.phrases.find((p) => p.id === o.phraseId)?.lyricKey ?? ""} · ${formatTime(o.startMs)}–${formatTime(o.endMs)} · ${timingStatus(o, duration)}`}
                      className={`timing-block ${o.id === cue?.id ? "selected" : ""} ${project.lyricGroups?.some((g) => g.occurrenceIds.includes(o.id)) ? "group-member" : ""} ${project.lyricGroups?.find((g) => g.id === selectedGroup)?.occurrenceIds.includes(o.id) ? "group-member-selected" : ""}`}
                      inert={!!duplicate}
                      style={
                        {
                          left: `${(o.startMs! / timelineMs) * 100}%`,
                          width: `${((o.endMs! - o.startMs!) / timelineMs) * 100}%`,
                          top: layout.tops.get(o.id) ?? 8,
                          "--group-color": groupColor(
                            project.lyricGroups?.find((g) =>
                              g.occurrenceIds.includes(o.id),
                            )?.id ?? "",
                          ),
                        } as CSSProperties
                      }
                      onPointerMove={pointerMove}
                      onPointerUp={pointerEnd}
                      onPointerCancel={pointerEnd}
                      onLostPointerCapture={pointerEnd}
                    >
                      <button
                        className="timing-handle"
                        aria-label={`Trim start ${o.id}`}
                        onFocus={() => {
                          onSelect(o.id);
                          setBoundary("start");
                        }}
                        onPointerDown={(e) => pointerStart(e, o, "start")}
                        onKeyDown={(e) => blockKey(e, o, "start")}
                      />
                      <button
                        className="timing-block-label"
                        aria-label={`Move ${o.id}`}
                        onFocus={() => {
                          onSelect(o.id);
                          setBoundary("both");
                        }}
                        onClick={() => select(o.id)}
                        onPointerDown={(e) => pointerStart(e, o, "both")}
                        onKeyDown={(e) => blockKey(e, o, "both")}
                      >
                        <span className="timing-block-pinyin">
                          {(() => {
                            const p = project.phrases.find(
                              (p) => p.id === o.phraseId,
                            );
                            return p ? linePinyin(p) : "";
                          })()}
                        </span>
                        <strong>
                          {
                            project.phrases.find((p) => p.id === o.phraseId)
                              ?.lyricKey
                          }
                        </strong>
                        <span>
                          {formatTime(o.startMs)} → {formatTime(o.endMs)}
                        </span>
                      </button>
                      <button
                        className="timing-handle"
                        aria-label={`Trim end ${o.id}`}
                        onFocus={() => {
                          onSelect(o.id);
                          setBoundary("end");
                        }}
                        onPointerDown={(e) => pointerStart(e, o, "end")}
                        onKeyDown={(e) => blockKey(e, o, "end")}
                      />
                    </div>
                  ))}
              </div>
              {available && (
                <div
                  className="timing-playhead"
                  style={{ left: `${(audio.positionMs / timelineMs) * 100}%` }}
                  aria-hidden="true"
                />
              )}
            </div>
          </div>
          {duplicate && (
            <section
              className="duplicate-group-panel"
              aria-label="Duplicate group"
            >
              <h2>Duplicate group</h2>
              <p>
                Drag the ghost handle to preview its position. Create copy
                finalizes it.
              </p>
              {groupRange(
                project.occurrences.filter((cue) =>
                  duplicate.group.occurrenceIds.includes(cue.id),
                ),
              ).start === null && (
                <p>This group is untimed; its copy will be unassigned.</p>
              )}
              <label>
                New group name
                <input
                  autoFocus
                  value={duplicate.name}
                  onChange={(e) =>
                    setDuplicate({ ...duplicate, name: e.target.value })
                  }
                />
              </label>
              <p className="timing-notice">
                {(() => {
                  const previewProject = shiftGroup(
                    project,
                    duplicate.group.id,
                    duplicate.offset,
                  );
                  const others = project.occurrences.filter(
                    (cue) => !duplicate.group.occurrenceIds.includes(cue.id),
                  );
                  const moved = previewProject.occurrences.filter((cue) =>
                    duplicate.group.occurrenceIds.includes(cue.id),
                  );
                  return moved.some(
                    (cue) =>
                      cue.startMs !== null &&
                      cue.endMs !== null &&
                      project.occurrences.some(
                        (other) =>
                          other.startMs !== null &&
                          other.endMs !== null &&
                          cue.startMs! < other.endMs &&
                          cue.endMs! > other.startMs,
                      ),
                  )
                    ? "Warning: overlap — copy can still be created."
                    : groupWarnings(
                        {
                          ...previewProject,
                          occurrences: [...moved, ...others],
                        },
                        duplicate.group,
                      ).join(" · ");
                })()}
              </p>
              <div className="actions">
                <button
                  disabled={!duplicate.name.trim()}
                  onClick={() =>
                    attempt(() => {
                      const copy = duplicateGroup(
                        project,
                        duplicate.group.id,
                        duplicate.name,
                        duplicate.offset,
                      );
                      onChange(copy.project, copy.selectedId);
                      setDuplicate(null);
                    })
                  }
                >
                  Create copy
                </button>
                <button onClick={() => setDuplicate(null)}>Cancel</button>
              </div>
            </section>
          )}
          <p className="timing-follow-hint muted">
            {audio.playing
              ? "Following playhead · pause to scroll horizontally"
              : zoom === 1
                ? "Whole song visible · zoom in to scroll"
                : "Drag the timeline background to scroll while paused"}
          </p>
          <p className="timing-help muted">
            Drag a block to move it; drag either edge to trim. Focus a block or
            edge and use ←/→ for 10 ms, Shift for 100 ms.
            <span className="timing-help-last">
              Unassigned occurrences stay in the list.
            </span>
          </p>
        </section>
        <section
          className="timing-inspector"
          inert={!!duplicate}
          aria-label="Lyric timing"
        >
          {cue && phrase ? (
            <>
              <p className="muted">
                Lyric {index + 1} of {project.occurrences.length}
              </p>
              <div className="timing-controls timing-cue-nav">
                <button disabled={index === 0} onClick={() => step(-1)}>
                  Previous
                </button>
                <button
                  disabled={index + 1 >= project.occurrences.length}
                  onClick={() => step(1)}
                >
                  Next
                </button>
                <button
                  title="Edit translation"
                  onClick={() => onReview(phrase.id)}
                >
                  Translate
                </button>
              </div>
              <div className="timing-text-preview">
                <LyricReading phrase={phrase} />
                {phrase.translation.en && <p>{phrase.translation.en}</p>}
                {phrase.translation.pl && <p>{phrase.translation.pl}</p>}
              </div>
              <p className="timing-review-status">
                {timingStatus(cue, duration)}
              </p>
              <div className="timing-controls timing-review-actions">
                <button
                  aria-describedby={
                    !available || !validTiming(cue, duration)
                      ? "timing-play-hint"
                      : undefined
                  }
                  disabled={!available || !validTiming(cue, duration)}
                  onClick={() =>
                    listen(
                      { startMs: cue.startMs!, endMs: cue.endMs! },
                      loopEnabled,
                    )
                  }
                >
                  Play lyric
                </button>
                <button
                  className={
                    cue.timingReview !== "reviewed" ? "primary" : undefined
                  }
                  disabled={!validTiming(cue, duration)}
                  onClick={() => {
                    const marking = cue.timingReview !== "reviewed";
                    const next = reviewTiming(
                      project,
                      new Set([cue.id]),
                      marking,
                      duration,
                    );
                    const nextId = marking ? nextReviewId : undefined;
                    setShowReviewCompletion(
                      marking && settings.autoAdvance && !nextId,
                    );
                    audio.cancelBounded();
                    audio.ref.current?.pause();
                    onChange(next, nextId ?? cue.id, true);
                  }}
                >
                  {cue.timingReview === "reviewed"
                    ? "Mark as needing review"
                    : "Mark reviewed"}
                  {nextReviewId && (
                    <span className="timing-review-next"> → Next</span>
                  )}
                </button>
              </div>
              {(!available || !validTiming(cue, duration)) && (
                <p id="timing-play-hint" className="muted timing-play-hint">
                  {!validTiming(cue, duration)
                    ? "Set a valid start and end to play this lyric."
                    : "Load audio to play this lyric."}
                </p>
              )}
              {showReviewCompletion && allTimedReviewed && (
                <p className="timing-completion" role="status">
                  {remainingUntimed
                    ? `Timed lyrics reviewed. ${remainingUntimed} untimed.`
                    : "All lyrics reviewed."}
                </p>
              )}
              <TimingFields
                cue={cue}
                onApply={(start, end) =>
                  attempt(() => {
                    const parse = (value: string) => {
                      if (!value.trim()) return null;
                      if (!/^\d+$/u.test(value))
                        throw Error(
                          "Use whole nonnegative milliseconds or leave unassigned fields empty.",
                        );
                      return Number(value);
                    };
                    onChange(
                      editTiming(
                        project,
                        cue.id,
                        { startMs: parse(start), endMs: parse(end) },
                        duration,
                      ),
                      cue.id,
                    );
                  })
                }
              />
              <ul className="timing-notices">
                {notices.map((notice) => (
                  <li key={notice}>{notice}</li>
                ))}
              </ul>
              <div className="timing-reset">
                <button
                  aria-label="Reset timing for this lyric"
                  disabled={!canReset}
                  title="Restore the last-reviewed interval, otherwise the latest automatic interval. Undo reverses the reset."
                  onClick={() =>
                    attempt(() =>
                      onChange(resetTiming(project, cue.id, duration), cue.id),
                    )
                  }
                >
                  {resetOutsideAudio
                    ? "Reset reference outside loaded audio"
                    : canReset
                      ? cue.reviewedTiming
                        ? "Reset to last reviewed"
                        : "Reset to automatic"
                      : resetTarget
                        ? cue.reviewedTiming
                          ? "Already at reviewed timing"
                          : "Already at automatic timing"
                        : "No reset reference"}
                </button>
              </div>
              <div className="timing-diagnostics">
                {cue.timingIssue && !cue.weakTiming && (
                  <p className="timing-notice">
                    Last generation: {cue.timingIssue.reasons.join(" ")}
                  </p>
                )}
                {automatic &&
                  (automaticDiffers ||
                    automatic.reasons.some((reason) => reason.trim()) ||
                    (automatic.matched !== undefined &&
                      automatic.total !== undefined)) && (
                    <details className="timing-suggestion-details">
                      <summary>Automatic timing details</summary>
                      {automaticDiffers && (
                        <p>
                          {formatTime(automatic.startMs)}–
                          {formatTime(automatic.endMs)}
                        </p>
                      )}
                      {automatic.matched !== undefined &&
                        automatic.total !== undefined && (
                          <p>
                            {automatic.matched}/{automatic.total} matching units
                          </p>
                        )}
                      {automatic.reasons.some((reason) => reason.trim()) && (
                        <p>{automatic.reasons.join(" ")}</p>
                      )}
                    </details>
                  )}
                {cue.weakTiming && (
                  <div className="timing-weak-estimate">
                    <p>
                      Weak estimate: {formatTime(cue.weakTiming.startMs)}–
                      {formatTime(cue.weakTiming.endMs)}
                    </p>
                    <p>{cue.weakTiming.reasons.join(" ")}</p>
                    {cue.weakTiming.matched !== undefined &&
                      cue.weakTiming.total !== undefined && (
                        <p>
                          {cue.weakTiming.matched}/{cue.weakTiming.total}{" "}
                          matching units
                        </p>
                      )}
                    <button
                      disabled={!available || !identityReady}
                      onClick={() => listen(cue.weakTiming!)}
                    >
                      Listen to weak estimate
                    </button>
                    <button
                      disabled={!identityReady}
                      onClick={() =>
                        attempt(() =>
                          onChange(
                            useWeakEstimate(project, cue.id, duration),
                            cue.id,
                          ),
                        )
                      }
                    >
                      Use estimate anyway
                    </button>
                  </div>
                )}
                {cue.reviewedTiming && cue.automaticTiming && (
                  <button
                    onClick={() =>
                      attempt(() =>
                        onChange(
                          latestAutomatic(project, cue.id, duration),
                          cue.id,
                        ),
                      )
                    }
                  >
                    Use latest automatic suggestion
                  </button>
                )}
              </div>
              <div className="timing-remove">
                <button
                  aria-label="Remove this appearance"
                  onClick={() => onRemove(cue.id)}
                >
                  Remove lyric
                </button>
              </div>
            </>
          ) : (
            <p>No occurrences in this project.</p>
          )}
        </section>
      </div>
      <p className="timing-shortcuts">
        Space: play/pause · S/E: capture start/end · ←/→: seek 100 ms (Shift: 1
        s) · Alt+←/→: nudge selected target 10 ms (Shift: 100 ms) · [/]:
        previous/next · ⌘/Ctrl+Z: undo. Shortcuts are inactive while typing.
      </p>
    </div>
  );
}
