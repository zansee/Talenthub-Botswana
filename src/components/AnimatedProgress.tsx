import { motion } from "framer-motion";

interface AnimatedProgressProps {
  /** Value from 0 to 100 */
  value: number;
  className?: string;
  barClassName?: string;
  /** Delay before the bar starts filling (ms → converted to seconds) */
  delay?: number;
}

/**
 * A progress bar that fills from 0% to `value` with spring physics on mount.
 * Replaces plain static progress divs.
 */
export const AnimatedProgress = ({
  value,
  className = "",
  barClassName = "",
  delay = 0,
}: AnimatedProgressProps) => {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={`w-full overflow-hidden rounded-full bg-white/10 ${className}`}>
      <motion.div
        className={`h-full rounded-full bg-primary ${barClassName}`}
        initial={{ width: "0%" }}
        animate={{ width: `${clamped}%` }}
        transition={{
          type: "spring",
          stiffness: 60,
          damping: 12,
          delay: delay / 1000,
        }}
      />
    </div>
  );
};
