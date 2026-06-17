"use client";

import { Clock, Loader2 } from "lucide-react";
import type { DocumentDTO } from "@/types/document";
import { cn, formatDate } from "@/lib/utils";
import { DocumentTypeIcon, DOCUMENT_TYPE_LABELS } from "./document-type-icon";
import { ExpiryBadge } from "./expiry-badge";

interface DocumentCardProps {
  document: DocumentDTO;
  onClick: (document: DocumentDTO) => void;
  /** True once VaultClient's polling budget is exhausted and the doc is still unprocessed. */
  timedOut?: boolean;
}

export function DocumentCard({ document, onClick, timedOut = false }: DocumentCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(document)}
      className={cn(
        "group flex w-full flex-col gap-3 rounded-xl border border-surface-border bg-surface-elevated p-4 text-left shadow-card transition-colors",
        "hover:border-accent-muted hover:bg-surface-hover",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center justify-center rounded-lg bg-surface-overlay p-2 text-text-secondary group-hover:text-text-primary">
          <DocumentTypeIcon type={document.type} />
        </div>
        <ExpiryBadge expiryDate={document.expiryDate} aiProcessed={document.aiProcessed} />
      </div>

      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-sm font-semibold text-text-primary">{document.name}</p>
        <p className="text-xs text-text-muted">
          {DOCUMENT_TYPE_LABELS[document.type]} · Added {formatDate(document.createdAt)}
        </p>
      </div>

      {!document.aiProcessed &&
        (timedOut ? (
          <p className="inline-flex items-center gap-1.5 text-xs text-text-muted">
            <Clock className="h-3 w-3" aria-hidden />
            Processing took longer than expected
          </p>
        ) : (
          <p className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Extracting details…
          </p>
        ))}
    </button>
  );
}
