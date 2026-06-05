import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, User, FileText, Bell, Settings, HelpCircle, LogOut, ChevronRight, Shield, Video, CheckCircle2, Zap, Gem, Download, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Profile = () => {
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [cvRequests, setCvRequests] = useState<any[]>([]);
  const [revampedCvs, setRevampedCvs] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()
      .then(({ data }) => setProfile(data));

    // Fetch revamped CVs that are not active yet
    (supabase as any).from("cv_versions")
      .select("*")
      .eq("user_id", user?.id)
      .eq("is_main", false)
      .order("created_at", { ascending: false })
      .then(({ data }: any) => {
        setRevampedCvs(data || []);
      });

    // Fetch pending CV requests
    supabase.from("cv_requests")
      .select("id, status, employer_id, created_at")
      .eq("candidate_id", user.id)
      .eq("status", "pending")
      .then(async ({ data }) => {
        if (data && data.length > 0) {
          const requestsWithDetails = await Promise.all(data.map(async (req) => {
            const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", req.employer_id).maybeSingle();
            const { data: member } = await supabase.from("company_members").select("companies(name, logo_url)").eq("user_id", req.employer_id).maybeSingle();
            
            return {
              ...req,
              employer_name: prof?.full_name || "An employer",
              company_name: (member?.companies as any)?.name || null,
              company_logo: (member?.companies as any)?.logo_url || null,
            };
          }));
          setCvRequests(requestsWithDetails);
        } else {
          setCvRequests([]);
        }
      });
  }, [user]);

  const handleApproveRequest = async (req: any) => {
    if (!profile?.cv_path) {
      toast.error("Please upload your CV first before sharing.", {
        action: {
          label: "Upload CV",
          onClick: () => navigate("/upload-cv"),
        }
      });
      return;
    }
    
    try {
      const { error } = await supabase
        .from("cv_requests")
        .update({
          status: "sent",
          cv_path: profile.cv_path,
        } as any)
        .eq("id", req.id);
        
      if (error) throw error;
      
      await supabase.from("notifications").insert([
        {
          user_id: req.employer_id,
          title: "CV Request Approved",
          body: `${profile.full_name || "A candidate"} has shared their CV with you.`,
          type: "cv_approved",
        },
      ]);
      
      toast.success("CV shared successfully!");
      setCvRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (err: any) {
      toast.error(err.message || "Failed to share CV.");
    }
  };

  const handleDeclineRequest = async (req: any) => {
    try {
      const { error } = await supabase
        .from("cv_requests")
        .update({
          status: "declined",
        } as any)
        .eq("id", req.id);
        
      if (error) throw error;
      
      toast.success("Request declined.");
      setCvRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (err: any) {
      toast.error(err.message || "Failed to decline request.");
    }
  };

  const handleSetMainCv = async (cv: any) => {
    setBusy(true);
    try {
      await (supabase as any).from("cv_versions").update({ is_main: false } as any).eq("user_id", user?.id);
      await (supabase as any).from("cv_versions").update({ is_main: true } as any).eq("id", cv.id);
      
      const { error } = await supabase.from("profiles").update({
        cv_path: cv.storage_path,
        cv_filename: cv.filename,
      }).eq("id", user?.id as string);

      if (error) throw error;

      toast.success("Revamped CV set as your main profile CV!");
      setRevampedCvs((prev) => prev.filter((c) => c.id !== cv.id));
      
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user?.id as string).maybeSingle();
      if (prof) setProfile(prof);
    } catch (e: any) {
      toast.error("Could not set as main CV: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadCv = async (cv: any) => {
    const { data, error } = await supabase.storage.from("delivered-cvs").createSignedUrl(cv.storage_path, 120);
    if (error || !data) {
      toast.error("Could not generate download link");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    navigate("/welcome");
  };

  const goCvDocs = () => navigate(profile?.cv_path ? "/cv-documents" : "/upload-cv");

  // Derive values BEFORE using them
  const accountType = profile?.account_type ?? "premium";
  const initial = (profile?.full_name ?? user?.email ?? "?")[0]?.toUpperCase();
  const isQuickJobs = accountType === "quick_jobs";
  const expiresAt = profile?.subscription_expires_at;
  const isActive = profile?.subscription_status === "active" && expiresAt && new Date(expiresAt) > new Date();

  // Job poster: only personal info + log out
  const jobPosterItems = [
    { icon: User, label: "Personal Information", onClick: () => navigate("/profile-details") },
    { icon: LogOut, label: "Log Out", onClick: handleSignOut },
  ];

  const items = isAdmin
    ? [
        { icon: Shield, label: "Admin Dashboard", onClick: () => navigate("/admin") },
        { icon: Settings, label: "Settings", onClick: () => navigate("/settings") },
        { icon: HelpCircle, label: "Privacy & Help", onClick: () => navigate("/privacy") },
        { icon: LogOut, label: "Log Out", onClick: handleSignOut },
      ]
    : isQuickJobs
    ? jobPosterItems
    : [
        { icon: User, label: "Personal Information", onClick: () => navigate("/profile-details") },
        { icon: FileText, label: "CV & Documents", onClick: goCvDocs },
        { icon: Video, label: "Interview Preparation", onClick: () => navigate("/interview-prep") },
        { icon: CheckCircle2, label: "Delivered Services", onClick: () => navigate("/delivered-services") },
        { icon: Bell, label: "Notifications", onClick: () => navigate("/notifications") },
        { icon: Settings, label: "Settings", onClick: () => navigate("/settings") },
        { icon: HelpCircle, label: "Privacy & Help", onClick: () => navigate("/privacy") },
        { icon: LogOut, label: "Log Out", onClick: handleSignOut },
      ];

  return (
    <div className="flex-1 flex flex-col p-5">
      <div className="flex items-center gap-3 pb-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-glow to-primary flex items-center justify-center text-forest-foreground font-bold text-xl">
          {initial}
        </div>
        <div>
          <p className="font-bold">{profile?.full_name || "Welcome"}</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      {/* Revamped CV Glassmorphic Banner */}
      {revampedCvs.length > 0 && (
        <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl p-4 mb-4 flex flex-col gap-3 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all -z-10" />
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center font-bold text-primary flex-shrink-0">
              <Gem className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-0.5">CV Revamp Delivered</p>
              <h4 className="font-bold text-sm text-white truncate">
                {revampedCvs[0].filename}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5 leading-normal">
                Your coach has delivered your revamped CV! Set it as your main CV to apply for jobs.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => handleSetMainCv(revampedCvs[0])}
              disabled={busy}
              className="flex-1 h-9 rounded-xl bg-forest hover:bg-forest/90 text-white font-semibold text-xs active:scale-[0.98] transition-all"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : "Set as Main CV"}
            </Button>
            <Button
              onClick={() => handleDownloadCv(revampedCvs[0])}
              variant="outline"
              className="h-9 px-4 rounded-xl border-white/10 text-white font-semibold text-xs active:scale-[0.98] transition-all"
            >
              <Download className="w-3.5 h-3.5 mr-1" /> Download
            </Button>
          </div>
        </div>
      )}

      {isQuickJobs ? (
        // ---- Job Poster upsell banner ----
        <div className="space-y-3">
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3 shadow-card">
            <Zap className="w-7 h-7 text-primary" />
            <div>
              <p className="font-semibold text-sm">Job Poster Account</p>
              <p className="text-[11px] text-muted-foreground">Post quick gigs in Botswana.</p>
            </div>
          </div>
          {/* Subscription upsell */}
          <div className="bg-gradient-to-br from-forest to-forest/80 rounded-2xl p-5 text-forest-foreground">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-5 h-5 text-warning" />
              <p className="font-bold text-sm">Unlock the full Talenthub experience</p>
            </div>
            <p className="text-xs opacity-80 mb-4 leading-relaxed">
              Browse and swipe on jobs, get AI-powered cover letters, CV scoring, Interview Prep and more. Start with a free 3-day trial.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => navigate("/subscribe")}
                className="w-full h-10 rounded-xl bg-warning text-warning-foreground font-semibold text-sm flex items-center justify-center gap-2"
              >
                <Crown className="w-4 h-4" /> Start 3-Day Free Trial
              </button>
              <p className="text-[10px] text-center opacity-60">Then P50/month. Cancel anytime.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className={`${isActive ? "bg-forest text-forest-foreground" : "bg-card border border-border"} rounded-2xl p-4 flex items-center gap-3 shadow-card`}>
          <Crown className={`w-7 h-7 ${isActive ? "text-warning" : "text-muted-foreground"}`} />
          <div className="flex-1">
            <p className="font-semibold text-sm flex items-center gap-2">
              {isActive ? "Active" : "Inactive"}
              <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-bold ${isActive ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"}`}>
                {isActive ? "Subscribed" : "No subscription"}
              </span>
            </p>
            <p className={`text-[11px] ${isActive ? "opacity-80" : "text-muted-foreground"}`}>
              {isActive
                ? `Active until ${new Date(expiresAt).toLocaleDateString()}`
                : "P50/month unlocks job matching, AI cover letters and more"}
            </p>
          </div>
          {!isActive && (
            <button onClick={() => navigate("/subscribe")} className="text-xs font-semibold text-primary">
              Renew
            </button>
          )}
        </div>
      )}

      {cvRequests.length > 0 && (
        <div className="mt-4 space-y-3">
          {cvRequests.map((req) => (
            <div key={req.id} className="bg-gradient-to-br from-forest/20 to-forest/5 border border-success/30 rounded-2xl p-4 shadow-card flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-forest/10 flex items-center justify-center font-bold text-success flex-shrink-0">
                  {req.company_logo ? (
                    <img src={req.company_logo} alt={req.company_name || req.employer_name} className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <User className="w-5 h-5 text-success" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-success mb-0.5">Headhunt Initiative</p>
                  <h4 className="font-bold text-sm text-white truncate">
                    {req.company_name ? req.company_name : req.employer_name}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-normal">
                    Requested to view your CV for potential job matching.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleApproveRequest(req)}
                  className="flex-1 h-9 rounded-xl bg-success text-success-foreground font-semibold text-xs active:scale-[0.98] transition-transform"
                >
                  Approve & Share
                </button>
                <button
                  onClick={() => handleDeclineRequest(req)}
                  className="h-9 px-3 rounded-xl bg-card border border-border text-muted-foreground hover:text-white font-semibold text-xs active:scale-[0.98] transition-transform"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 bg-card rounded-2xl shadow-soft divide-y divide-border">
        {items.map(({ icon: Icon, label, onClick }) => (
          <button key={label} onClick={onClick} className="w-full flex items-center gap-3 p-4 text-left">
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span className="flex-1 text-sm">{label}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default Profile;
