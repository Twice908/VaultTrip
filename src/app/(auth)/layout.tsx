import type { ReactNode } from "react";
import { UserButton } from "@clerk/nextjs";
import { Sidebar } from "@/components/layout/sidebar";
import { TabBar } from "@/components/layout/tab-bar";
import { Header } from "@/components/layout/header";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-surface-base">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Right-hand content column */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile top header */}
        <Header />

        {/* Desktop top bar — UserButton only, hidden on mobile */}
        <div className="hidden lg:flex items-center justify-end px-8 py-4 border-b border-surface-border">
          <UserButton
            appearance={{
              elements: { avatarBox: "h-9 w-9" },
            }}
          />
        </div>

        {/* Page content — padded away from tab bar on mobile */}
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8 pb-[calc(env(safe-area-inset-bottom)+72px)] lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <TabBar />
    </div>
  );
}
