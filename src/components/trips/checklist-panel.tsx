"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  MinusCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";
import type { ChecklistItemDTO } from "@/types/trip";
import type { ChecklistStatus, RequiredLevel } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

interface ChecklistPanelProps {
  tripId: string;
  items: ChecklistItemDTO[];
  onItemUpdated: (item: ChecklistItemDTO) => void;
}

const STATUS_CONFIG: Record<ChecklistStatus, { icon: React.ReactNode; label: string; color: string }> = {
  PENDING: {
    icon: <Circle className="h-4 w-4" />,
    label: "Pending",
    color: "text-text-muted",
  },
  FULFILLED: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    label: "Done",
    color: "text-success",
  },
  FLAGGED: {
    icon: <AlertTriangle className="h-4 w-4" />,
    label: "Flagged",
    color: "text-warning-DEFAULT",
  },
  NOT_APPLICABLE: {
    icon: <MinusCircle className="h-4 w-4" />,
    label: "N/A",
    color: "text-text-placeholder",
  },
};

const REQUIRED_LABELS: Record<RequiredLevel, string> = {
  REQUIRED: "Required",
  RECOMMENDED: "Recommended",
  OPTIONAL: "Optional",
};

const REQUIRED_ORDER: RequiredLevel[] = ["REQUIRED", "RECOMMENDED", "OPTIONAL"];

export function ChecklistPanel({ tripId, items, onItemUpdated }: ChecklistPanelProps) {
  const [regenerating, setRegenerating] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/checklist/generate`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Checklist regeneration started. Items will update shortly.");
    } catch {
      toast.error("Failed to regenerate checklist");
    } finally {
      setRegenerating(false);
    }
  }

  async function toggleStatus(item: ChecklistItemDTO) {
    const next: ChecklistStatus = item.status === "FULFILLED" ? "PENDING" : "FULFILLED";
    setUpdatingIds((prev) => new Set([...prev, item.id]));
    try {
      const res = await fetch(`/api/trips/${tripId}/checklist/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { item: ChecklistItemDTO };
      onItemUpdated(data.item);
    } catch {
      toast.error("Failed to update item");
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-surface-border bg-surface-elevated p-10 text-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
        <p className="text-sm font-medium text-text-primary">Generating your document checklist…</p>
        <p className="text-xs text-text-secondary max-w-xs">
          Claude is building a personalised checklist for your destination. This usually takes under 10 seconds.
        </p>
      </div>
    );
  }

  const grouped = REQUIRED_ORDER.map((level) => ({
    level,
    items: items.filter((i) => i.required === level),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">Document Checklist</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRegenerate}
          loading={regenerating}
          title="Regenerate checklist"
        >
          <RefreshCw className="h-4 w-4" />
          Regenerate
        </Button>
      </div>

      {grouped.map(({ level, items: levelItems }) => (
        <div key={level} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            {REQUIRED_LABELS[level]}
          </p>
          <div className="space-y-1.5">
            {levelItems.map((item) => {
              const cfg = STATUS_CONFIG[item.status];
              const isUpdating = updatingIds.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleStatus(item)}
                  disabled={isUpdating}
                  className={cn(
                    "group flex w-full items-start gap-3 rounded-lg border border-surface-border bg-surface-elevated p-3 text-left transition-colors min-h-[44px]",
                    "hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-70"
                  )}
                >
                  <span className={cn("mt-0.5 shrink-0 transition-colors", cfg.color, isUpdating && "opacity-50")}>
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : cfg.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      "text-sm font-medium",
                      item.status === "FULFILLED" ? "text-text-muted line-through" : "text-text-primary"
                    )}>
                      {item.label}
                    </p>
                    {item.description && (
                      <p className="mt-0.5 text-xs text-text-secondary">{item.description}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
