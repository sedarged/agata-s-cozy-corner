interface GoalRingProps {
  value: number;
  goal: number;
  label: string;
  unit?: string;
  size?: number;
}

export function GoalRing({ value, goal, label, unit, size = 120 }: GoalRingProps) {
  const pct = goal > 0 ? Math.min(1, value / goal) : 0;
  const radius = (size - 16) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - pct);
  const display = Math.round(pct * 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
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
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
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
