import { useEffect, useRef, useState } from "react";

interface GoalRingProps {
  value: number;
  goal: number;
  label: string;
  unit?: string;
  size?: number;
}

function usePrefersReducedMotion() {
  const [prefers, setPrefers] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefers(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return prefers;
}

export function GoalRing({ value, goal, label, unit, size = 120 }: GoalRingProps) {
  const pct = goal > 0 ? Math.min(1, value / goal) : 0;
  const radius = (size - 16) / 2;
  const circ = 2 * Math.PI * radius;
  const display = Math.round(pct * 100);
  const reduced = usePrefersReducedMotion();
  const mountedRef = useRef(false);
  const [drawnPct, setDrawnPct] = useState(reduced ? pct : 0);

  useEffect(() => {
    if (reduced) {
      setDrawnPct(pct);
      return;
    }
    if (!mountedRef.current) {
      mountedRef.current = true;
      const t = requestAnimationFrame(() => setDrawnPct(pct));
      return () => cancelAnimationFrame(t);
    }
    setDrawnPct(pct);
  }, [pct, reduced]);

  const offset = circ * (1 - drawnPct);
  const ariaLabel = `${label}: ${value} z ${goal}${unit ? ` ${unit}` : ""} (${display}%)`;

  return (
    <div
      className="flex flex-col items-center gap-2"
      role="img"
      aria-label={ariaLabel}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--muted)"
            strokeWidth={8}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--primary)"
            strokeWidth={8}
            fill="none"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transition: reduced ? "none" : "stroke-dashoffset 0.9s cubic-bezier(.22,.61,.36,1)",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-serif text-2xl leading-none">{display}%</div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {value}/{goal}{unit ? ` ${unit}` : ""}
          </div>
        </div>
      </div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}
