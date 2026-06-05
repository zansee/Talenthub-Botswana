import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ChevronRight } from "lucide-react";
import guideBanner1 from "@/assets/guide-banner-1.png";
import guideBanner2 from "@/assets/guide-banner-2.png";
import guideBanner3 from "@/assets/guide-banner-3.png";
import guideBanner4 from "@/assets/guide-banner-4.png";

const PANELS = [guideBanner1, guideBanner2, guideBanner3, guideBanner4];

const SLIDES = [
  {
    title: "Find Opportunities",
    description: "Discover jobs that match your skills and ambitions with Botswana's premier talent matching platform.",
  },
  {
    title: "Connect with Employers",
    description: "Match directly with local and regional recruiters looking specifically for talent like yours.",
  },
  {
    title: "Apply with Confidence",
    description: "Apply in minutes with Teemane, our AI-powered tool that helps your profile stand out.",
  },
  {
    title: "Get Hired Faster",
    description: "Track your application status in real-time and take the next step in your professional journey.",
  },
];

const Welcome = () => {
  const navigate = useNavigate();

  // If user completed/skipped welcome guide before, default directly to slide 3 (the actions view)
  const [currentSlide, setCurrentSlide] = useState(() => {
    const seen = localStorage.getItem("talenthub_welcome_guide_seen");
    return seen === "true" ? 3 : 0;
  });

  // Touch swipe states
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    if (currentSlide === 3) return; // Disable swipe actions on auth screen
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (currentSlide === 3) return;
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (currentSlide === 3 || !touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentSlide < 3) {
      setCurrentSlide((prev) => prev + 1);
    } else if (isRightSwipe && currentSlide > 0) {
      setCurrentSlide((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    setCurrentSlide(3);
    localStorage.setItem("talenthub_welcome_guide_seen", "true");
  };

  const handleNext = () => {
    if (currentSlide < 3) {
      setCurrentSlide((prev) => prev + 1);
    }
  };

  const handleNavigate = (path: string, state: any = {}) => {
    localStorage.setItem("talenthub_welcome_guide_seen", "true");
    navigate(path, { state });
  };

  return (
    <div
      className="flex-1 flex flex-col relative overflow-hidden bg-[#0a0c10] select-none"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Parallax Horizontal Banner ── */}
      <motion.div
        className="absolute inset-y-0 left-0 flex pointer-events-none"
        style={{ width: "400%" }}
        animate={{ x: `-${currentSlide * 25}%` }}
        transition={{ type: "spring", stiffness: 200, damping: 26 }}
      >
        {PANELS.map((panel, idx) => (
          <div key={idx} className="w-[25%] h-full relative overflow-hidden">
            <img
              src={panel}
              alt={`Welcome Guide Panel ${idx + 1}`}
              className="w-full h-full object-cover opacity-75"
            />
          </div>
        ))}
      </motion.div>

      {/* ── Vignette Overlays for visual contrast ── */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0c10]/50 via-transparent to-[#0a0c10]/95 pointer-events-none z-[1]" />

      {/* ── Header Area ── */}
      <div className="absolute top-6 left-6 z-10 flex items-center gap-2">
        <Logo size={42} />
      </div>

      {currentSlide < 3 && (
        <button
          onClick={handleSkip}
          className="absolute top-7 right-6 z-10 text-[10px] uppercase tracking-wider font-bold text-white/50 hover:text-white bg-white/5 border border-white/10 px-3.5 py-2 rounded-full backdrop-blur-md active:scale-95 transition-all cursor-pointer"
        >
          Skip
        </button>
      )}

      {/* ── Content Card Overlay ── */}
      <div className="mt-auto p-6 z-10 w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="bg-[#0e1218]/90 border border-white/5 rounded-3xl p-6 shadow-2xl backdrop-blur-xl flex flex-col"
          >
            {/* Title and Description */}
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              {SLIDES[currentSlide].title}
            </h2>
            <p className="text-white/60 text-xs mt-2.5 leading-relaxed min-h-[36px]">
              {SLIDES[currentSlide].description}
            </p>

            {/* Slider Navigation or Actions */}
            {currentSlide < 3 ? (
              <div className="flex items-center justify-between mt-6 pt-2">
                {/* Dots indicator */}
                <div className="flex gap-1.5">
                  {SLIDES.map((_, i) => (
                    <motion.div
                      key={i}
                      className="h-1.5 rounded-full bg-primary"
                      animate={{
                        width: currentSlide === i ? 18 : 6,
                        opacity: currentSlide === i ? 0.9 : 0.25,
                      }}
                      transition={{ duration: 0.25 }}
                    />
                  ))}
                </div>

                {/* Next CTA */}
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1 text-xs font-bold text-forest-foreground bg-primary hover:bg-primary/95 px-4 py-2.5 rounded-xl cursor-pointer shadow-lg active:scale-95 transition-all"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              /* Signup/Signin Stack */
              <div className="space-y-3 mt-6 pt-2">
                <Button
                  onClick={() => handleNavigate("/auth", { accountType: "premium" })}
                  className="w-full h-11 bg-forest hover:bg-forest/90 text-forest-foreground rounded-xl text-sm font-semibold cursor-pointer active:scale-[0.98] transition-transform"
                >
                  Create Account
                </Button>
                <button
                  onClick={() => handleNavigate("/auth", { mode: "signin" })}
                  className="w-full h-11 rounded-xl text-sm font-semibold border border-white/10 text-white hover:bg-white/5 cursor-pointer active:scale-[0.98] transition-transform flex items-center justify-center"
                >
                  I already have an account
                </button>
                <div className="flex items-center gap-3 py-0.5">
                  <div className="flex-1 h-px bg-white/5" />
                  <span className="text-[10px] text-white/35">or</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>
                <button
                  onClick={() => handleNavigate("/auth", { accountType: "quick_jobs" })}
                  className="w-full h-11 rounded-xl text-sm font-semibold cursor-pointer active:scale-[0.98] transition-transform"
                  style={{ backgroundColor: "#e8e4da", color: "#1a1a1a" }}
                >
                  Post a Quick Job →
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Welcome;
