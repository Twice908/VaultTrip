"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, Upload, Sparkles, X } from "lucide-react";
import type { DocumentType } from "@prisma/client";
import type { DocumentDTO } from "@/types/document";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DOCUMENT_TYPE_LABELS } from "./document-type-icon";
import { DocumentCard } from "./document-card";
import { UploadZone } from "./upload-zone";
import { DocumentDetailDrawer } from "./document-detail-drawer";

type Filter = DocumentType | "ALL";

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 10;

interface VaultClientProps {
  initialDocuments: DocumentDTO[];
}

export function VaultClient({ initialDocuments }: VaultClientProps) {
  const [documents, setDocuments] = useState<DocumentDTO[]>(initialDocuments);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [showUpload, setShowUpload] = useState(false);
  const [selected, setSelected] = useState<DocumentDTO | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  // IDs of documents whose processing exceeded MAX_POLL_ATTEMPTS ticks.
  const [timedOutIds, setTimedOutIds] = useState<Set<string>>(new Set());

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttemptsRef = useRef(0);
  // Always-current snapshot of documents so the interval closure is never stale.
  const documentsRef = useRef(documents);
  documentsRef.current = documents;

  const stopPolling = useCallback((newTimedOutIds?: string[]) => {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (newTimedOutIds && newTimedOutIds.length > 0) {
      setTimedOutIds((prev) => new Set([...prev, ...newTimedOutIds]));
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollIntervalRef.current !== null) return; // already running
    pollAttemptsRef.current = 0;

    pollIntervalRef.current = setInterval(async () => {
      pollAttemptsRef.current += 1;

      try {
        const res = await fetch("/api/documents");
        if (res.ok) {
          const data = (await res.json()) as { documents: DocumentDTO[] };
          const freshMap = new Map(data.documents.map((d) => [d.id, d]));

          setDocuments((prev) =>
            prev.map((d) => {
              const fresh = freshMap.get(d.id);
              return fresh ?? d;
            })
          );

          // If no doc in the fresh list is still unprocessed, stop polling.
          const hasStillUnprocessed = data.documents.some((d) => !d.aiProcessed);
          if (!hasStillUnprocessed) {
            stopPolling();
            return;
          }
        }
      } catch {
        // Transient network error — keep polling until the budget is spent.
      }

      if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
        const stillUnprocessed = documentsRef.current
          .filter((d) => !d.aiProcessed)
          .map((d) => d.id);
        stopPolling(stillUnprocessed);
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling]);

  // Start (or confirm already-running) polling whenever unprocessed docs exist.
  useEffect(() => {
    const hasUnprocessed = documents.some(
      (d) => !d.aiProcessed && !timedOutIds.has(d.id)
    );
    if (hasUnprocessed) startPolling();
  }, [documents, timedOutIds, startPolling]);

  // Clean up on unmount.
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // Distinct types present, used to render only relevant filter chips.
  const presentTypes = useMemo(() => {
    const set = new Set<DocumentType>();
    for (const doc of documents) set.add(doc.type);
    return Array.from(set);
  }, [documents]);

  const visibleDocuments = useMemo(
    () => (filter === "ALL" ? documents : documents.filter((d) => d.type === filter)),
    [documents, filter]
  );

  function handleUploaded(doc: DocumentDTO) {
    setDocuments((prev) => [doc, ...prev]);
  }

  function handleDeleted(id: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  const count = documents.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Vault{count > 0 && <span className="text-text-muted"> · {count} {count === 1 ? "document" : "documents"}</span>}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            All your travel documents in one encrypted place, filterable by type.
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setShowUpload((v) => !v)}>
          <Upload className="h-4 w-4" />
          Upload
        </Button>
      </div>

      {limitReached && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-accent-muted bg-accent-subtle p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-text-primary">
                You&apos;ve reached the Free plan limit
              </p>
              <p className="mt-0.5 text-sm text-text-secondary">
                Free accounts can store up to 10 documents. Upgrade to Traveler for 100
                documents and unlimited trips.
              </p>
              <Button variant="primary" size="sm" className="mt-3">
                Upgrade plan
              </Button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLimitReached(false)}
            aria-label="Dismiss"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      {showUpload && (
        <UploadZone
          onUploaded={handleUploaded}
          onLimitReached={() => setLimitReached(true)}
        />
      )}

      {count > 0 && (
        <div className="flex flex-wrap gap-2">
          <FilterChip active={filter === "ALL"} onClick={() => setFilter("ALL")}>
            All
          </FilterChip>
          {presentTypes.map((type) => (
            <FilterChip key={type} active={filter === type} onClick={() => setFilter(type)}>
              {DOCUMENT_TYPE_LABELS[type]}
            </FilterChip>
          ))}
        </div>
      )}

      {count === 0 ? (
        <EmptyState
          icon={<Archive className="h-7 w-7" />}
          title="Your vault is empty"
          description="Upload passports, visas, insurance PDFs, hotel bookings, and vaccination records. All files are encrypted at rest and served via expiring links."
          action={
            <Button variant="primary" size="md" onClick={() => setShowUpload(true)}>
              <Upload className="h-4 w-4" />
              Upload first document
            </Button>
          }
        />
      ) : visibleDocuments.length === 0 ? (
        <p className="rounded-xl border border-surface-border bg-surface-elevated p-8 text-center text-sm text-text-secondary">
          No documents of this type yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleDocuments.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onClick={setSelected}
              timedOut={timedOutIds.has(doc.id)}
            />
          ))}
        </div>
      )}

      <DocumentDetailDrawer
        document={selected}
        onClose={() => setSelected(null)}
        onDeleted={handleDeleted}
      />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-accent bg-accent text-white"
          : "border-surface-border bg-surface-elevated text-text-secondary hover:bg-surface-hover hover:text-text-primary"
      )}
    >
      {children}
    </button>
  );
}
