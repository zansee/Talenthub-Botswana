import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Check, Edit3, Sparkles, Paperclip, X, Mail } from "lucide-react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp, computeMatch } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Review = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { jobs, applications, upsertApplication } = useApp();
  if (isAdmin) return <Navigate to="/admin" replace />;
  const job = jobs.find((j) => j.id === id);
  const existing = applications.find((a) => a.job_id === id);

  const [profile, setProfile] = useState<any>(null);
  const [coverLetter, setCoverLetter] = useState(existing?.cover_letter ?? "");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [extras, setExtras] = useState<Array<{ file: File; label: string }>>([]);
  const [savedDocs, setSavedDocs] = useState<Array<{ id: string; label: string; storage_path: string; filename: string; mime_type: string | null }>>([]);
  const [includedSavedIds, setIncludedSavedIds] = useState<Set<string>>(new Set());
  const [mappedDocs, setMappedDocs] = useState<Record<string, string>>({});
  const extrasRef = useRef<HTMLInputElement>(null);
  const pendingDocLabelRef = useRef<string | null>(null);

  const isDocSatisfied = (reqDoc: string) => {
    const reqLower = reqDoc.trim().toLowerCase();
    
    // 1. Explicitly mapped saved doc
    const mappedId = mappedDocs[reqDoc];
    if (mappedId && includedSavedIds.has(mappedId)) return true;

    // 2. Newly uploaded extra file
    const hasExtra = extras.some((e) => e.label.trim().toLowerCase() === reqLower);
    if (hasExtra) return true;

    // 3. Re-usable saved doc with matching label
    const hasSaved = savedDocs.some(
      (d) => d.label.trim().toLowerCase() === reqLower && includedSavedIds.has(d.id)
    );
    if (hasSaved) return true;

    return false;
  };

  const getSatisfyingFilename = (reqDoc: string): string | null => {
    const reqLower = reqDoc.trim().toLowerCase();

    // 1. Explicitly mapped saved doc
    const mappedId = mappedDocs[reqDoc];
    if (mappedId && includedSavedIds.has(mappedId)) {
      const match = savedDocs.find((d) => d.id === mappedId);
      if (match) return match.filename;
    }

    // 2. Newly uploaded extra file
    const extraMatch = extras.find((e) => e.label.trim().toLowerCase() === reqLower);
    if (extraMatch) return extraMatch.file.name;

    // 3. Re-usable saved doc with matching label
    const savedMatch = savedDocs.find(
      (d) => d.label.trim().toLowerCase() === reqLower && includedSavedIds.has(d.id)
    );
    if (savedMatch) return savedMatch.filename;

    return null;
  };

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()
      .then(({ data }) => setProfile(data));
    supabase.from("application_documents")
      .select("id,label,storage_path,filename,mime_type")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const docs = (data ?? []) as any[];
        setSavedDocs(docs);
        // include all by default — they're reusable supporting docs
        setIncludedSavedIds(new Set(docs.map((d) => d.id)));
      });
  }, [user]);

  // Log job view for analytics
  useEffect(() => {
    if (!user || !job) return;
    
    const sessionKey = `viewed_${user.id}_${job.id}`;
    if (sessionStorage.getItem(sessionKey)) return;
    
    sessionStorage.setItem(sessionKey, "true");
    supabase.from("job_views").insert({ user_id: user.id, job_id: job.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, job?.id]);

  // Auto-generate AI cover letter once profile + job loaded and no existing letter
  useEffect(() => {
    if (!job || !profile || coverLetter || generating) return;
    generateLetter(profile, job);
  }, [job, profile]); // eslint-disable-line

  const generateLetter = async (p: any, j: any) => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-cover-letter", {
        body: { job: j, profile: p },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCoverLetter(data.coverLetter);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not generate cover letter — using a basic draft");
      const name = p.full_name || "[Your name]";
      setCoverLetter(`Dear Hiring Manager,\n\nI am writing to apply for the ${j.title} position at ${j.company}. ${p.current_job_title ? `As a ${p.current_job_title}, ` : ""}I bring relevant experience and a strong interest in ${j.industry}.\n\nKind regards,\n${name}`);
    } finally { setGenerating(false); }
  };

  if (!job) return <div className="p-6">Job not found</div>;
  const isSubmitted = existing?.status === "submitted";
  const match = computeMatch(job, profile);

  // ---------- PDF helpers ----------
  const wrap = (text: string, font: any, size: number, maxWidth: number): string[] => {
    const out: string[] = [];
    text.split("\n").forEach((para) => {
      if (!para.trim()) { out.push(""); return; }
      const words = para.split(" ");
      let line = "";
      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
          out.push(line); line = w;
        } else line = test;
      }
      if (line) out.push(line);
    });
    return out;
  };

  // Sentence case helper: "APPLICATION FOR THE POST OF SOFTWARE ENGINEER" -> "Application for the post of Software Engineer"
  const titleCase = (s: string) =>
    s.toLowerCase().replace(/\b\w/g, (c, i, str) => {
      // capitalise first letter; rest stays lowercase (sentence-style)
      return i === 0 ? c.toUpperCase() : c;
    });

  // Format raw postal address into separate lines.
  // Input examples:
  //   "P O Box 20308 Francistown"
  //   "P.O. Box 20308, Francistown"
  //   "Box 20308 Francistown"
  // Output: ["P O Box 20308", "Francistown"]
  const formatPostal = (raw: string): string[] => {
    const cleaned = raw.replace(/[,\n]+/g, " ").replace(/\s+/g, " ").trim();
    if (!cleaned) return [];
    // Match "(P O Box|P.O Box|PO Box|Box) <number>"
    const m = cleaned.match(/^((?:P\.?\s*O\.?\s*)?Box)\s+(\d+)\s*(.*)$/i);
    if (m) {
      const boxLine = `${m[1].replace(/\./g, "").replace(/\s+/g, " ").toUpperCase().replace("BOX", "Box")} ${m[2]}`.trim();
      const town = m[3].trim();
      return town ? [boxLine, town] : [boxLine];
    }
    // Fallback: split on multiple spaces or just return as a single line
    return cleaned.split(/\s{2,}/);
  };

  const coverLetterPdfBytes = async (): Promise<Uint8Array> => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const size = 11; const lh = 16; const margin = 60;
    let page = pdf.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    const maxW = width - margin * 2;
    let y = height - margin;

    const ensureRoom = () => {
      if (y < margin + lh) { page = pdf.addPage([595, 842]); y = height - margin; }
    };
    const draw = (text: string, opts: { bold?: boolean } = {}) => {
      const f = opts.bold ? bold : font;
      for (const line of wrap(text, f, size, maxW)) {
        ensureRoom();
        page.drawText(line, { x: margin, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
        y -= lh;
      }
    };
    const drawCentered = (text: string, opts: { bold?: boolean; underline?: boolean } = {}) => {
      const f = opts.bold ? bold : font;
      ensureRoom();
      const tw = f.widthOfTextAtSize(text, size);
      const x = (width - tw) / 2;
      page.drawText(text, { x, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
      if (opts.underline) {
        page.drawLine({
          start: { x, y: y - 2 }, end: { x: x + tw, y: y - 2 },
          thickness: 0.8, color: rgb(0.1, 0.1, 0.1),
        });
      }
      y -= lh;
    };
    const blank = () => { y -= lh; };

    // 1. Sender postal address (multi-line; NO location line in between)
    const postalLines = formatPostal(profile?.postal_address ?? "");
    postalLines.forEach((l) => draw(l));
    blank();

    // 2. Date
    draw(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }));
    blank();

    // 3. Recipient (hiring contact)
    if (job.hiring_contact_name) {
      draw(job.hiring_contact_name);
      if (job.hiring_contact_title) draw(job.hiring_contact_title);
    }
    draw(job.company);
    draw(job.location);
    blank();

    // 4. Salutation
    const salutation = job.hiring_contact_name ? `Dear ${job.hiring_contact_name},` : "Dear Sir/Madam,";
    draw(salutation);
    blank();

    // 5. RE line — centered, bold, underlined, ALL CAPS
    drawCentered(`RE: APPLICATION FOR THE POST OF ${job.title.toUpperCase()}`, { bold: true, underline: true });
    blank();

    // 6. Body
    coverLetter.split("\n").forEach((para) => {
      if (para.trim()) draw(para);
      else blank();
    });
    blank();

    // 7. Sign-off — name in normal case, not all caps
    draw("Yours faithfully,");
    blank();
    blank();
    draw(profile?.full_name ?? "", { bold: true });

    return await pdf.save();
  };

  const fetchCvPdf = async (): Promise<Uint8Array | null> => {
    if (!profile?.cv_path) return null;
    const { data, error } = await supabase.storage.from("cvs").download(profile.cv_path);
    if (error || !data) return null;
    const ext = profile.cv_path.split(".").pop()?.toLowerCase();
    if (ext !== "pdf") {
      toast.warning("CV must be PDF for merging. Re-upload as PDF for full merge.", { duration: 5000 });
      return null;
    }
    return new Uint8Array(await data.arrayBuffer());
  };

  const fileToPdf = async (file: File): Promise<Uint8Array | null> => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return new Uint8Array(await file.arrayBuffer());
    if (["png", "jpg", "jpeg"].includes(ext ?? "")) {
      const pdf = await PDFDocument.create();
      const bytes = new Uint8Array(await file.arrayBuffer());
      const img = ext === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      const page = pdf.addPage([595, 842]);
      const scale = Math.min((595 - 80) / img.width, (842 - 80) / img.height);
      page.drawImage(img, {
        x: (595 - img.width * scale) / 2,
        y: (842 - img.height * scale) / 2,
        width: img.width * scale, height: img.height * scale,
      });
      return await pdf.save();
    }
    toast.warning(`${file.name} skipped — convert DOC/DOCX to PDF first.`, { duration: 5000 });
    return null;
  };

  const mergePdfs = async (pdfs: Uint8Array[]): Promise<Uint8Array> => {
    const merged = await PDFDocument.create();
    for (const bytes of pdfs) {
      const src = await PDFDocument.load(bytes);
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    }
    return await merged.save();
  };

  const fetchSavedDocPdf = async (storage_path: string): Promise<Uint8Array | null> => {
    const { data, error } = await supabase.storage.from("app-docs").download(storage_path);
    if (error || !data) return null;
    const ext = storage_path.split(".").pop()?.toLowerCase();
    const file = new File([data], storage_path.split("/").pop() ?? "doc", { type: data.type || "application/octet-stream" });
    if (ext === "pdf") return new Uint8Array(await file.arrayBuffer());
    return await fileToPdf(file);
  };

  const persistNewExtras = async () => {
    if (!user || extras.length === 0) return;
    for (const e of extras) {
      const ext = e.file.name.split(".").pop() ?? "bin";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("app-docs").upload(path, e.file, {
        cacheControl: "3600", upsert: false, contentType: e.file.type || undefined,
      });
      if (upErr) { console.warn("save doc upload failed", upErr); continue; }
      const { data: row } = await supabase.from("application_documents").insert({
        user_id: user.id,
        label: e.label || e.file.name.replace(/\.[^.]+$/, ""),
        filename: e.file.name,
        storage_path: path,
        mime_type: e.file.type || null,
        size_bytes: e.file.size,
      }).select("id,label,storage_path,filename,mime_type").maybeSingle();
      if (row) {
        setSavedDocs((p) => [row as any, ...p]);
        setIncludedSavedIds((p) => new Set([...p, (row as any).id]));
      }
    }
  };

  const handleSend = async () => {
    const isCompanyJob = !!job.company_id;
    if (!isCompanyJob && !job.application_email) {
      toast.error("This job has no application email set.");
      return;
    }

    if (job.required_documents && job.required_documents.length > 0) {
      const unsatisfied = job.required_documents.filter(doc => !isDocSatisfied(doc));
      if (unsatisfied.length > 0) {
        toast.error(`Please upload the following required documents: ${unsatisfied.join(", ")}`);
        return;
      }
    }

    setBusy(true);
    try {
      // Persist new extras so the user doesn't re-upload next time
      await persistNewExtras();

      const parts: Uint8Array[] = [];
      parts.push(await coverLetterPdfBytes());
      const cv = await fetchCvPdf();
      if (cv) parts.push(cv);

      // New (in-memory) extras still in this session
      for (const e of extras) {
        const p = await fileToPdf(e.file);
        if (p) parts.push(p);
      }
      // Saved (re-usable) extras the user opted to include
      for (const doc of savedDocs) {
        if (!includedSavedIds.has(doc.id)) continue;
        const p = await fetchSavedDocPdf(doc.storage_path);
        if (p) parts.push(p);
      }

      const merged = await mergePdfs(parts);

      const safeName = (profile?.full_name ?? "Applicant").replace(/[^\w\s-]/g, "");
      const safeJob = job.title.replace(/[^\w\s-]/g, "");
      const filename = `Application for the post of ${safeJob}_${safeName}.pdf`;

      if (isCompanyJob) {
        if (!user) throw new Error("User session required");
        // Upload merged PDF directly to Supabase storage bucket 'application-docs'
        const storagePath = `applications/${job.id}/${user.id}_${Date.now()}.pdf`;
        const { error: upErr } = await supabase.storage
          .from("application-docs")
          .upload(storagePath, merged, {
            contentType: "application/pdf",
            cacheControl: "3600",
            upsert: true,
          });

        if (upErr) throw upErr;

        // Persist application status and the merged_pdf_path in database
        await upsertApplication(job.id, coverLetter, "submitted", storagePath);
        toast.success("Application submitted successfully directly to the employer!");
        setTimeout(() => navigate("/applications"), 1200);
        return;
      }

      // Trigger download of merged PDF
      const blob = new Blob([merged as BlobPart], { type: "application/pdf" });
      const gn = (window as any).gonative_file_writer_sharer;

    

      if (gn && gn.postMessage) {
        await new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(",")[1];
            const chunkSize = 700 * 1024;
            const id = Math.random().toString(36).substring(2);
            const nameWithoutExt = filename.replace(/\.pdf$/i, "");

          

            gn.postMessage(JSON.stringify({
  event: "fileStart",
  id,
  size: blob.size,
  type: "application/pdf",
  name: nameWithoutExt,
}));

let offset = 0;
const sendChunk = () => {
              if (offset >= base64.length) {
               
                gn.postMessage(JSON.stringify({ event: "fileEnd", id }));
                resolve();
                return;
              }
              const chunk = base64.slice(offset, offset + chunkSize);
              gn.postMessage(JSON.stringify({
                event: "fileChunk",
                id,
                data: "data:application/pdf;base64," + chunk,
              }));
              offset += chunkSize;
              setTimeout(sendChunk, 0);
            };
            setTimeout(sendChunk, 1500);
          };
          reader.readAsDataURL(blob);
        });
        // Wait 3s after chunks sent before navigating away
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        // Desktop browser fallback
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      await upsertApplication(job.id, coverLetter, "submitted");

      const totalExtras = extras.length + Array.from(includedSavedIds).length;
      const subject = `Application for the post of ${job.title} — ${profile?.full_name ?? ""}`.trim();
      const body = `Dear Hiring Manager,\n\nPlease find attached my application for the ${job.title} position at ${job.company}. The attached document includes my cover letter, CV${totalExtras ? ", and supporting documents" : ""}.\n\nKind regards,\n${profile?.full_name ?? ""}\n${profile?.phone ?? ""}\n${profile?.email ?? ""}`;
      const mailto = `mailto:${encodeURIComponent(job.application_email || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailto;
      toast.success("Document downloaded — attach it in your email app", { duration: 6000 });
      setTimeout(() => navigate("/applications"), 1200);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not prepare application");
    } finally { setBusy(false); }
  };

  const handleSaveDraft = async () => {
    setBusy(true);
    await upsertApplication(job.id, coverLetter, "draft");
    setBusy(false);
    toast.success("Draft saved");
  };

  const onPickExtras = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files)
      .filter((f) => f.size <= 10 * 1024 * 1024)
      .map((f) => ({
        file: f,
        label: pendingDocLabelRef.current || f.name.replace(/\.[^.]+$/, "")
      }));
    setExtras((p) => [...p, ...arr]);
    pendingDocLabelRef.current = null;
  };

  const removeSavedDoc = async (id: string, storage_path: string) => {
    if (!user) return;
    await supabase.storage.from("app-docs").remove([storage_path]);
    await supabase.from("application_documents").delete().eq("id", id).eq("user_id", user.id);
    setSavedDocs((p) => p.filter((d) => d.id !== id));
    setIncludedSavedIds((p) => { const n = new Set(p); n.delete(id); return n; });
  };

  return (
    <div className="flex-1 flex flex-col bg-background overflow-y-auto">
      <div className="p-5 flex items-center gap-3 border-b border-border">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-bold">Review & Apply</h1>
      </div>

      <div className="p-5 space-y-5">
        <div className="bg-card rounded-2xl p-4 shadow-soft">
          <p className="font-bold">{job.title}</p>
          <p className="text-sm text-muted-foreground">{job.company}</p>
          <p className="text-xs text-muted-foreground mt-1">{job.location}</p>
          <span className="inline-block mt-2 text-[11px] bg-primary/10 text-primary px-2 py-1 rounded-full font-semibold">{match}% Match</span>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> AI Cover Letter
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => profile && generateLetter(profile, job)}
                disabled={generating || !profile}
                className="text-xs text-primary disabled:opacity-50"
              >
                {generating ? "Generating…" : "Regenerate"}
              </button>
              <button onClick={() => setEditing((e) => !e)} className="text-xs text-primary flex items-center gap-1">
                <Edit3 className="w-3 h-3" /> {editing ? "Done" : "Edit"}
              </button>
            </div>
          </div>
          {editing ? (
            <Textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              className="rounded-2xl bg-card min-h-[260px] text-xs"
            />
          ) : (
            <div className="bg-card rounded-2xl p-4 text-xs whitespace-pre-line leading-relaxed text-muted-foreground border border-border max-h-64 overflow-y-auto">
              {generating ? "✨ Crafting your personalized letter…" : (coverLetter || "Tap Regenerate to create one")}
            </div>
          )}
        </div>

        {/* Required Documents Section */}
        {job.required_documents && job.required_documents.length > 0 && (
          <div className="bg-card rounded-2xl p-4 border border-border space-y-3 shadow-soft">
            <p className="text-sm font-semibold text-foreground">Required Documents</p>
            <p className="text-xs text-muted-foreground">
              The employer requires the following documents. Please upload or select them below:
            </p>
            <div className="space-y-2">
              {job.required_documents.map((doc) => {
                const satisfied = isDocSatisfied(doc);
                return (
                  <div
                    key={doc}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-colors ${
                      satisfied
                        ? "bg-success/5 border-success/20 text-foreground"
                        : "bg-destructive/5 border-destructive/10 text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${satisfied ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>
                        {satisfied ? (
                          <Check className="w-2.5 h-2.5" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-current" />
                        )}
                      </div>
                      <span className="font-semibold">{doc}</span>
                    </div>
                    
                    {!satisfied && (
                      <div className="flex items-center gap-1.5">
                        {savedDocs.length > 0 && (
                          <Select
                            onValueChange={(savedId) => {
                              setMappedDocs((prev) => ({ ...prev, [doc]: savedId }));
                              setIncludedSavedIds((prev) => {
                                const next = new Set(prev);
                                next.add(savedId);
                                return next;
                              });
                              toast.success(`Linked saved document for "${doc}"`);
                            }}
                          >
                            <SelectTrigger className="h-7 px-2.5 text-[10px] rounded-lg border-white/10 bg-white/5 text-muted-foreground w-28 hover:bg-white/10 hover:text-white font-semibold">
                              <SelectValue placeholder="Use Saved" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border-border text-foreground text-[11px] max-h-48">
                              {savedDocs.map((sd) => (
                                <SelectItem key={sd.id} value={sd.id} className="hover:bg-white/5 cursor-pointer text-xs">
                                  {sd.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            pendingDocLabelRef.current = doc;
                            extrasRef.current?.click();
                          }}
                          className="h-7 px-3 text-[11px] rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-bold"
                        >
                          Upload
                        </Button>
                      </div>
                    )}
                    {satisfied && (
                      <div className="flex flex-col items-end gap-0.5 max-w-[160px]">
                        <span className="text-[11px] text-success font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Ready
                        </span>
                        {(() => {
                          const filename = getSatisfyingFilename(doc);
                          return filename ? (
                            <span className="text-[9px] text-muted-foreground truncate w-full text-right" title={filename}>
                              {filename}
                            </span>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <p className="text-sm font-semibold mb-2">Attachments</p>
          <div className="bg-card rounded-2xl p-3 flex items-center gap-3 border border-border">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <p className="flex-1 text-sm truncate">{profile?.cv_filename ?? "No CV uploaded"}</p>
            {profile?.cv_path && <Check className="w-4 h-4 text-success" />}
          </div>

          {savedDocs.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Saved documents · re-use</p>
              {savedDocs.map((d) => {
                const included = includedSavedIds.has(d.id);
                return (
                  <div key={d.id} className="mt-2 bg-card rounded-2xl p-3 flex items-center gap-3 border border-border">
                    <input
                      type="checkbox"
                      checked={included}
                      onChange={() => setIncludedSavedIds((p) => {
                        const n = new Set(p);
                        if (n.has(d.id)) n.delete(d.id); else n.add(d.id);
                        return n;
                      })}
                      className="w-4 h-4 accent-primary"
                    />
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <p className="flex-1 text-xs truncate">{d.label}</p>
                    <button onClick={() => removeSavedDoc(d.id, d.storage_path)} className="text-muted-foreground" title="Remove from library">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {extras.map((e, i) => (
            <div key={i} className="mt-2 bg-card rounded-2xl p-3 border border-border space-y-2">
              <div className="flex items-center gap-3">
                <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                <p className="flex-1 text-xs truncate text-muted-foreground">{e.file.name}</p>
                <button onClick={() => setExtras((p) => p.filter((_, j) => j !== i))} className="text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                value={e.label}
                onChange={(ev) => setExtras((p) => p.map((x, j) => j === i ? { ...x, label: ev.target.value } : x))}
                placeholder="Document name e.g. Degree Certificate"
                className="w-full text-xs px-3 py-1.5 rounded-lg bg-secondary border border-border outline-none"
              />
            </div>
          ))}

          <input
            ref={extrasRef} type="file" multiple className="hidden"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={(e) => { onPickExtras(e.target.files); e.target.value = ""; }}
          />
          <button
            onClick={() => extrasRef.current?.click()}
            className="mt-2 w-full text-xs text-primary border border-dashed border-border rounded-xl py-2.5 flex items-center justify-center gap-2"
          >
            <Paperclip className="w-3.5 h-3.5" /> Add supporting document (PDF or image)
          </button>
        </div>

        <div className="flex gap-2 pb-4">
          <Button variant="outline" onClick={handleSaveDraft} disabled={busy} className="flex-1 h-12 rounded-xl">
            Save draft
          </Button>
          <Button
            disabled={busy || !coverLetter}
            onClick={handleSend}
            className="flex-1 h-12 bg-forest hover:bg-forest/90 rounded-xl font-semibold flex items-center justify-center gap-1.5"
          >
            <Mail className="w-4 h-4" />
            {busy ? "Preparing…" : isSubmitted ? "Resend" : "Send Application"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Review;
