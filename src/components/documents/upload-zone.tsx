"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, FileText, AlertTriangle, RefreshCw, X } from "lucide-react";
import {
  validateUpload,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
} from "@/lib/documents";
import type { DocumentDTO } from "@/types/document";
import { cn, formatFileSize } from "@/lib/utils";
import { toast } from "@/lib/toast";

type ItemStatus = "uploading" | "error";

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: ItemStatus;
  error?: string;
  /** Set once the presigned URL has been issued so a retry can reuse it. */
  uploadUrl?: string;
  documentId?: string;
}

interface UploadZoneProps {
  onUploaded: (document: DocumentDTO) => void;
  onLimitReached: () => void;
  tripId?: string;
}

function putToS3(
  url: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

export function UploadZone({ onUploaded, onLimitReached, tripId }: UploadZoneProps) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const update = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const runUpload = useCallback(
    async (item: UploadItem) => {
      try {
        let uploadUrl = item.uploadUrl;
        let documentId = item.documentId;

        // Step 1 — request a presigned URL (skip if retrying a failed PUT).
        if (!uploadUrl || !documentId) {
          const res = await fetch("/api/documents/upload-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: item.file.name,
              mimeType: item.file.type,
              fileSize: item.file.size,
              ...(tripId ? { tripId } : {}),
            }),
          });

          if (res.status === 402) {
            removeItem(item.id);
            onLimitReached();
            return;
          }

          if (!res.ok) {
            const body = (await res.json().catch(() => null)) as { error?: string } | null;
            throw new Error(body?.error ?? "Could not start upload");
          }

          const data = (await res.json()) as { documentId: string; uploadUrl: string };
          uploadUrl = data.uploadUrl;
          documentId = data.documentId;
          update(item.id, { uploadUrl, documentId, progress: 0, status: "uploading" });
        }

        // Step 2 — PUT the file bytes directly to S3.
        await putToS3(uploadUrl, item.file, (pct) => update(item.id, { progress: pct }));

        const dto: DocumentDTO = {
          id: documentId,
          tripId: tripId ?? null,
          type: "OTHER",
          name: item.file.name,
          fileSize: item.file.size,
          mimeType: item.file.type,
          expiryDate: null,
          issueDate: null,
          docNumber: null,
          issuedBy: null,
          aiProcessed: false,
          createdAt: new Date().toISOString(),
        };

        onUploaded(dto);
        removeItem(item.id);
        toast.success(`${item.file.name} uploaded`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        update(item.id, { status: "error", error: message });
      }
    },
    [onLimitReached, onUploaded, removeItem, tripId, update]
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        const validation = validateUpload({ mimeType: file.type, fileSize: file.size });
        const id = crypto.randomUUID();

        if (!validation.ok) {
          setItems((prev) => [
            ...prev,
            { id, file, progress: 0, status: "error", error: validation.error },
          ]);
          continue;
        }

        const item: UploadItem = { id, file, progress: 0, status: "uploading" };
        setItems((prev) => [...prev, item]);
        void runUpload(item);
      }
    },
    [runUpload]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const retry = useCallback(
    (item: UploadItem) => {
      // A validation failure has no presigned URL — it can't be retried, only dismissed.
      if (!item.uploadUrl && !validateUpload({ mimeType: item.file.type, fileSize: item.file.size }).ok) {
        return;
      }
      update(item.id, { status: "uploading", error: undefined });
      void runUpload({ ...item, status: "uploading", error: undefined });
    },
    [runUpload, update]
  );

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
          isDragging
            ? "border-accent bg-accent-subtle"
            : "border-surface-border bg-surface-elevated hover:border-accent-muted"
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-overlay text-text-secondary">
          <UploadCloud className="h-6 w-6" aria-hidden />
        </div>
        <p className="text-sm font-medium text-text-primary">
          Drag &amp; drop a document, or click to browse
        </p>
        <p className="text-xs text-text-muted">
          PDF, JPG, PNG, or WebP · up to {formatFileSize(MAX_FILE_SIZE)}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_MIME_TYPES.join(",")}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-surface-border bg-surface-elevated p-3"
            >
              <div className="text-text-secondary">
                {item.status === "error" ? (
                  <AlertTriangle className="h-5 w-5 text-danger-text" aria-hidden />
                ) : (
                  <FileText className="h-5 w-5" aria-hidden />
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {item.file.name}
                  </p>
                  <span className="shrink-0 text-xs text-text-muted">
                    {formatFileSize(item.file.size)}
                  </span>
                </div>

                {item.status === "uploading" && (
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-overlay">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}

                {item.status === "error" && (
                  <p className="text-xs text-danger-text">{item.error}</p>
                )}
              </div>

              {item.status === "error" && (
                <div className="flex shrink-0 items-center gap-1">
                  {(item.uploadUrl ||
                    validateUpload({
                      mimeType: item.file.type,
                      fileSize: item.file.size,
                    }).ok) && (
                    <button
                      type="button"
                      onClick={() => retry(item)}
                      aria-label="Retry upload"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    aria-label="Dismiss"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
