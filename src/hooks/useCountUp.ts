import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from 0 to `target` over `duration` ms after `delay` ms.
 * Uses requestAnimationFrame with an ease-out curve.
 *
 * @example
 * const score = useCountUp(84); // returns 0 → 84 over 800ms
 */
export const useCountUp = (
  target: number,
  duration = 800,
  delay = 0
): number => {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) { setCurrent(0); return; }

    const timeout = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (startRef.current === null) startRef.current = timestamp;
        const elapsed = timestamp - startRef.current;
        const progress = Math.min(elapsed / duration, 1);
        // Ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setCurrent(Math.round(eased * target));
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate);
        }
      };
      rafRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      startRef.current = null;
    };
  }, [target, duration, delay]);

  return current;
};
