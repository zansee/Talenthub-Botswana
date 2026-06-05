import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { TrendingUp, Star, Gem, PenLine, Loader2, Download, LogOut, Upload, CheckCircle2, FileText, Video, LayoutDashboard, Briefcase, Settings, BarChart3, Users, BookOpen, Search, Bell, ChevronDown, ChevronRight, Activity, Eye, X, AlertTriangle, Calendar, Check } from "lucide-react";
import mascot from "@/assets/mascot-transparent.png";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { motion, AnimatePresence } from "framer-motion";
import { modalContentVariants, modalOverlayVariants } from "@/lib/animations";

type RevampReq = {
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
  requested_documents?: string[] | null;
  additional_attachments_map?: Record<string, string | null> | null;
  revamp_amount: number | null;
  ai_rewritten_cv?: string | null;
  ai_consensus_score?: number | null;
  ai_debate_report?: any | null;
  rounds_needed?: number | null;
  ai_debate_step?: number | null;
};

type PrepReq = {
  id: string;
  user_id: string;
  type: string;
  target_role: string | null;
  interview_date: string | null;
  session_scheduled_at: string | null;
  meeting_link: string | null;
  script_path: string | null;
  attachment_paths: string[] | null;
  payment_status: string;
  status: string;
  partner_notes: string | null;
  delivered_at: string | null;
  created_at: string;
  amount: number | null;
  job_id?: string | null;
  jobs?: {
    id: string;
    title: string;
    company: string;
    location: string;
    description: string;
    skills: string[];
    required_qualification: string | null;
    required_years_experience: number | null;
  } | null;
};

const PartnerDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const [isPartner, setIsPartner] = useState<boolean | null>(null);
  const [companyName, setCompanyName] = useState("Partner");
  
  const [revamps, setRevamps] = useState<RevampReq[]>([]);
  const [preps, setPreps] = useState<PrepReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [meetingLinks, setMeetingLinks] = useState<Record<string, string>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("Overview");
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const lastMergedIdRef = useRef<string | null>(null);
  const [showAllRevamps, setShowAllRevamps] = useState(false);
  const [detailModal, setDetailModal] = useState<RevampReq | null>(null);
  const [workshopRequest, setWorkshopRequest] = useState<RevampReq | null>(null);
  const [editedCvText, setEditedCvText] = useState("");
  const [compareView, setCompareView] = useState(false);
  const [atsPreview, setAtsPreview] = useState(false);
  const [mergedPdfUrl, setMergedPdfUrl] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedPrepForDetails, setSelectedPrepForDetails] = useState<PrepReq | null>(null);
  const [docRequestId, setDocRequestId] = useState<string | null>(null);
  const [docChecklist, setDocChecklist] = useState<string[]>([]);
  const [docNote, setDocNote] = useState("");
  const [sendingDocReq, setSendingDocReq] = useState(false);
  const [docRequestsSent, setDocRequestsSent] = useState<Record<string, boolean>>({});
  const [docUpdated, setDocUpdated] = useState<Record<string, boolean>>({});

  // Settings state
  const [profileData, setProfileData] = useState<any>({});
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [notifyPrefs, setNotifyPrefs] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/partner/landing", { replace: true }); return; }
    
    // Check role and fetch profile info
    Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "partner").maybeSingle(),
      supabase.from("profiles").select("*").eq("id", user.id).single()
    ]).then(([roleRes, profRes]) => {
      setIsPartner(!!roleRes.data);
      if (profRes.data) {
        setProfileData(profRes.data);
        if (profRes.data.full_name) setCompanyName(profRes.data.full_name);
      }
    });
  }, [authLoading, user, navigate]);

  const load = async () => {
    setLoading(true);
    // Removed the failing partner_id filter to show all data
    const [r, p] = await Promise.all([
      supabase.from("revamp_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("interview_preps").select("*, jobs(*)").order("created_at", { ascending: false })
    ]);
    if (r.error) {
      console.error("Error loading revamp requests:", r.error);
      toast.error(`Failed to load revamp requests: ${r.error.message}`);
    }
    if (p.error) {
      console.error("Error loading interview preps:", p.error);
      toast.error(`Failed to load coaching sessions: ${p.error.message}`);
    }
    setRevamps((r.data ?? []) as unknown as RevampReq[]);
    setPreps((p.data ?? []) as any);
    setLoading(false);
  };
  
  useEffect(() => { if (isPartner) load(); }, [isPartner]);

  // Real-time listener for incoming revamp requests and coaching sessions
  useEffect(() => {
    if (!isPartner) return;

    const channel = supabase
      .channel("partner-dashboard-queue-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "revamp_requests" },
        () => {
          load();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "interview_preps" },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isPartner]);

  // Real-time listener for current active Workshop request updates
  useEffect(() => {
    if (!workshopRequest?.id) return;

    const channel = supabase
      .channel(`workshop_request_${workshopRequest.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "revamp_requests",
          filter: `id=eq.${workshopRequest.id}`
        },
        (payload) => {
          const updated = payload.new as RevampReq;
          setWorkshopRequest(updated);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workshopRequest?.id]);

  // Unified CV Workshop Document Merging & Setup
  useEffect(() => {
    if (!workshopRequest) {
      if (mergedPdfUrl) {
        URL.revokeObjectURL(mergedPdfUrl);
        setMergedPdfUrl(null);
      }
      lastMergedIdRef.current = null;
      return;
    }

    // Performance safeguard: Only re-merge when opening a different request
    if (lastMergedIdRef.current === workshopRequest.id) {
      // If AI finished generating and text is currently empty, initialize it
      if (workshopRequest.ai_rewritten_cv && !editedCvText) {
        setEditedCvText(workshopRequest.ai_rewritten_cv);
      }
      return;
    }

    lastMergedIdRef.current = workshopRequest.id;
    setEditedCvText(workshopRequest.ai_rewritten_cv || "");
    setCompareView(false);
    setAtsPreview(false);

    const createMergedPreview = async () => {
      setMerging(true);
      try {
        const pdfs: Uint8Array[] = [];

        // 1. Fetch CV (from revamp-documents bucket)
        if (workshopRequest.cv_path) {
          const { data, error } = await supabase.storage.from("revamp-documents").download(workshopRequest.cv_path);
          if (!error && data) {
            const ext = workshopRequest.cv_path.split(".").pop()?.toLowerCase();
            if (ext === "pdf") {
              pdfs.push(new Uint8Array(await data.arrayBuffer()));
            } else if (["png", "jpg", "jpeg"].includes(ext ?? "")) {
              const bytes = new Uint8Array(await data.arrayBuffer());
              const imgPdf = await imageToPdf(bytes, ext!);
              if (imgPdf) pdfs.push(imgPdf);
            }
          }
        }

        // 2. Fetch supporting attachments (from revamp-documents bucket)
        if (workshopRequest.attachment_paths && workshopRequest.attachment_paths.length > 0) {
          for (const path of workshopRequest.attachment_paths) {
            const { data, error } = await supabase.storage.from("revamp-documents").download(path);
            if (!error && data) {
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
        }

        if (pdfs.length > 0) {
          const merged = await PDFDocument.create();
          for (const bytes of pdfs) {
            try {
              const src = await PDFDocument.load(bytes);
              const pages = await merged.copyPages(src, src.getPageIndices());
              pages.forEach((p) => merged.addPage(p));
            } catch (err) {
              console.warn("Could not load document segment for merge", err);
            }
          }
           const mergedBytes = await merged.save();
           const blob = new Blob([mergedBytes as any], { type: "application/pdf" });
           const url = URL.createObjectURL(blob);
          setMergedPdfUrl(url);
        }
      } catch (err) {
        console.error("Error creating merged preview:", err);
      } finally {
        setMerging(false);
      }
    };

    createMergedPreview();
  }, [workshopRequest]);

  const wrapText = (text: string, font: any, size: number, maxWidth: number): string[] => {
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

  const handleRegenerate = async () => {
    if (!workshopRequest) return;
    setBusy(true);
    const loadingToast = toast.loading("Triggering AI regeneration...");
    try {
      const { error } = await supabase
        .from("revamp_requests")
        .update({
          fulfilment_status: "assigned",
          ai_debate_step: 0,
          ai_rewritten_cv: null,
          ai_consensus_score: null,
          ai_debate_report: null
        } as any)
        .eq("id", workshopRequest.id);
      
      if (error) throw error;
      toast.dismiss(loadingToast);
      toast.success("AI Debate panel activated!");
      
      const { data: latest } = await supabase
        .from("revamp_requests")
        .select("*")
        .eq("id", workshopRequest.id)
        .single();
      if (latest) setWorkshopRequest(latest as any);
      load();
    } catch (err: any) {
      console.error(err);
      toast.dismiss(loadingToast);
      toast.error("Failed to regenerate: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSendToClient = async () => {
    if (!workshopRequest) return;
    setBusy(true);
    const loadingToast = toast.loading("Compiling CV PDF and sending to client...");
    try {
      // 1. Compile edited text to PDF using pdf-lib
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      const size = 10; const lh = 14; const margin = 50;
      let page = pdf.addPage([595, 842]);
      const { width, height } = page.getSize();
      const maxW = width - margin * 2;
      let y = height - margin;

      const ensureRoom = () => {
        if (y < margin + lh) { page = pdf.addPage([595, 842]); y = height - margin; }
      };

      const lines = wrapText(editedCvText, font, size, maxW);
      for (const line of lines) {
        ensureRoom();
        if (line.trim()) {
          page.drawText(line, { x: margin, y, size, font, color: rgb(0.1, 0.1, 0.1) });
        }
        y -= lh;
      }

      const pdfBytes = await pdf.save();

      // 2. Upload compiled PDF to delivered-cvs bucket
      const filename = `${workshopRequest.target_job_title || "Revamped"}_CV.pdf`.replace(/\s+/g, "_");
      const storagePath = `${workshopRequest.user_id}/${workshopRequest.id}/delivered_cv.pdf`;
      
      const { error: upErr } = await supabase.storage.from("delivered-cvs").upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true
      });
      if (upErr) throw upErr;

       // 3. Insert record in cv_versions
       const { error: insErr } = await (supabase as any).from("cv_versions").insert({
         user_id: workshopRequest.user_id,
         storage_path: storagePath,
         filename,
         label: "AI Revamped CV",
         is_main: false,
         ai_score: workshopRequest.ai_consensus_score
       });
       if (insErr) throw insErr;

      // 4. Update revamp_requests table
      const { error: updErr } = await supabase.from("revamp_requests").update({
        fulfilment_status: "completed",
        revamped_cv_path: storagePath,
        revamped_cv_filename: filename,
        delivered_at: new Date().toISOString()
      }).eq("id", workshopRequest.id);
      if (updErr) throw updErr;

      // 5. Send notification
      await supabase.from("notifications").insert({
        user_id: workshopRequest.user_id,
        title: "CV Revamp Ready",
        body: `Your revamped CV is ready! Open it under CV & Documents.`,
        type: "revamp"
      });

      toast.dismiss(loadingToast);
      toast.success("CV delivered to candidate successfully!");
      setWorkshopRequest(null);
      load();
    } catch (err: any) {
      console.error("Error sending CV to client:", err);
      toast.dismiss(loadingToast);
      toast.error("Failed to send CV to client: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || isPartner === null) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Checking access…</div>;
  }
  if (!isPartner) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-background">
        <p className="text-sm text-muted-foreground">This account does not have partner access.</p>
        <Button onClick={() => { signOut(); navigate("/partner/landing"); }} variant="outline" className="mt-4">Sign out</Button>
      </div>
    );
  }

  const downloadFile = async (path: string, bucket: string = "cvs") => {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
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
    outputFilename: string = "merged_documents.pdf"
  ) => {
    const loadingToast = toast.loading("Downloading and merging documents...");
    try {
      const pdfs: Uint8Array[] = [];

      // 1. Fetch CV
      if (cvPath) {
        const { data, error } = await supabase.storage.from("revamp-documents").download(cvPath);
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
          const { data, error } = await supabase.storage.from("revamp-documents").download(path);
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

  const uploadRevamped = async (r: RevampReq, file: File) => {
    setUploadingId(r.id);
    try {
      const ext = file.name.split(".").pop() ?? "pdf";
      const path = `${r.user_id}/revamped/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("delivered-cvs").upload(path, file);
      if (upErr) throw upErr;
      
      const { error: updErr } = await supabase.from("revamp_requests").update({
        revamped_cv_path: path,
        revamped_cv_filename: file.name,
        fulfilment_status: "delivered",
        delivered_at: new Date().toISOString()
      }).eq("id", r.id);
      
      if (updErr) throw updErr;
      
      await supabase.from("notifications").insert({
        user_id: r.user_id,
        title: "CV Revamp Ready",
        body: "Your revamped CV has been delivered.",
        type: "revamp"
      });
      toast.success("Revamped CV sent to user");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploadingId(null);
    }
  };

  const uploadPrepScript = async (p: PrepReq, file: File) => {
    if (p.type === "coaching" && !meetingLinks[p.id] && !p.meeting_link) {
      toast.error("Please enter a meeting link before uploading the script");
      return;
    }
    setUploadingId(p.id);
    try {
      const ext = file.name.split(".").pop() ?? "pdf";
      const path = `${p.user_id}/interview/delivered/${crypto.randomUUID()}.${ext}`;

      // 1. Upload file to storage
      const { error: upErr } = await supabase.storage.from("app-docs").upload(path, file);
      if (upErr) {
        console.error("Storage upload error:", JSON.stringify(upErr));
        throw new Error(upErr.message || "File upload failed");
      }

      // 2. Update the interview prep record
      const updateData: any = { script_path: path, status: "delivered", delivered_at: new Date().toISOString() };
      if (p.type === "coaching" && meetingLinks[p.id]) updateData.meeting_link = meetingLinks[p.id];

      const { error: updErr } = await supabase.from("interview_preps").update(updateData).eq("id", p.id);
      if (updErr) {
        console.error("DB update error:", JSON.stringify(updErr));
        throw new Error(updErr.message || "Could not update session record");
      }

      // 3. Send notification (non-blocking — don't fail upload if this fails)
      const { error: notifErr } = await supabase.from("notifications").insert({
        user_id: p.user_id,
        title: "Interview Prep Ready",
        body: p.type === "coaching"
          ? "A meeting link has been shared for your coaching session."
          : "Your interview prep script has been delivered.",
        type: "prep",
      });
      if (notifErr) {
        console.warn("Notification insert failed (non-critical):", JSON.stringify(notifErr));
      }

      toast.success("Script delivered to user!");
      load();
    } catch (e: any) {
      console.error("uploadPrepScript error:", e);
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploadingId(null);
    }
  };

  
  const updateRevamp = async (id: string, field: string, value: string) => {
    try {
      const rev = revamps.find(r => r.id === id);
      await supabase.from("revamp_requests").update({ [field]: value } as any).eq("id", id);
      if (field === 'fulfilment_status' && rev) {
        await supabase.from("notifications").insert({
          user_id: rev.user_id,
          title: value === 'in_progress' ? 'CV Revamp In Progress' : 'CV Revamp Update',
          body: value === 'in_progress' ? 'Your CV Revamp request is now In Progress — your coach is working on it!' : `Your CV Revamp status has been updated to: ${value}`,
          type: 'revamp_status'
        });
      }
      toast.success("Updated");
      load();
    } catch (e) { toast.error("Failed to update"); }
  };

  const updatePrep = async (id: string, field: string, value: string) => {
    try {
      await supabase.from("interview_preps").update({ [field]: value } as any).eq("id", id);
      toast.success("Updated successfully");
      load();
    } catch (e) {
      toast.error("Failed to update");
    }
  };

  const handleSaveSettings = async () => {
    setSettingsLoading(true);
    try {
      const updates: any = {};
      if (profileData.full_name) updates.full_name = profileData.full_name;
      if (profileData.career_summary !== undefined) updates.career_summary = profileData.career_summary;
      await supabase.from("profiles").update(updates).eq("id", user?.id as string);

      if (newPassword) {
        if (!oldPassword) { toast.error("Please enter your current password"); setSettingsLoading(false); return; }
        if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); setSettingsLoading(false); return; }
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user?.email ?? '', password: oldPassword });
        if (signInErr) { toast.error("Current password is incorrect"); setSettingsLoading(false); return; }
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        setOldPassword(""); setNewPassword(""); setConfirmPassword("");
        toast.success("Password updated");
      }
      setCompanyName(profileData.full_name || "Partner");
      toast.success("Settings saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save settings");
    } finally { setSettingsLoading(false); }
  };

  const DOC_CHECKLIST_OPTIONS = ["CV / Resume","Academic Certificates","Professional Certifications","Professional Memberships / Licenses","References","ID / Passport","Driving License","Other"];

  const sendDocRequest = async (requestId: string, userId: string) => {
    if (docChecklist.length === 0) { toast.error("Select at least one document type"); return; }
    setSendingDocReq(true);
    try {
      const body = `To complete your CV Revamp, please upload the following: ${docChecklist.join(", ")}${docNote ? `\n\nNote: ${docNote}` : ""}`;
      const { error: notifErr } = await supabase.from("notifications").insert({
        user_id: userId,
        title: "Your coach needs a few more documents",
        body,
        type: "docs_requested"
      });
      if (notifErr) throw notifErr;

      const initialMap = {
        ...docChecklist.reduce((acc, opt) => ({ ...acc, [opt]: null }), {}),
        "__coach_message": body
      };
      
      const { error: updErr } = await supabase.from("revamp_requests").update({
        requested_documents: docChecklist,
        additional_attachments_map: initialMap,
        fulfilment_status: "docs_requested"
      } as any).eq("id", requestId);
      if (updErr) throw updErr;
      
      setDocRequestsSent(p => ({ ...p, [requestId]: true }));
      setDocRequestId(null); setDocChecklist([]); setDocNote("");
      toast.success("Document request sent to user");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send");
    } finally { setSendingDocReq(false); }
  };

  const deliveredRevamps = revamps.filter(r => r.fulfilment_status === 'completed' || r.fulfilment_status === 'delivered');
  const deliveredPreps = preps.filter(p => p.status === 'delivered');
  
  const totalEarnings = (deliveredRevamps.length * 150) +
                        deliveredPreps.reduce((acc, p) => acc + (p.type === 'script' ? 150 : p.type === 'virtual' || p.type === 'coaching' ? 500 : 0), 0);
                        
  const activeRevamps = revamps.filter(r => ['new', 'pending', 'paid', 'assigned', 'ai_processing', 'ai_complete', 'partner_reviewing', 'docs_requested'].includes(r.fulfilment_status)).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const activePreps = preps.filter(p => p.status === 'new' || p.status === 'scheduled' || p.status === 'in_progress' || p.status === 'paid' || p.status === 'pending');
  const totalCompleted = deliveredRevamps.length + deliveredPreps.length;
  
  // Mixed recent activity from both tables where delivered
  const recentActivity = [
    ...deliveredRevamps.map(r => ({ id: r.id, type: 'revamp', title: r.target_job_title || 'General', date: r.delivered_at || r.created_at })),
    ...deliveredPreps.map(p => ({ id: p.id, type: 'prep', title: p.target_role || 'General', date: p.delivered_at || p.created_at }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);

  return (
    <div className="min-h-screen flex bg-[#0a0c10] text-[#e5e7eb] font-sans selection:bg-primary/30">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-[#0d1117] flex flex-col shrink-0 hidden lg:flex">
        <div className="h-20 px-6 flex items-center border-b border-white/5">
          <div className="flex flex-col">
            <span className="font-bold text-xl tracking-tight text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" /> {companyName}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-primary font-semibold mt-0.5">Partner Portal</span>
          </div>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <SidebarItem icon={<LayoutDashboard />} label="Overview" active={activeTab === "Overview"} onClick={() => setActiveTab("Overview")} />
          <SidebarItem icon={<FileText />} label="CV Revamp" active={activeTab === "CV Revamp"} onClick={() => setActiveTab("CV Revamp")} />
          <SidebarItem icon={<Video />} label="Coaching" active={activeTab === "Coaching"} onClick={() => setActiveTab("Coaching")} />
          <SidebarItem icon={<Briefcase />} label="Requests" active={activeTab === "Requests"} onClick={() => setActiveTab("Requests")} />

          <SidebarItem icon={<Settings />} label="Settings" active={activeTab === "Settings"} onClick={() => setActiveTab("Settings")} />
        </nav>
        <div className="p-4 border-t border-white/5">
          <div className="rounded-xl bg-gradient-to-br from-primary/20 to-transparent border border-primary/20 p-4 relative overflow-hidden">
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary/20 blur-2xl rounded-full" />
            <Briefcase className="w-6 h-6 text-primary mb-3" />
            <p className="font-semibold text-white mb-1">Empowering<br/>Careers.</p>
            <p className="text-xs text-muted-foreground">We help professionals polish their profiles and grow their potential.</p>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-[#0d1117]/80 backdrop-blur-md sticky top-0 z-20">
          <div className="flex-1 max-w-xl">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="Search candidates, requests, or sessions..." className="w-full h-10 bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground/50" />
            </div>
          </div>
          <div className="flex items-center gap-6 ml-4">
            <button className="relative text-muted-foreground hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-[#0d1117]" />
            </button>
            <div className="flex items-center gap-3 pl-6 border-l border-white/5 cursor-pointer group" onClick={async () => { await signOut(); navigate("/partner/landing"); }}>
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                {companyName.substring(0, 2).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-white group-hover:text-primary transition-colors">{companyName}</p>
                <p className="text-[11px] text-muted-foreground">Log out</p>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="flex flex-col xl:flex-row gap-8 max-w-[1600px] mx-auto">
            
            {/* Left Column (Primary) */}
            <div className="flex-1 space-y-8 min-w-0">
              
              {/* Welcome Section */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-2">
                <div>
                  <p className="text-muted-foreground text-lg mb-1">Welcome back,</p>
                  <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">{companyName}<span className="text-primary">.</span></h1>
                  <p className="text-muted-foreground mt-2">Here's your impact today.</p>
                </div>
                <div className="sm:max-w-[280px] border-l-2 border-primary/40 pl-4 py-1">
                  <p className="text-lg font-medium text-white/90 italic leading-snug">"Better careers start with better preparation."</p>
                  <p className="text-sm text-primary mt-2 font-medium">— Talenthub Partner</p>
                </div>
              </div>

              {/* Metrics */}
              {["Overview", "Analytics"].includes(activeTab) && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard icon={<FileText />} label="CV Revamp Requests" value={revamps.length.toString()} trend="+12% vs last month" />
                  <MetricCard icon={<Users />} label="Coaching Sessions" value={preps.length.toString()} trend="+8% vs last month" />
                  <MetricCard icon={<CheckCircle2 />} label="Completed" value={totalCompleted.toString()} trend="+15% vs last month" />
                  <MetricCard icon={<TrendingUp />} label="Earnings (BWP)" value={`P${totalEarnings.toLocaleString()}`} trend="+20% vs last month" />
                </div>
              )}

              {/* CV Revamp Requests Table */}
              {["Overview", "CV Revamp", "Requests"].includes(activeTab) && (
                <div className="bg-[#0d1117] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">CV Revamp Requests</h2>
                  <Button variant="outline" size="sm" className="h-8 text-xs border-white/10 bg-transparent hover:bg-white/5 text-white" onClick={() => setShowAllRevamps(v => !v)}>{showAllRevamps ? 'Show less' : 'View all'}</Button>
                </div>
                <Tabs defaultValue="active" className="w-full">
                  <div className="p-4 bg-white/[0.02] border-b border-white/5 flex gap-6">
                    <TabsList className="bg-transparent p-0 h-auto gap-6 border-b-0">
                      <TabsTrigger value="active" className="text-sm font-medium data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary pb-4 -mb-4 rounded-none shadow-none px-0">
                        Active <span className="ml-1.5 bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded-full">{activeRevamps.length}</span>
                      </TabsTrigger>
                      <TabsTrigger value="completed" className="text-sm font-medium data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary pb-4 -mb-4 rounded-none shadow-none px-0">
                        Completed <span className="ml-1.5 bg-white/10 text-muted-foreground text-[10px] px-2 py-0.5 rounded-full">{deliveredRevamps.length}</span>
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  
                  <TabsContent value="active" className="m-0 border-none p-0 outline-none">
                    <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground border-b border-white/5 bg-[#0a0c10]/50">
                      <tr>
                        <th className="px-5 py-4 font-medium">Request ID</th>
                        <th className="px-5 py-4 font-medium">Target Role</th>
                        <th className="px-5 py-4 font-medium">Requested On</th>
                        <th className="px-5 py-4 font-medium">Status</th>
                        <th className="px-5 py-4 font-medium">Notes</th>
                        <th className="px-5 py-4 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {activeRevamps.length === 0 ? (
                        <tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">No active revamp requests.</td></tr>
                      ) : (showAllRevamps ? activeRevamps : activeRevamps.slice(0, 5)).map((r) => (
                        <tr key={r.id} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="px-5 py-4 text-white/80 font-mono text-xs">CVR-{r.id.substring(0,4).toUpperCase()}</td>
                          <td className="px-5 py-4 text-white font-medium">{r.target_job_title || "General Update"}</td>
                          <td className="px-5 py-4 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                          <td className="px-5 py-4">
                            <select 
                              className="text-[11px] bg-transparent text-white border border-white/10 rounded px-1 py-0.5 outline-none capitalize"
                              value={r.fulfilment_status}
                              onChange={(e) => updateRevamp(r.id, 'fulfilment_status', e.target.value)}
                            >
                              <option value="new" className="bg-[#0d1117]">New</option>
                              <option value="pending" className="bg-[#0d1117]">Pending</option>
                              <option value="assigned" className="bg-[#0d1117]">Assigned (Start AI)</option>
                              <option value="ai_processing" className="bg-[#0d1117]">AI Processing</option>
                              <option value="ai_complete" className="bg-[#0d1117]">AI Complete</option>
                              <option value="partner_reviewing" className="bg-[#0d1117]">Reviewing</option>
                              <option value="docs_requested" className="bg-[#0d1117]">Docs Requested</option>
                              <option value="completed" className="bg-[#0d1117]">Completed</option>
                            </select>
                          </td>
                          <td className="px-5 py-4">
                            <input 
                              type="text" 
                              placeholder="Notes..." 
                              className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1 w-full text-white outline-none focus:border-primary/50"
                              defaultValue={r.partner_notes || ''}
                              onBlur={(e) => { if(e.target.value !== r.partner_notes) updateRevamp(r.id, 'partner_notes', e.target.value); }}
                            />
                          </td>
                          <td className="px-5 py-4 text-right">
                             <div className="flex justify-end gap-2 flex-wrap">
                               <Button size="sm" className="h-7 text-[11px] bg-primary/25 text-primary border border-primary/30 hover:bg-primary hover:text-primary-foreground font-bold" onClick={() => setWorkshopRequest(r)}>Workshop</Button>
                               <Button variant="outline" size="sm" className="h-7 text-[11px] border-green-500/40 text-green-400 hover:bg-green-500/10" onClick={async () => {
                                 await downloadMergedFile(r.cv_path, r.attachment_paths, `CV_and_Docs_CVR-${r.id.substring(0,4).toUpperCase()}.pdf`);
                               }}>Get CV & Docs</Button>
                               {r.additional_attachment_paths && r.additional_attachment_paths.length > 0 && (
                                 <Button 
                                   variant="outline" 
                                   size="sm" 
                                   className="h-7 text-[11px] border-amber-500/40 text-amber-400 hover:bg-amber-500/10 animate-pulse" 
                                   onClick={async () => {
                                     await downloadMergedFile(null, r.additional_attachment_paths, `Additional_Docs_CVR-${r.id.substring(0,4).toUpperCase()}.pdf`);
                                   }}
                                 >
                                   Get Additional Docs
                                 </Button>
                               )}
                               <Button size="sm" className="h-7 text-[11px] bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30" onClick={() => { setDocRequestId(r.id); setDocChecklist([]); setDocNote(""); }}>
                                 {docRequestsSent[r.id] ? 'Docs Requested ✓' : 'Request Docs'}
                               </Button>
                               <Button size="sm" className="h-7 text-[11px] bg-white/5 text-muted-foreground hover:bg-white/10 border border-white/10" disabled={uploadingId === r.id} onClick={() => fileRefs.current[r.id]?.click()}>
                                 {uploadingId === r.id ? '...' : 'Upload Direct'}
                               </Button>
                               <input ref={(el) => { fileRefs.current[r.id] = el; }} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadRevamped(r, f); e.target.value = ""; }} />
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </TabsContent>

                <TabsContent value="completed" className="m-0 border-none p-0 outline-none">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-muted-foreground border-b border-white/5 bg-[#0a0c10]/50">
                        <tr>
                          <th className="px-5 py-4 font-medium">Request ID</th>
                          <th className="px-5 py-4 font-medium">Target Role</th>
                          <th className="px-5 py-4 font-medium">Requested On</th>
                          <th className="px-5 py-4 font-medium">Completed On</th>
                          <th className="px-5 py-4 font-medium">Status</th>
                          <th className="px-5 py-4 font-medium text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {deliveredRevamps.length === 0 ? (
                          <tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">No completed revamp requests.</td></tr>
                        ) : deliveredRevamps.slice(0, 5).map((r) => (
                          <tr key={r.id} className="hover:bg-white/[0.02] transition-colors group">
                            <td className="px-5 py-4 text-white/80 font-mono text-xs">CVR-{r.id.substring(0,4).toUpperCase()}</td>
                            <td className="px-5 py-4 text-white font-medium">{r.target_job_title || "General Update"}</td>
                            <td className="px-5 py-4 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                            <td className="px-5 py-4 text-muted-foreground">{r.delivered_at ? new Date(r.delivered_at).toLocaleDateString() : '-'}</td>
                            <td className="px-5 py-4"><span className="text-xs text-success bg-success/10 px-2 py-1 rounded border border-success/20">Delivered</span></td>
                            <td className="px-5 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" className="h-7 text-[11px] border-white/10" onClick={() => setDetailModal(r)}>View</Button>
                                <Button size="sm" className="h-7 text-[11px] bg-primary/25 text-primary border border-primary/30 hover:bg-primary hover:text-primary-foreground font-bold" onClick={() => setWorkshopRequest(r)}>Workshop</Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
                </Tabs>
              </div>
              )}

              {/* Coaching Sessions Table */}
              {["Overview", "Coaching", "Requests"].includes(activeTab) && (
              <div className="bg-[#0d1117] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">Upcoming Coaching Sessions</h2>
                  <Button variant="outline" size="sm" className="h-8 text-xs border-white/10 bg-transparent hover:bg-white/5 text-white" onClick={() => { setActiveTab('Coaching'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>View calendar</Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground border-b border-white/5 bg-[#0a0c10]/50">
                      <tr>
                        <th className="px-5 py-4 font-medium">Session ID</th>
                        <th className="px-5 py-4 font-medium">Session Type</th>
                        <th className="px-5 py-4 font-medium">Focus Area</th>
                        <th className="px-5 py-4 font-medium">Date & Time</th>
                        <th className="px-5 py-4 font-medium">Status & Link</th>
                        <th className="px-5 py-4 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {activePreps.length === 0 ? (
                        <tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">No upcoming coaching sessions.</td></tr>
                      ) : activePreps.slice(0, 5).map((p) => (
                        <tr key={p.id} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="px-5 py-4 text-white/80 font-mono text-xs">CS-{p.id.substring(0,4).toUpperCase()}</td>
                          <td className="px-5 py-4 text-white font-medium capitalize">{p.type}</td>
                          <td className="px-5 py-4 text-muted-foreground">{p.target_role || "General"}</td>
                          <td className="px-5 py-4 text-muted-foreground">
                            <div className="flex flex-col gap-1 min-w-[150px]">
                              {p.type === 'script' ? (
                                <span className="text-xs text-muted-foreground italic">N/A — Script Only</span>
                              ) : p.session_scheduled_at ? (
                                <div className="flex flex-col gap-1">
                                  <span className="font-semibold text-white">
                                    {new Date(p.session_scheduled_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                  </span>
                                  <button 
                                    type="button"
                                    onClick={() => updatePrep(p.id, 'session_scheduled_at', null as any)}
                                    className="text-[10px] text-red-400 hover:text-red-300 text-left font-semibold cursor-pointer"
                                  >
                                    Change Date
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs text-muted-foreground">Pending Scheduling</span>
                                  <input 
                                    type="datetime-local" 
                                    className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-white outline-none focus:border-primary/50 w-full"
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        updatePrep(p.id, 'session_scheduled_at', new Date(e.target.value).toISOString());
                                      }
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                             {p.type !== 'script' && (
                               <input 
                                 type="text" 
                                 placeholder="Meeting Link" 
                                 className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1 w-full text-white outline-none focus:border-primary/50 mb-2"
                                 value={meetingLinks[p.id] !== undefined ? meetingLinks[p.id] : p.meeting_link || ''}
                                 onChange={(e) => setMeetingLinks({...meetingLinks, [p.id]: e.target.value})}
                                 onBlur={(e) => { if(e.target.value !== p.meeting_link) updatePrep(p.id, 'meeting_link', e.target.value); }}
                               />
                             )}
                             <select 
                               className="text-[11px] bg-transparent text-white border border-white/10 rounded px-1 py-0.5 outline-none w-full"
                               value={p.status}
                               onChange={(e) => updatePrep(p.id, 'status', e.target.value)}
                             >
                               <option value="new" className="bg-[#0d1117]">New</option>
                               <option value="pending" className="bg-[#0d1117]">Pending</option>
                               <option value="scheduled" className="bg-[#0d1117]">Scheduled</option>
                               <option value="in_progress" className="bg-[#0d1117]">In Progress</option>
                               <option value="delivered" className="bg-[#0d1117]">Delivered</option>
                             </select>
                          </td>
                          <td className="px-5 py-4 text-right">
                             <div className="flex justify-end gap-2">
                               <Button size="sm" variant="outline" className="h-7 text-[11px] border-white/10 text-white" onClick={() => setSelectedPrepForDetails(p)}>
                                 Details
                               </Button>
                               <Button size="sm" className="h-7 text-[11px] bg-white/5 text-white hover:bg-white/10 border border-white/5" disabled={uploadingId === p.id} onClick={() => { if(p.type === 'coaching' && !meetingLinks[p.id] && !p.meeting_link) { toast.error('Enter meeting link first'); return; } fileRefs.current[p.id]?.click(); }}>
                                  Upload Script
                               </Button>
                             </div>
                             <input ref={(el) => { fileRefs.current[p.id] = el; }} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { uploadPrepScript(p, f); } e.target.value = ""; }} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              )}
              
              {/* Settings Tab */}
              {activeTab === "Settings" && (
                <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-8 shadow-xl max-w-3xl mx-auto">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                      <Settings className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">Settings</h2>
                      <p className="text-muted-foreground">Manage your partner profile and preferences</p>
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-white">Display Name</label>
                        <Input value={profileData?.full_name || ''} onChange={(e) => setProfileData({...profileData, full_name: e.target.value})} className="bg-white/5 border-white/10 text-white" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-white">Email Address (Read Only)</label>
                        <Input value={user?.email || ''} readOnly className="bg-white/5 border-white/10 text-muted-foreground opacity-70" />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Specialisation / Bio</label>
                      <textarea value={profileData?.career_summary || ''} onChange={(e) => setProfileData({...profileData, career_summary: e.target.value})} className="w-full h-24 bg-white/5 border border-white/10 rounded-md p-3 text-sm text-white resize-none focus:outline-none focus:border-primary/50" placeholder="E.g. Senior Tech Recruiter with 10+ years experience..." />
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-white">Email Notifications</p>
                        <p className="text-xs text-muted-foreground">Receive alerts for new requests and messages</p>
                      </div>
                      <Switch checked={notifyPrefs} onCheckedChange={setNotifyPrefs} />
                    </div>
                    
                    <div className="pt-6 border-t border-white/5 space-y-4">
                      <h3 className="text-sm font-semibold text-white">Change Password</h3>
                      <div className="max-w-sm space-y-3">
                        <div className="relative">
                          <Input type={showOldPw ? "text" : "password"} placeholder="Current Password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="bg-white/5 border-white/10 text-white pr-10" />
                          <button type="button" onClick={() => setShowOldPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white">
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="relative">
                          <Input type={showNewPw ? "text" : "password"} placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="bg-white/5 border-white/10 text-white pr-10" />
                          <button type="button" onClick={() => setShowNewPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white">
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="relative">
                          <Input type={showConfirmPw ? "text" : "password"} placeholder="Confirm New Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`bg-white/5 border-white/10 text-white pr-10 ${confirmPassword && confirmPassword !== newPassword ? 'border-red-500/50' : ''}`} />
                          <button type="button" onClick={() => setShowConfirmPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white">
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                        {confirmPassword && confirmPassword !== newPassword && (
                          <p className="text-xs text-red-400">Passwords do not match</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                      <Button variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => { signOut(); navigate("/partner/landing"); }}>
                        <LogOut className="w-4 h-4 mr-2" /> Sign Out
                      </Button>
                      <Button onClick={handleSaveSettings} disabled={settingsLoading} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                        {settingsLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Settings className="w-4 h-4 mr-2" />}
                        Save Changes
                      </Button>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Right Column (Secondary) */}
            <div className="w-full xl:w-80 space-y-6 shrink-0">
              
              {/* About Partnership */}
              <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-5 shadow-xl">
                <h3 className="text-sm font-semibold text-white mb-4">About Your Partnership</h3>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Gem className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-lg font-bold text-white">TalentHub</span>
                </div>
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                  Proud partner in empowering professionals through expert CV revamp and career coaching.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border border-white/5" onClick={() => { setActiveTab('CV Revamp'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-primary" />
                      <div>
                        <p className="text-sm font-medium text-white">CV Revamp</p>
                        <p className="text-[10px] text-muted-foreground">Polish. Strengthen. Stand out.</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border border-white/5" onClick={() => { setActiveTab('Coaching'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                    <div className="flex items-center gap-3">
                      <Video className="w-4 h-4 text-primary" />
                      <div>
                        <p className="text-sm font-medium text-white">Coaching</p>
                        <p className="text-[10px] text-muted-foreground">Guidance. Preparation. Growth.</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </div>

              {/* Your Impact */}
              <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-sm font-semibold text-white">Your Impact</h3>
                  <span className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer">All Time <ChevronDown className="w-3 h-3" /></span>
                </div>
                <div className="space-y-4">
                  <ImpactRow icon={<Users />} label="Professional Helpdesk — All Time" value={totalCompleted.toString()} />
                  <ImpactRow icon={<FileText />} label="Resumes Improved — All Time" value={deliveredRevamps.length.toString()} />
                  <ImpactRow icon={<Video />} label="Coaching Hours — All Time" value={deliveredPreps.length.toString()} />
                  <ImpactRow icon={<Star />} label="Satisfaction Rate - All Time" value="4.9 / 5" />
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
                  <span className="text-xs text-primary hover:underline cursor-pointer">View all</span>
                </div>
                <div className="space-y-4">
                  {recentActivity.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No recent activity.</p>
                  ) : (
                    recentActivity.slice(0, 5).map((item, i) => (
                      <ActivityItem 
                        key={item.id + i} 
                        icon={item.type === 'revamp' ? <FileText /> : <Video />} 
                        text={`Delivered ${item.type === 'revamp' ? 'CV' : 'Coaching'}: ${item.title}`} 
                        time={timeAgo(item.date)} 
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {detailModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            variants={modalOverlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.div
              className="bg-[#0d1117] border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl"
              variants={modalContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">Request Details</h2>
                <button onClick={() => setDetailModal(null)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Request ID</span><span className="font-mono text-white">CVR-{detailModal.id.substring(0,4).toUpperCase()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Target Role</span><span className="text-white">{detailModal.target_job_title || 'General Update'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Date Submitted</span><span className="text-white">{new Date(detailModal.created_at).toLocaleDateString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Date Delivered</span><span className="text-white">{detailModal.delivered_at ? new Date(detailModal.delivered_at).toLocaleDateString() : '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="text-green-400 font-semibold capitalize">{detailModal.fulfilment_status}</span></div>
                {detailModal.partner_notes && <div className="bg-white/5 rounded-xl p-3 border border-white/5"><p className="text-xs text-muted-foreground mb-1">Partner Notes</p><p className="text-white text-sm">{detailModal.partner_notes}</p></div>}
              </div>
              <div className="flex flex-col gap-2 mt-6">
                {detailModal.cv_path && (
                  <Button 
                    variant="outline" 
                    className="w-full border-green-500/40 text-green-400 hover:bg-green-500/10" 
                    onClick={() => downloadMergedFile(detailModal.cv_path, detailModal.attachment_paths, `CV_and_Docs_CVR-${detailModal.id.substring(0,4).toUpperCase()}.pdf`)}
                  >
                    Download Merged Original CV & Docs
                  </Button>
                )}
                {detailModal.additional_attachment_paths && detailModal.additional_attachment_paths.length > 0 && (
                  <Button 
                    variant="outline" 
                    className="w-full border-amber-500/40 text-amber-400 hover:bg-amber-500/10" 
                    onClick={() => downloadMergedFile(null, detailModal.additional_attachment_paths, `Additional_Docs_CVR-${detailModal.id.substring(0,4).toUpperCase()}.pdf`)}
                  >
                    Download Merged Additional Docs
                  </Button>
                )}
                {detailModal.revamped_cv_path && (
                  <Button 
                    className="w-full bg-primary/20 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground" 
                    onClick={() => downloadFile(detailModal.revamped_cv_path!, "delivered-cvs")}
                  >
                    Download Revamped CV
                  </Button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Request Documents Panel */}
      <AnimatePresence>
        {docRequestId && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            variants={modalOverlayVariants} initial="hidden" animate="visible" exit="exit"
          >
            <motion.div
              className="bg-[#0d1117] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl"
              variants={modalContentVariants} initial="hidden" animate="visible" exit="exit"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-white">Request Documents from User</h2>
                <button onClick={() => setDocRequestId(null)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Select which documents you need:</p>
              <div className="space-y-2 mb-4">
                {DOC_CHECKLIST_OPTIONS.map(opt => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={docChecklist.includes(opt)} onChange={e => setDocChecklist(p => e.target.checked ? [...p, opt] : p.filter(x => x !== opt))} className="rounded" />
                    <span className="text-sm text-white/80 group-hover:text-white">{opt}</span>
                  </label>
                ))}
              </div>
              <textarea value={docNote} onChange={e => setDocNote(e.target.value)} placeholder="Add a note to the user (optional)" className="w-full h-20 bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white resize-none focus:outline-none focus:border-primary/50 mb-4" />
              <Button onClick={() => { const r = revamps.find(x => x.id === docRequestId); if (r) sendDocRequest(docRequestId, r.user_id); }} disabled={sendingDocReq || docChecklist.length === 0} className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold">
                {sendingDocReq ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Request'}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Coaching Prep Details Modal */}
      <AnimatePresence>
        {selectedPrepForDetails && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            variants={modalOverlayVariants} initial="hidden" animate="visible" exit="exit"
          >
            <motion.div
              className="bg-[#0d1117] border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[85vh]"
              variants={modalContentVariants} initial="hidden" animate="visible" exit="exit"
            >
              <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-white">Coaching Session Details</h2>
                  <p className="text-xs text-muted-foreground">Session ID: CS-{selectedPrepForDetails.id.substring(0, 4).toUpperCase()}</p>
                </div>
                <button onClick={() => setSelectedPrepForDetails(null)} className="text-muted-foreground hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4 text-sm text-left">
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Session Type</span>
                  <span className="text-white font-semibold capitalize">{selectedPrepForDetails.type}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Target Role</span>
                  <span className="text-white font-semibold">{selectedPrepForDetails.target_role || "General"}</span>
                </div>
                {selectedPrepForDetails.jobs ? (
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-3 text-left">
                    <p className="text-xs font-bold text-primary uppercase tracking-wider">Internal Job Post Details</p>
                    <div>
                      <p className="text-sm font-semibold text-white">{selectedPrepForDetails.jobs.title}</p>
                      <p className="text-xs text-muted-foreground">{selectedPrepForDetails.jobs.company} • {selectedPrepForDetails.jobs.location}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Description</span>
                      <p className="text-xs text-white/80 whitespace-pre-wrap mt-0.5 max-h-40 overflow-y-auto pr-1">{selectedPrepForDetails.jobs.description}</p>
                    </div>
                    {selectedPrepForDetails.jobs.skills && selectedPrepForDetails.jobs.skills.length > 0 && (
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Required Skills</span>
                        <div className="flex flex-wrap gap-1">
                          {selectedPrepForDetails.jobs.skills.map((s, idx) => (
                            <span key={idx} className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-3 text-left">
                    <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">External / Custom Uploads</p>
                    <p className="text-xs text-muted-foreground">The candidate did not apply to an internal role. Please refer to their uploaded job description files below:</p>
                    {selectedPrepForDetails.attachment_paths && selectedPrepForDetails.attachment_paths.length > 0 ? (
                      <div className="space-y-1.5">
                        {selectedPrepForDetails.attachment_paths.map((p, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-black/30 p-2 rounded border border-white/5">
                            <span className="text-xs text-white/80 truncate pr-4">{p.split("/").pop()}</span>
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] text-primary hover:text-primary hover:bg-primary/10" onClick={() => downloadFile(p, "app-docs")}>
                              <Download className="w-3 h-3 mr-1" /> Download
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No description files uploaded.</p>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-6 pt-3 border-t border-white/5 flex justify-end">
                <Button onClick={() => setSelectedPrepForDetails(null)} className="bg-primary text-primary-foreground rounded-xl">Close</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CV Workshop Modal */}
      <AnimatePresence>
        {workshopRequest && (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            variants={modalOverlayVariants} initial="hidden" animate="visible" exit="exit"
          >
            <motion.div
              className="bg-[#0a0c10] border border-white/10 rounded-3xl w-full h-[95vh] flex flex-col shadow-2xl overflow-hidden max-w-[1700px]"
              variants={modalContentVariants} initial="hidden" animate="visible" exit="exit"
            >
              {/* Workshop Header */}
              <div className="h-16 px-6 border-b border-white/5 bg-[#0d1117] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                    <PenLine className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-sm font-bold text-white">CV Workshop — CVR-{workshopRequest.id.substring(0, 4).toUpperCase()}</h2>
                    <p className="text-[10px] text-muted-foreground">Target Role: {workshopRequest.target_job_title || "General"}</p>
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCompareView(!compareView)}
                    className={`h-8 text-xs border-white/10 ${compareView ? 'bg-primary/20 text-primary border-primary/30' : 'bg-transparent text-white'}`}
                  >
                    Compare View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAtsPreview(!atsPreview)}
                    className={`h-8 text-xs border-white/10 ${atsPreview ? 'bg-primary/20 text-primary border-primary/30' : 'bg-transparent text-white'}`}
                  >
                    ATS Preview
                  </Button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2.5">
                  <Button
                    onClick={handleRegenerate}
                    disabled={busy}
                    className="h-8 text-xs bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 font-bold"
                  >
                    Regenerate AI
                  </Button>
                  <Button
                    onClick={handleSendToClient}
                    disabled={busy}
                    className="h-8 text-xs bg-forest hover:bg-forest/90 text-white font-bold"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : 'Send to Client'}
                  </Button>
                  <button
                    onClick={() => setWorkshopRequest(null)}
                    className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 3-Panel Content Area */}
              <div className="flex-1 flex overflow-hidden divide-x divide-white/5">
                {/* LEFT PANEL: Merged Document Viewer */}
                <div className={`${compareView ? 'w-1/2' : 'w-1/3'} flex flex-col p-5 overflow-hidden gap-3`}>
                  <div className="flex items-center justify-between shrink-0">
                    <div className="text-left">
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">Candidate Attachments</h3>
                      <p className="text-[10px] text-muted-foreground">Original CV + supporting certificates package</p>
                    </div>
                    {workshopRequest.cv_path && (
                      <Button
                        variant="link"
                        size="sm"
                        className="text-primary text-[10px] p-0 h-auto font-bold"
                        onClick={() => downloadMergedFile(workshopRequest.cv_path, workshopRequest.attachment_paths, `Original_Docs_${workshopRequest.id.substring(0,4)}.pdf`)}
                      >
                        Download All Merged
                      </Button>
                    )}
                  </div>

                  {/* Merged PDF Preview Container */}
                  <div className="flex-1 bg-black/40 rounded-2xl border border-white/5 overflow-hidden">
                    {merging ? (
                      <div className="flex flex-col items-center justify-center h-full gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        <p className="text-[10px] text-muted-foreground">Merging documents package...</p>
                      </div>
                    ) : mergedPdfUrl ? (
                      <iframe src={mergedPdfUrl} className="w-full h-full border-none bg-white" title="Merged PDF Preview" />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center p-6 gap-2">
                        <FileText className="w-10 h-10 text-muted-foreground" />
                        <p className="text-xs font-semibold text-white">No CV Preview Available</p>
                        <p className="text-[10px] text-muted-foreground max-w-xs">We couldn't compile a live PDF package. You can download files individually below.</p>
                      </div>
                    )}
                  </div>

                  {/* Individual Download List */}
                  <div className="h-28 shrink-0 overflow-y-auto space-y-1.5 border-t border-white/5 pt-3">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 text-left">Attached Files</p>
                    {workshopRequest.cv_path && (
                      <div className="flex items-center justify-between bg-white/[0.02] p-1.5 rounded-lg border border-white/5">
                        <span className="text-[11px] text-white/80 truncate max-w-[200px]">Candidate CV</span>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] text-primary" onClick={() => downloadFile(workshopRequest.cv_path!, "revamp-documents")}>
                          Download
                        </Button>
                      </div>
                    )}
                    {(workshopRequest.attachment_paths || []).map((path, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white/[0.02] p-1.5 rounded-lg border border-white/5">
                        <span className="text-[11px] text-white/80 truncate max-w-[200px]">{path.split("/").pop()}</span>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] text-primary" onClick={() => downloadFile(path, "revamp-documents")}>
                          Download
                        </Button>
                      </div>
                    ))}
                    {workshopRequest.requested_documents && workshopRequest.requested_documents.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-white/5 space-y-1.5">
                        <p className="text-[9px] uppercase tracking-wider text-amber-500 font-semibold mb-1 text-left">Coach Requested Files</p>
                        {workshopRequest.requested_documents.map((label: string) => {
                          const path = (workshopRequest.additional_attachments_map as any)?.[label];
                          return (
                            <div key={label} className="flex items-center justify-between bg-amber-500/[0.02] p-1.5 rounded-lg border border-amber-500/10">
                              <div className="flex flex-col min-w-0">
                                <span className="text-[11px] text-white/85 font-medium">{label}</span>
                                <span className="text-[9px] text-muted-foreground truncate max-w-[180px]">
                                  {path ? path.split("/").pop() : "Awaiting upload"}
                                </span>
                              </div>
                              {path ? (
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] text-primary" onClick={() => downloadFile(path, "revamp-documents")}>
                                  Download
                                </Button>
                              ) : (
                                <span className="text-[9px] text-amber-500/60 font-semibold uppercase px-1.5 py-0.5 bg-amber-500/5 border border-amber-500/10 rounded">Pending</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* CENTRE PANEL: Narrative Editor */}
                <div className="flex-1 flex flex-col p-5 overflow-hidden gap-3">
                  {["new", "pending", "paid"].includes(workshopRequest.fulfilment_status) ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-[#0d1117]/30 rounded-2xl border border-white/5 gap-4">
                      <div className="relative w-24 h-24 mb-2">
                        <img
                          src={mascot}
                          alt="Teemane mascot"
                          className="w-full h-full object-contain animate-bob drop-shadow-[0_0_12px_rgba(130,200,80,0.3)]"
                        />
                      </div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">AI CV Generation Pending</h3>
                      <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                        This request has not been processed by our AI panel yet. Activate the Qwen 3-model debate loop to analyze, review, and draft the first narrative version of this CV.
                      </p>
                      <Button
                        onClick={handleRegenerate}
                        disabled={busy}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-10 px-6 rounded-xl text-xs flex items-center gap-2 mt-2"
                      >
                        🤖 Activate AI Debate Loop
                      </Button>
                    </div>
                  ) : ["assigned", "ai_processing"].includes(workshopRequest.fulfilment_status) ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-[#0d1117]/30 rounded-2xl border border-white/5 gap-4">
                      <div className="relative w-24 h-24 mb-2">
                        <div className="absolute inset-1 rounded-full border border-success/20 animate-ping" />
                        <img
                          src={mascot}
                          alt="Teemane mascot"
                          className="w-full h-full object-contain animate-bob drop-shadow-[0_0_12px_rgba(130,200,80,0.4)]"
                        />
                      </div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">AI Debate Loop Running</h3>
                      <p className="text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
                        {(workshopRequest.ai_debate_step ?? 0) <= 1 ? "Estimated time: 2 mins" :
                         (workshopRequest.ai_debate_step ?? 0) <= 3 ? "Estimated time: 1.5 mins" :
                         (workshopRequest.ai_debate_step ?? 0) <= 5 ? "Estimated time: 45 secs" :
                         (workshopRequest.ai_debate_step ?? 0) === 6 ? "Estimated time: 15 secs" : "Writing final results..."}
                      </p>

                      <div className="mt-4 space-y-2.5 w-full max-w-xs text-left bg-white/[0.01] border border-white/5 p-4 rounded-2xl">
                        {[
                          { step: 1, label: "Uploading CV to AI panel" },
                          { step: 2, label: "ATS Expert reviewing CV" },
                          { step: 3, label: "Writing Quality Expert review" },
                          { step: 4, label: "Comparing notes & debate" },
                          { step: 5, label: "Arbitrator crafting rewritten CV" },
                          { step: 6, label: "Final rescoring check" },
                          { step: 7, label: "Ready for Coach review" }
                        ].map((s) => {
                          const activeStep = workshopRequest.fulfilment_status === "assigned" ? 1 : (workshopRequest.ai_debate_step ?? 1);
                          const done = s.step < activeStep;
                          const current = s.step === activeStep;

                          return (
                            <div key={s.step} className="flex items-center gap-2.5">
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${
                                done ? "bg-success text-success-foreground" : current ? "bg-primary text-primary-foreground animate-pulse" : "bg-white/5 text-muted-foreground border border-white/10"
                              }`}>
                                {done ? <Check className="w-2.5 h-2.5" /> : s.step}
                              </div>
                              <span className={`text-[11px] ${current ? "text-white font-bold" : done ? "text-white/70" : "text-muted-foreground"}`}>
                                {s.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between shrink-0">
                        <div className="text-left">
                          <h3 className="text-xs font-bold text-white uppercase tracking-wider">AI CV Narrative Editor</h3>
                          <p className="text-[10px] text-muted-foreground">Edit narrative or formatting directly in Botswana job context</p>
                        </div>
                        <div className="bg-primary/10 text-primary text-[10px] px-2.5 py-1 rounded-full font-bold">
                          {editedCvText.split(/\s+/).filter(Boolean).length} words • {Math.max(1, Math.round(editedCvText.split(/\s+/).filter(Boolean).length / 200))} min read
                        </div>
                      </div>

                      <div className="flex-1 bg-black/40 rounded-2xl border border-white/5 overflow-hidden p-4">
                        {atsPreview ? (
                          <pre className="w-full h-full font-mono text-[11px] text-zinc-300 overflow-y-auto whitespace-pre-wrap leading-relaxed text-left">
                            {editedCvText || "(CV is empty)"}
                          </pre>
                        ) : (
                          <textarea
                            value={editedCvText}
                            onChange={(e) => setEditedCvText(e.target.value)}
                            placeholder="Write or edit the CV contents here in markdown format..."
                            className="w-full h-full bg-transparent text-xs text-white resize-none focus:outline-none leading-relaxed overflow-y-auto font-sans pr-2 text-left"
                          />
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* RIGHT PANEL: AI Debate Timeline & Document Checklist */}
                {!compareView && (
                  ["new", "pending", "paid", "assigned", "ai_processing"].includes(workshopRequest.fulfilment_status) ? (
                    <div className="w-80 shrink-0 flex flex-col items-center justify-center text-center p-5 gap-3 bg-[#0d1117]/20 border-l border-white/5 bg-white/[0.01]">
                      <PenLine className="w-8 h-8 text-muted-foreground/30 animate-pulse" />
                      <p className="text-xs font-semibold text-white/60">Awaiting AI Debate Results</p>
                      <p className="text-[10px] text-muted-foreground max-w-[200px] leading-relaxed">
                        Once the AI debate loop completes, the round metrics, arbitrator summary, changes log, and missing certificate alerts will load here.
                      </p>
                    </div>
                  ) : (
                    <div className="w-80 shrink-0 flex flex-col p-5 overflow-y-auto gap-5 bg-white/[0.01]">
                    {/* Score Timeline */}
                    <div className="text-left">
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">AI Debate Timeline</h3>
                      <div className="space-y-3.5">
                        {((workshopRequest.ai_debate_report as any)?.rounds || []).map((r: any, idx: number) => (
                          <div key={idx} className="border-l-2 border-primary/30 pl-4 py-1.5 relative text-xs">
                            <div className="absolute w-2 h-2 bg-primary rounded-full -left-[5px] top-2" />
                            <p className="font-bold text-white/90">Round {r.attempt || (idx + 1)} Debate</p>
                            <div className="grid grid-cols-2 gap-1 text-[10px] text-muted-foreground mt-1">
                              <div>ATS R1: <span className="font-semibold text-white">{r.max_round1?.overall_score || 0}%</span></div>
                              <div>Narrative R1: <span className="font-semibold text-white">{r.plus_round1?.overall_score || 0}%</span></div>
                              <div>ATS Debate: <span className="font-semibold text-white">{r.max_round2?.overall_score || 0}%</span></div>
                              <div>Narrative Debate: <span className="font-semibold text-white">{r.plus_round2?.overall_score || 0}%</span></div>
                            </div>
                            <p className="text-[10px] text-primary font-bold mt-1">Consensus: {r.consensus_score || 0}%</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* AI Comments Summary */}
                    <div className="border-t border-white/5 pt-4 text-left">
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2">AI Summary & Recommendations</h3>
                      <div className="bg-white/5 border border-white/5 p-3.5 rounded-2xl text-[11px] leading-relaxed text-muted-foreground">
                        {(workshopRequest.ai_debate_report as any)?.ai_summary_comment || "No summary comments from arbitrator."}
                      </div>
                    </div>

                    {/* Missing Documents Checklist Alerts */}
                    {((workshopRequest.ai_debate_report as any)?.missing_docs_detected || []).length > 0 && (
                      <div className="border-t border-white/5 pt-4 space-y-2.5 text-left">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider">Flagged Missing Files</h3>
                          <span className="text-[9px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded font-bold">Alert</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-normal">
                          The AI detected qualifications mentioned in text but missing from attachments:
                        </p>
                        <ul className="list-disc pl-4 text-[10px] text-amber-500/80 space-y-1">
                          {((workshopRequest.ai_debate_report as any)?.missing_docs_detected || []).map((doc: string, idx: number) => (
                            <li key={idx} className="leading-snug">{doc}</li>
                          ))}
                        </ul>
                        <Button
                          onClick={() => {
                            const report = (workshopRequest.ai_debate_report as any) || {};
                            const missing = report.missing_docs_detected || [];
                            
                            const mapped: string[] = [];
                            let otherNote = "";
                            
                            missing.forEach((item: string) => {
                              const lower = item.toLowerCase();
                              if (lower.includes("academic") || lower.includes("degree") || lower.includes("diploma") || lower.includes("university") || lower.includes("transcript") || lower.includes("school")) {
                                if (!mapped.includes("Academic Certificates")) mapped.push("Academic Certificates");
                              } else if (lower.includes("cert") || lower.includes("bica") || lower.includes("course") || lower.includes("short")) {
                                if (!mapped.includes("Professional Certifications")) mapped.push("Professional Certifications");
                              } else if (lower.includes("licen") || lower.includes("member") || lower.includes("board") || lower.includes("regulatory") || lower.includes("card")) {
                                if (!mapped.includes("Professional Memberships / Licenses")) mapped.push("Professional Memberships / Licenses");
                              } else if (lower.includes("refer")) {
                                if (!mapped.includes("References")) mapped.push("References");
                              } else if (lower.includes("id") || lower.includes("omang") || lower.includes("passport")) {
                                if (!mapped.includes("ID / Passport")) mapped.push("ID / Passport");
                              } else if (lower.includes("driver") || lower.includes("driving")) {
                                if (!mapped.includes("Driving License")) mapped.push("Driving License");
                              } else {
                                if (!mapped.includes("Other")) mapped.push("Other");
                                otherNote += (otherNote ? ", " : "") + item;
                              }
                            });
                            
                            if (mapped.length === 0) mapped.push("Other");
                            
                            setDocRequestId(workshopRequest.id);
                            setDocChecklist(mapped);
                            setDocNote(otherNote ? `The AI flagged these missing documents: ${otherNote}` : "Please provide these documents to complete your CV revamp.");
                            setWorkshopRequest(null);
                          }}
                          className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold h-8 text-[11px] rounded-xl"
                        >
                          Request Flagged Files
                        </Button>
                      </div>
                    )}

                    {/* AI Changes Log */}
                    {((workshopRequest.ai_debate_report as any)?.changes_made || []).length > 0 && (
                      <div className="border-t border-white/5 pt-4 text-left">
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Changes Made</h3>
                        <ul className="list-disc pl-4 text-[10px] text-muted-foreground space-y-1">
                          {((workshopRequest.ai_debate_report as any)?.changes_made || []).map((item: string, idx: number) => (
                            <li key={idx} className="leading-snug">{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  )
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SidebarItem = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${active ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground hover:bg-white/5 hover:text-white'}`}>
    {icon} {label}
  </button>
);

const MetricCard = ({ icon, label, value, trend }: { icon: React.ReactNode, label: string, value: string, trend: string }) => (
  <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-5 shadow-xl relative overflow-hidden group">
    <div className="flex justify-between items-start mb-4">
      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
        {icon}
      </div>
      <h3 className="text-[28px] font-bold text-white leading-none">{value}</h3>
    </div>
    <p className="text-sm text-white/80 font-medium mb-2">{label}</p>
    <p className="text-xs text-primary/80 flex items-center gap-1 font-medium">
      <Activity className="w-3 h-3" /> {trend}
    </p>
    {/* Abstract background shape */}
    <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-colors" />
  </div>
);

const StatusBadge = ({ status }: { status: string }) => {
  const isNew = status === 'new' || status === 'pending' || status === 'paid';
  const isProg = status === 'in_progress' || status === 'assigned' || status === 'ai_processing' || status === 'ai_complete';
  const isDocs = status === 'docs_requested';
  
  let color = 'text-muted-foreground bg-white/5 border-white/10';
  if (isNew) color = 'text-primary bg-primary/10 border-primary/20';
  else if (isProg) color = 'text-orange-400 bg-orange-400/10 border-orange-400/20';
  else if (isDocs) color = 'text-amber-500 bg-amber-500/10 border-amber-500/20';
  
  const label = isNew ? 'New' : isProg ? 'In Progress' : status === 'docs_requested' ? 'Docs Requested' : status === 'partner_reviewing' ? 'Reviewing' : status;
  return <span className={`inline-flex px-2.5 py-1 rounded-md text-[11px] font-semibold border ${color} capitalize tracking-wide`}>{label}</span>;
};

const ImpactRow = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
  <div className="flex items-center justify-between text-sm">
    <div className="flex items-center gap-3 text-muted-foreground">
      <span className="text-primary">{icon}</span> {label}
    </div>
    <span className="font-semibold text-white">{value}</span>
  </div>
);

const ActivityItem = ({ icon, text, time }: { icon: React.ReactNode, text: string, time: string }) => (
  <div className="flex gap-3 items-start">
    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-primary shrink-0 mt-0.5">
      {icon}
    </div>
    <div>
      <p className="text-sm text-white/90 leading-snug">{text}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{time}</p>
    </div>
  </div>
);

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min${mins !== 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
  return new Date(dateStr).toLocaleDateString();
};

export { PartnerDashboard as default };
