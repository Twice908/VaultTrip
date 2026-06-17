"use client";

import { useState } from "react";
import { Plus, Plane } from "lucide-react";
import type { TripDTO } from "@/types/trip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TripCard } from "./trip-card";
import { CreateTripModal } from "./create-trip-modal";

interface TripsClientProps {
  initialTrips: TripDTO[];
}

export function TripsClient({ initialTrips }: TripsClientProps) {
  const [trips] = useState<TripDTO[]>(initialTrips);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Trips</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Each trip workspace holds all the documents you need for that journey.
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          New trip
        </Button>
      </div>

      {trips.length === 0 ? (
        <EmptyState
          icon={<Plane className="h-7 w-7" />}
          title="No trips yet"
          description="Create your first trip to get a destination-specific document checklist and keep everything organised in one place."
          action={
            <Button variant="primary" size="md" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              Create first trip
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}

      {showCreate && <CreateTripModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
