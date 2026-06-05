import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";

const TAGLINE = "Your Career, Elevated.";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.6,
    },
  },
};

const charVariants = {
  hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

const Splash = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const navigated = useRef(false);

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      if (!navigated.current) {
        navigated.current = true;
        navigate(user ? "/swipe" : "/welcome");
      }
    }, 3500);
    return () => clearTimeout(t);
  }, [navigate, user, loading]);

  const characters = Array.from(TAGLINE);

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-tr from-[#06080b] via-[#090c10] to-[#0d1217] relative overflow-hidden">
      
      {/* ── Spotlight Beam 1 (Top Left, Green-tinged) ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: -100, y: -100 }}
        animate={{ opacity: [0, 0.26, 0.20], scale: [0.8, 1.1, 1], x: 0, y: 0 }}
        transition={{ duration: 2.2, ease: "easeOut" }}
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: "radial-gradient(circle 500px at 12% 12%, rgba(130, 200, 80, 0.28) 0%, transparent 85%)",
        }}
      />

      {/* ── Spotlight Beam 2 (Bottom Right, Soft Amber-tinged) ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.08 }}
        transition={{ delay: 0.8, duration: 1.8, ease: "easeOut" }}
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: "radial-gradient(circle 400px at 88% 88%, rgba(234, 179, 8, 0.15) 0%, transparent 85%)",
        }}
      />

      {/* ── Logo ── */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 mb-8"
      >
        {/* Ambient backing glow behind the logo */}
        <div
          className="absolute inset-0 rounded-full blur-3xl opacity-25 scale-125 pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(130,200,80,0.7) 0%, transparent 70%)" }}
        />
        <Logo size={92} />
      </motion.div>

      {/* ── Tagline — letter-by-letter reveal ── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-wrap justify-center tracking-[0.24em] text-xs uppercase font-bold text-white/90 z-10 px-4"
      >
        {characters.map((char, index) => (
          <motion.span
            key={index}
            variants={charVariants}
            className={char === "," || char === "." ? "text-[rgba(130,200,80,0.9)]" : ""}
          >
            {char === " " ? "\u00A0" : char}
          </motion.span>
        ))}
      </motion.div>

      {/* ── Sub-tagline ── */}
      <motion.p
        initial={{ opacity: 0, letterSpacing: "0.25em" }}
        animate={{ opacity: 0.45, letterSpacing: "0.36em" }}
        transition={{ delay: 1.8, duration: 1.2, ease: "easeOut" }}
        className="mt-3 text-[9px] text-white/70 uppercase font-semibold tracking-[0.36em] z-10"
      >
        Connecting Talent · Botswana
      </motion.p>

      {/* ── Bottom luxury loading dots ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.2, duration: 0.6 }}
        className="absolute bottom-14 flex gap-2.5 z-10"
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ opacity: [0.25, 0.9, 0.25] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.25 }}
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "rgba(130,200,80,0.7)" }}
          />
        ))}
      </motion.div>
    </div>
  );
};

export default Splash;
