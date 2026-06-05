import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import mascot from "@/assets/mascot-transparent.png";
import { Button } from "@/components/ui/button";
import { AtsBreakdown } from "@/lib/atsScore";
import { toast } from "sonner";
import { useCountUp } from "@/hooks/useCountUp";
import { AnimatedProgress } from "@/components/AnimatedProgress";

const PASS = 80;

const CVScore = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [busy, setBusy] = useState(true);
  const [result, setResult] = useState<AtsBreakdown | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user) return;
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("cv_path,cv_filename,cv_extracted_skills,cv_summary,skills,current_job_title,cv_extracted_qualification,highest_education")
          .eq("id", user.id).maybeSingle();

        if (!active) return;
        if (!profile?.cv_path) {
          toast.error("No CV found — upload one first");
          navigate("/upload-cv");
          return;
        }

        // 1. Check for existing analysis to prevent multiple LLM calls
        const { data: existing } = await supabase
          .from("cv_analyses")
          .select("*")
          .eq("user_id", user.id)
          .eq("cv_filename", profile.cv_filename ?? "")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!active) return;

        if (existing) {
          setResult({
            score: existing.score ?? 0,
            keyword_score: existing.keyword_score ?? 0,
            structure_score: existing.structure_score ?? 0,
            readability_score: existing.readability_score ?? 0,
            formatting_score: existing.formatting_score ?? 0,
            feedback: existing.feedback ? existing.feedback.split("\n") : [],
          });
          setBusy(false);
          return;
        }

        // 2. If no existing analysis, run the parse & score functions
        let cvText = profile.cv_summary ?? "";

        if (cvText.length < 50) {
          toast.info("Reading your CV, please wait a moment…");
          // Wait up to 25s for parse-cv; otherwise proceed with whatever we have
          await Promise.race([
            supabase.functions.invoke("parse-cv"),
            new Promise((resolve) => setTimeout(resolve, 25000)),
          ]);
          if (!active) return;
          const { data: updated } = await supabase
            .from("profiles")
            .select("cv_extracted_skills,cv_summary,skills,current_job_title")
            .eq("id", user.id).maybeSingle();
          cvText = updated?.cv_summary ?? "";
          if (cvText.length < 50) {
            toast.warning("We couldn't fully read your CV. Score is approximate — try uploading a PDF with selectable text.");
            cvText = [
              ...(updated?.skills ?? []),
              ...(updated?.cv_extracted_skills ?? []),
              updated?.current_job_title ?? "",
            ].filter(Boolean).join(" ") || "cv";
          }
        }

        if (!active) return;

        const targetKeywords = [
          ...(profile.skills ?? []),
          ...(profile.cv_extracted_skills ?? []),
          profile.current_job_title ?? "",
          profile.highest_education ?? "",
          profile.cv_extracted_qualification ?? "",
        ].filter(Boolean);

        const { data: scored, error: scoreErr } = await supabase.functions.invoke("score-cv", {
          body: { cvText, target_keywords: targetKeywords },
        });
        
        if (!active) return;

        if (scoreErr || !scored || scored.error) {
          throw new Error(scored?.error ?? scoreErr?.message ?? "Failed to score CV");
        }
        const r = scored as AtsBreakdown;
        setResult(r);

        await supabase.from("cv_analyses").insert({
          user_id: user.id,
          score: r.score,
          keyword_score: r.keyword_score,
          structure_score: r.structure_score,
          readability_score: r.readability_score,
          formatting_score: r.formatting_score,
          feedback: r.feedback.join("\n"),
          cv_filename: profile.cv_filename ?? null,
        });
      } catch (e: any) {
        if (active) {
          toast.error(e?.message ?? "Could not analyze CV");
        }
      } finally {
        if (active) {
          setBusy(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [user, navigate]);

  if (busy || !result) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#0a0c10] text-[#e5e7eb] select-none">
        <div className="relative w-28 h-28 flex items-center justify-center p-2 animate-pulse-glow">
          <img
            src={mascot}
            alt="AI Assistant"
            className="w-full h-full object-contain animate-bob drop-shadow-[0_0_16px_rgba(130,200,80,0.5)]"
          />
          {/* Laser Scanner Sweep Bar */}
          <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#82c850] to-transparent shadow-[0_0_8px_#82c850] animate-laser" />
        </div>
        <p className="mt-6 text-sm font-semibold tracking-wide text-white">Analyzing your CV...</p>
        <p className="mt-1 text-xs text-muted-foreground">Teemane is parsing structure and matching keywords</p>
      </div>
    );
  }

  const passed = result.score >= PASS;
  const ringColor = passed ? "text-success" : result.score >= 60 ? "text-warning" : "text-destructive";

  return (
    <ScoreContent
      result={result}
      passed={passed}
      ringColor={ringColor}
      navigate={navigate}
      user={user}
    />
  );
};

// Separate inner component so hooks (useCountUp) run only after result is available
const ScoreContent = ({
  result,
  passed,
  ringColor,
  navigate,
  user,
}: {
  result: AtsBreakdown;
  passed: boolean;
  ringColor: string;
  navigate: ReturnType<typeof useNavigate>;
  user: any;
}) => {
  const animatedScore = useCountUp(result.score, 1000, 200);

  return (
    <div className="flex-1 flex flex-col bg-background overflow-y-auto">
      <div className="p-5 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-bold">Your ATS Score</h1>
      </div>

      <div className="px-6 py-2 flex flex-col items-center text-center">
        {/* Mascot reaction card */}
        <div className="flex items-center gap-4 bg-card border border-border rounded-2xl p-4 w-full max-w-sm mb-6 select-none shadow-soft animate-fade-in">
          <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
            <img
              src={mascot}
              alt="AI Assistant"
              className="w-14 h-14 object-contain animate-bob drop-shadow-[0_0_10px_rgba(130,200,80,0.4)]"
            />
          </div>
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">AI Assistant Feedback</p>
            <p className="text-xs text-foreground/85 leading-relaxed mt-0.5 font-medium">
              {passed 
                ? "Incredible job! Your CV matches standard ATS structures and keywords. You are ready to swipe!" 
                : "Your CV matches some requirements, but let's revamp it to ensure it passes automated hiring screens in Botswana."
              }
            </p>
          </div>
        </div>

        <div className="relative w-40 h-40">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="44" fill="none" strokeWidth="8" strokeLinecap="round"
              className={ringColor}
              stroke="currentColor"
              strokeDasharray={`${(result.score / 100) * 276.46} 276.46`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold">{animatedScore}%</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">ATS Score</span>
          </div>
        </div>
        <p className={`mt-4 text-sm font-semibold flex items-center gap-2 ${passed ? "text-success" : "text-warning"}`}>
          {passed ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {passed ? "Your CV is ATS-ready" : "Your CV may not pass ATS systems"}
        </p>
      </div>

      <div className="px-5 mt-4 space-y-3">
        <Bar label="Keyword match" value={result.keyword_score} />
        <Bar label="Structure" value={result.structure_score} />
        <Bar label="Readability" value={result.readability_score} />
        <Bar label="Formatting" value={result.formatting_score} />
      </div>

      <div className="px-5 mt-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Feedback</p>
        <ul className="bg-card rounded-2xl p-4 border border-border space-y-2 text-sm">
          {result.feedback.map((f, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span className="text-foreground/85">{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="p-5 mt-auto space-y-2">
        {(() => {
          const proceed = async (path: string) => {
            if (user) await supabase.from("profiles").update({ onboarding_complete: true }).eq("id", user.id);
            navigate(path);
          };
          return passed ? (
            <Button onClick={() => proceed("/processing")} className="w-full h-12 bg-forest hover:bg-forest/90 rounded-xl font-semibold">
              Continue to jobs <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <>
              <Button onClick={() => navigate("/cv-revamp")} className="w-full h-12 bg-primary hover:bg-primary/90 rounded-xl font-semibold">
                Revamp My CV (recommended)
              </Button>
              <Button variant="outline" onClick={() => proceed("/processing")} className="w-full h-12 rounded-xl">
                Continue anyway
              </Button>
            </>
          );
        })()}
      </div>
    </div>
  );
};

const Bar = ({ label, value }: { label: string; value: number }) => (
  <div>
    <div className="flex justify-between text-xs mb-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}%</span>
    </div>
    <AnimatedProgress value={value} delay={200} className="h-2" barClassName="" />
  </div>
);

export default CVScore;
