import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Brain, ListChecks, RefreshCw, Clock, Video, FileText, CheckCircle2, AlertTriangle, HelpCircle, Eye, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface CoAssessmentBuilderProps {
  jobId: string | null;
  jobTitle: string;
  jobDescription: string;
  jobSkills: string;
  onSave: (data: { preScreening: any[]; formalAssessment: any | null; assessmentQuestions: any[] }) => void;
  initialPreScreening?: any[];
}

export default function CoAssessmentBuilder({
  jobId,
  jobTitle,
  jobDescription,
  jobSkills,
  onSave,
  initialPreScreening,
}: CoAssessmentBuilderProps) {
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [regenCount, setRegenCount] = useState(0);

  // Pre-Screening Questions State
  const [preScreening, setPreScreening] = useState<any[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [showAiBlock, setShowAiBlock] = useState(false);

  // Formal Assessment Configuration State
  const [hasFormalAssessment, setHasFormalAssessment] = useState(false);
  const [assessmentName, setAssessmentName] = useState("Technical & Aptitude Evaluation");
  const [attemptsAllowed, setAttemptsAllowed] = useState("1");
  const [isLiveTimed, setIsLiveTimed] = useState(false);
  const [deadlineDays, setDeadlineDays] = useState("7");
  const [autoSend, setAutoSend] = useState(false);

  // Formal Assessment Questions State
  const [assessmentQuestions, setAssessmentQuestions] = useState<any[]>([]);

  useEffect(() => {
    if (initialPreScreening && initialPreScreening.length > 0) {
      setPreScreening(initialPreScreening);
    }
  }, [initialPreScreening]);

  useEffect(() => {
    async function loadAssessments() {
      if (!jobId) return;
      try {
        setLoading(true);
        // 1. Fetch pre-screening questions
        const { data: psData } = await supabase
          .from("pre_screening_questions")
          .select("*")
          .eq("job_id", jobId)
          .order("created_at", { ascending: true });
        
        if (psData) setPreScreening(psData);

        // 2. Fetch formal assessment config
        const { data: assessData } = await supabase
          .from("assessments")
          .select("*")
          .eq("job_id", jobId)
          .maybeSingle();

        if (assessData) {
          setHasFormalAssessment(true);
          setAssessmentName(assessData.name);
          setAttemptsAllowed(assessData.attempts_allowed);
          setIsLiveTimed(assessData.is_live_timed);
          setDeadlineDays(String(assessData.deadline_days || 7));
          setAutoSend(assessData.auto_send);

          // Fetch formal assessment questions
          const { data: qData } = await supabase
            .from("assessment_questions")
            .select("*")
            .eq("assessment_id", assessData.id)
            .order("order_index", { ascending: true });
          
          if (qData) {
            setAssessmentQuestions(qData);
          }
        }
      } catch (err: any) {
        console.error("Error loading assessment data:", err.message);
      } finally {
        setLoading(false);
      }
    }
    loadAssessments();
  }, [jobId]);

  // Bubble up configuration changes to parent job post/edit flow
  useEffect(() => {
    onSave({
      preScreening,
      formalAssessment: hasFormalAssessment
        ? {
            name: assessmentName,
            attempts_allowed: attemptsAllowed,
            is_live_timed: isLiveTimed,
            deadline_days: parseInt(deadlineDays, 10) || 7,
            auto_send: autoSend,
          }
        : null,
      assessmentQuestions,
    });
  }, [preScreening, hasFormalAssessment, assessmentName, attemptsAllowed, isLiveTimed, deadlineDays, autoSend, assessmentQuestions]);

  // AI Pre-Screening Suggestion Generator
  const generateAiSuggestions = async () => {
    if (regenCount >= 3) {
      toast.error("You have reached the maximum of 3 AI suggestions.");
      return;
    }
    try {
      setAiLoading(true);
      setShowAiBlock(true);
      
      const { data, error } = await supabase.functions.invoke("ai-agent", {
        body: {
          action: "suggest_pre_screening",
          jobDetails: {
            title: jobTitle,
            description: jobDescription,
            skills: jobSkills,
          },
        },
      });

      if (error || !data?.questions) throw error || new Error("Failed to generate questions");
      
      setAiSuggestions(data.questions);
      setRegenCount((prev) => prev + 1);
      toast.success(`Generated suggestions! (Attempt ${regenCount + 1}/3)`);
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.message || String(err);
      toast.error(`AI suggestions failed: ${errMsg}. Make sure 'ai-agent' is deployed and GEMINI_API_KEY is configured.`);
    } finally {
      setAiLoading(false);
    }
  };

  // Add a pre-screening question
  const addPreScreeningQuestion = (question: any = null) => {
    const defaultQ = question || {
      id: crypto.randomUUID(),
      question_text: "",
      question_type: "yes_no",
      options: ["Yes", "No"],
      is_required: true,
      is_disqualifying: false,
      correct_answer: "Yes",
    };
    setPreScreening([...preScreening, defaultQ]);
  };

  const updatePreScreening = (index: number, field: string, value: any) => {
    setPreScreening((prev) =>
      prev.map((q, idx) => {
        if (idx !== index) return q;
        const updated = { ...q, [field]: value };
        // Reset correct answer/options depending on type
        if (field === "question_type") {
          if (value === "yes_no") {
            updated.options = ["Yes", "No"];
            updated.correct_answer = "Yes";
          } else if (value === "multiple_choice") {
            updated.options = ["Option A", "Option B"];
            updated.correct_answer = "Option A";
          } else if (value === "rating") {
            updated.options = null;
            updated.correct_answer = "4";
          } else {
            updated.options = null;
            updated.correct_answer = null;
            updated.is_disqualifying = false;
          }
        }
        return updated;
      })
    );
  };

  const removePreScreening = (index: number) => {
    setPreScreening(preScreening.filter((_, idx) => idx !== index));
  };

  // Add a formal assessment question
  const addAssessmentQuestion = (type: string) => {
    const newQ = {
      id: crypto.randomUUID(),
      question_type: type,
      question_text: "",
      order_index: assessmentQuestions.length,
      options: type === "multiple_choice" ? ["Option A", "Option B"] : null,
      correct_answers: type === "multiple_choice" ? ["Option A"] : null,
      video_max_duration: type === "video" ? 60 : null,
      iq_difficulty: type === "iq_aptitude" ? "mid" : null,
      iq_count: type === "iq_aptitude" ? 10 : null,
      iq_source: type === "iq_aptitude" ? "mixed" : null,
      time_limit_seconds: type === "iq_aptitude" ? null : 60,
    };
    setAssessmentQuestions([...assessmentQuestions, newQ]);
  };

  const updateAssessmentQuestion = (index: number, field: string, value: any) => {
    setAssessmentQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== index) return q;
        return { ...q, [field]: value };
      })
    );
  };

  const removeAssessmentQuestion = (index: number) => {
    setAssessmentQuestions(
      assessmentQuestions
        .filter((_, idx) => idx !== index)
        .map((q, idx) => ({ ...q, order_index: idx }))
    );
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">
        Loading Assessment Configurations...
      </div>
    );
  }

  return (
    <div className="space-y-8 border-t border-white/5 pt-8 mt-6">
      <div>
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" /> Assessments Dashboard
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Set up candidate pre-screening and formal cognitive evaluation criteria for this role.
        </p>
      </div>

      {/* Part 1: Pre-Screening Questions */}
      <div className="bg-[#111318]/50 border border-white/5 rounded-2xl p-6 space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-4 border-b border-white/5 pb-4">
          <div>
            <h4 className="text-sm font-bold text-white">Pre-Screening Questions</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Questions candidates answer immediately when applying to filter out unqualified profiles.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={generateAiSuggestions}
              disabled={aiLoading || regenCount >= 3}
              variant="outline"
              className="border-primary/20 text-primary hover:bg-primary/5 text-xs h-9 rounded-xl flex items-center gap-1.5"
            >
              <ListChecks className="w-3.5 h-3.5" />
              {regenCount === 0 ? "Suggest Questions (AI)" : `Regenerate AI Suggestions (${regenCount}/3)`}
            </Button>
            <Button
              type="button"
              onClick={() => addPreScreeningQuestion()}
              className="bg-primary hover:bg-primary/95 text-primary-foreground text-xs h-9 rounded-xl flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Question
            </Button>
          </div>
        </div>

        {/* AI Suggested panel */}
        {showAiBlock && (
          <div className="bg-[#0c1514] border border-primary/20 rounded-xl p-4 space-y-3 animate-in fade-in duration-200">
            <h5 className="text-xs font-bold text-primary flex items-center gap-1">
              <ListChecks className="w-3.5 h-3.5" /> AI Recommended Screening Questions
            </h5>
            {aiLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 justify-center">
                <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                <span>Teemane is brainstorming screening questions...</span>
              </div>
            ) : aiSuggestions.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No suggestions generated yet.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                {aiSuggestions.map((s, idx) => (
                  <div key={idx} className="flex justify-between items-start gap-4 p-2 bg-[#12201d]/50 rounded-lg text-xs hover:bg-[#12201d]/85 transition-colors border border-primary/5">
                    <div className="min-w-0">
                      <p className="font-semibold text-white/90 leading-snug">{s.question_text}</p>
                      <p className="text-[10px] text-primary/70 font-medium capitalize mt-0.5">
                        Type: {s.question_type.replace("_", " ")} 
                        {s.is_disqualifying ? " • Disqualifying" : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        addPreScreeningQuestion({
                          id: crypto.randomUUID(),
                          question_text: s.question_text,
                          question_type: s.question_type,
                          options: s.options || (s.question_type === "yes_no" ? ["Yes", "No"] : null),
                          is_required: s.is_required ?? true,
                          is_disqualifying: s.is_disqualifying ?? false,
                          correct_answer: s.correct_answer,
                        });
                        setAiSuggestions(aiSuggestions.filter((_, i) => i !== idx));
                      }}
                      className="text-primary hover:text-white hover:bg-primary/20 shrink-0 h-7 text-[10px]"
                    >
                      + Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pre-Screening Questions List */}
        {preScreening.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-white/5 rounded-xl">
            No pre-screening questions configured. Candidates will apply with only cover letter & CV.
          </div>
        ) : (
          <div className="space-y-4">
            {preScreening.map((q, idx) => (
              <div key={q.id} className="border border-white/5 rounded-xl p-4 bg-card/60 space-y-4 relative">
                <button
                  type="button"
                  onClick={() => removePreScreening(idx)}
                  className="absolute top-4 right-4 text-muted-foreground hover:text-red-400 p-1.5 rounded hover:bg-white/5 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Question Text */}
                  <div className="md:col-span-8 space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-semibold">Question #{idx + 1}</Label>
                    <Input
                      value={q.question_text}
                      onChange={(e) => updatePreScreening(idx, "question_text", e.target.value)}
                      placeholder="e.g. Do you have a valid driver's license?"
                      className="h-10 rounded-xl bg-[#111318] border-white/10 text-white"
                    />
                  </div>

                  {/* Question Type */}
                  <div className="md:col-span-4 space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-semibold">Question Type</Label>
                    <Select value={q.question_type} onValueChange={(val) => updatePreScreening(idx, "question_type", val)}>
                      <SelectTrigger className="h-10 rounded-xl bg-[#111318] border-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                        <SelectItem value="yes_no">Yes / No</SelectItem>
                        <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                        <SelectItem value="rating">Rating (1 to 5)</SelectItem>
                        <SelectItem value="short_text">Short Text</SelectItem>
                        <SelectItem value="long_text">Long Text</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Multiple choice options builder */}
                {q.question_type === "multiple_choice" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-semibold">Options (comma-separated, max 6)</Label>
                    <Input
                      value={q.options ? q.options.join(", ") : ""}
                      onChange={(e) => {
                        const opts = e.target.value.split(",").map((s) => s.trim()).slice(0, 6);
                        updatePreScreening(idx, "options", opts);
                      }}
                      placeholder="Option A, Option B, Option C"
                      className="h-10 rounded-xl bg-[#111318] border-white/10 text-white text-xs"
                    />
                  </div>
                )}

                {/* Validation and Disqualifications */}
                <div className="flex flex-wrap gap-4 items-center border-t border-white/5 pt-3 text-xs">
                  <label className="flex items-center gap-2 text-zinc-300 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={q.is_required ?? false}
                      onChange={(e) => updatePreScreening(idx, "is_required", e.target.checked)}
                      className="w-3.5 h-3.5 accent-primary"
                    />
                    Required Question
                  </label>

                  {/* Disqualifying option logic */}
                  {["yes_no", "multiple_choice", "rating"].includes(q.question_type) && (
                    <label className="flex items-center gap-2 text-zinc-300 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={q.is_disqualifying ?? false}
                        onChange={(e) => updatePreScreening(idx, "is_disqualifying", e.target.checked)}
                        className="w-3.5 h-3.5 accent-primary"
                      />
                      Disqualify if answer is incorrect
                    </label>
                  )}

                  {/* Set correct/acceptable answer */}
                  {q.is_disqualifying && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Acceptable correct answer:</span>
                      {q.question_type === "yes_no" && (
                        <Select value={q.correct_answer} onValueChange={(val) => updatePreScreening(idx, "correct_answer", val)}>
                          <SelectTrigger className="h-8 bg-[#111318] border-white/10 text-white rounded-lg text-xs w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                            <SelectItem value="Yes">Yes</SelectItem>
                            <SelectItem value="No">No</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {q.question_type === "multiple_choice" && (
                        <Select value={q.correct_answer} onValueChange={(val) => updatePreScreening(idx, "correct_answer", val)}>
                          <SelectTrigger className="h-8 bg-[#111318] border-white/10 text-white rounded-lg text-xs w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                            {q.options?.map((opt: string) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {q.question_type === "rating" && (
                        <Select value={q.correct_answer} onValueChange={(val) => updatePreScreening(idx, "correct_answer", val)}>
                          <SelectTrigger className="h-8 bg-[#111318] border-white/10 text-white rounded-lg text-xs w-36">
                            <SelectValue placeholder="Min rating required" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                            {["1", "2", "3", "4", "5"].map((v) => (
                              <SelectItem key={v} value={v}>At least {v} stars</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Part 2: Formal Assessment Toggle */}
      <div className="bg-[#111318]/50 border border-white/5 rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div>
            <h4 className="text-sm font-bold text-white">Formal Assessment</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Send separate structured assessments to candidates after reviewing their initial profile.
            </p>
          </div>
          <label className="relative flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hasFormalAssessment}
              onChange={(e) => setHasFormalAssessment(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            <span className="ml-3 text-xs font-semibold text-zinc-300">Enable Assessment</span>
          </label>
        </div>

        {hasFormalAssessment && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Assessment Config */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-semibold">Assessment Title</Label>
                <Input
                  value={assessmentName}
                  onChange={(e) => setAssessmentName(e.target.value)}
                  placeholder="e.g. Engineering & IQ Assessment"
                  className="h-10 rounded-xl bg-[#111318] border-white/10 text-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-semibold">Allowed Attempt Count</Label>
                <Select value={attemptsAllowed} onValueChange={setAttemptsAllowed}>
                  <SelectTrigger className="h-10 rounded-xl bg-[#111318] border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                    <SelectItem value="1">1 Attempt Allowed</SelectItem>
                    <SelectItem value="2">2 Attempts Allowed</SelectItem>
                    <SelectItem value="unlimited">Unlimited Attempts</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-semibold">Deadline Days (from invitation)</Label>
                <Input
                  type="number"
                  value={deadlineDays}
                  onChange={(e) => setDeadlineDays(e.target.value)}
                  className="h-10 rounded-xl bg-[#111318] border-white/10 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-6 text-xs">
                <label className="flex items-center gap-2 text-zinc-300 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isLiveTimed}
                    onChange={(e) => setIsLiveTimed(e.target.checked)}
                    className="w-3.5 h-3.5 accent-primary"
                  />
                  Live Timed Session
                </label>

                <label className="flex items-center gap-2 text-zinc-300 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSend}
                    onChange={(e) => setAutoSend(e.target.checked)}
                    className="w-3.5 h-3.5 accent-primary"
                  />
                  Auto-send on "Reviewed" stage
                </label>
              </div>
            </div>

            {/* Assessment Question Builder */}
            <div className="border-t border-white/5 pt-6 space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <h5 className="text-xs font-bold text-white uppercase tracking-wider">Assessment Questions Flow</h5>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addAssessmentQuestion("text")}
                    className="border-white/10 hover:bg-white/5 text-white text-[11px] rounded-lg"
                  >
                    <FileText className="w-3 h-3 text-primary mr-1" /> Add Written (Text)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addAssessmentQuestion("video")}
                    className="border-white/10 hover:bg-white/5 text-white text-[11px] rounded-lg"
                  >
                    <Video className="w-3 h-3 text-primary mr-1" /> Add Video Question
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addAssessmentQuestion("multiple_choice")}
                    className="border-white/10 hover:bg-white/5 text-white text-[11px] rounded-lg"
                  >
                    <CheckCircle2 className="w-3 h-3 text-primary mr-1" /> Add Multiple Choice
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={assessmentQuestions.some((q) => q.question_type === "iq_aptitude")}
                    onClick={() => addAssessmentQuestion("iq_aptitude")}
                    className="border-primary/20 text-primary hover:bg-primary/5 text-[11px] rounded-lg disabled:opacity-50"
                    title="Only one IQ test block allowed per assessment"
                  >
                    <Brain className="w-3 h-3 text-primary mr-1" /> Add IQ Aptitude Block
                  </Button>
                </div>
              </div>

              {assessmentQuestions.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-white/5 rounded-xl">
                  No questions added. Add questions above to build your evaluation.
                </div>
              ) : (
                <div className="space-y-4">
                  {assessmentQuestions.map((q, idx) => (
                    <div key={q.id} className="border border-white/5 rounded-xl p-4 bg-card/60 space-y-4 relative">
                      <button
                        type="button"
                        onClick={() => removeAssessmentQuestion(idx)}
                        className="absolute top-4 right-4 text-zinc-500 hover:text-red-400 p-1.5 rounded hover:bg-white/5 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                        {q.question_type === "text" && <FileText className="w-4 h-4" />}
                        {q.question_type === "video" && <Video className="w-4 h-4" />}
                        {q.question_type === "multiple_choice" && <CheckCircle2 className="w-4 h-4" />}
                        {q.question_type === "iq_aptitude" && <Brain className="w-4 h-4" />}
                        <span className="uppercase">Question #{idx + 1} — {q.question_type.replace("_", " ")}</span>
                      </div>

                      {/* Main Question Text (Except IQ block) */}
                      {q.question_type !== "iq_aptitude" ? (
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground font-semibold">Question Text</Label>
                          <Input
                            value={q.question_text}
                            onChange={(e) => updateAssessmentQuestion(idx, "question_text", e.target.value)}
                            placeholder="Type the question..."
                            className="h-10 rounded-xl bg-[#111318] border-white/10 text-white"
                          />
                        </div>
                      ) : (
                        <div className="bg-[#111318]/50 border border-white/5 rounded-xl p-4 space-y-4">
                          <p className="text-xs text-muted-foreground">
                            Cognitive block will automatically inject timed logical, numerical, and verbal reasoning questions.
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground font-semibold">Difficulty</Label>
                              <Select value={q.iq_difficulty} onValueChange={(val) => updateAssessmentQuestion(idx, "iq_difficulty", val)}>
                                <SelectTrigger className="h-9 rounded-lg bg-[#111318] border-white/10 text-white text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                                  <SelectItem value="entry">Entry Level</SelectItem>
                                  <SelectItem value="mid">Mid Level</SelectItem>
                                  <SelectItem value="senior">Senior Level</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground font-semibold">Question Count</Label>
                              <Select value={String(q.iq_count)} onValueChange={(val) => updateAssessmentQuestion(idx, "iq_count", parseInt(val, 10))}>
                                <SelectTrigger className="h-9 rounded-lg bg-[#111318] border-white/10 text-white text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                                  <SelectItem value="10">10 Questions</SelectItem>
                                  <SelectItem value="20">20 Questions</SelectItem>
                                  <SelectItem value="30">30 Questions</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground font-semibold">Question Source</Label>
                              <Select value={q.iq_source} onValueChange={(val) => updateAssessmentQuestion(idx, "iq_source", val)}>
                                <SelectTrigger className="h-9 rounded-lg bg-[#111318] border-white/10 text-white text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                                  <SelectItem value="bank">Admin Question Bank</SelectItem>
                                  <SelectItem value="ai">AI-Generated (Gemini)</SelectItem>
                                  <SelectItem value="mixed">Mixed (Bank + AI)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Video max duration selection */}
                      {q.question_type === "video" && (
                        <div className="space-y-1.5 w-48">
                          <Label className="text-xs text-muted-foreground font-semibold">Max Recording Duration</Label>
                          <Select value={String(q.video_max_duration)} onValueChange={(val) => updateAssessmentQuestion(idx, "video_max_duration", parseInt(val, 10))}>
                            <SelectTrigger className="h-9 rounded-lg bg-[#111318] border-white/10 text-white text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                              <SelectItem value="30">30 Seconds</SelectItem>
                              <SelectItem value="60">1 Minute</SelectItem>
                              <SelectItem value="120">2 Minutes</SelectItem>
                              <SelectItem value="180">3 Minutes</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* MCQ Option lists */}
                      {q.question_type === "multiple_choice" && (
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground font-semibold">Options (comma-separated)</Label>
                            <Input
                              value={q.options ? q.options.join(", ") : ""}
                              onChange={(e) => {
                                const opts = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                                updateAssessmentQuestion(idx, "options", opts);
                              }}
                              placeholder="e.g. Option A, Option B, Option C"
                              className="h-10 rounded-xl bg-[#111318] border-white/10 text-white text-xs"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground font-semibold">Correct Options (comma-separated, matches options exactly)</Label>
                            <Input
                              value={q.correct_answers ? q.correct_answers.join(", ") : ""}
                              onChange={(e) => {
                                const ans = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                                updateAssessmentQuestion(idx, "correct_answers", ans);
                              }}
                              placeholder="e.g. Option A"
                              className="h-10 rounded-xl bg-[#111318] border-white/10 text-white text-xs"
                            />
                          </div>
                        </div>
                      )}

                      {/* Individual time limit */}
                      {q.question_type !== "iq_aptitude" && (
                        <div className="space-y-1.5 w-48">
                          <Label className="text-xs text-muted-foreground font-semibold">Individual Time Limit (optional)</Label>
                          <Input
                            type="number"
                            value={q.time_limit_seconds || ""}
                            onChange={(e) => updateAssessmentQuestion(idx, "time_limit_seconds", e.target.value ? parseInt(e.target.value, 10) : null)}
                            placeholder="Unlimited"
                            className="h-9 rounded-lg bg-[#111318] border-white/10 text-white text-xs"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
