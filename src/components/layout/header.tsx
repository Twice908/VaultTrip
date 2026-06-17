"use client";

import { UserButton } from "@clerk/nextjs";
import { ShieldCheck } from "lucide-react";

export function Header() {
  return (
    <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-surface-border bg-surface-elevated px-4 pt-safe"
      style={{ paddingTop: `calc(env(safe-area-inset-top) + 0.75rem)`, paddingBottom: "0.75rem" }}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
          <ShieldCheck className="h-4.5 w-4.5 text-white" />
        </div>
        <span className="text-base font-bold tracking-tight text-text-primary">
          VaultTrip
        </span>
      </div>
      <UserButton
        appearance={{
          elements: {
            avatarBox: "h-9 w-9",
          },
        }}
      />
    </header>
  );
}
