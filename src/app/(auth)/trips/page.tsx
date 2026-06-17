import { headers } from "next/headers";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import type { TripDTO } from "@/types/trip";
import { TripsClient } from "@/components/trips/trips-client";

async function fetchTrips(): Promise<TripDTO[]> {
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_APP_URL}/api/trips`, {
      headers: { cookie: headers().get("cookie") ?? "" },
      cache: "no-store",
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "Trips page failed to load trips");
      return [];
    }
    const data = (await res.json()) as { trips: TripDTO[] };
    return data.trips;
  } catch (err) {
    logger.error({ err }, "Trips page trip fetch threw");
    return [];
  }
}

export default async function TripsPage() {
  const trips = await fetchTrips();
  return <TripsClient initialTrips={trips} />;
}
