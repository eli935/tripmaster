import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Gold-tinted skeleton shimmer for loading states.
 * Replaces generic Loader2 spinners per v8.7 vision §5.3.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-[var(--gold-500)]/5 border border-[var(--gold-500)]/10",
        className
      )}
      {...props}
    >
      <div
        className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite]"
        style={{
          backgroundImage:
            "linear-gradient(90deg, transparent 0%, rgba(212,169,96,0.12) 50%, transparent 100%)",
          backgroundSize: "200% 100%",
        }}
      />
    </div>
  );
}

/**
 * Inline gold dot-spinner for buttons (tiny, 3 pulsing dots).
 */
function GoldSpinner({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1", className)}
      aria-label="טוען"
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-[var(--gold-500)] animate-pulse"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="h-1.5 w-1.5 rounded-full bg-[var(--gold-500)] animate-pulse"
        style={{ animationDelay: "200ms" }}
      />
      <span
        className="h-1.5 w-1.5 rounded-full bg-[var(--gold-500)] animate-pulse"
        style={{ animationDelay: "400ms" }}
      />
    </span>
  );
}

export { Skeleton, GoldSpinner };
