"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-config";

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-surface-border bg-surface-elevated"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] w-full transition-colors",
                  isActive ? "text-accent" : "text-text-muted hover:text-text-secondary"
                )}
              >
                <Icon
                  className={cn(
                    "h-6 w-6 shrink-0",
                    isActive && "drop-shadow-[0_0_6px_rgba(59,127,235,0.6)]"
                  )}
                />
                <span
                  className={cn(
                    "text-2xs font-medium leading-none",
                    isActive ? "text-accent" : "text-text-muted"
                  )}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
