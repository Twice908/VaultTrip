import {
  BookMarked,
  Stamp,
  ShieldCheck,
  Plane,
  Hotel,
  Syringe,
  ScrollText,
  IdCard,
  FileText,
  type LucideIcon,
} from "lucide-react";
import type { DocumentType } from "@prisma/client";
import { cn } from "@/lib/utils";

const ICON_BY_TYPE: Record<DocumentType, LucideIcon> = {
  PASSPORT: BookMarked,
  VISA: Stamp,
  TRAVEL_INSURANCE: ShieldCheck,
  FLIGHT_BOOKING: Plane,
  HOTEL_BOOKING: Hotel,
  VACCINATION_RECORD: Syringe,
  TRAVEL_PERMIT: ScrollText,
  IDENTITY_CARD: IdCard,
  OTHER: FileText,
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  PASSPORT: "Passport",
  VISA: "Visa",
  TRAVEL_INSURANCE: "Travel insurance",
  FLIGHT_BOOKING: "Flight booking",
  HOTEL_BOOKING: "Hotel booking",
  VACCINATION_RECORD: "Vaccination record",
  TRAVEL_PERMIT: "Travel permit",
  IDENTITY_CARD: "Identity card",
  OTHER: "Other",
};

interface DocumentTypeIconProps {
  type: DocumentType;
  className?: string;
}

export function DocumentTypeIcon({ type, className }: DocumentTypeIconProps) {
  const Icon = ICON_BY_TYPE[type];
  return <Icon className={cn("h-5 w-5", className)} aria-hidden />;
}
