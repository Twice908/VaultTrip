import { notFound } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, CheckCircle2, Circle, AlertTriangle, MinusCircle, Plane } from "lucide-react";
import type { RequiredLevel, ChecklistStatus } from "@prisma/client";
import { formatDate } from "@/lib/utils";
import { getCountryName } from "@/lib/countries";

interface SharedTripPageProps {
  params: { token: string };
}

interface SharedChecklistItem {
  id: string;
  label: string;
  description: string | null;
  required: RequiredLevel;
  status: ChecklistStatus;
}

interface SharedTripData {
  id: string;
  name: string;
  destination: string;
  departureDate: string;
  returnDate: string | null;
  checklist: SharedChecklistItem[];
}

const STATUS_ICON: Record<ChecklistStatus, React.ReactNode> = {
  FULFILLED: <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />,
  PENDING: <Circle className="h-4 w-4 text-text-muted" aria-hidden />,
  FLAGGED: <AlertTriangle className="h-4 w-4 text-warning-DEFAULT" aria-hidden />,
  NOT_APPLICABLE: <MinusCircle className="h-4 w-4 text-text-placeholder" aria-hidden />,
};

const REQUIRED_LABELS: Record<RequiredLevel, string> = {
  REQUIRED: "Required",
  RECOMMENDED: "Recommended",
  OPTIONAL: "Optional",
};

const REQUIRED_ORDER: RequiredLevel[] = ["REQUIRED", "RECOMMENDED", "OPTIONAL"];

async function fetchSharedTrip(token: string): Promise<SharedTripData | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/shared/${token}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { trip: SharedTripData };
    return data.trip;
  } catch {
    return null;
  }
}

export default async function SharedTripPage({ params }: SharedTripPageProps) {
  const trip = await fetchSharedTrip(params.token);
  if (!trip) notFound();

  const destName = getCountryName(trip.destination);
  const depDate = formatDate(trip.departureDate);
  const retDate = trip.returnDate ? formatDate(trip.returnDate) : null;

  const grouped = REQUIRED_ORDER.map((level) => ({
    level,
    items: trip.checklist.filter((i) => i.required === level),
  })).filter((g) => g.items.length > 0);

  const fulfilled = trip.checklist.filter((i) => i.status === "FULFILLED").length;
  const total = trip.checklist.length;

  return (
    <div className="min-h-screen bg-surface-base flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-bold tracking-tight text-text-primary">VaultTrip</span>
        </div>
        <Link
          href="/sign-in"
          className="text-sm font-medium text-accent hover:text-accent-hover transition-colors min-h-[44px] flex items-center"
        >
          Sign in
        </Link>
      </header>

      <main className="flex-1 mx-auto w-full max-w-xl px-4 py-8 space-y-6">
        {/* Trip header */}
        <div className="rounded-xl border border-surface-border bg-surface-elevated p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent">
              <Plane className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text-primary">{trip.name}</h1>
              <p className="text-sm text-text-secondary">
                {destName} · {depDate}{retDate ? ` – ${retDate}` : ""}
              </p>
            </div>
          </div>

          {total > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs text-text-secondary">
                <span>Checklist progress</span>
                <span className="font-medium text-text-primary">{fulfilled} / {total}</span>
              </div>
              <div className="h-2 rounded-full bg-surface-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${total > 0 ? Math.round((fulfilled / total) * 100) : 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Checklist */}
        {grouped.length === 0 ? (
          <p className="text-center text-sm text-text-secondary py-8">No checklist items yet.</p>
        ) : (
          <div className="space-y-4">
            {grouped.map(({ level, items }) => (
              <div key={level} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {REQUIRED_LABELS[level]}
                </p>
                <div className="space-y-1.5">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 rounded-lg border border-surface-border bg-surface-elevated p-3"
                    >
                      <span className="mt-0.5 shrink-0">{STATUS_ICON[item.status]}</span>
                      <div>
                        <p className={`text-sm font-medium ${item.status === "FULFILLED" ? "text-text-muted line-through" : "text-text-primary"}`}>
                          {item.label}
                        </p>
                        {item.description && (
                          <p className="mt-0.5 text-xs text-text-secondary">{item.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="rounded-xl border border-accent-muted bg-accent-subtle p-5 text-center">
          <p className="text-sm font-semibold text-text-primary mb-1">Organise your own trips</p>
          <p className="text-xs text-text-secondary mb-4">
            VaultTrip keeps all your travel documents in one encrypted place and generates personalised checklists for every destination.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors min-h-[44px]"
          >
            Create your free account
          </Link>
        </div>
      </main>
    </div>
  );
}
