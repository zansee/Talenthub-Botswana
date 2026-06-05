import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

/**
 * Shimmer skeleton placeholder — replaces spinners while data loads.
 * Compose multiple to match the real content layout.
 *
 * @example
 * <Skeleton className="h-12 w-full rounded-xl" />
 * <Skeleton className="h-4 w-2/3 rounded-full mt-2" />
 */
export const Skeleton = ({ className }: SkeletonProps) => (
  <div className={cn("th-skeleton", className)} />
);

/** A pre-built skeleton for a job/application card row */
export const SkeletonCard = () => (
  <div className="bg-card rounded-2xl p-4 space-y-3 border border-border">
    <div className="flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-3/4 rounded-full" />
        <Skeleton className="h-3 w-1/2 rounded-full" />
      </div>
      <Skeleton className="w-16 h-6 rounded-full" />
    </div>
    <Skeleton className="h-3 w-full rounded-full" />
    <Skeleton className="h-3 w-5/6 rounded-full" />
  </div>
);

/** A pre-built skeleton for a notification row */
export const SkeletonNotification = () => (
  <div className="flex items-start gap-3 p-4 border-b border-border">
    <Skeleton className="w-9 h-9 rounded-full shrink-0 mt-0.5" />
    <div className="flex-1 space-y-1.5">
      <Skeleton className="h-3.5 w-3/4 rounded-full" />
      <Skeleton className="h-3 w-1/2 rounded-full" />
    </div>
  </div>
);

/** A pre-built skeleton for a stat card (dashboard) */
export const SkeletonStatCard = () => (
  <div className="bg-card rounded-2xl p-4 border border-border space-y-2">
    <Skeleton className="h-3 w-1/2 rounded-full" />
    <Skeleton className="h-7 w-2/3 rounded-lg" />
  </div>
);
