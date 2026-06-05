import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, CreditCard, Video, FileText, Paperclip, X } from "lucide-react";
import mascot from "@/assets/mascot-transparent.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";

const InterviewPrep = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { jobs } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"info" | "payment_select" | "payment_confirm">("info");
  const [prepType, setPrepType] = useState<"script" | "coaching">("script");
  const [paymentInfo, setPaymentInfo] = useState<{ status: string; amount: number | null }>({ status: "skipped_beta", amount: null });

  const [targetRole, setTargetRole] = useState("");
  const [interviewDate, setInterviewDate] = useState("");
  const [attachments, setAttachments] = useState<Array<{ file: File; label: string }>>([]);
  
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [pastApplications, setPastApplications] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("applications").select("job_id").eq("user_id", user.id);
      if (data) {
        const appliedJobIds = new Set(data.map(a => a.job_id));
        const appliedJobs = jobs.filter(j => appliedJobIds.has(j.id));
        setPastApplications(appliedJobs);
      }
    })();
  }, [user, jobs]);

  const onPickFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files)
      .filter((f) => f.size <= 10 * 1024 * 1024)
      .map((f) => ({ file: f, label: f.name }));
    setAttachments((p) => [...p, ...arr]);
  };

  const submit = async (payStatus: string, payAmount: number) => {
    if (!user) {
      toast.error("You must be logged in to submit a request.");
      return;
    }
    setSubmitting(true);
    try {
      // Upload attachments first
      const paths: string[] = [];
      for (const a of attachments) {
        const ext = a.file.name.split(".").pop() ?? "bin";
        const path = `${user.id}/interview/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("app-docs").upload(path, a.file);
        if (upErr) {
          console.warn("File upload failed:", upErr.message);
        } else {
          paths.push(path);
        }
      }

      // Insert the interview prep record
      const { error, data: inserted } = await supabase
        .from("interview_preps")
        .insert({
          user_id: user.id,
          type: prepType,
          target_role: targetRole,
          interview_date: interviewDate || null,
          attachment_paths: paths,
          status: "new",
          payment_status: payStatus,
          amount: payAmount,
          job_id: selectedJobId,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Supabase insert error:", JSON.stringify(error));
        throw new Error(error.message || "Database error — please try again.");
      }

      const id = (inserted as any)?.id ?? null;
      if (id) setSubmittedId(id);
      toast.success("Request submitted successfully!");
      setSubmitted(true);
    } catch (e: any) {
      console.error("submit() caught error:", e);
      toast.error(e?.message ?? "Could not submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (!targetRole.trim() && attachments.length === 0) {
      toast.error("Please provide a target role or attach a job description.");
      return;
    }
    setStep("payment_select");
  };

  if (step === "payment_select") {
    return (
      <div className="h-full flex-1 flex flex-col bg-background overflow-hidden">
        <div className="p-6 pb-3 shrink-0">
          <button onClick={() => setStep("info")} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 flex-1 overflow-y-auto pb-6">
          <div className="flex items-center gap-3 mb-6">
            <img src={mascot} alt="Teemane" className="w-14 h-14 object-contain animate-bob drop-shadow-[0_0_10px_rgba(130,200,80,0.5)]" />
            <div>
              <h1 className="text-2xl font-bold">Choose your service</h1>
              <p className="text-xs text-muted-foreground">Select the type of preparation you need</p>
            </div>
          </div>
          <div className="space-y-4 pb-8">
            <button onClick={() => { setPrepType("script"); setStep("payment_confirm"); }}
              className={`w-full text-left bg-card border ${prepType === 'script' ? 'border-primary' : 'border-border'} rounded-2xl p-5 hover:border-primary transition-colors`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold"><FileText className="w-5 h-5 text-primary" /> Custom Script</div>
                <p className="font-bold text-primary">P150</p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Get a customized document with 30 tailored Q&A for your specific target role.</p>
            </button>
            <button onClick={() => { setPrepType("coaching"); setStep("payment_confirm"); }}
              className={`w-full text-left bg-card border ${prepType === 'coaching' ? 'border-primary' : 'border-border'} rounded-2xl p-5 hover:border-primary transition-colors`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold"><Video className="w-5 h-5 text-primary" /> Virtual Coaching + Script</div>
                <p className="font-bold text-primary">P500</p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">1-on-1 virtual coaching session with a hiring expert plus your custom 30 Q&A script.</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "payment_confirm") {
    const amount = prepType === "script" ? 150 : 500;

    // Show success screen inside this block once submitted
    if (submitted) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="relative mb-2">
            <img src={mascot} alt="Teemane" className="w-24 h-24 object-contain animate-bob drop-shadow-[0_0_16px_rgba(130,200,80,0.5)]" />
          </div>
          <h2 className="mt-4 text-2xl font-bold">Request received!</h2>
          {submittedId && (
            <div className="mt-3 px-4 py-2 bg-primary/10 border border-primary/20 rounded-xl">
              <p className="text-xs text-muted-foreground">Your Session ID</p>
              <p className="text-lg font-bold text-primary font-mono">CS-{submittedId.substring(0, 4).toUpperCase()}</p>
              <p className="text-xs text-muted-foreground mt-1">Save this ID to track your session.</p>
            </div>
          )}
          <p className="mt-4 text-sm text-muted-foreground max-w-xs">
            Our partner coach will review your request and reach out shortly.
          </p>
          <Button onClick={() => navigate("/profile")} className="mt-8 bg-forest hover:bg-forest/90 rounded-xl">
            Back to Profile
          </Button>
        </div>
      );
    }

    const proceed = async (status: "paid" | "skipped_beta") => {
      setPaymentInfo({ status, amount });
      await submit(status, amount);
    };
    return (
      <div className="h-full flex-1 flex flex-col bg-background overflow-hidden">
        <div className="p-6 pb-3 shrink-0">
          <button onClick={() => setStep("payment_select")} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
          <img src={mascot} alt="Teemane" className="w-24 h-24 object-contain animate-bob drop-shadow-[0_0_16px_rgba(130,200,80,0.5)] mb-2" />
          <p className="text-sm uppercase tracking-wider text-muted-foreground">{prepType === "script" ? "Custom Script" : "Virtual Coaching"}</p>
          <p className="text-4xl font-bold mt-1">P{amount}</p>
          <p className="text-xs text-muted-foreground mt-2 max-w-xs">Mock payment — payment gateway coming soon</p>
          <Button disabled={submitting} onClick={() => proceed("paid")} className="mt-6 w-full max-w-xs h-12 bg-forest hover:bg-forest/90 rounded-xl">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : `Confirm & Pay P${amount}`}
          </Button>
          <button disabled={submitting} onClick={() => proceed("skipped_beta")} className="mt-3 text-xs text-muted-foreground">Skip payment (beta)</button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="relative mb-2">
          <img src={mascot} alt="Teemane" className="w-24 h-24 object-contain animate-bob drop-shadow-[0_0_16px_rgba(130,200,80,0.5)]" />
        </div>
        <h2 className="mt-4 text-2xl font-bold">Request received</h2>
        {submittedId && (
          <div className="mt-3 px-4 py-2 bg-primary/10 border border-primary/20 rounded-xl">
            <p className="text-xs text-muted-foreground">Your Session ID</p>
            <p className="text-lg font-bold text-primary font-mono">CS-{submittedId.substring(0, 4).toUpperCase()}</p>
            <p className="text-xs text-muted-foreground mt-1">Save this ID to track your session.</p>
          </div>
        )}
        <p className="mt-4 text-sm text-muted-foreground max-w-xs">
          Our partner coach will review your request and reach out shortly.
        </p>
        <Button onClick={() => navigate("/profile")} className="mt-8 bg-forest hover:bg-forest/90 rounded-xl">
          Back to Profile
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex-1 flex flex-col bg-background overflow-hidden">
      <div className="p-6 pb-3 shrink-0">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>

      <div className="px-6 flex-1 overflow-y-auto pb-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Interview Prep Details</h1>
          <p className="text-xs text-muted-foreground">{prepType === "script" ? "Custom Q&A Script" : "Virtual Coaching + Script"}</p>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Target Role</Label>
            <Input value={targetRole} onChange={(e) => { setTargetRole(e.target.value); setSelectedJobId(null); }} placeholder="e.g. Senior Frontend Developer" />
            
            {pastApplications.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1">Select a role you applied for via Talenthub:</p>
                <select 
                  className="w-full h-11 px-3 rounded-xl bg-card border border-border text-sm focus:outline-none focus:border-primary"
                  value={selectedJobId || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedJobId(val || null);
                    if (val) {
                      const selectedJob = pastApplications.find(j => j.id === val);
                      if (selectedJob) setTargetRole(selectedJob.title);
                    } else {
                      setTargetRole("");
                    }
                  }}
                >
                  <option value="">Select a role...</option>
                  {pastApplications.map(j => (
                    <option key={j.id} value={j.id}>{j.title}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <Label className="mb-2 block">Job Description / Notes</Label>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">If the role you're interviewing for wasn't applied to through Talenthub, or you have extra context, please upload the job description or an image of the job post below.</p>
            <input ref={fileRef} type="file" multiple className="hidden" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={(e) => { onPickFiles(e.target.files); e.target.value = ""; }} />
            {attachments.map((a, i) => (
              <div key={i} className="mb-2 bg-card rounded-xl p-2 border border-border flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                <p className="flex-1 text-xs truncate text-muted-foreground">{a.label}</p>
                <button onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))} className="text-muted-foreground"><X className="w-4 h-4" /></button>
              </div>
            ))}
            <button onClick={() => fileRef.current?.click()} className="w-full text-xs text-primary border border-dashed border-border rounded-xl py-2.5 flex items-center justify-center gap-2">
              <Paperclip className="w-3.5 h-3.5" /> Attach job description
            </button>
          </div>

          {prepType === "coaching" && (
            <div>
              <Label className="mb-2 block">Preferred Interview / Coaching Date</Label>
              <Input type="date" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} className="rounded-xl bg-card" />
            </div>
          )}
        </div>
      </div>

      <div className="p-6 pt-3 border-t border-border bg-card shrink-0">
        <Button onClick={handleNext} className="w-full h-12 bg-forest hover:bg-forest/90 rounded-xl font-semibold">
          Continue to Payment
        </Button>
      </div>
    </div>
  );
};

export default InterviewPrep;
