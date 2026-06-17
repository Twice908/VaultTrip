"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AuthError({ error, reset }: ErrorProps) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-danger-subtle border border-danger-border">
        <AlertCircle className="h-7 w-7 text-danger-text" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-text-primary">Something went wrong</h2>
        <p className="text-sm text-text-secondary max-w-sm">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
      </div>
      <Button variant="secondary" size="md" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
