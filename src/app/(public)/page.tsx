import Link from "next/link";
import { ShieldCheck, Plane, Bell, Wifi } from "lucide-react";

const features = [
  {
    icon: ShieldCheck,
    title: "Encrypted document vault",
    description:
      "Passports, visas, insurance, and bookings — encrypted at rest, accessible in seconds.",
  },
  {
    icon: Plane,
    title: "Per-trip organisation",
    description:
      "Create a trip workspace and attach every document it needs. No more hunting through folders at the gate.",
  },
  {
    icon: Bell,
    title: "Expiry alerts",
    description:
      "Get notified 12 months before your passport expires, 30 days before a visa lapses, and 7 days before insurance ends.",
  },
  {
    icon: Wifi,
    title: "Works offline",
    description:
      "Pre-cached documents are readable at airports and borders with no signal. Built as a PWA for your home screen.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-base">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-surface-border max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-bold tracking-tight text-text-primary">VaultTrip</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors min-h-[44px] flex items-center px-2"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover min-h-[44px]"
          >
            Get started free
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-5xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-accent-muted bg-accent-subtle px-4 py-1.5 text-sm text-accent mb-8">
          <Wifi className="h-3.5 w-3.5" />
          Offline-ready at airports and borders
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold text-text-primary leading-tight text-balance mb-6">
          Every travel document,<br />
          <span className="text-accent">always ready.</span>
        </h1>

        <p className="text-lg text-text-secondary max-w-xl mx-auto mb-10 text-balance">
          VaultTrip organises your passports, visas, insurance, and bookings per
          trip — and keeps them encrypted, offline-ready, and one tap away when
          it counts.
        </p>

        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center rounded-lg bg-accent px-6 py-3 text-base font-medium text-white transition-colors hover:bg-accent-hover active:bg-accent-active min-h-[44px]"
          >
            Create your vault — it&apos;s free
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex items-center justify-center rounded-lg px-6 py-3 text-base font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary min-h-[44px]"
          >
            Sign in
          </Link>
        </div>

        {/* Feature cards */}
        <div className="mt-24 grid gap-4 sm:grid-cols-2 text-left">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-xl border border-surface-border bg-surface-elevated p-6"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-subtle border border-accent-muted">
                <Icon className="h-5 w-5 text-accent" />
              </div>
              <h3 className="mb-1 text-base font-semibold text-text-primary">{title}</h3>
              <p className="text-sm text-text-secondary">{description}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-border py-8 text-center">
        <p className="text-sm text-text-muted">
          © 2025 VaultTrip. Your documents never leave your vault.
        </p>
      </footer>
    </div>
  );
}
