"use client";

import { cn } from "@/lib/utils";
import type { TripHealthScore } from "@/types/trip";

interface HealthScoreRingProps {
  score: TripHealthScore;
  size?: "sm" | "md";
}

const SIZE_CONFIG = {
  sm: { radius: 18, stroke: 4, box: 44, textClass: "text-xs" },
  md: { radius: 28, stroke: 5, box: 68, textClass: "text-sm" },
};

function getColor(percent: number | null): string {
  if (percent === null) return "#364D66"; // grey — no data
  if (percent >= 80) return "#22C55E"; // green
  if (percent >= 50) return "#F59E0B"; // amber
  return "#EF4444"; // red
}

export function HealthScoreRing({ score, size = "sm" }: HealthScoreRingProps) {
  const cfg = SIZE_CONFIG[size];
  const circumference = 2 * Math.PI * cfg.radius;
  const fillPct = score.percent ?? 0;
  const dashOffset = circumference - (fillPct / 100) * circumference;
  const color = getColor(score.percent);

  const label =
    score.percent === null
      ? "—"
      : `${score.percent}%`;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: cfg.box, height: cfg.box }}
      title={
        score.percent === null
          ? "Checklist generating…"
          : `${score.fulfilled} of ${score.total} required documents`
      }
      aria-label={`Trip health: ${label}`}
    >
      <svg
        width={cfg.box}
        height={cfg.box}
        viewBox={`0 0 ${cfg.box} ${cfg.box}`}
        className="-rotate-90"
      >
        {/* Track */}
        <circle
          cx={cfg.box / 2}
          cy={cfg.box / 2}
          r={cfg.radius}
          fill="none"
          stroke="#1E3352"
          strokeWidth={cfg.stroke}
        />
        {/* Fill */}
        <circle
          cx={cfg.box / 2}
          cy={cfg.box / 2}
          r={cfg.radius}
          fill="none"
          stroke={color}
          strokeWidth={cfg.stroke}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <span
        className={cn(
          "absolute font-semibold",
          cfg.textClass,
          score.percent === null ? "text-text-muted" : "text-text-primary"
        )}
        style={{ color: score.percent !== null ? color : undefined }}
      >
        {label}
      </span>
    </div>
  );
}
