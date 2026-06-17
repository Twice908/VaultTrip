"use client";

import Link from "next/link";
import { FileText, Calendar } from "lucide-react";
import type { TripDTO } from "@/types/trip";
import { formatDate } from "@/lib/utils";
import { getCountryName } from "@/lib/countries";
import { HealthScoreRing } from "./health-score-ring";

interface TripCardProps {
  trip: TripDTO;
}

const TRIP_TYPE_LABELS: Record<string, string> = {
  TOURISM: "Tourism",
  BUSINESS: "Business",
  TRANSIT: "Transit",
  STUDY: "Study",
  WORK: "Work",
};

export function TripCard({ trip }: TripCardProps) {
  const destinationName = getCountryName(trip.destination);
  const departureLabel = formatDate(trip.departureDate);

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group flex flex-col gap-4 rounded-xl border border-surface-border bg-surface-elevated p-5 transition-colors hover:border-accent/50 hover:bg-surface-hover"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-text-primary group-hover:text-accent transition-colors">
            {trip.name}
          </h3>
          <p className="mt-0.5 text-sm text-text-secondary truncate">
            {destinationName} · {TRIP_TYPE_LABELS[trip.tripType] ?? trip.tripType}
          </p>
        </div>
        <HealthScoreRing score={trip.healthScore} size="sm" />
      </div>

      <div className="flex items-center gap-4 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" aria-hidden />
          {departureLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" aria-hidden />
          {trip.documentCount} {trip.documentCount === 1 ? "doc" : "docs"}
        </span>
        {trip.checklistCounts.pending > 0 && (
          <span className="ml-auto rounded-full bg-warning-subtle px-2 py-0.5 text-warning-text">
            {trip.checklistCounts.pending} pending
          </span>
        )}
      </div>
    </Link>
  );
}
