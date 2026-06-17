"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Share2, Trash2, FileText, CheckSquare } from "lucide-react";
import Link from "next/link";
import type { TripDetailDTO, ChecklistItemDTO } from "@/types/trip";
import { computeHealthScore } from "@/types/trip";
import type { DocumentDTO } from "@/types/document";
import { Button } from "@/components/ui/button";
import { DocumentCard } from "@/components/documents/document-card";
import { DocumentDetailDrawer } from "@/components/documents/document-detail-drawer";
import { UploadZone } from "@/components/documents/upload-zone";
import { HealthScoreRing } from "./health-score-ring";
import { ChecklistPanel } from "./checklist-panel";
import { getCountryName } from "@/lib/countries";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

interface TripDetailClientProps {
  trip: TripDetailDTO;
}

type Tab = "documents" | "checklist";

const TRIP_TYPE_LABELS: Record<string, string> = {
  TOURISM: "Tourism",
  BUSINESS: "Business",
  TRANSIT: "Transit",
  STUDY: "Study",
  WORK: "Work",
};

export function TripDetailClient({ trip: initialTrip }: TripDetailClientProps) {
  const router = useRouter();
  const [trip, setTrip] = useState(initialTrip);
  const [activeTab, setActiveTab] = useState<Tab>("checklist");
  const [showUpload, setShowUpload] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentDTO | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sharingLink, setSharingLink] = useState(false);

  function handleItemUpdated(item: ChecklistItemDTO) {
    const updatedChecklist = trip.checklist.map((c) => (c.id === item.id ? item : c));
    const healthScore = computeHealthScore(updatedChecklist);
    setTrip((prev) => ({ ...prev, checklist: updatedChecklist, healthScore }));
  }

  function handleDocUploaded(doc: DocumentDTO) {
    setTrip((prev) => ({
      ...prev,
      documents: [doc, ...prev.documents],
      documentCount: prev.documentCount + 1,
    }));
  }

  function handleDocDeleted(id: string) {
    setTrip((prev) => ({
      ...prev,
      documents: prev.documents.filter((d) => d.id !== id),
      documentCount: prev.documentCount - 1,
    }));
  }

  async function handleDelete() {
    if (!confirm(`Delete "${trip.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/trips/${trip.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Trip deleted");
      router.push("/trips");
    } catch {
      toast.error("Failed to delete trip");
      setDeleting(false);
    }
  }

  async function handleShare() {
    setSharingLink(true);
    try {
      const res = await fetch(`/api/trips/${trip.id}/share`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { shareToken: string };
      const url = `${typeof window !== "undefined" ? window.location.origin : ""}/shared/${data.shareToken}`;
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard");
    } catch {
      toast.error("Failed to generate share link");
    } finally {
      setSharingLink(false);
    }
  }

  const destName = getCountryName(trip.destination);
  const depDate = formatDate(trip.departureDate);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/trips"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
            aria-label="Back to trips"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-text-primary">{trip.name}</h1>
            <p className="text-sm text-text-secondary">
              {destName} · {TRIP_TYPE_LABELS[trip.tripType]} · {depDate}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pl-12 sm:pl-0">
          <HealthScoreRing score={trip.healthScore} size="md" />
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleShare} loading={sharingLink}>
              <Share2 className="h-4 w-4" />
              Share
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Health score summary */}
      {trip.healthScore.total > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface-elevated px-4 py-3">
          <div className="flex-1">
            <div className="mb-1.5 flex items-center justify-between text-xs text-text-secondary">
              <span>Required documents</span>
              <span className="font-medium text-text-primary">
                {trip.healthScore.fulfilled} / {trip.healthScore.total}
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-border overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${trip.healthScore.percent ?? 0}%`,
                  backgroundColor:
                    (trip.healthScore.percent ?? 0) >= 80
                      ? "#22C55E"
                      : (trip.healthScore.percent ?? 0) >= 50
                      ? "#F59E0B"
                      : "#EF4444",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile tabs / Desktop two-panel */}
      <div className="lg:hidden">
        <div className="flex gap-1 rounded-xl border border-surface-border bg-surface-elevated p-1">
          {([
            { id: "checklist" as Tab, label: "Checklist", icon: <CheckSquare className="h-4 w-4" /> },
            { id: "documents" as Tab, label: `Documents (${trip.documentCount})`, icon: <FileText className="h-4 w-4" /> },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors min-h-[44px]",
                activeTab === tab.id
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left panel — Checklist (always rendered on desktop; toggled on mobile) */}
        <div className={cn("space-y-4", activeTab !== "checklist" && "lg:block hidden")}>
          <ChecklistPanel
            tripId={trip.id}
            items={trip.checklist}
            onItemUpdated={handleItemUpdated}
          />
        </div>

        {/* Right panel — Documents */}
        <div className={cn("space-y-4", activeTab !== "documents" && "lg:block hidden")}>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-text-primary">
              Documents{trip.documentCount > 0 && ` (${trip.documentCount})`}
            </h2>
            <Button variant="secondary" size="sm" onClick={() => setShowUpload((v) => !v)}>
              + Add
            </Button>
          </div>

          {showUpload && (
            <UploadZone
              tripId={trip.id}
              onUploaded={handleDocUploaded}
              onLimitReached={() => toast.error("Document limit reached. Upgrade your plan.")}
            />
          )}

          {trip.documents.length === 0 ? (
            <div className="rounded-xl border border-surface-border bg-surface-elevated p-6 text-center">
              <p className="text-sm text-text-secondary">
                No documents linked to this trip yet.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => setShowUpload(true)}
              >
                Add a document
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {trip.documents.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onClick={setSelectedDoc}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <DocumentDetailDrawer
        document={selectedDoc}
        onClose={() => setSelectedDoc(null)}
        onDeleted={handleDocDeleted}
      />
    </div>
  );
}
