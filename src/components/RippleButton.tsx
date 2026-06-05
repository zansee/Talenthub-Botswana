import { motion } from "framer-motion";
import { ReactNode, useRef } from "react";
import { SPRING_SNAPPY } from "@/lib/animations";

interface RippleButtonProps {
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  id?: string;
}

/**
 * A premium button with:
 * - Ripple effect from exact tap/click point
 * - Spring scale compression on press
 */
export const RippleButton = ({
  onClick,
  children,
  className = "",
  disabled = false,
  type = "button",
  id,
}: RippleButtonProps) => {
  const containerRef = useRef<HTMLButtonElement>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const btn = containerRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const size = Math.max(rect.width, rect.height) * 2;

    const ripple = document.createElement("span");
    ripple.className = "th-ripple";
    ripple.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${x - size / 2}px;
      top: ${y - size / 2}px;
    `;
    btn.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
  };

  return (
    <motion.button
      ref={containerRef}
      id={id}
      type={type}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={handlePointerDown}
      whileTap={disabled ? {} : { scale: 0.96 }}
      transition={SPRING_SNAPPY}
      className={`relative overflow-hidden ${className}`}
    >
      {children}
    </motion.button>
  );
};
