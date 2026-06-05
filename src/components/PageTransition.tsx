import { motion } from "framer-motion";
import { ReactNode } from "react";
import { pageVariants } from "@/lib/animations";

interface PageTransitionProps {
  children: ReactNode;
  /** 1 = forward (slide from right), -1 = back (slide from left) */
  direction?: number;
  className?: string;
}

/**
 * Wraps a screen's content with a smooth slide-in / slide-out page transition.
 * Use inside AnimatePresence in App.tsx.
 *
 * @example
 * <PageTransition direction={direction}>
 *   <YourScreen />
 * </PageTransition>
 */
export const PageTransition = ({
  children,
  direction = 1,
  className = "flex-1 flex flex-col overflow-hidden",
}: PageTransitionProps) => (
  <motion.div
    className={className}
    custom={direction}
    variants={pageVariants}
    initial="initial"
    animate="animate"
    exit="exit"
  >
    {children}
  </motion.div>
);
