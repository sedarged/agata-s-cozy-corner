import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import type { NoteBackground } from "@/lib/mock-data";
import { emitQuotaEvent } from "@/lib/backup";
import { useFocusTrap } from "@/lib/use-focus-trap";
import type { HandwritingPageDTO } from "@/lib/api/client";
import {
  Pen,
  Highlighter,
  Pencil,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Maximize2,
  X,
  Minus,
  ChevronLeft,
  ChevronRight,
  Plus,
  FilePlus,
} from "lucide-react";

export interface HandwritingCanvasHandle {
  toDataUrl: () => string;
  clear: () => void;
  hasInk: () => boolean;
}

type Tool = "pen" | "highlighter" | "pencil" | "eraser";

interface Stroke {
  tool: Tool;
  color: string;
  width: number;
  baseWidth?: number;
  points: { x: number; y: number; p?: number }[];
}

interface Props {
  initialDataUrl?: string;
  background: NoteBackground;
  onBackgroundChange: (b: NoteBackground) => void;
  minHeight?: number;
  onDirty?: () => void;
  // ---- multi-page mode ----
  // Provided together, they activate the page-nav strip + per-page state.
  // When omitted, the canvas falls back to legacy single-page mode keyed
  // off `initialDataUrl` (the legacy `notes.drawingDataUrl` flow).
  noteId?: string;
  pages?: HandwritingPageDTO[];
  activePageId?: string | null;
  onSelectPage?: (id: string) => void;
  onAddPage?: () => void;
  onDeletePage?: (id: string) => void;
  // Fires (debounced) after stroke commits in multi-page mode so the
  // parent can persist the page. In legacy mode this is a no-op.
  onStrokesChange?: (strokes: Stroke[]) => void;
}

const backgrounds: { value: NoteBackground; label: string }[] = [
  { value: "plain", label: "Jasny" },
  { value: "lined", label: "Linie" },
  { value: "grid", label: "Kratka" },
  { value: "cream", label: "Kremowy" },
  { value: "dark", label: "Ciemny" },
];

const colorPresets = [
  "#1a0e08",
  "#3a2418",
  "#c9a86a",
  "#b04e3a",
  "#8b2e2e",
  "#2c4a6b",
  "#2f5d3a",
  "#5b3a8a",
];

const PREFS_KEY = "agata-handwriting-prefs-v2";

interface StoredPrefs {
  color?: string;
  width?: number;
  tool?: Tool;
  background?: NoteBackground;
}

function readPrefs(): StoredPrefs {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function writePrefs(p: StoredPrefs) {
  if (typeof window === "undefined") return;
  try {
    const merged = { ...readPrefs(), ...p };
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(merged));
  } catch (e) {
    const isQuota = e instanceof Error && /quota|exceeded/i.test(e.message);
    if (isQuota) emitQuotaEvent("other", "Nie można zapisać preferencji pędzla.");
  }
}

export function getStoredHandwritingBackground(): NoteBackground | undefined {
  return readPrefs().background;
}

function strokeStyleFor(tool: Tool, color: string): string {
  if (tool === "highlighter") {
    // Translucent color band for highlighter feel.
    return hexToRgba(color, 0.32);
  }
  if (tool === "pencil") {
    return hexToRgba(color, 0.82);
  }
  return color;
}

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function effectiveWidth(tool: Tool, baseWidth: number, pressure: number): number {
  if (tool === "eraser") return baseWidth * 4;
  if (tool === "highlighter") return baseWidth * 5;
  if (tool === "pencil") return Math.max(0.5, baseWidth * (0.5 + pressure * 0.6));
  return Math.max(0.5, baseWidth * (0.6 + pressure));
}

export const HandwritingCanvas = forwardRef<HandwritingCanvasHandle, Props>(
  function HandwritingCanvas(
    {
      initialDataUrl,
      background,
      onBackgroundChange,
      minHeight = 420,
      onDirty,
      noteId,
      pages,
      activePageId: activePageIdProp,
      onSelectPage,
      onAddPage,
      onDeletePage,
      onStrokesChange,
    },
    ref,
  ) {
    // Multi-page mode is on when the parent passes both `noteId` and `pages`.
    // The chrome (page-nav strip) renders only in this mode so legacy callers
    // that pass only `initialDataUrl` see no behavioural difference.
    const isMultiPage = !!noteId && !!pages;
    const safePages: HandwritingPageDTO[] = isMultiPage ? (pages as HandwritingPageDTO[]) : [];
    const controlledActivePageId = activePageIdProp ?? null;
    // Active page id — controlled by the parent when passed, otherwise
    // falls back to the first page in `pages`, else stays null. The
    // nav strip calls `onSelectPage` and the next render reflects it.
    const [localActivePageId, setLocalActivePageId] = useState<string | null>(
      controlledActivePageId ?? safePages[0]?.id ?? null,
    );
    const activePageId: string | null = controlledActivePageId ?? localActivePageId;
    const activePage: HandwritingPageDTO | undefined = isMultiPage
      ? safePages.find((p) => p.id === activePageId)
      : undefined;
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [redoStack, setRedoStack] = useState<Stroke[]>([]);
    const currentRef = useRef<Stroke | null>(null);
    // Tracks the single pointer currently allowed to draw (palm rejection).
    const activePointerRef = useRef<{ id: number; type: string } | null>(null);
    const stored = readPrefs();
    const [color, setColor] = useState(stored.color ?? "#1a0e08");
    const [width, setWidth] = useState(stored.width ?? 3);
    const [tool, setTool] = useState<Tool>(stored.tool ?? "pen");
    const [colorPanel, setColorPanel] = useState(false);
    const sizeRef = useRef({ w: 0, h: 0 });

    useEffect(() => {
      writePrefs({ color, width, tool });
    }, [color, width, tool]);

    useEffect(() => {
      writePrefs({ background });
    }, [background]);

    const handleBackgroundChange = (b: NoteBackground) => {
      writePrefs({ background: b });
      onBackgroundChange(b);
    };

    const bgFill =
      background === "dark" ? "#1d140d" : background === "cream" ? "#f5ede2" : "#fdfaf4";

    const initialImgRef = useRef<HTMLImageElement | null>(null);
    const [initialLoaded, setInitialLoaded] = useState(false);
    const [clearedInitial, setClearedInitial] = useState(false);

    // Paint a single stroke with the active context transform. Extracted so the
    // full repaint (drawAll) and the incremental live repaint (drawCurrentStroke)
    // share identical rendering.
    const renderStroke = useCallback((ctx: CanvasRenderingContext2D, s: Stroke) => {
      ctx.save();
      ctx.lineCap = s.tool === "highlighter" ? "butt" : "round";
      ctx.lineJoin = "round";
      if (s.tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
      } else if (s.tool === "highlighter") {
        ctx.globalCompositeOperation = "multiply";
        ctx.strokeStyle = strokeStyleFor(s.tool, s.color);
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = strokeStyleFor(s.tool, s.color);
      }
      const pts = s.points;
      if (pts.length === 1) {
        ctx.lineWidth = s.width;
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, s.width / 2, 0, Math.PI * 2);
        ctx.fillStyle = s.tool === "eraser" ? "rgba(0,0,0,1)" : strokeStyleFor(s.tool, s.color);
        ctx.fill();
      } else if (s.baseWidth !== undefined && (s.tool === "pen" || s.tool === "pencil")) {
        for (let i = 1; i < pts.length; i++) {
          const curr = pts[i];
          const prev = pts[i - 1];
          const avgP = ((prev.p ?? 0.5) + (curr.p ?? 0.5)) / 2;
          ctx.lineWidth = effectiveWidth(s.tool, s.baseWidth, avgP);
          const startX = i === 1 ? pts[0].x : (pts[i - 2].x + prev.x) / 2;
          const startY = i === 1 ? pts[0].y : (pts[i - 2].y + prev.y) / 2;
          const endX = (prev.x + curr.x) / 2;
          const endY = (prev.y + curr.y) / 2;
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.quadraticCurveTo(prev.x, prev.y, endX, endY);
          ctx.stroke();
        }
      } else {
        ctx.lineWidth = s.width;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          const p = pts[i];
          const prev = pts[i - 1];
          const mx = (prev.x + p.x) / 2;
          const my = (prev.y + p.y) / 2;
          ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
        }
        ctx.stroke();
      }
      ctx.restore();
    }, []);

    const drawAll = useCallback(() => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const { w, h } = sizeRef.current;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = bgFill;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.restore();

      // background pattern
      ctx.save();
      ctx.strokeStyle = background === "dark" ? "rgba(201,168,106,0.18)" : "rgba(58,36,24,0.10)";
      ctx.lineWidth = 1;
      if (background === "lined") {
        for (let y = 36; y < h; y += 32) {
          ctx.beginPath();
          ctx.moveTo(24, y);
          ctx.lineTo(w - 24, y);
          ctx.stroke();
        }
      } else if (background === "grid") {
        for (let y = 28; y < h; y += 28) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
        for (let x = 28; x < w; x += 28) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
      }
      ctx.restore();

      if (initialImgRef.current && !clearedInitial) {
        ctx.drawImage(initialImgRef.current, 0, 0, w, h);
      }

      for (const s of strokes) renderStroke(ctx, s);
      if (currentRef.current) renderStroke(ctx, currentRef.current);
    }, [strokes, background, bgFill, clearedInitial, renderStroke]);

    // Incremental live rendering. drawAll repaints everything; during an active
    // stroke that means re-rendering every committed stroke on each pointer move,
    // which degrades on long notes. Instead we snapshot the committed canvas
    // (background + paper + finished strokes) into an offscreen buffer once at
    // pointer-down, then each move blits that buffer (O(1)) and repaints only the
    // in-progress stroke. Painting the live stroke in a single pass also keeps the
    // highlighter's multiply blend from self-darkening at segment joins.
    const baseRef = useRef<HTMLCanvasElement | null>(null);
    const captureBase = useCallback(() => {
      const c = canvasRef.current;
      if (!c) return;
      let snap = baseRef.current;
      if (!snap) {
        snap = document.createElement("canvas");
        baseRef.current = snap;
      }
      if (snap.width !== c.width || snap.height !== c.height) {
        snap.width = c.width;
        snap.height = c.height;
      }
      const sctx = snap.getContext("2d");
      if (!sctx) return;
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, snap.width, snap.height);
      sctx.drawImage(c, 0, 0);
    }, []);
    const drawCurrentStroke = useCallback(() => {
      const c = canvasRef.current;
      const snap = baseRef.current;
      if (!c || !snap) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(snap, 0, 0);
      ctx.restore();
      if (currentRef.current) {
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        renderStroke(ctx, currentRef.current);
        ctx.restore();
      }
    }, [renderStroke]);

    const resize = useCallback(() => {
      const c = canvasRef.current;
      const wrap = wrapRef.current;
      if (!c || !wrap) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = wrap.getBoundingClientRect();
      const w = Math.max(200, rect.width);
      const h = Math.max(minHeight, rect.height);
      sizeRef.current = { w, h };
      c.width = Math.floor(w * dpr);
      c.height = Math.floor(h * dpr);
      c.style.width = w + "px";
      c.style.height = h + "px";
      const ctx = c.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawAll();
    }, [drawAll, minHeight]);

    useEffect(() => {
      resize();
      const ro = new ResizeObserver(resize);
      if (wrapRef.current) ro.observe(wrapRef.current);
      return () => ro.disconnect();
    }, [resize]);

    useEffect(() => {
      drawAll();
    }, [drawAll]);

    useEffect(() => {
      if (!initialDataUrl) return;
      const img = new Image();
      img.onload = () => {
        initialImgRef.current = img;
        setInitialLoaded(true);
        drawAll();
      };
      img.src = initialDataUrl;
    }, [initialDataUrl, drawAll]);

    // Multi-page mode: when the active page id changes (user picked a
    // different page from the nav strip, or the parent re-ordered the
    // pages), swap the local strokes buffer to that page's stored
    // strokes. Without this, switching pages would silently show stale
    // strokes from the previous page.
    useEffect(() => {
      if (!isMultiPage) return;
      setRedoStack([]);
      setStrokes(() => (activePage?.strokes as Stroke[]) || []);
      // activePage is derived from activePageId + safePages; depending on
      // activePageId alone is enough — re-derivation picks up new strokes
      // if the parent re-saved the same page id.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activePageId, isMultiPage]);

    // Multi-page mode: when strokes change on the active page, fire
    // `onStrokesChange` debounced so the parent can persist without
    // slamming the server on every pointer move. The legacy single-page
    // mode skips this entirely. We stash `onStrokesChange` in a ref so an
    // inline-arrow callback from the parent doesn't reset the debounce
    // timer on every render.
    const onStrokesChangeRef = useRef<((s: Stroke[]) => void) | undefined>(onStrokesChange);
    useEffect(() => {
      onStrokesChangeRef.current = onStrokesChange;
    }, [onStrokesChange]);
    useEffect(() => {
      if (!isMultiPage) return;
      const cb = onStrokesChangeRef.current;
      if (!cb) return;
      // debounce: cancel the previous timer when strokes change so we only
      // fire after 400ms of inactivity (avoids slamming the server on every
      // pointermove coalesced batch).
      const t = setTimeout(() => cb(strokes), 400);
      return () => clearTimeout(t);
    }, [strokes, isMultiPage]);

    const computeHasInk = useCallback(
      () => strokes.length > 0 || (initialLoaded && !clearedInitial),
      [strokes.length, initialLoaded, clearedInitial],
    );

    useImperativeHandle(
      ref,
      () => ({
        toDataUrl: () => (computeHasInk() ? (canvasRef.current?.toDataURL("image/png") ?? "") : ""),
        clear: () => {
          setStrokes([]);
          currentRef.current = null;
          initialImgRef.current = null;
          setClearedInitial(true);
        },
        hasInk: () => computeHasInk(),
      }),
      [computeHasInk],
    );

    const ptFrom = (e: React.PointerEvent) => {
      const c = canvasRef.current!;
      const rect = c.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        p: e.pressure || undefined,
      };
    };

    const onDown = (e: React.PointerEvent) => {
      // Palm rejection for iPad-pen-first writing: only one pointer draws at a
      // time. A resting palm (pointerType "touch") that lands while another
      // pointer is active is ignored — except that a pen always preempts a
      // finger/palm stroke already in progress, so the Pencil wins. On a mouse
      // or single finger there is only ever one pointer, so behaviour is unchanged.
      if (activePointerRef.current) {
        const active = activePointerRef.current;
        if (e.pointerType === "pen" && active.type !== "pen") {
          currentRef.current = null; // discard the finger/palm stroke in progress
        } else {
          return; // ignore additional concurrent contacts (e.g. resting palm)
        }
      }
      e.preventDefault();
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      activePointerRef.current = { id: e.pointerId, type: e.pointerType };
      const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
      // Repaint committed strokes only (drops any stale in-progress stroke, e.g.
      // a finger stroke a pen just preempted) and snapshot that as the base layer.
      currentRef.current = null;
      drawAll();
      captureBase();
      currentRef.current = {
        tool,
        color,
        width: effectiveWidth(tool, width, pressure),
        baseWidth: width,
        points: [ptFrom(e)],
      };
      drawCurrentStroke();
    };
    const onMove = (e: React.PointerEvent) => {
      if (!currentRef.current || !activePointerRef.current) return;
      if (e.pointerId !== activePointerRef.current.id) return;
      e.preventDefault();
      const c = canvasRef.current;
      if (!c) return;
      const rect = c.getBoundingClientRect();
      const toPt = (ev: PointerEvent) => ({
        x: ev.clientX - rect.left,
        y: ev.clientY - rect.top,
        p: ev.pressure || undefined,
      });
      // Apple Pencil samples faster (≈120–240 Hz) than pointermove fires, so the
      // browser coalesces intermediate samples into one event. Replay them all so
      // fast strokes keep every point and stay smooth instead of going polygonal.
      const native = e.nativeEvent;
      const coalesced =
        typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [];
      if (coalesced.length > 0) {
        for (const ce of coalesced) currentRef.current.points.push(toPt(ce));
      } else {
        currentRef.current.points.push(toPt(native));
      }
      drawCurrentStroke();
    };
    const onUp = (e: React.PointerEvent) => {
      // Ignore up/cancel from non-active pointers (e.g. the palm lifting).
      if (!activePointerRef.current || e.pointerId !== activePointerRef.current.id) return;
      e.preventDefault();
      activePointerRef.current = null;
      if (!currentRef.current) return;
      const s = currentRef.current;
      currentRef.current = null;
      setStrokes((prev) => [...prev, s]);
      setRedoStack([]);
      onDirty?.();
    };

    const undo = () => {
      setStrokes((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        setRedoStack((r) => [...r, last]);
        return prev.slice(0, -1);
      });
      onDirty?.();
    };
    const redo = () => {
      setRedoStack((r) => {
        if (r.length === 0) return r;
        const last = r[r.length - 1];
        setStrokes((prev) => [...prev, last]);
        return r.slice(0, -1);
      });
      onDirty?.();
    };

    const [confirmClear, setConfirmClear] = useState(false);
    const [focus, setFocus] = useState(false);
    const hasInk = strokes.length > 0 || (initialLoaded && !clearedInitial);
    const askClear = () => {
      if (hasInk) setConfirmClear(true);
      else {
        setStrokes([]);
        currentRef.current = null;
      }
    };
    const clearAll = () => {
      setStrokes([]);
      currentRef.current = null;
      initialImgRef.current = null;
      setClearedInitial(true);
      setConfirmClear(false);
      onDirty?.();
      drawAll();
    };

    useEffect(() => {
      const t = setTimeout(resize, 0);
      return () => clearTimeout(t);
    }, [focus, resize]);

    // Close color panel when clicking outside.
    useEffect(() => {
      if (!colorPanel) return;
      const handler = (e: PointerEvent) => {
        const t = e.target as HTMLElement;
        if (!t.closest("[data-color-panel]") && !t.closest("[data-color-trigger]")) {
          setColorPanel(false);
        }
      };
      window.addEventListener("pointerdown", handler);
      return () => window.removeEventListener("pointerdown", handler);
    }, [colorPanel]);

    const ToolButton = ({
      value,
      label,
      icon: Icon,
    }: {
      value: Tool;
      label: string;
      icon: typeof Pen;
    }) => {
      const active = tool === value;
      return (
        <button
          type="button"
          onClick={() => setTool(value)}
          title={label}
          aria-label={label}
          aria-pressed={active}
          className={`relative h-9 w-9 sm:h-11 sm:w-11 grid place-items-center rounded-xl sm:rounded-2xl transition-all ${
            active
              ? "bg-[var(--accent-gold)] text-[var(--bg)] shadow-[0_6px_18px_-6px_rgba(201,168,106,0.55)] -translate-y-0.5"
              : "bg-[var(--glass-inner)] text-warm hover:text-[var(--accent-gold)]"
          }`}
        >
          <Icon
            className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]"
            strokeWidth={active ? 2.2 : 1.8}
          />
        </button>
      );
    };

    return (
      <div
        className={
          focus
            ? "fixed inset-0 z-50 bg-[var(--bg)] p-3 sm:p-4 overflow-auto flex flex-col gap-3"
            : "space-y-3"
        }
      >
        {/* iPad-style top toolbar */}
        <div className="glass rounded-2xl sm:rounded-3xl p-1.5 sm:p-2.5 flex items-center gap-1.5 sm:gap-2 flex-wrap relative">
          <div className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-2xl bg-[var(--glass-inner)]">
            <ToolButton value="pen" label="Pióro" icon={Pen} />
            <ToolButton value="highlighter" label="Zakreślacz" icon={Highlighter} />
            <ToolButton value="pencil" label="Ołówek" icon={Pencil} />
            <ToolButton value="eraser" label="Gumka" icon={Eraser} />
          </div>

          <div className="h-8 w-px bg-[var(--glass-border-soft)] mx-1 hidden sm:block" />

          {/* Thickness */}
          <div className="flex items-center gap-1.5 sm:gap-2 px-2 py-1.5 rounded-2xl bg-[var(--glass-inner)]">
            <Minus className="w-3 h-3 text-warm-muted" />
            <input
              type="range"
              min={1}
              max={14}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="w-14 sm:w-28 accent-[var(--accent-gold)]"
              aria-label="Grubość"
            />
            <span
              className="rounded-full bg-warm shrink-0"
              style={{
                width: Math.max(4, width + 2),
                height: Math.max(4, width + 2),
                background: tool === "eraser" ? "var(--accent-soft)" : color,
                opacity: tool === "highlighter" ? 0.45 : 1,
              }}
              aria-hidden
            />
          </div>

          {/* Color trigger */}
          <button
            type="button"
            data-color-trigger
            onClick={() => setColorPanel((v) => !v)}
            disabled={tool === "eraser"}
            className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl grid place-items-center bg-[var(--glass-inner)] relative disabled:opacity-40"
            aria-label="Kolor"
            title="Kolor"
          >
            <span
              className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-[var(--glass-border)] shadow-inner"
              style={{ background: color }}
            />
          </button>

          <div className="ml-auto flex items-center gap-1 sm:gap-1.5 p-1 rounded-2xl bg-[var(--glass-inner)]">
            <button
              type="button"
              onClick={undo}
              disabled={strokes.length === 0}
              className="h-9 w-9 sm:h-11 sm:w-11 grid place-items-center rounded-xl sm:rounded-2xl text-warm disabled:opacity-30 hover:text-[var(--accent-gold)]"
              aria-label="Cofnij"
              title="Cofnij"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={redoStack.length === 0}
              className="h-9 w-9 sm:h-11 sm:w-11 grid place-items-center rounded-xl sm:rounded-2xl text-warm disabled:opacity-30 hover:text-[var(--accent-gold)]"
              aria-label="Ponów"
              title="Ponów"
            >
              <Redo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={askClear}
              className="h-9 w-9 sm:h-11 sm:w-11 grid place-items-center rounded-xl sm:rounded-2xl text-warm hover:text-[var(--accent-gold)]"
              aria-label="Wyczyść"
              title="Wyczyść stronę"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setFocus((f) => !f)}
              className="h-9 w-9 sm:h-11 sm:w-11 grid place-items-center rounded-xl sm:rounded-2xl text-warm hover:text-[var(--accent-gold)]"
              aria-label={focus ? "Zamknij pełny ekran" : "Pełny ekran"}
              title={focus ? "Zamknij" : "Pełny ekran"}
            >
              {focus ? (
                <X className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Maximize2 className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>

          {colorPanel && (
            <div
              data-color-panel
              className="absolute z-30 mt-2 top-full left-2 right-2 sm:right-auto sm:left-auto sm:w-auto glass rounded-2xl p-3 shadow-xl"
            >
              <div className="grid grid-cols-4 gap-2">
                {colorPresets.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setColor(c);
                      setColorPanel(false);
                    }}
                    className={`w-9 h-9 rounded-full border transition ${
                      color === c
                        ? "ring-2 ring-[var(--accent-gold)] ring-offset-2 ring-offset-[var(--bg)]"
                        : "border-[var(--glass-border)]"
                    }`}
                    style={{ background: c }}
                    aria-label={`Kolor ${c}`}
                  />
                ))}
              </div>
              <label className="block mt-3 text-[11px] uppercase tracking-wider text-warm-muted">
                Własny kolor
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="block mt-1 w-full h-9 rounded-lg cursor-pointer bg-transparent"
                />
              </label>
            </div>
          )}
        </div>

        {/* Background selector */}
        <div
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar"
          style={{ scrollbarWidth: "none" }}
        >
          <span className="hidden sm:inline text-[11px] uppercase tracking-wider text-warm-muted pr-1 shrink-0">
            Papier
          </span>
          {backgrounds.map((b) => (
            <button
              key={b.value}
              type="button"
              onClick={() => handleBackgroundChange(b.value)}
              className={`shrink-0 px-2.5 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs transition ${
                background === b.value
                  ? "bg-[var(--accent-gold)] text-[var(--bg)]"
                  : "bg-[var(--glass-inner)] text-warm hover:text-[var(--accent-gold)]"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>

        {/* Page navigation strip — only shown in multi-page mode.
            Provides prev/next, a "Strona N z M" indicator, and add/delete
            page actions. The parent owns the page records (via React Query
            hooks); we just fire callbacks. */}
        {isMultiPage &&
          (() => {
            const activePageIndex = safePages.findIndex((p) => p.id === activePageId);
            const safeIndex = activePageIndex >= 0 ? activePageIndex : 0;
            const prevPage = safePages[safeIndex - 1];
            const nextPage = safePages[safeIndex + 1];
            return (
              <div
                className="glass rounded-2xl px-2 py-1.5 flex items-center gap-1 sm:gap-2"
                data-testid="handwriting-page-nav"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (!prevPage) return;
                    if (onSelectPage) onSelectPage(prevPage.id);
                    setLocalActivePageId(prevPage.id);
                  }}
                  disabled={!prevPage}
                  aria-label="Poprzednia strona"
                  title="Poprzednia strona"
                  className="h-9 w-9 grid place-items-center rounded-xl bg-[var(--glass-inner)] text-warm hover:text-[var(--accent-gold)] disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <div
                  className="flex-1 text-center text-xs sm:text-sm tabular-nums"
                  aria-live="polite"
                >
                  Strona {safeIndex + 1} z {safePages.length}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!nextPage) return;
                    if (onSelectPage) onSelectPage(nextPage.id);
                    setLocalActivePageId(nextPage.id);
                  }}
                  disabled={!nextPage}
                  aria-label="Następna strona"
                  title="Następna strona"
                  className="h-9 w-9 grid place-items-center rounded-xl bg-[var(--glass-inner)] text-warm hover:text-[var(--accent-gold)] disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onAddPage?.()}
                  aria-label="Dodaj stronę"
                  title="Dodaj stronę"
                  className="h-9 w-9 grid place-items-center rounded-xl bg-[var(--glass-inner)] text-warm hover:text-[var(--accent-gold)]"
                >
                  <FilePlus className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!activePageId) return;
                    onDeletePage?.(activePageId);
                  }}
                  disabled={!activePageId || safePages.length <= 1}
                  aria-label="Usuń stronę"
                  title="Usuń stronę"
                  className="h-9 w-9 grid place-items-center rounded-xl bg-[var(--glass-inner)] text-warm hover:text-[#b04e3a] disabled:opacity-30"
                >
                  <Minus className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            );
          })()}

        {/* Canvas */}
        <div
          ref={wrapRef}
          className={`rounded-3xl overflow-hidden border border-[var(--glass-border-soft)] shadow-[0_24px_60px_-30px_rgba(60,40,20,0.35)] ${
            focus ? "flex-1" : ""
          }`}
          style={focus ? { padding: 0 } : { minHeight, padding: 0 }}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            style={{
              touchAction: "none",
              display: "block",
              width: "100%",
              userSelect: "none",
              WebkitUserSelect: "none",
              cursor: tool === "eraser" ? "cell" : "crosshair",
            }}
          />
        </div>

        {confirmClear && (
          <ClearConfirm
            onCancel={() => setConfirmClear(false)}
            onConfirm={() => {
              clearAll();
              setConfirmClear(false);
            }}
          />
        )}
      </div>
    );
  },
);

function ClearConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onCancel, true);
  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hw-clear-title"
      onClick={onCancel}
    >
      <div
        ref={ref}
        className="glass rounded-2xl p-6 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="hw-clear-title" className="font-serif text-lg mb-2">
          Wyczyścić stronę?
        </h3>
        <p className="text-sm text-warm-muted mb-5">To usunie pismo z tej notatki.</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-full bg-[var(--glass-inner)] text-warm text-sm"
          >
            Anuluj
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm font-medium"
          >
            Wyczyść
          </button>
        </div>
      </div>
    </div>
  );
}
