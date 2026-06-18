import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import type { NoteBackground } from "@/lib/mock-data";
import { Pen, Eraser, Undo2, Redo2, Trash2, Maximize2, X } from "lucide-react";

export interface HandwritingCanvasHandle {
  toDataUrl: () => string;
  clear: () => void;
  hasInk: () => boolean;
}

interface Stroke {
  color: string;
  width: number;
  erase: boolean;
  points: { x: number; y: number; p?: number }[];
}

interface Props {
  initialDataUrl?: string;
  background: NoteBackground;
  onBackgroundChange: (b: NoteBackground) => void;
  minHeight?: number;
  onDirty?: () => void;
}

const backgrounds: { value: NoteBackground; label: string }[] = [
  { value: "plain", label: "Jasny papier" },
  { value: "lined", label: "Linie" },
  { value: "grid", label: "Kratka" },
  { value: "cream", label: "Kremowy" },
  { value: "dark", label: "Ciemny" },
];

const colorPresets = ["#3a2418", "#c9a86a", "#8b2e2e", "#2c4a6b", "#2f5d3a", "#1a0e08"];

const PREFS_KEY = "agata-handwriting-prefs-v1";

interface StoredPrefs {
  color?: string;
  width?: number;
  erase?: boolean;
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
  } catch {
    /* noop */
  }
}

export function getStoredHandwritingBackground(): NoteBackground | undefined {
  return readPrefs().background;
}

export const HandwritingCanvas = forwardRef<HandwritingCanvasHandle, Props>(
  function HandwritingCanvas(
    { initialDataUrl, background, onBackgroundChange, minHeight = 420, onDirty },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [redoStack, setRedoStack] = useState<Stroke[]>([]);
    const currentRef = useRef<Stroke | null>(null);
    const stored = readPrefs();
    const [color, setColor] = useState(stored.color ?? "#3a2418");
    const [width, setWidth] = useState(stored.width ?? 3);
    const [erase, setErase] = useState(stored.erase ?? false);
    const dprRef = useRef(1);
    const sizeRef = useRef({ w: 0, h: 0 });

    // Persist tool prefs whenever they change.
    useEffect(() => {
      writePrefs({ color, width, erase });
    }, [color, width, erase]);

    // Persist background pref whenever parent updates it.
    useEffect(() => {
      writePrefs({ background });
    }, [background]);

    const handleBackgroundChange = (b: NoteBackground) => {
      writePrefs({ background: b });
      onBackgroundChange(b);
    };

    const bgFill =
      background === "dark" ? "#1d140d" : background === "cream" ? "#f5ede2" : "#fdfaf4";

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
      ctx.strokeStyle = background === "dark" ? "rgba(201,168,106,0.18)" : "rgba(58,36,24,0.12)";
      ctx.lineWidth = 1;
      if (background === "lined") {
        for (let y = 32; y < h; y += 28) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
      } else if (background === "grid") {
        for (let y = 24; y < h; y += 24) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
        for (let x = 24; x < w; x += 24) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
      }
      ctx.restore();

      if (initialImgRef.current) {
        ctx.drawImage(initialImgRef.current, 0, 0, w, h);
      }

      const all = currentRef.current ? [...strokes, currentRef.current] : strokes;
      for (const s of all) {
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if (s.erase) {
          ctx.globalCompositeOperation = "destination-out";
          ctx.strokeStyle = "rgba(0,0,0,1)";
        } else {
          ctx.globalCompositeOperation = "source-over";
          ctx.strokeStyle = s.color;
        }
        ctx.lineWidth = s.width;
        const pts = s.points;
        if (pts.length === 1) {
          ctx.beginPath();
          ctx.arc(pts[0].x, pts[0].y, s.width / 2, 0, Math.PI * 2);
          ctx.fillStyle = s.erase ? "rgba(0,0,0,1)" : s.color;
          ctx.fill();
        } else {
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
      }
    }, [strokes, background, bgFill]);

    const resize = useCallback(() => {
      const c = canvasRef.current;
      const wrap = wrapRef.current;
      if (!c || !wrap) return;
      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;
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

    // load initial image once; keep it in a ref so drawAll() can repaint it after every state change
    const initialImgRef = useRef<HTMLImageElement | null>(null);
    const [initialLoaded, setInitialLoaded] = useState(false);
    const [clearedInitial, setClearedInitial] = useState(false);
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
      return { x: e.clientX - rect.left, y: e.clientY - rect.top, p: e.pressure || undefined };
    };

    const onDown = (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
      currentRef.current = {
        color,
        erase,
        width: erase ? width * 3 : Math.max(0.5, width * (0.6 + pressure)),
        points: [ptFrom(e)],
      };
      drawAll();
    };
    const onMove = (e: React.PointerEvent) => {
      if (!currentRef.current) return;
      e.preventDefault();
      currentRef.current.points.push(ptFrom(e));
      drawAll();
    };
    const onUp = (e: React.PointerEvent) => {
      if (!currentRef.current) return;
      e.preventDefault();
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

    // Re-measure when entering/exiting focus mode so the canvas fills the new container.
    useEffect(() => {
      const t = setTimeout(resize, 0);
      return () => clearTimeout(t);
    }, [focus, resize]);

    return (
      <div
        className={
          focus
            ? "fixed inset-0 z-50 bg-[var(--bg)] p-3 sm:p-4 overflow-auto flex flex-col gap-3"
            : "space-y-3"
        }
      >
        <div className="glass rounded-2xl p-3 flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={() => setErase(false)}
            className={`px-3 py-2 rounded-full text-xs inline-flex items-center gap-1.5 ${!erase ? "bg-[var(--accent-gold)] text-[var(--bg)]" : "bg-[var(--glass-inner)] text-warm"}`}
          >
            <Pen className="w-3.5 h-3.5" /> Pióro
          </button>
          <button
            type="button"
            onClick={() => setErase(true)}
            className={`px-3 py-2 rounded-full text-xs inline-flex items-center gap-1.5 ${erase ? "bg-[var(--accent-gold)] text-[var(--bg)]" : "bg-[var(--glass-inner)] text-warm"}`}
          >
            <Eraser className="w-3.5 h-3.5" /> Gumka
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={strokes.length === 0}
            className="px-3 py-2 rounded-full text-xs inline-flex items-center gap-1.5 bg-[var(--glass-inner)] text-warm disabled:opacity-40"
          >
            <Undo2 className="w-3.5 h-3.5" /> Cofnij
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={redoStack.length === 0}
            className="px-3 py-2 rounded-full text-xs inline-flex items-center gap-1.5 bg-[var(--glass-inner)] text-warm disabled:opacity-40"
          >
            <Redo2 className="w-3.5 h-3.5" /> Ponów
          </button>
          <button
            type="button"
            onClick={askClear}
            className="px-3 py-2 rounded-full text-xs inline-flex items-center gap-1.5 bg-[var(--glass-inner)] text-warm"
          >
            <Trash2 className="w-3.5 h-3.5" /> Wyczyść
          </button>
          <label className="text-xs text-warm-muted inline-flex items-center gap-2 ml-1">
            Grubość
            <input
              type="range"
              min={1}
              max={12}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="w-24"
            />
          </label>
          <div className="inline-flex items-center gap-1.5">
            <span className="text-xs text-warm-muted">Kolor</span>
            {colorPresets.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border ${color === c ? "ring-2 ring-[var(--accent-gold)]" : "border-[var(--glass-border)]"}`}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setFocus((f) => !f)}
            className="ml-auto px-3 py-2 rounded-full text-xs inline-flex items-center gap-1.5 bg-[var(--glass-inner)] text-warm"
          >
            {focus ? (
              <>
                <X className="w-3.5 h-3.5" /> Zamknij
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" /> Pełny ekran pisania
              </>
            )}
          </button>
        </div>

        <div className="glass rounded-2xl p-2 flex flex-wrap gap-2 items-center">
          <span className="text-xs text-warm-muted px-1">Tło strony</span>
          {backgrounds.map((b) => (
            <button
              key={b.value}
              type="button"
              onClick={() => onBackgroundChange(b.value)}
              className={`px-3 py-1.5 rounded-full text-xs ${background === b.value ? "bg-[var(--accent-gold)] text-[var(--bg)]" : "bg-[var(--glass-inner)] text-warm"}`}
            >
              {b.label}
            </button>
          ))}
        </div>

        <div
          ref={wrapRef}
          className={`glass rounded-2xl overflow-hidden ${focus ? "flex-1" : ""}`}
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
              cursor: "crosshair",
            }}
          />
        </div>
        {confirmClear && (
          <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4">
            <div className="glass rounded-2xl p-6 max-w-sm w-full">
              <h3 className="font-serif text-lg mb-2">Wyczyścić stronę?</h3>
              <p className="text-sm text-warm-muted mb-5">To usunie pismo z tej notatki.</p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmClear(false)}
                  className="px-4 py-2 rounded-full bg-[var(--glass-inner)] text-warm text-sm"
                >
                  Anuluj
                </button>
                <button
                  onClick={clearAll}
                  className="px-4 py-2 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm font-medium"
                >
                  Wyczyść
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
);
