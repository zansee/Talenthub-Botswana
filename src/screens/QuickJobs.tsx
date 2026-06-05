import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Hourglass, Plus, MapPin, Calendar, Check, X, Users, Trash2, ChevronDown, ChevronUp, AlertCircle, Zap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const obscureName = (name: string | null) => {
  if (!name || name.trim() === "") return "anonymous";
  return name.trim().split(" ").map(p => {
    if (p.length <= 2) return p.toUpperCase();
    return p[0].toUpperCase() + "*".repeat(p.length - 2) + p[p.length - 1].toUpperCase();
  }).join(" ");
};

const QuickJobs = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [accountType, setAccountType] = useState<string>("premium");
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [passedJobs, setPassedJobs] = useState<Set<string>>(new Set());
  const [interestedJobs, setInterestedJobs] = useState<Set<string>>(new Set());

  // Employer Dashboard State
  const [myJobs, setMyJobs] = useState<any[]>([]);
  const [interestsMap, setInterestsMap] = useState<Record<string, any[]>>({});
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [showClosedGigs, setShowClosedGigs] = useState(false);

  // Closing Job Modal State
  const [closingJob, setClosingJob] = useState<any | null>(null);
  const [closeReason, setCloseReason] = useState<string>("hired_on_platform");
  const [hiredCandidateId, setHiredCandidateId] = useState<string>("");
  const [hiredCandidateName, setHiredCandidateName] = useState<string>("");
  const [closeText, setCloseText] = useState<string>("");
  const [submittingClose, setSubmittingClose] = useState(false);

  useEffect(() => {
    localStorage.setItem("last_quick_job_view", Date.now().toString());
  }, []);

  // Handle notification redirect expansion
  useEffect(() => {
    if (location.state?.expandJobId) {
      setExpandedJobId(location.state.expandJobId);
      // Clean up state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: flag } = await supabase
        .from("feature_flags").select("enabled").eq("key", "quick_jobs").maybeSingle();
      const isOn = Boolean((flag as any)?.enabled);
      setEnabled(isOn);

      const { data: p } = await supabase.from("profiles")
        .select("cv_path,onboarding_complete,account_type,phone,email").eq("id", user.id).maybeSingle();
      const at = (p as any)?.account_type ?? "premium";
      setAccountType(at);
      setProfileReady(at === "quick_jobs" || Boolean((p as any)?.cv_path && (p as any)?.onboarding_complete));
      
      if (isOn) {
        if (at === "quick_jobs") {
          // Fetch employer's own posts
          const { data: myRows } = await supabase
            .from("quick_jobs")
            .select("*")
            .eq("posted_by", user.id)
            .order("created_at", { ascending: false });
          
          const jobsList = myRows || [];
          setMyJobs(jobsList);

          if (jobsList.length > 0) {
            const jobIds = jobsList.map(j => j.id);
            const { data: interestsData } = await (supabase as any)
              .from("quick_job_interests")
              .select("*")
              .in("quick_job_id", jobIds)
              .order("created_at", { ascending: false });

            const map: Record<string, any[]> = {};
            jobIds.forEach(id => { map[id] = []; });
            ((interestsData || []) as any[]).forEach(item => {
              if (map[item.quick_job_id]) {
                map[item.quick_job_id].push(item);
              }
            });
            setInterestsMap(map);
          }
        } else {
          // Fetch approved jobs for candidates to swipe
          const { data } = await supabase
            .from("quick_jobs" as any)
            .select("*")
            .eq("status", "approved")
            .eq("is_active", true)
            .order("created_at", { ascending: false });
          setJobs((data as any[]) ?? []);
        }
      }
    } catch (err) {
      console.error("Error loading quick jobs data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id]);

  const handlePass = (jobId: string) => {
    setPassedJobs(prev => {
      const next = new Set(prev);
      next.add(jobId);
      return next;
    });
  };

  const handleInterested = async (jobId: string) => {
    if (!user) return;
    try {
      const { data: p } = await supabase.from("profiles").select("phone,email,full_name").eq("id", user.id).single();
      
      await supabase.from("quick_job_interests" as any).insert({
        quick_job_id: jobId,
        user_id: user.id,
        contact_info: p?.phone || p?.email || "No contact info",
        user_name: p?.full_name || "Anonymous",
      } as any);

      setInterestedJobs(prev => {
        const next = new Set(prev);
        next.add(jobId);
        return next;
      });

      const job = jobs.find(j => j.id === jobId);
      if (job?.posted_by) {
        await supabase.from("notifications").insert({
          user_id: job.posted_by,
          title: "New Quick Job Interest",
          body: `${p?.full_name || "Someone"} is interested in "${job.title}". Contact: ${p?.phone || p?.email || "No contact provided"}.`,
          type: "quick_job_interest",
          job_id: jobId
        });
      }

      toast.success("Interest sent to the poster!");
    } catch (err) {
      toast.error("Failed to send interest");
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!window.confirm("Are you sure you want to delete this job posting?")) return;
    try {
      const { error } = await supabase.from("quick_jobs").delete().eq("id", jobId);
      if (error) throw error;
      toast.success("Job posting deleted successfully");
      setMyJobs(prev => prev.filter(j => j.id !== jobId));
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    }
  };

  const handleCloseJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingJob) return;
    setSubmittingClose(true);
    try {
      let candidateName = hiredCandidateName;
      let candidateId = hiredCandidateId || null;

      if (closeReason === "hired_on_platform") {
        if (!hiredCandidateId) {
          toast.error("Please select the candidate you hired.");
          setSubmittingClose(false);
          return;
        }
        const candidates = interestsMap[closingJob.id] || [];
        const selected = candidates.find(c => c.user_id === hiredCandidateId);
        if (selected) {
          candidateName = selected.user_name;
        }
      } else {
        candidateId = null;
      }

      const { error } = await supabase
        .from("quick_jobs")
        .update({
          status: "closed",
          is_active: false,
          close_reason: closeReason,
          close_text: closeText.trim(),
          hired_user_id: candidateId,
          hired_user_name: closeReason === "hired_on_platform" ? candidateName : (closeReason === "hired_off_platform" ? candidateName : null),
          closed_at: new Date().toISOString()
        } as any)
        .eq("id", closingJob.id);

      if (error) throw error;

      toast.success("Job closed successfully!");
      setClosingJob(null);
      setCloseReason("hired_on_platform");
      setHiredCandidateId("");
      setHiredCandidateName("");
      setCloseText("");
      loadData(); // Reload all jobs
    } catch (err: any) {
      toast.error(err.message || "Failed to close job");
    } finally {
      setSubmittingClose(false);
    }
  };

  if (!enabled && !loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-background">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-5">
          <Hourglass className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-xl font-bold">Quick Jobs is coming soon</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs">
          Stay tuned — we're building a fast way to find and post short, local gigs in Botswana.
        </p>
        <span className="mt-4 text-[10px] uppercase tracking-wider bg-warning/15 text-warning font-bold px-3 py-1 rounded-full">
          Beta locked
        </span>
      </div>
    );
  }

  // Render Employer/Poster Dashboard
  if (accountType === "quick_jobs") {
    const activeMyJobs = myJobs.filter(j => j.status !== 'closed');
    const closedMyJobs = myJobs.filter(j => j.status === 'closed');
    const liveCount = activeMyJobs.filter(j => j.status === 'approved' && j.is_active).length;
    const pendingCount = activeMyJobs.filter(j => j.status === 'pending').length;

    const renderJobCard = (j: any, isClosedCard = false) => {
      const candidates = interestsMap[j.id] || [];
      const isExpanded = expandedJobId === j.id;

      return (
        <div key={j.id} className="bg-card rounded-2xl shadow-soft border border-border overflow-hidden flex flex-col">
          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-sm text-foreground">{j.title}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold mt-0.5">{j.category}</p>
              </div>
              <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                j.status === "approved" 
                  ? "bg-success/10 text-success border-success/20" 
                  : j.status === "rejected"
                  ? "bg-destructive/10 text-destructive border-destructive/20"
                  : j.status === "closed"
                  ? "bg-neutral-500/10 text-neutral-400 border-neutral-500/20"
                  : "bg-warning/10 text-warning border-warning/20 animate-pulse"
              }`}>
                {j.status === "approved" ? "Live" : j.status === "rejected" ? "Rejected" : j.status === "closed" ? "Closed" : "Pending Review"}
              </span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">{j.description}</p>

            <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-[11px] text-muted-foreground border-t border-white/5 pt-3">
              <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3 text-primary" />{j.location}</span>
              <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3 text-primary" />{j.date_needed}</span>
              <span>Pay: <strong className="text-foreground font-semibold">BWP {j.pay_amount}</strong> ({j.pay_type})</span>
              <span>Duration: <strong className="text-foreground font-semibold">{j.duration}</strong></span>
            </div>

            {isClosedCard && (
              <div className="text-[11px] bg-black/10 border border-white/5 p-3 rounded-xl space-y-1 mt-2 text-muted-foreground">
                <p><span className="font-bold uppercase tracking-wider text-[8px] block text-zinc-500">Close Reason</span> {j.close_reason === 'hired_on_platform' ? 'Hired on Talenthub' : j.close_reason === 'hired_off_platform' ? 'Hired outside Talenthub' : j.close_reason === 'cancelled' ? 'Cancelled' : 'Other'}</p>
                {j.hired_user_name && <p><span className="font-bold uppercase tracking-wider text-[8px] block text-zinc-500">Hired Candidate</span> {j.hired_user_name}</p>}
                {j.close_text && <p><span className="font-bold uppercase tracking-wider text-[8px] block text-zinc-500">Details</span> "{j.close_text}"</p>}
                <p className="text-[9px] text-zinc-600">Closed on {new Date(j.closed_at).toLocaleDateString()}</p>
              </div>
            )}

            {/* Expand interested candidates section */}
            <div className="pt-2 flex items-center justify-between border-t border-white/5">
              <button
                onClick={() => setExpandedJobId(isExpanded ? null : j.id)}
                className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                <Users className="w-3.5 h-3.5" />
                <span>{candidates.length} Interested {candidates.length === 1 ? "Candidate" : "Candidates"}</span>
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              
              <div className="flex items-center gap-2">
                {!isClosedCard && j.status === "approved" && j.is_active && (
                  <button
                    onClick={() => setClosingJob(j)}
                    className="px-2.5 py-1 rounded-lg bg-warning/15 text-warning text-[10px] font-bold hover:bg-warning/25 transition-colors"
                  >
                    Close Job
                  </button>
                )}
                <button
                  onClick={() => handleDeleteJob(j.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete posting"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {isExpanded && (
            <div className="bg-black/10 border-t border-border p-4 space-y-2.5">
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Interested Candidates</p>
              {candidates.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-1">No candidates have indicated interest yet.</p>
              ) : (
                <div className="space-y-2">
                  {candidates.map((c) => (
                    <div key={c.id} className="bg-card border border-border p-3 rounded-xl flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-foreground">{c.user_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">Contact: {c.contact_info}</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {c.contact_info.includes("@") ? (
                          <a
                            href={`mailto:${c.contact_info}`}
                            className="px-2.5 py-1 rounded-lg bg-primary/15 text-primary text-[10px] font-bold hover:bg-primary/25 transition-colors"
                          >
                            Email
                          </a>
                        ) : (
                          <a
                            href={`tel:${c.contact_info}`}
                            className="px-2.5 py-1 rounded-lg bg-primary/15 text-primary text-[10px] font-bold hover:bg-primary/25 transition-colors"
                          >
                            Call
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="flex-1 flex flex-col bg-background overflow-y-auto relative">
        <div className="p-5 flex items-center justify-between border-b border-border">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" /> My Quick Jobs
          </h1>
          <Button
            size="sm"
            onClick={() => navigate("/quick-jobs/new")}
            className="rounded-xl bg-forest hover:bg-forest/90"
          >
            <Plus className="w-4 h-4 mr-1" /> Post Job
          </Button>
        </div>

        <div className="p-5 space-y-4">
          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-3 bg-card border border-border p-4 rounded-2xl">
            <div className="text-center border-r border-border">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total Posts</p>
              <p className="text-lg font-bold mt-0.5">{activeMyJobs.length}</p>
            </div>
            <div className="text-center border-r border-border">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Live & Active</p>
              <p className="text-lg font-bold text-success mt-0.5">{liveCount}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Pending Review</p>
              <p className="text-lg font-bold text-warning mt-0.5">{pendingCount}</p>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading postings…</p>
          ) : activeMyJobs.length === 0 && closedMyJobs.length === 0 ? (
            <div className="rounded-2xl bg-card p-8 text-sm text-muted-foreground text-center border border-border">
              <AlertCircle className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-60" />
              <p className="font-semibold">No quick jobs posted yet</p>
              <p className="text-xs mt-1">Gigs you post will appear here so you can track views and interest.</p>
              <Button size="sm" onClick={() => navigate("/quick-jobs/new")} className="mt-4 bg-forest hover:bg-forest/90 rounded-xl">
                Post your first gig
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active Jobs list */}
              {activeMyJobs.length > 0 && (
                <div className="space-y-3">
                  {activeMyJobs.map(j => renderJobCard(j, false))}
                </div>
              )}

              {/* Collapsed Closed Gigs list */}
              {closedMyJobs.length > 0 && (
                <div className="mt-5 pt-3 border-t border-border">
                  <button
                    onClick={() => setShowClosedGigs(!showClosedGigs)}
                    className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground py-2"
                  >
                    <span>Closed Gigs ({closedMyJobs.length})</span>
                    {showClosedGigs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {showClosedGigs && (
                    <div className="space-y-3 mt-3 opacity-85">
                      {closedMyJobs.map(j => renderJobCard(j, true))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Closing Job Modal overlay */}
        {closingJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <h3 className="font-bold text-sm text-foreground">Close Job Posting</h3>
                <button
                  onClick={() => setClosingJob(null)}
                  className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <form onSubmit={handleCloseJobSubmit} className="p-5 space-y-4 overflow-y-auto">
                <p className="text-xs text-muted-foreground">Please tell us why you are closing this gig. This helps keep Talenthub clean and secure.</p>
                
                <div className="space-y-2">
                  <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Reason</label>
                  <div className="space-y-2">
                    {[
                      { id: "hired_on_platform", label: "Hired someone on Talenthub" },
                      { id: "hired_off_platform", label: "Hired someone outside Talenthub" },
                      { id: "cancelled", label: "No longer need help / Cancelled" },
                      { id: "other", label: "Other" }
                    ].map((opt) => (
                      <label
                        key={opt.id}
                        className="flex items-start gap-2.5 p-3 rounded-xl border border-border bg-black/10 cursor-pointer hover:border-primary/50 transition-colors"
                      >
                        <input
                          type="radio"
                          name="close_reason"
                          value={opt.id}
                          checked={closeReason === opt.id}
                          onChange={(e) => setCloseReason(e.target.value)}
                          className="mt-0.5 text-primary focus:ring-primary"
                        />
                        <span className="text-xs font-semibold text-foreground leading-snug">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Dropdown for Hired Candidate on Platform */}
                {closeReason === "hired_on_platform" && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Who did you hire?</label>
                    {(interestsMap[closingJob.id] || []).length === 0 ? (
                      <div className="p-3 border border-dashed border-border rounded-xl text-center bg-black/10">
                        <p className="text-xs text-muted-foreground italic">No candidates showed interest yet.</p>
                      </div>
                    ) : (
                      <select
                        value={hiredCandidateId}
                        onChange={(e) => setHiredCandidateId(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl border border-border bg-card text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                        required
                      >
                        <option value="">Select candidate…</option>
                        {(interestsMap[closingJob.id] || []).map((c) => (
                          <option key={c.user_id} value={c.user_id}>{c.user_name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Manual Name for Hired Candidate off Platform */}
                {closeReason === "hired_off_platform" && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Candidate Name (Optional)</label>
                    <input
                      type="text"
                      value={hiredCandidateName}
                      onChange={(e) => setHiredCandidateName(e.target.value)}
                      placeholder="e.g. Thabo Molefe"
                      className="w-full h-11 px-3 rounded-xl border border-border bg-card text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}

                {/* Text Explanation */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Additional details (Optional)</label>
                  <textarea
                    value={closeText}
                    onChange={(e) => setCloseText(e.target.value)}
                    placeholder="Any additional feedback or reason..."
                    className="w-full p-3 min-h-[70px] rounded-xl border border-border bg-card text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submittingClose || (closeReason === "hired_on_platform" && (interestsMap[closingJob.id] || []).length === 0)}
                  className="w-full h-11 bg-warning hover:bg-warning/90 rounded-xl text-xs font-bold text-black"
                >
                  {submittingClose ? "Submitting..." : "Close Posting"}
                </Button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render Candidate Gig swipe/feed
  const visibleJobs = jobs.filter(j => !passedJobs.has(j.id) && !interestedJobs.has(j.id));

  return (
    <div className="flex-1 flex flex-col bg-background overflow-y-auto">
      <div className="p-5 flex items-center justify-between">
        <h1 className="text-lg font-bold flex items-center gap-2"><Zap className="w-5 h-5 text-primary" /> Quick Jobs</h1>
        <Button
          size="sm"
          onClick={() => navigate(profileReady ? "/quick-jobs/new" : "/profile-setup")}
          className="rounded-xl bg-forest hover:bg-forest/90"
        >
          <Plus className="w-4 h-4 mr-1" /> Post
        </Button>
      </div>

      <div className="px-5 pb-5 space-y-3">
        {!profileReady && (
          <div className="rounded-2xl bg-card p-4 text-sm border border-border">
            Complete your profile and upload your CV before posting a Quick Job.
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading gigs…</p>
        ) : visibleJobs.length === 0 ? (
          <div className="rounded-2xl bg-card p-6 text-sm text-muted-foreground text-center border border-border">
            No more quick jobs available right now. Check back later!
          </div>
        ) : (
          visibleJobs.map((j) => (
            <div key={j.id} className="bg-card rounded-2xl shadow-soft border border-border overflow-hidden flex flex-col">
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{j.title}</p>
                    <p className="text-[11px] text-muted-foreground">{j.category}</p>
                  </div>
                  <span className="text-xs font-bold text-primary whitespace-nowrap">BWP {j.pay_amount}</span>
                </div>
                
                <div className="max-h-24 overflow-y-auto pr-2 scrollbar-thin">
                  <p className="text-xs text-muted-foreground leading-relaxed">{j.description}</p>
                </div>
                
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground pt-1">
                  {j.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{j.location}</span>}
                  {j.date_needed && <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{j.date_needed}</span>}
                </div>
                <p className="text-[10px] text-muted-foreground pt-1">
                  Posted by {obscureName(j.poster_name)} · {j.pay_type} · {j.duration}
                  {j.preferred_gender && j.preferred_gender !== 'Any' ? ` · Prefers: ${j.preferred_gender}` : ''}
                </p>
              </div>
              
              <div className="grid grid-cols-2 border-t border-border mt-auto">
                <button 
                  onClick={() => handlePass(j.id)}
                  className="py-3 flex items-center justify-center gap-2 text-muted-foreground hover:bg-secondary/50 transition-colors font-medium text-sm"
                >
                  <X className="w-4 h-4" /> Pass
                </button>
                <button 
                  onClick={() => handleInterested(j.id)}
                  className="py-3 flex items-center justify-center gap-2 text-primary hover:bg-primary/10 transition-colors font-medium text-sm border-l border-border"
                >
                  <Check className="w-4 h-4" /> Interested
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default QuickJobs;
