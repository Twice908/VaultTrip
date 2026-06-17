import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import type { TripDetailDTO } from "@/types/trip";
import { TripDetailClient } from "@/components/trips/trip-detail-client";

interface TripPageProps {
  params: { id: string };
}

async function fetchTrip(id: string): Promise<TripDetailDTO | null> {
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_APP_URL}/api/trips/${id}`, {
      headers: { cookie: headers().get("cookie") ?? "" },
      cache: "no-store",
    });
    if (res.status === 404 || res.status === 403) return null;
    if (!res.ok) {
      logger.warn({ status: res.status, tripId: id }, "Trip detail page fetch failed");
      return null;
    }
    const data = (await res.json()) as { trip: TripDetailDTO };
    return data.trip;
  } catch (err) {
    logger.error({ err, tripId: id }, "Trip detail page fetch threw");
    return null;
  }
}

export default async function TripPage({ params }: TripPageProps) {
  const trip = await fetchTrip(params.id);
  if (!trip) notFound();
  return <TripDetailClient trip={trip} />;
}
