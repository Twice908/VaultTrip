import { headers } from "next/headers";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import type { DocumentDTO } from "@/types/document";
import { VaultClient } from "@/components/documents/vault-client";

async function fetchDocuments(): Promise<DocumentDTO[]> {
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_APP_URL}/api/documents`, {
      headers: { cookie: headers().get("cookie") ?? "" },
      cache: "no-store",
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "Vault page failed to load documents");
      return [];
    }
    const data = (await res.json()) as { documents: DocumentDTO[] };
    return data.documents;
  } catch (err) {
    logger.error({ err }, "Vault page document fetch threw");
    return [];
  }
}

export default async function VaultPage() {
  const documents = await fetchDocuments();
  return <VaultClient initialDocuments={documents} />;
}
