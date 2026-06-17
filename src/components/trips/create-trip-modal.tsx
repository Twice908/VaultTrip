"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, ArrowLeft, ArrowRight, Plane, Briefcase, ArrowUpDown, GraduationCap, HardHat, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CountrySelect } from "./country-select";
import { getCountryName } from "@/lib/countries";
import { formatDate } from "@/lib/utils";
import type { TripType } from "@prisma/client";
import { toast } from "@/lib/toast";

interface CreateTripModalProps {
  onClose: () => void;
}

interface FormState {
  name: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  tripType: TripType;
}

const TRIP_TYPES: { value: TripType; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: "TOURISM",
    label: "Tourism",
    description: "Holiday, sightseeing, or personal travel",
    icon: <Plane className="h-5 w-5" />,
  },
  {
    value: "BUSINESS",
    label: "Business",
    description: "Meetings, conferences, or work assignments",
    icon: <Briefcase className="h-5 w-5" />,
  },
  {
    value: "TRANSIT",
    label: "Transit",
    description: "Stopover or connecting through a country",
    icon: <ArrowUpDown className="h-5 w-5" />,
  },
  {
    value: "STUDY",
    label: "Study",
    description: "Academic programs, exchange, or courses",
    icon: <GraduationCap className="h-5 w-5" />,
  },
  {
    value: "WORK",
    label: "Work",
    description: "Employment visa, relocation, or long-stay",
    icon: <HardHat className="h-5 w-5" />,
  },
];

const INITIAL_FORM: FormState = {
  name: "",
  origin: "",
  destination: "",
  departureDate: "",
  returnDate: "",
  tripType: "TOURISM",
};

export function CreateTripModal({ onClose }: CreateTripModalProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validateStep1(): boolean {
    const newErrors: typeof errors = {};
    if (!form.name.trim()) newErrors.name = "Trip name is required";
    if (!form.origin) newErrors.origin = "Origin country is required";
    if (!form.destination) newErrors.destination = "Destination country is required";
    if (!form.departureDate) {
      newErrors.departureDate = "Departure date is required";
    } else {
      const dep = new Date(form.departureDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dep < today) newErrors.departureDate = "Departure date cannot be in the past";
    }
    if (form.returnDate && form.departureDate && new Date(form.returnDate) < new Date(form.departureDate)) {
      newErrors.returnDate = "Return date must be after departure date";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          origin: form.origin,
          destination: form.destination,
          departureDate: new Date(form.departureDate).toISOString(),
          returnDate: form.returnDate ? new Date(form.returnDate).toISOString() : null,
          tripType: form.tripType,
        }),
      });

      if (res.status === 402) {
        toast.error("You've reached the 3-trip limit on the Free plan. Upgrade to create more trips.");
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Failed to create trip");
        setSubmitting(false);
        return;
      }

      const data = (await res.json()) as { trip: { id: string } };
      toast.success("Trip created! Your document checklist is generating…");
      onClose();
      router.push(`/trips/${data.trip.id}`);
    } catch {
      toast.error("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  const selectedTripType = TRIP_TYPES.find((t) => t.value === form.tripType)!;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-lg mx-auto rounded-t-2xl sm:rounded-2xl border border-surface-border bg-surface-elevated shadow-modal max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-border px-6 py-4">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                {step === 1 && "New Trip"}
                {step === 2 && "Trip Type"}
                {step === 3 && "Confirm Trip"}
              </h2>
              <p className="text-xs text-text-muted">Step {step} of 3</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1 px-6 pt-4">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-accent" : "bg-surface-border"
              }`}
            />
          ))}
        </div>

        {/* Step 1 — Trip basics */}
        {step === 1 && (
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary" htmlFor="trip-name">
                Trip name
              </label>
              <input
                id="trip-name"
                type="text"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="e.g. Japan Summer 2026"
                className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2.5 text-sm text-text-primary placeholder:text-text-placeholder outline-none focus:border-accent min-h-[44px]"
              />
              {errors.name && <p className="mt-1 text-xs text-danger-text">{errors.name}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary" htmlFor="origin">
                Departing from
              </label>
              <CountrySelect
                id="origin"
                value={form.origin}
                onChange={(code) => setField("origin", code)}
                placeholder="Select origin country"
              />
              {errors.origin && <p className="mt-1 text-xs text-danger-text">{errors.origin}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary" htmlFor="destination">
                Destination
              </label>
              <CountrySelect
                id="destination"
                value={form.destination}
                onChange={(code) => setField("destination", code)}
                placeholder="Select destination country"
              />
              {errors.destination && <p className="mt-1 text-xs text-danger-text">{errors.destination}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary" htmlFor="departure-date">
                  Departure
                </label>
                <input
                  id="departure-date"
                  type="date"
                  value={form.departureDate}
                  onChange={(e) => setField("departureDate", e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent min-h-[44px]"
                />
                {errors.departureDate && <p className="mt-1 text-xs text-danger-text">{errors.departureDate}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary" htmlFor="return-date">
                  Return <span className="text-text-muted">(optional)</span>
                </label>
                <input
                  id="return-date"
                  type="date"
                  value={form.returnDate}
                  onChange={(e) => setField("returnDate", e.target.value)}
                  min={form.departureDate || new Date().toISOString().slice(0, 10)}
                  className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent min-h-[44px]"
                />
                {errors.returnDate && <p className="mt-1 text-xs text-danger-text">{errors.returnDate}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Trip type */}
        {step === 2 && (
          <div className="px-6 py-5 space-y-2">
            {TRIP_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setField("tripType", type.value)}
                className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors min-h-[44px] ${
                  form.tripType === type.value
                    ? "border-accent bg-accent-subtle"
                    : "border-surface-border bg-surface-overlay hover:bg-surface-hover"
                }`}
              >
                <span className={form.tripType === type.value ? "text-accent" : "text-text-muted"}>
                  {type.icon}
                </span>
                <div>
                  <p className={`text-sm font-medium ${form.tripType === type.value ? "text-accent" : "text-text-primary"}`}>
                    {type.label}
                  </p>
                  <p className="text-xs text-text-secondary">{type.description}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 3 — Confirm */}
        {step === 3 && (
          <div className="px-6 py-5 space-y-4">
            <div className="rounded-xl border border-surface-border bg-surface-overlay p-4 space-y-3">
              <Row label="Trip name" value={form.name} />
              <Row label="From" value={getCountryName(form.origin)} />
              <Row label="To" value={getCountryName(form.destination)} />
              <Row label="Departure" value={formatDate(form.departureDate)} />
              {form.returnDate && <Row label="Return" value={formatDate(form.returnDate)} />}
              <Row label="Trip type" value={selectedTripType.label} />
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-accent-muted bg-accent-subtle p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
              <p className="text-sm text-text-secondary">
                After creation, Claude will generate a personalised document checklist for your destination and trip type. It usually takes under 10 seconds.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-surface-border px-6 py-4">
          <span className="text-xs text-text-muted">
            {step === 1 && "Tell us about your trip"}
            {step === 2 && "Choose the purpose of travel"}
            {step === 3 && "Ready to create your trip workspace"}
          </span>
          {step < 3 ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                if (step === 1 && !validateStep1()) return;
                setStep((s) => s + 1);
              }}
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              onClick={handleSubmit}
              loading={submitting}
              disabled={submitting}
            >
              {submitting ? "Creating…" : "Create trip"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-medium text-text-primary text-right">{value}</span>
    </div>
  );
}
