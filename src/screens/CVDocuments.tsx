import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, Trash2, Plus, Gem, RefreshCw, Upload, Download } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const DOCUMENT_TYPES = [
  "Academic Certificate",
  "Professional Certificate",
  "Reference Letter",
  "National ID",
  "Passport",
  "Transcript",
  "Other",
];

type Doc = {
  id: string;
  label: string;
  filename: string;
  storage_path: string;
  mime_type: string | null;
  created_at: string;
};

const CVDocuments = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [latestScore, setLatestScore] = useState<number | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [cvVersions, setCvVersions] = useState<any[]>([]);
  const [activeRevamp, setActiveRevamp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [docLabel, setDocLabel] = useState("Academic Certificate");
  const [uploadingDocLabel, setUploadingDocLabel] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cvReplaceRef = useRef<HTMLInputElement>(null);
  const placeholderFileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    if (!user) return;
    const [{ data: prof }, { data: scoreRow }, { data: docsRows }, { data: versionsRows }, { data: activeRevampData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("cv_analyses").select("score").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("application_documents").select("id,label,filename,storage_path,mime_type,created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      (supabase as any).from("cv_versions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("revamp_requests").select("*").eq("user_id", user.id).neq("fulfilment_status", "completed").neq("fulfilment_status", "delivered").neq("fulfilment_status", "cancelled").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setProfile(prof);
    setLatestScore((scoreRow as any)?.score ?? null);
    setDocs((docsRows ?? []) as Doc[]);
    setCvVersions(versionsRows ?? []);
    setActiveRevamp(activeRevampData);
    setLoading(false);
    if (!prof?.cv_path && !activeRevampData) navigate("/upload-cv", { replace: true });
  };

  useEffect(() => {
    refresh();

    if (!user) return;

    const channel = supabase
      .channel("candidate-cv-documents-revamp")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "revamp_requests",
          filter: `user_id=eq.${user.id}`
        },
        () => {
          refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const replaceCv = async (file: File) => {
    if (!user) return;
    setBusy(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/cv.${ext}`;
      const { error: upErr } = await supabase.storage.from("cvs").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      await supabase.from("profiles").update({ cv_path: path, cv_filename: file.name }).eq("id", user.id);
      toast.success("CV updated");
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Upload failed"); }
    finally { setBusy(false); }
  };

  const addDoc = async (file: File) => {
    if (!user) return;
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("app-docs").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { error: insErr = null } = await supabase.from("application_documents").insert({
        user_id: user.id,
        label: docLabel,
        filename: file.name,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
      });
      if (insErr) throw insErr;
      toast.success("Document added");
      setAddOpen(false);
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Upload failed"); }
    finally { setBusy(false); }
  };

  const handleUploadPlaceholderDoc = async (file: File) => {
    if (!user || !activeRevamp || !uploadingDocLabel) return;
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${user.id}/${activeRevamp.id}/additional/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("revamp-documents").upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (upErr) throw upErr;

      const currentMap = activeRevamp.additional_attachments_map || {};
      const newMap = { ...currentMap, [uploadingDocLabel]: path };
      
      const currentPaths = activeRevamp.additional_attachment_paths || [];
      const newPaths = [...currentPaths, path];

      const { error: updErr } = await supabase
        .from("revamp_requests")
        .update({
          additional_attachments_map: newMap,
          additional_attachment_paths: newPaths,
        } as any)
        .eq("id", activeRevamp.id);
      
      if (updErr) throw updErr;

      toast.success(`Uploaded ${uploadingDocLabel}`);
      setUploadingDocLabel(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const submitDocsToCoach = async () => {
    if (!user || !activeRevamp) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("revamp_requests")
        .update({
          fulfilment_status: "partner_reviewing"
        } as any)
        .eq("id", activeRevamp.id);

      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: "admin",
        title: "Requested Documents Uploaded",
        body: `Candidate CVR-${activeRevamp.id.substring(0,4).toUpperCase()} uploaded all requested files.`,
        type: "doc_uploaded"
      });

      toast.success("Documents submitted to your coach!");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Submission failed");
    } finally {
      setBusy(false);
    }
  };

  const removeDoc = async (d: Doc) => {
    if (!user) return;
    await supabase.storage.from("app-docs").remove([d.storage_path]);
    await supabase.from("application_documents").delete().eq("id", d.id).eq("user_id", user.id);
    setDocs((p) => p.filter((x) => x.id !== d.id));
  };

  const downloadCvVersion = async (cv: any) => {
    const bucket = cv.storage_path.includes("revamped") || cv.storage_path.includes("delivered") ? "delivered-cvs" : "cvs";
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(cv.storage_path, 120);
    if (error || !data) { toast.error("Could not generate download link"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const useRevampedAsMain = async (cv: any) => {
    if (!user) return;
    setBusy(true);
    try {
      await (supabase as any).from("cv_versions").update({ is_main: false } as any).eq("user_id", user.id);
      await (supabase as any).from("cv_versions").update({ is_main: true } as any).eq("id", cv.id);

      const { error } = await supabase.from("profiles").update({
        cv_path: cv.storage_path,
        cv_filename: cv.filename,
      }).eq("id", user.id);

      if (error) throw error;
      toast.success("Revamped CV set as your main CV");
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="flex-1 flex flex-col bg-background overflow-y-auto">
      <div className="p-5 flex items-center gap-3 border-b border-border">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-bold">CV & Documents</h1>
      </div>

      {activeRevamp && (
        <section className="p-5 pb-2 space-y-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Gem className="w-3.5 h-3.5 text-primary" /> Active CV Revamp Request
          </p>
          <div className="bg-[#0e1218] border border-white/5 rounded-3xl p-5 shadow-soft space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-mono font-semibold">Request ID</p>
                <p className="text-sm font-bold text-white font-mono">CVR-{activeRevamp.id.substring(0, 4).toUpperCase()}</p>
              </div>
              <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                activeRevamp.fulfilment_status === "docs_requested"
                  ? "bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse"
                  : ["assigned", "ai_processing"].includes(activeRevamp.fulfilment_status)
                  ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                  : "bg-primary/10 text-primary border-primary/20"
              }`}>
                {activeRevamp.fulfilment_status === "docs_requested"
                  ? "Action Required"
                  : ["assigned", "ai_processing"].includes(activeRevamp.fulfilment_status)
                  ? "Drafting & Review"
                  : ["ai_complete", "partner_reviewing"].includes(activeRevamp.fulfilment_status)
                  ? "Coach Reviewing"
                  : "Awaiting Coach Review"}
              </span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {activeRevamp.fulfilment_status === "docs_requested"
                ? "Your coach has requested some additional files to finish your CV revamp. Please upload them below."
                : ["assigned", "ai_processing"].includes(activeRevamp.fulfilment_status)
                ? "Our review panel is evaluating your CV and drafting structural improvements. You can track this process step-by-step!"
                : ["ai_complete", "partner_reviewing"].includes(activeRevamp.fulfilment_status)
                ? "The initial review is complete! Your coach is now editing and polishing the final layout before sending it to you."
                : "Your revamp request was received. A coach will review your original documents shortly to begin drafting your CV."}
            </p>

            {activeRevamp.fulfilment_status === "docs_requested" && (activeRevamp.additional_attachments_map?.__coach_message || activeRevamp.notes) && (
              <div className="text-xs text-amber-500/80 bg-amber-500/5 border border-amber-500/10 p-3 rounded-2xl whitespace-pre-wrap leading-relaxed">
                <span className="font-bold text-amber-500 block mb-1">Coach Note:</span>
                {activeRevamp.additional_attachments_map?.__coach_message || activeRevamp.notes}
              </div>
            )}

            {["assigned", "ai_processing"].includes(activeRevamp.fulfilment_status) && (
              <Button onClick={() => navigate("/cv-revamp")} className="w-full bg-forest hover:bg-forest/90 text-white rounded-xl h-10 text-xs font-bold">
                Track Drafting Progress →
              </Button>
            )}

            {activeRevamp.fulfilment_status === "docs_requested" && activeRevamp.requested_documents && activeRevamp.requested_documents.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-white/5">
                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Requested Documents</p>
                <div className="space-y-2">
                  {activeRevamp.requested_documents.map((label: string) => {
                    const path = activeRevamp.additional_attachments_map?.[label];
                    return (
                      <div key={label} className="flex items-center justify-between bg-white/[0.01] border border-white/5 p-3 rounded-2xl">
                        <div className="flex-1 min-w-0 pr-3">
                          <p className="text-xs font-semibold text-white truncate">{label}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {path ? `Uploaded: ${path.split("/").pop()}` : "Awaiting your upload"}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant={path ? "outline" : "default"}
                          disabled={busy}
                          onClick={() => {
                            setUploadingDocLabel(label);
                            placeholderFileRef.current?.click();
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
                  const allDone = activeRevamp.requested_documents.every(
                    (lbl: string) => activeRevamp.additional_attachments_map?.[lbl]
                  );
                  return (
                    <Button
                      onClick={submitDocsToCoach}
                      disabled={busy || !allDone}
                      className="w-full bg-forest hover:bg-forest/90 text-white rounded-xl h-11 text-xs font-bold mt-2"
                    >
                      {busy ? "Submitting..." : "Submit Documents to Coach"}
                    </Button>
                  );
                })()}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="p-5 space-y-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">My CV</p>
        <div className="bg-card rounded-2xl p-4 shadow-soft">
          {profile?.cv_path ? (
            <>
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-primary mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{profile.cv_filename ?? "CV.pdf"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Uploaded {profile.cv_uploaded_at ? new Date(profile.cv_uploaded_at).toLocaleDateString() : "—"}
                  </p>
                  {latestScore != null && (
                    <p className="text-[11px] mt-1">Latest ATS score: <span className="font-bold text-primary">{latestScore}%</span></p>
                  )}
                </div>
              </div>
              <input ref={cvReplaceRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) replaceCv(f); }} />
              <div className="grid grid-cols-2 gap-2 mt-4">
                <Button variant="outline" disabled={busy} onClick={() => cvReplaceRef.current?.click()} className="rounded-xl h-10 text-xs">
                  <Upload className="w-3.5 h-3.5 mr-1" /> Replace
                </Button>
                <Button onClick={() => navigate("/cv-score")} className="rounded-xl h-10 text-xs bg-primary hover:bg-primary/90">
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Rescore
                </Button>
                <Button onClick={() => navigate("/cv-revamp")} className="col-span-2 rounded-xl h-10 text-xs bg-forest hover:bg-forest/90">
                  <Gem className="w-3.5 h-3.5 mr-1" /> Go to CV Revamp
                </Button>
              </div>
            </>
          ) : (
            <Button onClick={() => navigate("/upload-cv")} className="w-full h-11 rounded-xl bg-forest hover:bg-forest/90">
              <Upload className="w-4 h-4 mr-2" /> Upload CV
            </Button>
          )}
        </div>
      </section>

      {cvVersions.length > 0 && (
        <section className="p-5 pt-0 space-y-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Revamped CV Versions</p>
          <div className="space-y-3">
            {cvVersions.map((cv) => {
              const isActive = profile?.cv_path === cv.storage_path;
              return (
                <div key={cv.id} className={`bg-card rounded-2xl p-4 shadow-soft border ${isActive ? 'border-primary/40' : 'border-border'}`}>
                  <div className="flex items-start gap-3">
                    <Gem className="w-5 h-5 text-success mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{cv.filename}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Delivered on {new Date(cv.created_at).toLocaleDateString()}
                      </p>
                      {cv.ai_score != null && (
                        <p className="text-[11px] mt-0.5">ATS Match Score: <span className="font-bold text-primary">{cv.ai_score}%</span></p>
                      )}
                    </div>
                    {isActive ? (
                      <span className="text-[10px] font-bold uppercase bg-primary/10 text-primary px-2.5 py-1 rounded-full">Active</span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase bg-success/15 text-success px-2 py-1 rounded-full">New</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <Button variant="outline" onClick={() => downloadCvVersion(cv)} className="rounded-xl h-10 text-xs">
                      <Download className="w-3.5 h-3.5 mr-1" /> Download
                    </Button>
                    <Button onClick={() => useRevampedAsMain(cv)} disabled={busy || isActive} className="rounded-xl h-10 text-xs bg-forest hover:bg-forest/90">
                      {isActive ? "In use" : "Use as main CV"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="p-5 pt-0 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Supporting Documents</p>
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} className="rounded-xl h-8 text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add
          </Button>
        </div>
        {docs.length === 0 ? (
          <div className="bg-card rounded-2xl p-4 text-sm text-muted-foreground text-center">
            No documents yet. Upload certificates, references and IDs once — they'll auto-attach to applications.
          </div>
        ) : (
          <div className="space-y-2">
            {docs.map((d) => (
              <div key={d.id} className="bg-card rounded-2xl p-3 flex items-center gap-3 shadow-soft">
                <FileText className="w-4 h-4 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{d.filename}</p>
                  <p className="text-[11px] text-muted-foreground">{d.label}</p>
                </div>
                <button onClick={() => removeDoc(d)} className="w-9 h-9 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Add Document</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Document type</Label>
              <Select value={docLabel} onValueChange={setDocLabel}>
                <SelectTrigger className="h-11 rounded-xl bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>{DOCUMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <input ref={fileRef} type="file" accept=".pdf,image/jpeg,image/png" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) addDoc(f); }} />
            <Button onClick={() => fileRef.current?.click()} disabled={busy} className="w-full h-11 bg-forest hover:bg-forest/90 rounded-xl">
              {busy ? "Uploading…" : "Choose file"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <input 
        ref={placeholderFileRef} 
        type="file" 
        className="hidden" 
        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" 
        onChange={(e) => { 
          const f = e.target.files?.[0]; 
          if (f) handleUploadPlaceholderDoc(f); 
          e.target.value = ""; 
        }} 
      />
    </div>
  );
};

export default CVDocuments;
