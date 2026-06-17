"use client";

import { useEffect, useState } from "react";
import { X, Download, Trash2, AlertTriangle } from "lucide-react";
import type { DocumentDTO, DocumentDetailDTO } from "@/types/document";
import { cn, formatDate, formatFileSize } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { DocumentTypeIcon, DOCUMENT_TYPE_LABELS } from "./document-type-icon";
import { ExpiryBadge } from "./expiry-badge";

interface DocumentDetailDrawerProps {
  document: DocumentDTO | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-surface-border py-3">
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd className="text-sm font-medium text-text-primary">{value}</dd>
    </div>
  );
}

export function DocumentDetailDrawer({
  document,
  onClose,
  onDeleted,
}: DocumentDetailDrawerProps) {
  const [downloading, setDownloading] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reset transient state whenever a different document is opened.
  useEffect(() => {
    setConfirmingDelete(false);
    setDownloading(false);
    setDeleting(false);
  }, [document?.id]);

  // Close on Escape while open.
  useEffect(() => {
    if (!document) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [document, onClose]);

  const open = document !== null;

  async function handleDownload() {
    if (!document) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/documents/${document.id}`);
      if (!res.ok) throw new Error("Could not generate download link");
      const data = (await res.json()) as DocumentDetailDTO;
      window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    if (!document) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${document.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete document");
      onDeleted(document.id);
      toast.success("Document deleted");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/60 transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      {/* Slide-over panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Document details"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-surface-base shadow-modal transition-transform",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {document && (
          <>
            <header className="flex items-start justify-between gap-3 border-b border-surface-border p-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex items-center justify-center rounded-lg bg-surface-overlay p-2 text-text-secondary">
                  <DocumentTypeIcon type={document.type} />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-text-primary">
                    {document.name}
                  </h2>
                  <p className="text-xs text-text-muted">
                    {DOCUMENT_TYPE_LABELS[document.type]}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5">
              {!document.aiProcessed && (
                <div className="mb-5 flex items-start gap-2 rounded-lg border border-surface-border bg-surface-overlay p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-text" aria-hidden />
                  <p className="text-xs text-text-secondary">
                    We&apos;re extracting details from this document. Check back shortly.
                  </p>
                </div>
              )}

              <div className="mb-4">
                <ExpiryBadge
                  expiryDate={document.expiryDate}
                  aiProcessed={document.aiProcessed}
                />
              </div>

              <dl>
                <Field label="Type" value={DOCUMENT_TYPE_LABELS[document.type]} />
                <Field label="Expiry date" value={formatDate(document.expiryDate)} />
                <Field label="Issue date" value={formatDate(document.issueDate)} />
                <Field label="Document number" value={document.docNumber ?? "—"} />
                <Field label="Issued by" value={document.issuedBy ?? "—"} />
                <Field label="File size" value={formatFileSize(document.fileSize)} />
                <Field label="Added" value={formatDate(document.createdAt)} />
              </dl>
            </div>

            <footer className="space-y-3 border-t border-surface-border p-5">
              <Button
                variant="primary"
                size="md"
                className="w-full"
                loading={downloading}
                onClick={handleDownload}
              >
                <Download className="h-4 w-4" />
                Download
              </Button>

              {confirmingDelete ? (
                <div className="space-y-2 rounded-lg border border-danger-border bg-danger-subtle p-3">
                  <p className="text-sm text-text-primary">
                    Delete this document permanently? This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="danger"
                      size="md"
                      className="flex-1"
                      loading={deleting}
                      onClick={handleDelete}
                    >
                      Delete
                    </Button>
                    <Button
                      variant="secondary"
                      size="md"
                      className="flex-1"
                      disabled={deleting}
                      onClick={() => setConfirmingDelete(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="md"
                  className="w-full text-danger-text hover:bg-danger-subtle"
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete document
                </Button>
              )}
            </footer>
          </>
        )}
      </aside>
    </>
  );
}
