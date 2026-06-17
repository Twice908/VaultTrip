import { CheckCircle2, AlertTriangle, Clock, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ExpiryStatus = "processing" | "none" | "valid" | "expiring" | "expired";

const EXPIRING_WINDOW_DAYS = 30;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Derives the expiry status for a document. Pure function — `now` is injectable
 * for testing.
 */
export function getExpiryStatus(
  expiryDate: string | null,
  aiProcessed: boolean,
  now: Date = new Date()
): ExpiryStatus {
  if (!aiProcessed) return "processing";
  if (!expiryDate) return "none";

  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) return "none";

  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / MS_PER_DAY);
  if (daysLeft < 0) return "expired";
  if (daysLeft <= EXPIRING_WINDOW_DAYS) return "expiring";
  return "valid";
}

const CONFIG: Record<
  ExpiryStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  processing: {
    label: "Processing",
    icon: Clock,
    className: "bg-surface-overlay text-text-secondary",
  },
  none: {
    label: "No expiry",
    icon: MinusCircle,
    className: "bg-surface-overlay text-text-secondary",
  },
  valid: {
    label: "Valid",
    icon: CheckCircle2,
    className: "bg-success-subtle text-success-text",
  },
  expiring: {
    label: "Expiring soon",
    icon: AlertTriangle,
    className: "bg-warning-subtle text-warning-text",
  },
  expired: {
    label: "Expired",
    icon: AlertTriangle,
    className: "bg-danger-subtle text-danger-text",
  },
};

interface ExpiryBadgeProps {
  expiryDate: string | null;
  aiProcessed: boolean;
  className?: string;
}

export function ExpiryBadge({ expiryDate, aiProcessed, className }: ExpiryBadgeProps) {
  const status = getExpiryStatus(expiryDate, aiProcessed);
  const { label, icon: Icon, className: tone } = CONFIG[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tone,
        className
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}
