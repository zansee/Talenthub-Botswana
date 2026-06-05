import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Gem, CheckCircle2, Loader2, CreditCard, Lock, Paperclip, X, FileText, Check, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useFlag } from "@/lib/featureFlags";
import { toast } from "sonner";
import mascot from "@/assets/mascot-transparent.png";

const PRICE_BWP = 250;

const FOCUS_OPTIONS = [
  "ATS optimisation", "Career change", "Gap in employment",
  "Highlight achievements", "Entry-level / graduate", "Senior / executive level",
  "Skills & keywords", "Layout & formatting", "LinkedIn alignment", "Other",
];

const CVRevamp = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const revampEnabled = useFlag("revamp_enabled");
  const paymentsEnabled = useFlag("payments_enabled");
  const revampPaymentsOn = useFlag("cv_revamp_payments");
  const betaMode = useFlag("beta_mode");

  // Form input states
  const [currentJob, setCurrentJob] = useState("");
  const [targetJob, setTargetJob] = useState("");
  const [focus, setFocus] = useState<string[]>([]);
  const [otherText, setOtherText] = useState("");

  // Unique Request ID generated on load to structure uploads
  const [requestId] = useState(() => crypto.randomUUID());
  const [forceNew, setForceNew] = useState(false);

  // Structured Upload files
  const [cvPath, setCvPath] = useState<string | null>(null);
  const [cvFilename, setCvFilename] = useState<string | null>(null);
  const [newCvFile, setNewCvFile] = useState<File | null>(null);

  const [academicFiles, setAcademicFiles] = useState<File[]>([]);
  const [certificationsFiles, setCertificationsFiles] = useState<File[]>([]);
  const [licensesFiles, setLicensesFiles] = useState<File[]>([]);
  const [referencesFiles, setReferencesFiles] = useState<File[]>([]);

  // Submitting state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [paymentStep, setPaymentStep] = useState<"none" | "select" | "confirm">(revampPaymentsOn ? "select" : "none");
  const [revampLevel, setRevampLevel] = useState<"entry" | "mid" | "senior" | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<{ status: string; level: string | null; amount: number | null }>({ status: "skipped_beta", level: null, amount: null });

  // Active request tracking states
  const [latestId, setLatestId] = useState<string | null>(null);
  const [latestStatus, setLatestStatus] = useState<string | null>(null);
  const [latestStep, setLatestStep] = useState<number>(0);
  const [latestNotes, setLatestNotes] = useState<string | null>(null);
  const [latestAttachmentPaths, setLatestAttachmentPaths] = useState<string[]>([]);
  const [latestAdditionalPaths, setLatestAdditionalPaths] = useState<string[]>([]);
  const [deliveredCvPath, setDeliveredCvPath] = useState<string | null>(null);
  const [deliveredCvFilename, setDeliveredCvFilename] = useState<string | null>(null);
  const [requestedDocs, setRequestedDocs] = useState<string[]>([]);
  const [additionalMap, setAdditionalMap] = useState<Record<string, string | null>>({});
  const [activePlaceholderLabel, setActivePlaceholderLabel] = useState<string | null>(null);

  const [uploadingDoc, setUploadingDoc] = useState(false);
  const missingDocFileRef = useRef<HTMLInputElement>(null);

  const cvUploadRef = useRef<HTMLInputElement>(null);
  const academicUploadRef = useRef<HTMLInputElement>(null);
  const certificationsUploadRef = useRef<HTMLInputElement>(null);
  const licensesUploadRef = useRef<HTMLInputElement>(null);
  const referencesUploadRef = useRef<HTMLInputElement>(null);

  const loadLatest = async () => {
    if (!user) return;
    const { data }: any = await (supabase as any)
      .from("revamp_requests")
      .select("id, fulfilment_status, notes, attachment_paths, additional_attachment_paths, ai_debate_step, revamped_cv_path, revamped_cv_filename, requested_documents, additional_attachments_map")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setLatestId(data.id);
      setLatestStatus(data.fulfilment_status);
      setLatestStep(data.ai_debate_step || 0);
      setLatestNotes(data.notes);
      setLatestAttachmentPaths(data.attachment_paths || []);
      setLatestAdditionalPaths(data.additional_attachment_paths || []);
      setDeliveredCvPath(data.revamped_cv_path);
      setDeliveredCvFilename(data.revamped_cv_filename);
      setRequestedDocs(data.requested_documents || []);
      setAdditionalMap(data.additional_attachments_map || {});
    }
  };

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("current_job_title,cv_path,cv_filename").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.current_job_title) setCurrentJob(data.current_job_title);
        if (data?.cv_path) {
          setCvPath(data.cv_path);
          setCvFilename(data.cv_filename || "CV.pdf");
        }
      });
    loadLatest();
  }, [user]);

  // Real-time listener for debate loop status updates
  useEffect(() => {
    if (!user || !latestId) return;

    const channel = supabase
      .channel("revamp_status_updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "revamp_requests",
          filter: `id=eq.${latestId}`
        },
        (payload) => {
          const updated = payload.new as any;
          setLatestStatus(updated.fulfilment_status);
          setLatestStep(updated.ai_debate_step || 0);
          setLatestNotes(updated.notes);
          setDeliveredCvPath(updated.revamped_cv_path);
          setDeliveredCvFilename(updated.revamped_cv_filename);
          setRequestedDocs(updated.requested_documents || []);
          setAdditionalMap(updated.additional_attachments_map || {});
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, latestId]);

  useEffect(() => {
    if (revampPaymentsOn && paymentStep === "none" && !submitted) setPaymentStep("select");
  }, [revampPaymentsOn]);

  const toggleFocus = (f: string) =>
    setFocus((p) => p.includes(f) ? p.filter((x) => x !== f) : [...p, f]);

  const uploadFileToRevamp = async (file: File, subfolder: string): Promise<string> => {
    if (!user) throw new Error("Unauthorized");
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${user.id}/${requestId}/${subfolder}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("revamp-documents").upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
    if (upErr) throw upErr;
    return path;
  };

  const submit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      let finalCvPath = cvPath;

      // 1. Upload CV if a new one was selected
      if (newCvFile) {
        finalCvPath = await uploadFileToRevamp(newCvFile, "cv");
      } else if (cvPath) {
        // If reusing profile CV, copy it over to the revamp-documents bucket for unified packaging
        try {
          const { data: fileData, error: dlErr } = await supabase.storage.from("cvs").download(cvPath);
          if (dlErr) throw dlErr;
          const ext = cvFilename?.split(".").pop() || "pdf";
          const path = `${user.id}/${requestId}/cv/cv.${ext}`;
          
          let contentType = "application/pdf";
          if (ext === "doc") contentType = "application/msword";
          else if (ext === "docx") contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          
          const { error: upErr } = await supabase.storage.from("revamp-documents").upload(path, fileData, {
            contentType,
            upsert: true
          });
          if (upErr) throw upErr;
          finalCvPath = path;
        } catch (copyErr: any) {
          console.warn("Could not copy profile CV to revamp-documents bucket", copyErr);
          throw new Error("Could not copy profile CV: " + (copyErr?.message ?? copyErr));
        }
      }

      if (!finalCvPath) {
        throw new Error("Most recent CV is required. Please upload or set a CV on your profile.");
      }

      // 2. Upload supporting documents
      const paths: string[] = [];
      for (const f of academicFiles) {
        paths.push(await uploadFileToRevamp(f, "academic"));
      }
      for (const f of certificationsFiles) {
        paths.push(await uploadFileToRevamp(f, "certifications"));
      }
      for (const f of licensesFiles) {
        paths.push(await uploadFileToRevamp(f, "licenses"));
      }
      for (const f of referencesFiles) {
        paths.push(await uploadFileToRevamp(f, "references"));
      }

      // 3. Build notes
      const focusParts = [...focus];
      if (focus.includes("Other") && otherText.trim()) focusParts.push(otherText.trim());
      const notes = focusParts.join(", ").slice(0, 2000);

      // 4. Create the revamp request record
      const { error } = await supabase.from("revamp_requests").insert({
        id: requestId,
        user_id: user.id,
        current_job_title: currentJob || null,
        target_job_title: targetJob || null,
        notes: notes || null,
        cv_path: finalCvPath,
        attachment_paths: paths,
        payment_status: paymentInfo.status as any,
        revamp_level: paymentInfo.level,
        revamp_amount: paymentInfo.amount,
        fulfilment_status: "new",
      } as any);

      if (error) throw error;
      setSubmitted(true);
      loadLatest();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadMissingDoc = async (file: File) => {
    if (!user || !latestId || !activePlaceholderLabel) return;
    setUploadingDoc(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${user.id}/${latestId}/additional/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("revamp-documents").upload(path, file, {
        contentType: file.type || undefined, upsert: false,
      });
      if (upErr) throw upErr;

      const newMap = { ...additionalMap, [activePlaceholderLabel]: path };
      const newPaths = [...latestAdditionalPaths, path];

      const { error: updErr } = await supabase.from("revamp_requests").update({
        additional_attachments_map: newMap,
        additional_attachment_paths: newPaths,
      } as any).eq("id", latestId);
      if (updErr) throw updErr;

      toast.success(`Uploaded ${activePlaceholderLabel}`);
      setActivePlaceholderLabel(null);
      setLatestAdditionalPaths(newPaths);
      setAdditionalMap(newMap);
      loadLatest();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not upload document");
    } finally {
      setUploadingDoc(false);
    }
  };

  const submitDocsToCoachFromTracker = async () => {
    if (!user || !latestId) return;
    setUploadingDoc(true);
    try {
      const { error } = await supabase
        .from("revamp_requests")
        .update({
          fulfilment_status: "partner_reviewing"
        } as any)
        .eq("id", latestId);

      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: "admin",
        title: "Requested Documents Uploaded",
        body: `Candidate CVR-${latestId.substring(0,4).toUpperCase()} uploaded all requested files.`,
        type: "doc_uploaded"
      });

      toast.success("Documents submitted to your coach!");
      loadLatest();
    } catch (e: any) {
      toast.error(e?.message ?? "Submission failed");
    } finally {
      setUploadingDoc(false);
    }
  };

  const downloadDeliveredCv = async () => {
    if (!deliveredCvPath) return;
    const { data, error } = await supabase.storage.from("delivered-cvs").createSignedUrl(deliveredCvPath, 120);
    if (error || !data) {
      toast.error("Could not generate download link");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const useAsMainCV = async () => {
    if (!user || !deliveredCvPath) return;
    setSubmitting(true);
    try {
      // 1. Find matching cv_version if any
      const { data: versions }: any = await (supabase as any)
        .from("cv_versions")
        .select("id")
        .eq("storage_path", deliveredCvPath)
        .limit(1);

      const versionId = versions?.[0]?.id;
      if (versionId) {
        // Toggle is_main on cv_versions
        await (supabase as any).from("cv_versions").update({ is_main: false } as any).eq("user_id", user.id);
        await (supabase as any).from("cv_versions").update({ is_main: true } as any).eq("id", versionId);
      }

      // 2. Set profile active CV
      await supabase.from("profiles").update({
        cv_path: deliveredCvPath,
        cv_filename: deliveredCvFilename ?? "Delivered_CV.pdf"
      }).eq("id", user.id);

      toast.success("Revamped CV set as your main profile CV!");
    } catch (e: any) {
      toast.error("Could not set as main CV: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Choose Package Pages
  if (revampPaymentsOn && paymentStep === "select") {
    return (
      <div className="flex-1 flex flex-col bg-background p-6 overflow-y-auto">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center self-start" type="button">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="mt-4 text-2xl font-bold">Choose your level</h1>
        <p className="text-sm text-muted-foreground mt-1">Pick the package that matches your experience.</p>
        <div className="mt-6 space-y-3 pb-8">
          <button onClick={() => { setRevampLevel("entry"); setPaymentStep("confirm"); }}
            className="w-full text-left bg-card border border-border rounded-2xl p-5 hover:border-primary transition-colors" type="button">
            <div className="flex items-center justify-between"><p className="font-bold">Entry Level</p><p className="font-bold text-primary">P150</p></div>
            <p className="text-xs text-muted-foreground mt-1">For candidates with 0-3 years experience</p>
          </button>
          <button onClick={() => { setRevampLevel("mid"); setPaymentStep("confirm"); }}
            className="w-full text-left bg-card border border-border rounded-2xl p-5 hover:border-primary transition-colors" type="button">
            <div className="flex items-center justify-between"><p className="font-bold">Mid Level</p><p className="font-bold text-primary">P200</p></div>
            <p className="text-xs text-muted-foreground mt-1">For candidates with 4-9 years experience</p>
          </button>
          <button onClick={() => { setRevampLevel("senior"); setPaymentStep("confirm"); }}
            className="w-full text-left bg-card border border-border rounded-2xl p-5 hover:border-primary transition-colors" type="button">
            <div className="flex items-center justify-between"><p className="font-bold">Senior Level</p><p className="font-bold text-primary">P300</p></div>
            <p className="text-xs text-muted-foreground mt-1">For professionals with 10+ years experience</p>
          </button>
        </div>
      </div>
    );
  }

  if (revampPaymentsOn && paymentStep === "confirm" && revampLevel) {
    const amount = revampLevel === "entry" ? 150 : revampLevel === "mid" ? 200 : 300;
    const proceed = (status: "paid" | "skipped_beta") => {
      setPaymentInfo({ status, level: revampLevel, amount });
      setPaymentStep("none");
      toast.success("Payment confirmed — complete your request below");
    };
    return (
      <div className="flex-1 flex flex-col bg-background p-6 overflow-y-auto">
        <button onClick={() => setPaymentStep("select")} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center self-start" type="button">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <CreditCard className="w-10 h-10 text-primary" />
          </div>
          <p className="text-sm uppercase tracking-wider text-muted-foreground">{revampLevel === "entry" ? "Entry Level" : revampLevel === "mid" ? "Mid Level" : "Senior Level"}</p>
          <p className="text-4xl font-bold mt-1">P{amount}</p>
          <p className="text-xs text-muted-foreground mt-2 max-w-xs">Mock payment — payment gateway coming soon</p>
          <Button onClick={() => proceed("paid")} className="mt-6 w-full max-w-xs h-12 bg-forest hover:bg-forest/90 rounded-xl" type="button">
            Confirm & Pay P{amount}
          </Button>
          <button onClick={() => proceed("skipped_beta")} className="mt-3 text-xs text-muted-foreground" type="button">Skip payment (beta)</button>
        </div>
      </div>
    );
  }

  // If the request has been submitted but not yet activated by the coach
  const showPendingScreen = !forceNew && latestStatus && ["new", "pending", "paid"].includes(latestStatus);

  if (showPendingScreen) {
    return (
      <div className="flex-1 bg-background p-6 overflow-y-auto flex flex-col animate-fade-in">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center self-start mb-6" type="button">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 max-w-sm w-full mx-auto flex flex-col justify-center items-center pb-8 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-white">Request Received</h2>
          
          <div className="mt-4 px-4 py-2.5 bg-primary/10 border border-primary/20 rounded-xl inline-block">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Your Request ID</p>
            <p className="text-lg font-bold text-primary font-mono">CVR-{latestId?.substring(0, 4).toUpperCase()}</p>
          </div>
          
          <p className="text-xs text-muted-foreground mt-4 max-w-xs leading-relaxed">
            Your CV and supporting documents have been submitted to our coach console.
          </p>
          <p className="text-xs text-primary font-medium mt-3 bg-primary/5 border border-primary/20 px-4 py-2 rounded-2xl">
            Status: Awaiting Coach Review
          </p>
          <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed max-w-xs">
            A partner coach will review your documents shortly to begin drafting your revamped CV. You will be able to track the drafting progress here!
          </p>
          <Button onClick={() => loadLatest()} className="mt-8 bg-forest hover:bg-forest/90 rounded-xl text-xs h-10 px-6 font-bold" type="button">
            Check Updates
          </Button>
        </div>
      </div>
    );
  }

  // AI Stepper Screen while revamp is processing/underway
  const showProgressStepper = !forceNew && latestStatus && ["assigned", "ai_processing", "ai_complete", "partner_reviewing", "docs_requested"].includes(latestStatus);

  if (showProgressStepper) {
    const stepsData = [
      { step: 1, label: "Uploading original CV to drafting system" },
      { step: 2, label: "ATS compliance evaluation in progress" },
      { step: 3, label: "Evaluating narrative style and impact" },
      { step: 4, label: "Compiling panel expert review notes" },
      { step: 5, label: "Senior CV writer drafting your new CV" },
      { step: 6, label: "Proofreading and formatting checks" },
      { step: 7, label: "With your coach for final polish" }
    ];

    // Determine step indices based on status
    let activeStep = 1;
    if (latestStatus === "ai_processing") {
      activeStep = latestStep || 1;
    } else if (latestStatus === "ai_complete" || latestStatus === "partner_reviewing" || latestStatus === "docs_requested") {
      activeStep = 7;
    } else if (latestStatus === "assigned") {
      activeStep = 1;
    }

    // Rough estimated time remaining
    const getEstTime = () => {
      if (activeStep <= 1) return "Estimated time: 2 mins";
      if (activeStep <= 3) return "Estimated time: 1.5 mins";
      if (activeStep <= 5) return "Estimated time: 45 secs";
      if (activeStep === 6) return "Estimated time: 15 secs";
      return "CV is complete! Awaiting coach check-off.";
    };

    return (
      <div className="flex-1 bg-background p-6 overflow-y-auto flex flex-col">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center self-start mb-6">
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 max-w-sm w-full mx-auto flex flex-col justify-center items-center pb-8">
          <div className="relative w-28 h-28 mb-4">
            <div className="absolute inset-1 rounded-full border border-success/20 animate-ping" />
            <img
              src={mascot}
              alt="Teemane mascot"
              className="w-full h-full object-contain animate-bob drop-shadow-[0_0_12px_rgba(130,200,80,0.4)]"
            />
          </div>

          <h2 className="text-xl font-bold text-white text-center">AI Debate Panel Active</h2>
          <p className="text-xs text-muted-foreground text-center mt-1.5 leading-relaxed">
            Teemane is running your CV through a strict Qwen ATS & Narrative review debate loop.
          </p>

          <p className="text-[11px] font-semibold text-primary mt-3 bg-primary/10 border border-primary/20 px-3.5 py-1.5 rounded-full">
            {getEstTime()}
          </p>

          {/* Stepper Steps */}
          <div className="mt-8 space-y-3.5 w-full bg-card border border-border p-5 rounded-3xl shadow-card">
            {stepsData.map((s) => {
              const done = s.step < activeStep;
              const current = s.step === activeStep;

              return (
                <div key={s.step} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                    done ? "bg-success text-success-foreground" : current ? "bg-primary text-primary-foreground animate-pulse" : "bg-white/5 text-muted-foreground border border-white/10"
                  }`}>
                    {done ? <Check className="w-3 h-3" /> : s.step}
                  </div>
                  <span className={`text-xs ${current ? "text-white font-bold" : done ? "text-white/80" : "text-muted-foreground"}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Coach Documents Request Overlay */}
          {latestStatus && latestStatus === "docs_requested" && requestedDocs && requestedDocs.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-5 mt-5 text-left w-full flex flex-col gap-3">
              <h3 className="text-sm font-bold text-amber-500 flex items-center gap-2">
                <Paperclip className="w-4 h-4" /> Coach requested missing files
              </h3>
              {(() => {
                const coachMsg = additionalMap?.__coach_message || latestNotes;
                return coachMsg ? (
                  <p className="text-xs text-amber-500/80 whitespace-pre-wrap leading-relaxed mb-2">{coachMsg}</p>
                ) : null;
              })()}
              
              <div className="space-y-2 w-full">
                {requestedDocs.map((label: string) => {
                  const path = additionalMap?.[label];
                  return (
                    <div key={label} className="flex items-center justify-between bg-black/20 border border-amber-500/20 p-3 rounded-2xl">
                      <div className="flex-1 min-w-0 pr-3">
                        <p className="text-xs font-semibold text-white truncate">{label}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {path ? `Uploaded: ${path.split("/").pop()}` : "Awaiting your upload"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={path ? "outline" : "default"}
                        disabled={uploadingDoc}
                        onClick={() => {
                          setActivePlaceholderLabel(label);
                          missingDocFileRef.current?.click();
                        }}
                        className={`rounded-lg h-8 text-[10px] shrink-0 ${!path ? "bg-amber-500 hover:bg-amber-600 text-black font-bold" : "border-white/10 text-white"}`}
                      >
                        {path ? "Replace" : "Upload"}
                      </Button>
                    </div>
                  );
                })}
              </div>

              {(() => {
                const allDone = requestedDocs.every((lbl: string) => additionalMap?.[lbl]);
                return (
                  <Button
                    onClick={submitDocsToCoachFromTracker}
                    disabled={uploadingDoc || !allDone}
                    className="w-full bg-forest hover:bg-forest/90 text-white rounded-xl h-11 text-xs font-bold mt-2"
                  >
                    {uploadingDoc ? "Submitting..." : "Submit Documents to Coach"}
                  </Button>
                );
              })()}

              <input 
                ref={missingDocFileRef} 
                type="file" 
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadMissingDoc(f);
                  e.target.value = "";
                }} 
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Completed CV Revamp View
  if (!forceNew && (latestStatus === "completed" || latestStatus === "delivered")) {
    return (
      <div className="flex-1 bg-background p-6 overflow-y-auto flex flex-col animate-fade-in">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center self-start mb-6" type="button">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 max-w-sm w-full mx-auto flex flex-col justify-center items-center pb-8 text-center">
          <div className="w-20 h-20 rounded-full bg-success/15 flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10 text-success" />
          </div>
          <h2 className="text-2xl font-bold text-white">CV Revamp Completed!</h2>
          <p className="text-xs text-muted-foreground mt-2 max-w-xs leading-relaxed">
            Our experts and AI panel have finalized your new professional CV.
          </p>

          <div className="mt-8 p-5 bg-card border border-border rounded-3xl w-full text-left space-y-4 shadow-card">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{deliveredCvFilename || "Revamped_CV.pdf"}</p>
                <p className="text-[10px] text-muted-foreground">Ready to download and use</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={downloadDeliveredCv} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl text-xs flex items-center justify-center gap-2" type="button">
                <Download className="w-4 h-4" /> Download Revamped CV
              </Button>
              <Button onClick={useAsMainCV} disabled={submitting} className="w-full bg-forest hover:bg-forest/90 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2" type="button">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Use as Main Profile CV
              </Button>
            </div>
          </div>

          <button onClick={() => setForceNew(true)} className="text-xs text-muted-foreground underline underline-offset-2 mt-6" type="button">
            Need another revamp? Start a new request
          </button>
        </div>
      </div>
    );
  }

  // Already Submitted/Finished state
  if (submitted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-background">
        <div className="w-20 h-20 rounded-full bg-success/15 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-success" />
        </div>
        <h2 className="mt-6 text-2xl font-bold">Request received</h2>
        <div className="mt-3 px-4 py-2 bg-primary/10 border border-primary/20 rounded-xl">
          <p className="text-xs text-muted-foreground">Your Request ID</p>
          <p className="text-lg font-bold text-primary font-mono">CVR-{requestId.substring(0, 4).toUpperCase()}</p>
        </div>
        <p className="mt-4 text-sm text-muted-foreground max-w-xs leading-relaxed">
          Your CV is now in the queue for the Qwen AI debate panel. Teemane will start analyzing shortly!
        </p>
        <Button onClick={() => loadLatest()} className="mt-8 bg-forest hover:bg-forest/90 rounded-xl">
          Track Progress
        </Button>
      </div>
    );
  }

  // Submission Form Screen
  return (
    <div className="h-full flex-1 flex flex-col bg-background overflow-hidden">
      <div className="p-6 pb-3 shrink-0">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>

      <div className="px-6 flex-1 overflow-y-auto pb-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Gem className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">CV Revamp</h1>
            <p className="text-xs text-muted-foreground">3-Model Qwen Debate & Coach review</p>
          </div>
        </div>

        {betaMode && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 text-xs text-warning-foreground">
            <strong>Beta Mode:</strong> CV revamp and AI processing are active. Pricing is bypassed.
          </div>
        )}

        <div className="space-y-3">
          <div>
            <Label htmlFor="current">Current role (optional)</Label>
            <Input id="current" value={currentJob} onChange={(e) => setCurrentJob(e.target.value)} placeholder="e.g. Junior Accountant" maxLength={120} />
          </div>
          <div>
            <Label htmlFor="target">Target role</Label>
            <Input id="target" value={targetJob} onChange={(e) => setTargetJob(e.target.value)} placeholder="e.g. Finance Manager" maxLength={120} />
          </div>
        </div>

        <div>
          <Label className="mb-2 block">What should we focus on?</Label>
          <div className="flex flex-wrap gap-2">
            {FOCUS_OPTIONS.map((f) => {
              const selected = focus.includes(f);
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleFocus(f)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    selected ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground"
                  }`}
                >
                  {f}
                </button>
              );
            })}
          </div>
          {focus.includes("Other") && (
            <Input
              className="mt-2"
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder="Tell the coach what to focus on"
              maxLength={300}
            />
          )}
        </div>

        {/* STRUCTURED UPLOAD SLOTS GRID */}
        <div className="space-y-3.5">
          <Label className="block">Upload Supporting Documents</Label>
          <p className="text-[11px] text-muted-foreground leading-relaxed -mt-1.5">
            Provide academic credentials and certifications. The Qwen AI debate models parse files to verify and enrich your CV experience.
          </p>

          <div className="space-y-2.5">
            {/* Slot 1: CV */}
            <div className="bg-card border border-border p-4 rounded-2xl flex items-center justify-between shadow-soft">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white">Most Recent CV (Required)</p>
                  <p className="text-[10px] text-muted-foreground truncate max-w-[170px]">
                    {newCvFile ? newCvFile.name : cvFilename ? `${cvFilename} (Profile CV)` : "Select PDF/Word CV"}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => cvUploadRef.current?.click()} className="h-8 text-xs rounded-lg" type="button">
                {newCvFile || cvPath ? "Replace" : "Upload"}
              </Button>
              <input ref={cvUploadRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => setNewCvFile(e.target.files?.[0] || null)} />
            </div>

            {/* Slot 2: Academic Certificates */}
            <div className="bg-card border border-border p-4 rounded-2xl flex items-center justify-between shadow-soft">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white">Academic Certificates (Optional)</p>
                  <p className="text-[10px] text-muted-foreground truncate max-w-[170px]">
                    {academicFiles.length > 0 ? `${academicFiles.length} file(s) attached` : "Diplomas, Degrees"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {academicFiles.length > 0 && <button onClick={() => setAcademicFiles([])} className="text-muted-foreground p-1" type="button"><X className="w-3.5 h-3.5" /></button>}
                <Button size="sm" variant="outline" onClick={() => academicUploadRef.current?.click()} className="h-8 text-xs rounded-lg" type="button">
                  Add
                </Button>
              </div>
              <input ref={academicUploadRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={(e) => setAcademicFiles(Array.from(e.target.files || []))} />
            </div>

            {/* Slot 3: Professional Certifications */}
            <div className="bg-card border border-border p-4 rounded-2xl flex items-center justify-between shadow-soft">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white">Professional Certs (Optional)</p>
                  <p className="text-[10px] text-muted-foreground truncate max-w-[170px]">
                    {certificationsFiles.length > 0 ? `${certificationsFiles.length} file(s) attached` : "BICA, short courses"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {certificationsFiles.length > 0 && <button onClick={() => setCertificationsFiles([])} className="text-muted-foreground p-1" type="button"><X className="w-3.5 h-3.5" /></button>}
                <Button size="sm" variant="outline" onClick={() => certificationsUploadRef.current?.click()} className="h-8 text-xs rounded-lg" type="button">
                  Add
                </Button>
              </div>
              <input ref={certificationsUploadRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={(e) => setCertificationsFiles(Array.from(e.target.files || []))} />
            </div>

            {/* Slot 4: Professional Licenses */}
            <div className="bg-card border border-border p-4 rounded-2xl flex items-center justify-between shadow-soft">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white">Licenses & Memberships (Optional)</p>
                  <p className="text-[10px] text-muted-foreground truncate max-w-[170px]">
                    {licensesFiles.length > 0 ? `${licensesFiles.length} file(s) attached` : "Regulatory council letters"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {licensesFiles.length > 0 && <button onClick={() => setLicensesFiles([])} className="text-muted-foreground p-1" type="button"><X className="w-3.5 h-3.5" /></button>}
                <Button size="sm" variant="outline" onClick={() => licensesUploadRef.current?.click()} className="h-8 text-xs rounded-lg" type="button">
                  Add
                </Button>
              </div>
              <input ref={licensesUploadRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={(e) => setLicensesFiles(Array.from(e.target.files || []))} />
            </div>

            {/* Slot 5: References & ID */}
            <div className="bg-card border border-border p-4 rounded-2xl flex items-center justify-between shadow-soft">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white">References & ID (Optional)</p>
                  <p className="text-[10px] text-muted-foreground truncate max-w-[170px]">
                    {referencesFiles.length > 0 ? `${referencesFiles.length} file(s) attached` : "Omang ID, driver's license"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {referencesFiles.length > 0 && <button onClick={() => setReferencesFiles([])} className="text-muted-foreground p-1" type="button"><X className="w-3.5 h-3.5" /></button>}
                <Button size="sm" variant="outline" onClick={() => referencesUploadRef.current?.click()} className="h-8 text-xs rounded-lg" type="button">
                  Add
                </Button>
              </div>
              <input ref={referencesUploadRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={(e) => setReferencesFiles(Array.from(e.target.files || []))} />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Service fee</span>
            </div>
            <span className="font-bold">BWP {paymentInfo.amount || PRICE_BWP}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {paymentsEnabled
              ? "You'll be charged once your request is accepted."
              : "During beta, requests are free and processed immediately."}
          </p>
        </div>
      </div>

      <div className="p-6 pt-3 border-t border-border bg-card shrink-0">
        <Button onClick={submit} disabled={submitting || (!cvPath && !newCvFile)} className="w-full h-12 bg-forest hover:bg-forest/90 rounded-xl font-semibold" type="button">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (paymentsEnabled && paymentStep !== "none") ? "Continue to payment" : "Submit request"}
        </Button>
      </div>
    </div>
  );
};

export default CVRevamp;
