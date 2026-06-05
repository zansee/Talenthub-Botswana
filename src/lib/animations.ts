import { Variants } from "framer-motion";

// ─── Easing curves ────────────────────────────────────────────────────────────
export const SPRING_GENTLE = { type: "spring", stiffness: 280, damping: 24 } as const;
export const SPRING_SNAPPY = { type: "spring", stiffness: 400, damping: 28 } as const;
export const SPRING_BOUNCY = { type: "spring", stiffness: 320, damping: 18 } as const;
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

// ─── Page slide transitions ───────────────────────────────────────────────────
export const pageVariants: Variants = {
  initial: (dir: number = 1) => ({
    x: dir > 0 ? "100%" : "-100%",
    opacity: 0,
  }),
  animate: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.28, ease: EASE_OUT },
  },
  exit: (dir: number = 1) => ({
    x: dir > 0 ? "-60%" : "60%",
    opacity: 0,
    transition: { duration: 0.22, ease: [0.4, 0, 1, 1] },
  }),
};

// ─── Step slide (for onboarding — horizontal only, directional) ───────────────
export const stepVariants: Variants = {
  initial: (dir: number = 1) => ({
    x: dir > 0 ? 60 : -60,
    opacity: 0,
  }),
  animate: {
    x: 0,
    opacity: 1,
    transition: SPRING_GENTLE,
  },
  exit: (dir: number = 1) => ({
    x: dir > 0 ? -40 : 40,
    opacity: 0,
    transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
  }),
};

// ─── Stagger list container ───────────────────────────────────────────────────
export const listContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      // Wait for page transition to land before staggering
      delayChildren: 0.25,
      staggerChildren: 0.06,
    },
  },
};

// ─── Stagger list item ────────────────────────────────────────────────────────
export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: SPRING_GENTLE,
  },
};

// ─── Card cascade (same as list but 80ms stagger) ────────────────────────────
export const cardCascadeContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.3,
      staggerChildren: 0.08,
    },
  },
};

export const cardCascadeItemVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: SPRING_GENTLE,
  },
};

// ─── Modal spring entrance ────────────────────────────────────────────────────
export const modalOverlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.18 } },
};

export const modalContentVariants: Variants = {
  hidden: { opacity: 0, scale: 0.93, y: 12 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: SPRING_GENTLE,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 8,
    transition: { duration: 0.16, ease: [0.4, 0, 1, 1] },
  },
};

// ─── Skill tag pop ────────────────────────────────────────────────────────────
export const skillTagVariants: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: SPRING_BOUNCY,
  },
  exit: {
    scale: 0,
    opacity: 0,
    transition: { duration: 0.15 },
  },
};

// ─── Spring tap props (spread onto motion elements) ───────────────────────────
export const springTap = {
  whileTap: { scale: 0.96 },
  transition: SPRING_SNAPPY,
} as const;

// ─── Fade in up (generic utility) ────────────────────────────────────────────
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: SPRING_GENTLE,
  },
};
