import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Star, FileText, Download, Check, Save, AlertCircle, ChevronDown, ListFilter, Users, ArrowLeft, ExternalLink, Calendar, HelpCircle, CheckSquare, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import AssessmentReviewer from "../components/AssessmentReviewer";

interface CoApplicationsProps {
  companyId: string | null;
  userId: string;
  role: string;
}

export const CoApplications = ({ companyId, userId, role }: CoApplicationsProps) => {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<any[]>([]);
  const [internalApps, setInternalApps] = useState<any[]>([]);
  const [externalApps, setExternalApps] = useState<any[]>([]);
  
  // Navigation: "list" (jobs first list) or "detail" (viewing applications for a specific job)
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Detail View Configuration
  const [activeSourceTab, setActiveSourceTab] = useState<"internal" | "external">("internal");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);
  const [sortByScore, setSortByScore] = useState(false);

  // Notes editing state
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savingNotesId, setSavingNotesId] = useState<string | null>(null);

  // Expanded candidate card ID
  const [expandedCandidateId, setExpandedCandidateId] = useState<string | null>(null);

  const loadJobsAndApps = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch jobs
      let jobsQuery = supabase.from("jobs").select("id, title, location, created_at");
      if (companyId) {
        jobsQuery = jobsQuery.eq("company_id", companyId);
      } else {
        jobsQuery = jobsQuery.eq("posted_by", userId);
      }
      const { data: jobsData, error: jobsErr } = await jobsQuery;
      if (jobsErr) throw jobsErr;
      setJobs(jobsData || []);

      const jobIds = (jobsData || []).map((j) => j.id);
      if (jobIds.length === 0) {
        setInternalApps([]);
        setExternalApps([]);
        setLoading(false);
        return;
      }

      // 2. Fetch internal applications
      const { data: intData, error: intErr } = await supabase
        .from("applications")
        .select(`
          id,
          created_at,
          status,
          recruiter_notes,
          starred,
          job_id,
          user_id,
          cover_letter,
          merged_pdf_path,
          jobs(title)
        `)
        .in("job_id", jobIds)
        .order("created_at", { ascending: false });

      if (intErr) throw intErr;

      // Fetch profiles & documents for internal candidates
      const candidateIds = (intData || []).map((a) => a.user_id);
      let profilesMap: Record<string, any> = {};
      let docsMap: Record<string, any[]> = {};

      if (candidateIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, highest_education, skills, cv_path, cv_filename, years_experience, email, phone")
          .in("id", candidateIds);
        if (profs) {
          profs.forEach((p) => {
            profilesMap[p.id] = p;
          });
        }

        const { data: docsData } = await supabase
          .from("application_documents")
          .select("id, user_id, filename, label, storage_path, mime_type, size_bytes")
          .in("user_id", candidateIds);
        if (docsData) {
          docsData.forEach((d) => {
            if (!docsMap[d.user_id]) docsMap[d.user_id] = [];
            docsMap[d.user_id].push(d);
          });
        }
      }

      // Fetch assessment responses for internal candidates
      const { data: intResps } = await supabase
        .from("assessment_responses")
        .select("id, application_id, score, completed_at")
        .in("job_id", jobIds as any) // Safe fallback or logic check
        .order("completed_at", { ascending: false });

      const intRespsMap: Record<string, any> = {};
      (intResps || []).forEach((r) => {
        if (r.application_id) {
          intRespsMap[r.application_id] = r;
        }
      });

      const enrichedInternal = (intData || []).map((app) => {
        const profile = profilesMap[app.user_id] || {};
        const docs = docsMap[app.user_id] || [];
        const resp = intRespsMap[app.id] || null;
        
        // Display full candidate name to employer
        const rawName = profile.full_name || "Unknown Candidate";

        return {
          ...app,
          isExternal: false,
          candidateName: rawName,
          email: profile.email || "N/A",
          phone: profile.phone || "N/A",
          education: profile.highest_education || "N/A",
          skills: profile.skills || [],
          cvPath: profile.cv_path || null,
          cvFilename: profile.cv_filename || null,
          experience: profile.years_experience || 0,
          mergedPdfPath: app.merged_pdf_path || null,
          documents: docs,
          assessment: resp,
          assessmentScore: resp ? Number(resp.score || 0) : null,
        };
      });

      // 3. Fetch external applications
      const { data: extData, error: extErr } = await supabase
        .from("external_applications")
        .select(`
          *,
          jobs(title)
        `)
        .in("job_id", jobIds)
        .order("created_at", { ascending: false });

      if (extErr) throw extErr;

      // Fetch assessment responses for external candidates
      const { data: extResps } = await supabase
        .from("assessment_responses")
        .select("id, external_application_id, score, completed_at")
        .is("application_id", null)
        .order("completed_at", { ascending: false });

      const extRespsMap: Record<string, any> = {};
      (extResps || []).forEach((r) => {
        if (r.external_application_id) {
          extRespsMap[r.external_application_id] = r;
        }
      });

      const enrichedExternal = (extData || []).map((app) => {
        const resp = extRespsMap[app.id] || null;
        return {
          ...app,
          isExternal: true,
          candidateName: app.full_name,
          education: "N/A (External)",
          skills: [],
          cvPath: app.cv_path,
          cvFilename: app.cv_filename,
          experience: 0,
          mergedPdfPath: null,
          documents: [],
          assessment: resp,
          assessmentScore: resp ? Number(resp.score || 0) : null,
        };
      });

      setInternalApps(enrichedInternal);
      setExternalApps(enrichedExternal);

      // Initialize notes state
      const initialNotes: Record<string, string> = {};
      enrichedInternal.forEach((a) => { initialNotes[a.id] = a.recruiter_notes || ""; });
      enrichedExternal.forEach((a) => { initialNotes[a.id] = a.recruiter_notes || ""; });
      setEditingNotes(initialNotes);

    } catch (err: any) {
      console.error("Error loading applications:", err.message);
      toast.error("Failed to load applications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobsAndApps();

    // Subscribe to realtime changes on applications and external_applications
    const channel = supabase
      .channel("co-applications-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "applications" },
        () => {
          loadJobsAndApps();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "external_applications" },
        () => {
          loadJobsAndApps();
        }
      )
      .subscribe();

    // Listen to local AI actions dispatch
    const handleLocalRefresh = () => {
      loadJobsAndApps();
    };
    window.addEventListener("refresh-recruitment-data", handleLocalRefresh);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("refresh-recruitment-data", handleLocalRefresh);
    };
  }, [companyId, userId]);

  const handleStatusChange = async (app: any, newStatus: string) => {
    try {
      const table = app.isExternal ? "external_applications" : "applications";
      const { error } = await supabase
        .from(table as any)
        .update({ status: newStatus as any })
        .eq("id", app.id);

      if (error) throw error;

      if (app.isExternal) {
        setExternalApps((prev) =>
          prev.map((a) => (a.id === app.id ? { ...a, status: newStatus } : a))
        );
      } else {
        setInternalApps((prev) =>
          prev.map((a) => (a.id === app.id ? { ...a, status: newStatus } : a))
        );
      }
      toast.success("Application status updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update status.");
    }
  };

  const handleToggleStar = async (app: any) => {
    try {
      const table = app.isExternal ? "external_applications" : "applications";
      const { error } = await supabase
        .from(table as any)
        .update({ starred: !app.starred })
        .eq("id", app.id);

      if (error) throw error;

      if (app.isExternal) {
        setExternalApps((prev) =>
          prev.map((a) => (a.id === app.id ? { ...a, starred: !app.starred } : a))
        );
      } else {
        setInternalApps((prev) =>
          prev.map((a) => (a.id === app.id ? { ...a, starred: !app.starred } : a))
        );
      }
      toast.success(!app.starred ? "Candidate starred" : "Candidate unstarred");
    } catch (err: any) {
      toast.error(err.message || "Failed to star candidate.");
    }
  };

  const handleSaveNotes = async (app: any) => {
    try {
      setSavingNotesId(app.id);
      const notes = editingNotes[app.id] || "";
      const table = app.isExternal ? "external_applications" : "applications";
      
      const { error } = await supabase
        .from(table as any)
        .update({ recruiter_notes: notes })
        .eq("id", app.id);

      if (error) throw error;

      if (app.isExternal) {
        setExternalApps((prev) =>
          prev.map((a) => (a.id === app.id ? { ...a, recruiter_notes: notes } : a))
        );
      } else {
        setInternalApps((prev) =>
          prev.map((a) => (a.id === app.id ? { ...a, recruiter_notes: notes } : a))
        );
      }
      toast.success("Recruiter notes saved!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save recruiter notes.");
    } finally {
      setSavingNotesId(null);
    }
  };

  const handleViewCV = async (app: any) => {
    if (app.mergedPdfPath) {
      try {
        const { data, error } = await supabase.storage.from("application-docs").createSignedUrl(app.mergedPdfPath, 60);
        if (error || !data) throw error || new Error("Failed to generate URL");
        window.open(data.signedUrl, "_blank");
        return;
      } catch (err: any) {
        console.error("Error signing merged PDF URL:", err.message);
        toast.error("Could not open candidate's application package.");
        return;
      }
    }

    if (!app.cvPath) {
      toast.error("No CV uploaded by this candidate.");
      return;
    }

    try {
      const bucket = app.isExternal ? "external-cvs" : "cvs";
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(app.cvPath, 60);
      if (error || !data) throw error || new Error("Failed to generate URL");
      
      window.open(data.signedUrl, "_blank");
    } catch (err: any) {
      console.error("Error signing CV URL:", err.message);
      toast.error("Could not open candidate's CV.");
    }
  };

  const handleViewDoc = async (doc: any) => {
    try {
      const { data, error } = await supabase.storage.from("app-docs").createSignedUrl(doc.storage_path, 60);
      if (error || !data) throw error || new Error("Failed to generate URL");
      
      window.open(data.signedUrl, "_blank");
    } catch (err: any) {
      console.error("Error signing doc URL:", err.message);
      toast.error("Could not open candidate's supporting document.");
    }
  };

  const getJobCounts = (jobId: string) => {
    const internal = internalApps.filter((a) => a.job_id === jobId);
    const external = externalApps.filter((a) => a.job_id === jobId);
    const newInt = internal.filter((a) => a.status === "submitted").length;
    const newExt = external.filter((a) => a.status === "submitted").length;

    return {
      internal: internal.length,
      external: external.length,
      total: internal.length + external.length,
      unreviewed: newInt + newExt,
    };
  };

  const handleOpenJobDetail = (jobId: string) => {
    setSelectedJobId(jobId);
    setViewMode("detail");
    setStatusFilter("all");
    setSearchTerm("");
    setStarredOnly(false);
    setExpandedCandidateId(null);
  };

  // Get selected job details
  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  // Filtered applicants list for detail view
  const currentApplicants = activeSourceTab === "internal"
    ? internalApps.filter((a) => a.job_id === selectedJobId)
    : externalApps.filter((a) => a.job_id === selectedJobId);

  // Stage counts for pipeline filter chips
  const pipelineStats = {
    all: currentApplicants.length,
    submitted: currentApplicants.filter(a => a.status === "submitted").length,
    reviewing: currentApplicants.filter(a => a.status === "reviewing").length,
    shortlisted: currentApplicants.filter(a => a.status === "shortlisted").length,
    assessment_sent: currentApplicants.filter(a => a.status === "assessment_sent").length,
    interview: currentApplicants.filter(a => a.status === "interview").length,
    offer: currentApplicants.filter(a => a.status === "offer" || a.status === "hired").length,
    rejected: currentApplicants.filter(a => a.status === "rejected" || a.status === "declined").length,
  };

  const getFilteredApplicants = () => {
    let result = [...currentApplicants];

    if (statusFilter !== "all") {
      if (statusFilter === "offer") {
        result = result.filter((a) => a.status === "offer" || a.status === "hired");
      } else if (statusFilter === "rejected") {
        result = result.filter((a) => a.status === "rejected" || a.status === "declined");
      } else {
        result = result.filter((a) => a.status === statusFilter);
      }
    }

    if (starredOnly) {
      result = result.filter((a) => a.starred);
    }

    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (a) =>
          a.candidateName.toLowerCase().includes(term) ||
          a.education.toLowerCase().includes(term) ||
          (a.skills && a.skills.some((s: string) => s.toLowerCase().includes(term)))
      );
    }

    if (sortByScore) {
      result.sort((a, b) => {
        const scoreA = a.assessmentScore ?? -1;
        const scoreB = b.assessmentScore ?? -1;
        return scoreB - scoreA; // descending
      });
    }

    return result;
  };

  const filteredApplicants = getFilteredApplicants();

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-white/5 w-1/4 rounded-xl" />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-white/5 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // Job Listing (Job-first view)
  if (viewMode === "list") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Applications</h1>
          <p className="text-muted-foreground mt-1">
            Review candidate applications organised by your corporate job postings.
          </p>
        </div>

        {jobs.length === 0 ? (
          <div className="p-12 text-center bg-[#0d1117] border border-white/5 rounded-2xl text-muted-foreground shadow-xl">
            <Users className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-1">No Active Postings</h3>
            <p className="text-sm text-muted-foreground">Post a job to start receiving candidate applications.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.map((job) => {
              const counts = getJobCounts(job.id);
              return (
                <div
                  key={job.id}
                  onClick={() => handleOpenJobDetail(job.id)}
                  className="bg-[#0d1117] border border-white/5 hover:border-primary/45 rounded-2xl p-6 transition-all duration-250 hover:shadow-glow cursor-pointer flex flex-col justify-between h-48 group"
                >
                  <div>
                    <h3 className="text-base font-bold text-white leading-snug group-hover:text-primary transition-colors truncate">
                      {job.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">{job.location}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-b border-white/5 py-3 my-2 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground">App Users</span>
                      <p className="text-sm font-semibold text-white mt-0.5">{counts.internal}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground">External</span>
                      <p className="text-sm font-semibold text-white mt-0.5">{counts.external}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground">Total</span>
                      <p className="text-sm font-bold text-primary mt-0.5">{counts.total}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">
                      Posted {new Date(job.created_at).toLocaleDateString()}
                    </span>
                    {counts.unreviewed > 0 && (
                      <span className="bg-primary/20 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold text-[10px]">
                        {counts.unreviewed} New
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Job Details applications list
  return (
    <div className="space-y-6">
      {/* Header back button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setViewMode("list")}
          className="p-2 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/5 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{selectedJob?.title}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Recruitment Pipeline Workspace</p>
        </div>
      </div>

      {/* Internal vs External tabs switcher */}
      <div className="flex border-b border-white/5 gap-2">
        <button
          onClick={() => {
            setActiveSourceTab("internal");
            setStatusFilter("all");
            setExpandedCandidateId(null);
          }}
          className={`h-11 px-6 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeSourceTab === "internal"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-white"
          }`}
        >
          <Users className="w-4 h-4" /> App Applications
        </button>
        <button
          onClick={() => {
            setActiveSourceTab("external");
            setStatusFilter("all");
            setExpandedCandidateId(null);
          }}
          className={`h-11 px-6 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeSourceTab === "external"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-white"
          }`}
        >
          <ExternalLink className="w-4 h-4" /> External Applications (Public Link)
        </button>
      </div>

      {/* Stage Summary Chips */}
      <div className="flex flex-wrap gap-2 pb-2">
        <StageChip label="All" count={pipelineStats.all} active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
        <StageChip label="Applied" count={pipelineStats.submitted} active={statusFilter === "submitted"} onClick={() => setStatusFilter("submitted")} />
        <StageChip label="Reviewed" count={pipelineStats.reviewing} active={statusFilter === "reviewing"} onClick={() => setStatusFilter("reviewing")} />
        <StageChip label="Shortlisted" count={pipelineStats.shortlisted} active={statusFilter === "shortlisted"} onClick={() => setStatusFilter("shortlisted")} />
        <StageChip label="Assessment Sent" count={pipelineStats.assessment_sent} active={statusFilter === "assessment_sent"} onClick={() => setStatusFilter("assessment_sent")} />
        <StageChip label="Interview" count={pipelineStats.interview} active={statusFilter === "interview"} onClick={() => setStatusFilter("interview")} />
        <StageChip label="Offer" count={pipelineStats.offer} active={statusFilter === "offer"} onClick={() => setStatusFilter("offer")} />
        <StageChip label="Rejected" count={pipelineStats.rejected} active={statusFilter === "rejected"} onClick={() => setStatusFilter("rejected")} />
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-4 shadow-xl justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search candidates by name, education..."
            className="pl-10 h-10 rounded-xl bg-card border-white/10 text-white w-full"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto shrink-0 mt-2 md:mt-0">
          <button
            onClick={() => setStarredOnly(!starredOnly)}
            className={`h-10 px-4 rounded-xl border flex items-center gap-2 text-xs font-semibold transition-colors ${
              starredOnly
                ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                : "border-white/10 bg-transparent text-muted-foreground hover:bg-white/5 hover:text-white"
            }`}
          >
            <Star className={`w-4 h-4 ${starredOnly ? "fill-yellow-400" : ""}`} />
            Starred Only
          </button>
          <button
            onClick={() => setSortByScore(!sortByScore)}
            className={`h-10 px-4 rounded-xl border flex items-center gap-2 text-xs font-semibold transition-colors ${
              sortByScore
                ? "bg-primary/10 text-primary border-primary/30"
                : "border-white/10 bg-transparent text-muted-foreground hover:bg-white/5 hover:text-white"
            }`}
          >
            <Award className="w-4 h-4" />
            Sort by Score
          </button>
        </div>
      </div>

      {/* Applicants List */}
      {filteredApplicants.length === 0 ? (
        <div className="p-12 text-center bg-[#0d1117] border border-white/5 rounded-2xl text-muted-foreground shadow-xl">
          <Users className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-1">No Applicants Found</h3>
          <p className="text-sm text-muted-foreground">Adjust filters or select a different pipeline stage.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredApplicants.map((app) => {
            const isExpanded = expandedCandidateId === app.id;
            return (
              <div
                key={app.id}
                className="bg-[#0d1117] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors flex flex-col gap-5 shadow-xl relative"
              >
                {/* Header card info */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                      {app.candidateName.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white">{app.candidateName}</h3>
                        <button
                          onClick={() => handleToggleStar(app)}
                          className="hover:scale-115 transition-transform"
                        >
                          <Star className={`w-4 h-4 ${app.starred ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground hover:text-white"}`} />
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Applied {new Date(app.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="flex items-center gap-2 flex-1 sm:flex-none">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider hidden md:inline">Stage:</span>
                      <Select value={app.status} onValueChange={(val) => handleStatusChange(app, val)}>
                        <SelectTrigger className="h-9 rounded-xl bg-card border-white/10 text-white text-xs w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0d1117] border-white/5 text-white">
                          <SelectItem value="submitted" className="hover:bg-white/5 cursor-pointer">Applied</SelectItem>
                          <SelectItem value="reviewing" className="hover:bg-white/5 cursor-pointer">Reviewed</SelectItem>
                          <SelectItem value="shortlisted" className="hover:bg-white/5 cursor-pointer">Shortlisted</SelectItem>
                          <SelectItem value="assessment_sent" className="hover:bg-white/5 cursor-pointer">Assessment Sent</SelectItem>
                          <SelectItem value="interview" className="hover:bg-white/5 cursor-pointer">Interview</SelectItem>
                          <SelectItem value="offer" className="hover:bg-white/5 cursor-pointer">Offer</SelectItem>
                          <SelectItem value="declined" className="hover:bg-white/5 cursor-pointer">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {app.assessmentScore !== null && (
                      <div className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-xl flex items-center gap-1">
                        <Award className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold">{app.assessmentScore}%</span>
                      </div>
                    )}

                    <Button
                      onClick={() => setExpandedCandidateId(isExpanded ? null : app.id)}
                      variant="ghost"
                      size="sm"
                      className="text-xs text-primary hover:bg-white/5 rounded-lg shrink-0 font-bold"
                    >
                      {isExpanded ? "Collapse" : "Review Details"}
                    </Button>
                  </div>
                </div>

                {/* Expanded Details section */}
                {isExpanded && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 border-t border-white/5 pt-5 mt-2 animate-in fade-in duration-200">
                    {/* Expanded candidate tabs details */}
                    <div className="lg:col-span-8 space-y-4">
                      <CandidateDetailSubTabs app={app} onViewCV={handleViewCV} onViewDoc={handleViewDoc} />
                    </div>

                    {/* Recruiter sidebar controls */}
                    <div className="lg:col-span-4 space-y-4 border-t lg:border-t-0 lg:border-l border-white/5 pt-4 lg:pt-0 lg:pl-6 flex flex-col justify-between">
                      <div className="space-y-2 flex-1">
                        <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Recruiter Notes</Label>
                        <Textarea
                          value={editingNotes[app.id] || ""}
                          onChange={(e) => setEditingNotes({ ...editingNotes, [app.id]: e.target.value })}
                          placeholder="Type review summaries, candidate feedback, assessment insights..."
                          className="min-h-[140px] bg-card border-white/10 text-white rounded-xl text-xs resize-none"
                        />
                      </div>
                      <Button
                        onClick={() => handleSaveNotes(app)}
                        disabled={savingNotesId === app.id || editingNotes[app.id] === app.recruiter_notes}
                        className="bg-primary/20 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground h-9 text-xs rounded-xl w-full flex items-center justify-center gap-1.5 transition-all mt-4"
                      >
                        <Save className="w-4 h-4" />
                        {savingNotesId === app.id ? "Saving..." : "Save recruiter notes"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Sub tab layout for Expanded Candidate details
const CandidateDetailSubTabs = ({ app, onViewCV, onViewDoc }: { app: any; onViewCV: (a: any) => void; onViewDoc: (d: any) => void }) => {
  const [activeTab, setActiveTab] = useState<"info" | "docs" | "assessment">("info");

  return (
    <div className="space-y-4">
      {/* Small selector menu */}
      <div className="flex border-b border-white/5 gap-4">
        <button
          onClick={() => setActiveTab("info")}
          className={`pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === "info" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-white"
          }`}
        >
          CV & Overview
        </button>
        {app.documents?.length > 0 && (
          <button
            onClick={() => setActiveTab("docs")}
            className={`pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === "docs" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-white"
            }`}
          >
            Documents ({app.documents.length})
          </button>
        )}
        <button
          onClick={() => setActiveTab("assessment")}
          className={`pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === "assessment" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-white"
          }`}
        >
          Assessments
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "info" && (
        <div className="space-y-4 text-xs">
          {/* Main Info Blocks */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-muted-foreground">Education</span>
              <p className="text-white font-medium mt-0.5">{app.education}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Contact Detail</span>
              <p className="text-white font-medium mt-0.5">{app.email}</p>
              <p className="text-white font-medium">{app.phone}</p>
            </div>
          </div>

          {/* Skills tags */}
          {app.skills?.length > 0 && (
            <div className="space-y-1">
              <span className="text-muted-foreground font-semibold">Candidate Skills</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {app.skills.map((skill: string, index: number) => (
                  <span key={index} className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white/80">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Cover Letter */}
          {app.cover_letter && (
            <div className="space-y-1 pt-2">
              <span className="text-muted-foreground font-semibold">Cover Letter</span>
              <p className="text-xs text-white/85 bg-white/[0.02] border border-white/5 rounded-xl p-3 whitespace-pre-wrap leading-relaxed">
                {app.cover_letter}
              </p>
            </div>
          )}

          <Button
            onClick={() => onViewCV(app)}
            disabled={!app.cvPath && !app.mergedPdfPath}
            variant="outline"
            className="border-white/10 text-white hover:bg-white/5 h-10 rounded-xl text-xs flex items-center gap-1.5 mt-2"
          >
            <FileText className="w-4 h-4 text-primary" /> {app.mergedPdfPath ? "View Application Package" : "View Resume / CV"}
          </Button>
        </div>
      )}

      {activeTab === "docs" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {app.documents.map((doc: any) => (
            <div key={doc.id} className="flex items-center justify-between p-2 rounded-xl bg-[#111318]/50 border border-white/5 hover:border-white/10 transition-colors">
              <div className="flex items-center gap-2 min-w-0 mr-2">
                <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-xs text-white/85 truncate font-medium">{doc.label || doc.filename}</span>
              </div>
              <button
                onClick={() => onViewDoc(doc)}
                className="text-xs text-primary hover:text-primary-foreground hover:bg-primary px-2.5 py-1 rounded-lg transition-all font-semibold shrink-0"
              >
                View
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === "assessment" && (
        <div className="space-y-2">
          {app.assessment ? (
            <AssessmentReviewer responseId={app.assessment.id} />
          ) : (
            <div className="py-8 text-center bg-[#111318]/50 border border-white/5 rounded-2xl text-muted-foreground text-xs">
              <HelpCircle className="w-8 h-8 text-white/10 mx-auto mb-2" />
              <p>No assessment has been completed yet for this candidate.</p>
              {app.status !== "assessment_sent" && (
                <p className="text-[10px] mt-1">Move candidate to "Assessment Sent" to invite them.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const StageChip = ({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`h-8 px-3 rounded-full text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
      active
        ? "bg-primary text-primary-foreground border-primary"
        : "border-white/5 bg-[#0d1117] text-muted-foreground hover:border-white/15 hover:text-white"
    }`}
  >
    <span>{label}</span>
    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${active ? "bg-white/20 text-white" : "bg-white/5 text-muted-foreground"}`}>
      {count}
    </span>
  </button>
);
