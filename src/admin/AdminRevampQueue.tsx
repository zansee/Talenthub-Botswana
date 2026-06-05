import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Gem, Loader2, Download, Upload, CheckCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PDFDocument } from "pdf-lib";

type Req = {
  id: string;
  user_id: string;
  current_job_title: string | null;
  target_job_title: string | null;
  notes: string | null;
  cv_path: string | null;
  attachment_paths: string[] | null;
  additional_attachment_paths: string[] | null;
  payment_status: string;
  fulfilment_status: string;
  partner_notes: string | null;
  revamped_cv_path: string | null;
  revamped_cv_filename: string | null;
  delivered_at: string | null;
  created_at: string;
};

const STATUSES = ["new", "in_progress", "delivered", "cancelled"];

const AdminRevampQueue = () => {
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const uploadRevamped = async (r: Req, file: File) => {
    setUploadingId(r.id);
    try {
      const ext = file.name.split(".").pop() ?? "pdf";
      const path = `${r.user_id}/revamped/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("cvs").upload(path, file, { contentType: file.type || undefined });
      if (upErr) throw upErr;
      const { error: updErr } = await supabase.from("revamp_requests").update({
        revamped_cv_path: path, revamped_cv_filename: file.name, fulfilment_status: "delivered",
      }).eq("id", r.id);
      if (updErr) throw updErr;
      toast.success("Revamped CV sent to user");
      load();
    } catch (e: any) { toast.error(e?.message ?? "Upload failed"); }
    finally { setUploadingId(null); }
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("revamp_requests").select("*").order("created_at", { ascending: false });
    if (error) {
      console.error("Error loading revamp requests queue:", error);
      toast.error(`Failed to load revamp requests queue: ${error.message}`);
    }
    setItems((data ?? []) as Req[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("revamp_requests").update({ fulfilment_status: status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status updated");
    load();
  };

  const saveNotes = async (id: string) => {
    const { error } = await supabase.from("revamp_requests").update({ partner_notes: drafts[id] ?? "" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Notes saved");
    load();
  };

  const downloadCV = async (path: string) => {
    const { data, error } = await supabase.storage.from("cvs").createSignedUrl(path, 60);
    if (error || !data) return toast.error("Could not generate download link");
    window.open(data.signedUrl, "_blank");
  };

  const downloadAttachment = async (path: string) => {
    const { data, error } = await supabase.storage.from("app-docs").createSignedUrl(path, 60);
    if (error || !data) return toast.error("Could not generate download link");
    window.open(data.signedUrl, "_blank");
  };

  const imageToPdf = async (bytes: Uint8Array, ext: string): Promise<Uint8Array | null> => {
    try {
      const pdf = await PDFDocument.create();
      const img = ext === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      const page = pdf.addPage([595, 842]);
      const scale = Math.min((595 - 80) / img.width, (842 - 80) / img.height);
      page.drawImage(img, {
        x: (595 - img.width * scale) / 2,
        y: (842 - img.height * scale) / 2,
        width: img.width * scale, height: img.height * scale,
      });
      return await pdf.save();
    } catch (e) {
      console.error("Image to PDF conversion failed:", e);
      return null;
    }
  };

  const downloadMergedFile = async (
    cvPath: string | null,
    attachmentPaths: string[] | null,
    outputFilename: string = "merged_documents.pdf",
    attachmentBucket: string = "app-docs"
  ) => {
    const loadingToast = toast.loading("Downloading and merging documents...");
    try {
      const pdfs: Uint8Array[] = [];

      // 1. Fetch CV
      if (cvPath) {
        const { data, error } = await supabase.storage.from("cvs").download(cvPath);
        if (error || !data) {
          console.warn("Could not download CV file", cvPath, error);
        } else {
          const ext = cvPath.split(".").pop()?.toLowerCase();
          if (ext === "pdf") {
            pdfs.push(new Uint8Array(await data.arrayBuffer()));
          } else if (["png", "jpg", "jpeg"].includes(ext ?? "")) {
            const bytes = new Uint8Array(await data.arrayBuffer());
            const imgPdf = await imageToPdf(bytes, ext!);
            if (imgPdf) pdfs.push(imgPdf);
          }
        }
      }

      // 2. Fetch Attachments
      if (attachmentPaths && attachmentPaths.length > 0) {
        for (const path of attachmentPaths) {
          const { data, error } = await supabase.storage.from(attachmentBucket).download(path);
          if (error || !data) {
            console.warn("Could not download attachment file", path, error);
            continue;
          }
          const ext = path.split(".").pop()?.toLowerCase();
          if (ext === "pdf") {
            pdfs.push(new Uint8Array(await data.arrayBuffer()));
          } else if (["png", "jpg", "jpeg"].includes(ext ?? "")) {
            const bytes = new Uint8Array(await data.arrayBuffer());
            const imgPdf = await imageToPdf(bytes, ext!);
            if (imgPdf) pdfs.push(imgPdf);
          }
        }
      }

      if (pdfs.length === 0) {
        toast.dismiss(loadingToast);
        toast.error("No valid PDF/image documents found to download.");
        return;
      }

      // 3. Merge PDFs
      const merged = await PDFDocument.create();
      for (const bytes of pdfs) {
        try {
          const src = await PDFDocument.load(bytes);
          const pages = await merged.copyPages(src, src.getPageIndices());
          pages.forEach((p) => merged.addPage(p));
        } catch (loadErr) {
          console.warn("Could not load PDF document segment", loadErr);
        }
      }
      
      const mergedBytes = await merged.save();
      const blob = new Blob([mergedBytes as any], { type: "application/pdf" });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = outputFilename;
      a.click();
      URL.revokeObjectURL(url);

      toast.dismiss(loadingToast);
      toast.success("Documents merged and downloaded successfully!");
    } catch (e: any) {
      console.error(e);
      toast.dismiss(loadingToast);
      toast.error(e?.message ?? "Failed to download and merge documents");
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Gem className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-bold">CV Revamp Queue</h1>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No revamp requests yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                  <p className="font-semibold">{r.target_job_title || "Target role not specified"}</p>
                  {r.current_job_title && <p className="text-xs text-muted-foreground">Currently: {r.current_job_title}</p>}
                  <p className="text-[11px] mt-1">
                    Payment: <span className="font-mono">{r.payment_status}</span>
                  </p>
                </div>
                <Select value={r.fulfilment_status} onValueChange={(v) => updateStatus(r.id, v)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {r.notes && (
                <div className="mt-3 p-3 bg-secondary rounded-lg text-sm">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">User notes</p>
                  {r.notes}
                </div>
              )}

              {r.cv_path && (
                <Button variant="outline" size="sm" className="mt-3 mr-2 border-green-500/40 text-green-400 hover:bg-green-500/10" onClick={() => downloadMergedFile(r.cv_path, r.attachment_paths, `CV_and_Docs_CVR-${r.id.substring(0,4).toUpperCase()}.pdf`)}>
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Get CV & Docs (Merged)
                </Button>
              )}
              {r.additional_attachment_paths && r.additional_attachment_paths.length > 0 && (
                <Button variant="outline" size="sm" className="mt-3 mr-2 border-amber-500/40 text-amber-400 hover:bg-amber-500/10" onClick={() => downloadMergedFile(null, r.additional_attachment_paths, `Additional_Docs_CVR-${r.id.substring(0,4).toUpperCase()}.pdf`, "revamp-documents")}>
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Get Additional Docs (Merged)
                </Button>
              )}

              <div className="mt-3">
                <Textarea
                  placeholder="Partner notes (internal)…"
                  defaultValue={r.partner_notes ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                  rows={2}
                />
                <Button size="sm" className="mt-2" onClick={() => saveNotes(r.id)}>Save notes</Button>
              </div>

              <div className="mt-4 pt-3 border-t border-border">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Deliver revamped CV</p>
                {r.revamped_cv_path ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-xs text-success">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Sent {r.delivered_at ? new Date(r.delivered_at).toLocaleDateString() : ""}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => downloadCV(r.revamped_cv_path!)}>
                      <Download className="w-3.5 h-3.5 mr-1.5" /> {r.revamped_cv_filename ?? "Revamped CV"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => fileRefs.current[r.id]?.click()} disabled={uploadingId === r.id}>Replace</Button>
                  </div>
                ) : (
                  <Button size="sm" disabled={uploadingId === r.id} onClick={() => fileRefs.current[r.id]?.click()}>
                    {uploadingId === r.id ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
                    Upload revamped CV & send
                  </Button>
                )}
                <input
                  ref={(el) => { fileRefs.current[r.id] = el; }}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadRevamped(r, f); e.target.value = ""; }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminRevampQueue;
