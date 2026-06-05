import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, FileText, Upload, CheckCircle2, UserPlus, AlertCircle, Phone, Mail, User, Info, ArrowLeft, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function PublicJobApplication() {
  const { jobId } = useParams<{ jobId: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [job, setJob] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);

  // Personal info state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);

  // Pre-screening answers state: questionId -> answer string
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadJobData() {
      if (!jobId) return;
      try {
        setLoading(true);
        // Load Job Details
        const { data: jobData, error: jobErr } = await supabase
          .from("jobs")
          .select("*, company_id(*)")
          .eq("id", jobId)
          .single();

        if (jobErr) throw jobErr;
        setJob(jobData);

        // Load Pre-screening questions
        const { data: qData, error: qErr } = await supabase
          .from("pre_screening_questions")
          .select("*")
          .eq("job_id", jobId)
          .order("created_at", { ascending: true });

        if (qErr) throw qErr;
        setQuestions(qData || []);

        // Initialize answers map
        const initialAnswers: Record<string, string> = {};
        (qData || []).forEach((q: any) => {
          initialAnswers[q.id] = "";
        });
        setAnswers(initialAnswers);
      } catch (err: any) {
        console.error("Error loading job details:", err.message);
        toast.error("Failed to load job details.");
      } finally {
        setLoading(false);
      }
    }

    loadJobData();
  }, [jobId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const validTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (!validTypes.includes(file.type)) {
        toast.error("Please upload only PDF or Word documents.");
        return;
      }
      setCvFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cvFile) {
      toast.error("Please upload your CV to apply.");
      return;
    }

    // Verify all required pre-screening questions have been answered
    for (const q of questions) {
      if (q.is_required && !answers[q.id]?.trim()) {
        toast.error(`Please answer the required question: "${q.question_text}"`);
        return;
      }
    }

    try {
      setSubmitting(true);

      // 1. Upload CV to Supabase Storage
      const fileExt = cvFile.name.split(".").pop();
      const sanitizedName = cvFile.name.replace(/[^a-zA-Z0-9]/g, "_");
      const filePath = `${jobId}/${Date.now()}_${sanitizedName}.${fileExt}`;

      const { error: uploadErr } = await supabase.storage
        .from("external-cvs")
        .upload(filePath, cvFile);

      if (uploadErr) throw uploadErr;

      // 2. Evaluate disqualifications
      let isDisqualified = false;
      questions.forEach((q) => {
        const candidateAnswer = answers[q.id]?.trim();
        if (q.is_disqualifying) {
          // Check if correct answer is set and check type matching
          if (q.question_type === "yes_no" || q.question_type === "multiple_choice") {
            if (q.correct_answer && candidateAnswer.toLowerCase() !== q.correct_answer.toLowerCase()) {
              isDisqualified = true;
            }
          } else if (q.question_type === "rating") {
            // Assume rating requires a minimum number (e.g. >= correct_answer)
            const minRating = parseInt(q.correct_answer || "0", 10);
            const candidateRating = parseInt(candidateAnswer || "0", 10);
            if (candidateRating < minRating) {
              isDisqualified = true;
            }
          }
        }
      });

      // 3. Create external application record
      const { data: extApp, error: appErr } = await supabase
        .from("external_applications")
        .insert([
          {
            job_id: jobId || "",
            full_name: fullName,
            email: email,
            phone: phone,
            cover_letter: coverLetter,
            cv_path: filePath,
            cv_filename: cvFile.name,
            status: isDisqualified ? "declined" : "submitted",
            recruiter_notes: isDisqualified
              ? "System Auto-Reject: Candidate did not meet the minimum pre-screening requirements."
              : null,
          },
        ])
        .select()
        .single();

      if (appErr) throw appErr;

      // 4. Save answers to database
      if (questions.length > 0) {
        const answersToInsert = questions.map((q) => {
          const ans = answers[q.id];
          const isDq = q.is_disqualifying && (
            (q.question_type === "yes_no" || q.question_type === "multiple_choice")
              ? (q.correct_answer && ans.toLowerCase() !== q.correct_answer.toLowerCase())
              : (q.question_type === "rating" ? parseInt(ans || "0", 10) < parseInt(q.correct_answer || "0", 10) : false)
          );
          return {
            job_id: jobId || "",
            external_application_id: extApp.id,
            question_id: q.id,
            answer_text: ans,
            is_disqualified: isDq,
          };
        });

        const { error: ansErr } = await supabase
          .from("pre_screening_answers")
          .insert(answersToInsert);

        if (ansErr) throw ansErr;
      }

      // 5. Send confirmation email
      try {
        await supabase.functions.invoke("send-email", {
          body: {
            type: "application_confirmation",
            email: email,
            fullName: fullName,
            jobTitle: job.title,
            companyName: job.company_id?.name || job.company,
          },
        });
      } catch (emailErr) {
        console.warn("Could not send email confirmation:", emailErr);
      }

      toast.success("Application submitted successfully!");
      setSubmitted(true);
    } catch (err: any) {
      console.error("Submission failed:", err.message);
      toast.error(err.message || "Failed to submit application.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0c10] text-[#e5e7eb] flex flex-col items-center justify-center p-6">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm text-muted-foreground">Loading job post details...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-[#0a0c10] text-[#e5e7eb] flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold">Job Post Not Found</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          This job post may have expired, been deactivated, or deleted.
        </p>
        <Link to="/" className="mt-6 text-primary hover:underline">Return to Home</Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0a0c10] text-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-[#0d1117] border border-white/5 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 bg-primary/10 border border-primary/20 text-primary rounded-2xl flex items-center justify-center mx-auto animate-bounce">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">Application Submitted!</h2>
            <p className="text-sm text-muted-foreground">
              Thank you for applying for the <span className="text-white font-medium">{job.title}</span> role at <span className="text-white font-medium">{job.company_id?.name || job.company}</span>.
            </p>
            <p className="text-xs text-muted-foreground">
              We have sent a confirmation email to <span className="text-white/80">{email}</span>.
            </p>
          </div>

          {/* Account Creation Nudge */}
          <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 space-y-3 text-left">
            <div className="flex items-start gap-2.5">
              <UserPlus className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-white">Create a TalentHub account</h4>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Track your application status in real-time, get auto-matched to open roles in Botswana, and complete interview assessments directly in the mobile app.
                </p>
              </div>
            </div>
            <Button asChild className="w-full h-10 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded-xl text-xs">
              <Link to="/auth">Create Free Account</Link>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Powered by <span className="font-semibold text-primary">TalentHub Botswana</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0c10] text-[#e5e7eb] font-sans pb-16 flex flex-col items-center">
      <header className="w-full max-w-2xl px-6 py-4 flex items-center gap-3">
        <Link to="/" className="text-muted-foreground hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-primary" />
          <span className="font-bold text-sm tracking-tight text-white">TalentHub Botswana</span>
        </div>
      </header>

      <main className="w-full max-w-2xl px-6 space-y-8">
        {/* Job Info Header Card */}
        <div className="bg-[#0d1117] border border-white/5 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex gap-4 items-start">
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
              {job.company_id?.logo_url ? (
                <img src={job.company_id.logo_url} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Briefcase className="w-6 h-6 text-primary" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight leading-snug">{job.title}</h1>
              <p className="text-sm text-primary font-medium">{job.company_id?.name || job.company}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                <span>{job.location}</span>
                <span>•</span>
                <span>{job.employment_type || job.job_type}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 pt-4">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">Role Overview</h3>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line line-clamp-4 hover:line-clamp-none transition-all cursor-pointer">
              {job.description}
            </p>
          </div>
        </div>

        {/* Application Form */}
        <form onSubmit={handleSubmit} className="bg-[#0d1117] border border-white/5 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="border-b border-white/5 pb-4">
            <h2 className="text-lg font-bold text-white tracking-tight">Submit Your Application</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Please provide your details below.</p>
          </div>

          {/* Personal Info Grid */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" /> Full Name
              </Label>
              <Input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="First and last name"
                className="h-11 bg-card border-white/10 text-white rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-primary" /> Email Address
                </Label>
                <Input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="h-11 bg-card border-white/10 text-white rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-primary" /> Phone Number
                </Label>
                <Input
                  required
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +267 71000000"
                  className="h-11 bg-card border-white/10 text-white rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-semibold">Cover Letter</Label>
              <Textarea
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder="Tell the company why you are a great fit for this position..."
                className="min-h-[120px] bg-card border-white/10 text-white rounded-xl text-sm"
              />
            </div>

            {/* CV Upload */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground font-semibold">Upload CV (PDF or Word)</Label>
              <div className="relative border border-dashed border-white/10 hover:border-primary/50 transition-colors rounded-2xl p-6 bg-card flex flex-col items-center justify-center text-center cursor-pointer">
                <input
                  type="file"
                  required
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                <span className="text-xs text-white/80 font-medium">
                  {cvFile ? cvFile.name : "Drag & drop or tap to upload CV"}
                </span>
                <span className="text-[10px] text-muted-foreground mt-1">Accepts PDF, DOC, DOCX up to 10MB</span>
              </div>
            </div>
          </div>

          {/* Pre-Screening Questions */}
          {questions.length > 0 && (
            <div className="border-t border-white/5 pt-6 space-y-6">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Pre-Screening Questions</h3>
              </div>

              {questions.map((q, index) => (
                <div key={q.id} className="space-y-2 bg-[#111318]/50 border border-white/5 rounded-2xl p-4">
                  <Label className="text-xs font-semibold text-white/90 flex items-start gap-1 leading-relaxed">
                    <span>{index + 1}.</span>
                    <span>
                      {q.question_text}
                      {q.is_required && <span className="text-red-400 ml-0.5">*</span>}
                    </span>
                  </Label>

                  {/* MCQ type */}
                  {q.question_type === "multiple_choice" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {q.options?.map((opt: string) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                          className={`h-10 px-4 rounded-xl border text-xs font-medium text-left transition-all ${
                            answers[q.id] === opt
                              ? "bg-primary/10 border-primary text-primary"
                              : "border-white/5 bg-card hover:bg-white/5 text-white/85"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Yes/No type */}
                  {q.question_type === "yes_no" && (
                    <div className="flex gap-3 mt-2">
                      {["Yes", "No"].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                          className={`h-10 px-6 rounded-xl border text-xs font-semibold transition-all ${
                            answers[q.id] === opt
                              ? "bg-primary/10 border-primary text-primary"
                              : "border-white/5 bg-card hover:bg-white/5 text-white/85"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Rating scale */}
                  {q.question_type === "rating" && (
                    <div className="flex items-center gap-1.5 mt-2">
                      {[1, 2, 3, 4, 5].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setAnswers({ ...answers, [q.id]: String(val) })}
                          className={`w-9 h-9 rounded-full border flex items-center justify-center text-xs font-bold transition-all ${
                            answers[q.id] === String(val)
                              ? "bg-primary/10 border-primary text-primary"
                              : "border-white/5 bg-card hover:bg-white/5 text-white/80"
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Text types */}
                  {q.question_type === "short_text" && (
                    <Input
                      value={answers[q.id] || ""}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                      placeholder="Type your response here..."
                      className="h-10 bg-card border-white/10 text-white rounded-xl text-xs"
                    />
                  )}

                  {q.question_type === "long_text" && (
                    <Textarea
                      value={answers[q.id] || ""}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                      placeholder="Type your detailed response here..."
                      className="min-h-[80px] bg-card border-white/10 text-white rounded-xl text-xs"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-12 bg-primary hover:bg-primary/95 text-primary-foreground font-bold rounded-2xl text-sm transition-all"
          >
            {submitting ? "Uploading files & submitting..." : "Submit Application"}
          </Button>
        </form>
      </main>
    </div>
  );
}
