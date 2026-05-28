import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Star, FileText, Download, Check, Save, AlertCircle, ChevronDown, ListFilter, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface CoApplicationsProps {
  companyId: string | null;
  userId: string;
  role: string;
}

export const CoApplications = ({ companyId, userId, role }: CoApplicationsProps) => {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("all");
  const [applications, setApplications] = useState<any[]>([]);
  const [filteredApps, setFilteredApps] = useState<any[]>([]);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [starredOnly, setStarredOnly] = useState(false);

  // Notes editing state
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savingNotesId, setSavingNotesId] = useState<string | null>(null);

  const loadJobsAndApps = async () => {
    try {
      setLoading(true);
      
      // 1. Get jobs
      let jobsQuery = supabase.from("jobs").select("id, title");
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
        setApplications([]);
        setFilteredApps([]);
        setLoading(false);
        return;
      }

      // 2. Get applications with profiles (implicit join via foreign key)
      const { data: appsData, error: appsErr } = await supabase
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
      
      if (appsErr) throw appsErr;

      // 3. For each application, fetch profile and documents separately
      const candidateIds = (appsData || []).map((a) => a.user_id);
      let profilesMap: Record<string, any> = {};
      let docsMap: Record<string, any[]> = {};

      if (candidateIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, highest_education, skills, cv_path, cv_filename, years_experience")
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

      const enrichedApps = (appsData || []).map((app) => {
        const profile = profilesMap[app.user_id] || {};
        const docs = docsMap[app.user_id] || [];
        
        // Mask name
        const rawName = profile.full_name || "Unknown Candidate";
        const parts = rawName.split(" ");
        const firstName = parts[0];
        const lastInitial = parts.length > 1 ? `${parts[parts.length - 1][0]}.` : "";
        const maskedName = `${firstName} ${lastInitial}`;

        return {
          ...app,
          candidateName: maskedName,
          education: profile.highest_education || "N/A",
          skills: profile.skills || [],
          cvPath: profile.cv_path || null,
          cvFilename: profile.cv_filename || null,
          experience: profile.years_experience || 0,
          mergedPdfPath: app.merged_pdf_path || null,
          documents: docs,
        };
      });

      setApplications(enrichedApps);
      
      // Initialize notes state
      const initialNotes: Record<string, string> = {};
      enrichedApps.forEach((a) => {
        initialNotes[a.id] = a.recruiter_notes || "";
      });
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
  }, [companyId, userId]);

  // Handle filtering
  useEffect(() => {
    let result = [...applications];

    if (selectedJobId !== "all") {
      result = result.filter((app) => app.job_id === selectedJobId);
    }
    if (statusFilter !== "all") {
      result = result.filter((app) => app.status === statusFilter);
    }
    if (starredOnly) {
      result = result.filter((app) => app.starred);
    }
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (app) =>
          app.candidateName.toLowerCase().includes(term) ||
          app.jobs?.title.toLowerCase().includes(term) ||
          app.education.toLowerCase().includes(term) ||
          app.skills.some((s: string) => s.toLowerCase().includes(term))
      );
    }

    setFilteredApps(result);
  }, [applications, selectedJobId, statusFilter, starredOnly, searchTerm]);

  const handleStatusChange = async (appId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("applications")
        .update({ status: newStatus as any })
        .eq("id", appId);

      if (error) throw error;

      setApplications((prev) =>
        prev.map((app) => (app.id === appId ? { ...app, status: newStatus } : app))
      );
      toast.success("Application status updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update status.");
    }
  };

  const handleToggleStar = async (appId: string, currentStarred: boolean) => {
    try {
      const { error } = await supabase
        .from("applications")
        .update({ starred: !currentStarred })
        .eq("id", appId);

      if (error) throw error;

      setApplications((prev) =>
        prev.map((app) => (app.id === appId ? { ...app, starred: !currentStarred } : app))
      );
      toast.success(!currentStarred ? "Candidate starred" : "Candidate unstarred");
    } catch (err: any) {
      toast.error(err.message || "Failed to star candidate.");
    }
  };

  const handleSaveNotes = async (appId: string) => {
    try {
      setSavingNotesId(appId);
      const notes = editingNotes[appId] || "";
      const { error } = await supabase
        .from("applications")
        .update({ recruiter_notes: notes })
        .eq("id", appId);

      if (error) throw error;

      setApplications((prev) =>
        prev.map((app) => (app.id === appId ? { ...app, recruiter_notes: notes } : app))
      );
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
        toast.error("Could not open candidate's merged application package.");
        return;
      }
    }

    if (!app.cvPath) {
      toast.error("No CV uploaded by this candidate.");
      return;
    }
    try {
      const { data, error } = await supabase.storage.from("cvs").createSignedUrl(app.cvPath, 60);
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

  // Status counts for pipeline chips
  const pipelineStats = {
    all: applications.length,
    submitted: applications.filter(a => a.status === "submitted").length,
    reviewing: applications.filter(a => a.status === "reviewing").length,
    shortlisted: applications.filter(a => a.status === "shortlisted").length,
    interview: applications.filter(a => a.status === "interview").length,
    hired: applications.filter(a => a.status === "hired").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Applications</h1>
          <p className="text-muted-foreground mt-1">
            Review resumes, track hiring stages, and record recruitment notes.
          </p>
        </div>

        {/* Job Filter selector */}
        <div className="w-full md:w-64">
          <Select value={selectedJobId} onValueChange={setSelectedJobId}>
            <SelectTrigger className="bg-[#0d1117] border-white/10 text-white rounded-xl h-11">
              <SelectValue placeholder="All Job Openings" />
            </SelectTrigger>
            <SelectContent className="bg-[#0d1117] border-white/5 text-white">
              <SelectItem value="all" className="hover:bg-white/5 cursor-pointer">All Job Openings</SelectItem>
              {jobs.map((j) => (
                <SelectItem key={j.id} value={j.id} className="hover:bg-white/5 cursor-pointer">{j.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stage Summary Chips */}
      <div className="flex flex-wrap gap-2 pb-2">
        <StageChip label="All" count={pipelineStats.all} active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
        <StageChip label="Applied" count={pipelineStats.submitted} active={statusFilter === "submitted"} onClick={() => setStatusFilter("submitted")} />
        <StageChip label="Reviewing" count={pipelineStats.reviewing} active={statusFilter === "reviewing"} onClick={() => setStatusFilter("reviewing")} />
        <StageChip label="Shortlisted" count={pipelineStats.shortlisted} active={statusFilter === "shortlisted"} onClick={() => setStatusFilter("shortlisted")} />
        <StageChip label="Interview" count={pipelineStats.interview} active={statusFilter === "interview"} onClick={() => setStatusFilter("interview")} />
        <StageChip label="Hired" count={pipelineStats.hired} active={statusFilter === "hired"} onClick={() => setStatusFilter("hired")} />
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-4 shadow-xl">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search candidates by name, education, skills..."
            className="pl-10 h-10 rounded-xl bg-card border-white/10 text-white w-full"
          />
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto shrink-0">
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
        </div>
      </div>

      {/* Applications List */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="h-44 bg-white/5 rounded-2xl" />
          ))}
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="p-12 text-center bg-[#0d1117] border border-white/5 rounded-2xl text-muted-foreground shadow-xl">
          <Users className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-1">No Applications Found</h3>
          <p className="text-sm text-muted-foreground">Adjust filters or select a different job role.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredApps.map((app) => (
            <div
              key={app.id}
              className="bg-[#0d1117] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors flex flex-col lg:flex-row gap-6 shadow-xl relative"
            >
              {/* Star Toggle */}
              <button
                onClick={() => handleToggleStar(app.id, app.starred)}
                className="absolute top-5 right-5 hover:scale-110 transition-transform"
              >
                <Star className={`w-5 h-5 ${app.starred ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground hover:text-white"}`} />
              </button>

              {/* Applicant Info Column */}
              <div className="flex-1 space-y-3 min-w-0">
                <div className="flex justify-between items-start gap-4 pr-8">
                  <div>
                    <h3 className="text-lg font-bold text-white leading-snug">{app.candidateName}</h3>
                    <p className="text-xs text-primary font-medium mt-0.5">{app.jobs?.title || "Unknown Job"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground">Education</span>
                    <p className="text-white/80 font-medium mt-0.5">{app.education}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Experience</span>
                    <p className="text-white/80 font-medium mt-0.5">{app.experience} years</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Applied</span>
                    <p className="text-white/80 font-medium mt-0.5">
                      {new Date(app.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Candidate Skills */}
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Skills</span>
                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                    {app.skills && app.skills.length > 0 ? (
                      app.skills.map((skill: string, index: number) => (
                        <span key={index} className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white/80">
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground/60 italic">No skills listed</span>
                    )}
                  </div>
                </div>

                {/* Cover Letter */}
                {app.cover_letter && (
                  <div className="space-y-1 mt-3">
                    <span className="text-xs text-muted-foreground font-semibold">Cover Letter</span>
                    <p className="text-xs text-white/85 bg-white/[0.02] border border-white/5 rounded-xl p-3 whitespace-pre-wrap leading-relaxed">
                      {app.cover_letter}
                    </p>
                  </div>
                )}

                {/* Supporting Documents */}
                {app.documents && app.documents.length > 0 && (
                  <div className="space-y-1.5 mt-4">
                    <span className="text-xs text-muted-foreground font-semibold">Supporting Documents</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                      {app.documents.map((doc: any) => (
                        <div key={doc.id} className="flex items-center justify-between p-2 rounded-xl bg-[#111318]/50 border border-white/5 hover:border-white/10 transition-colors">
                          <div className="flex items-center gap-2 min-w-0 mr-2">
                            <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="text-xs text-white/85 truncate font-medium">{doc.label || doc.filename}</span>
                          </div>
                          <button
                            onClick={() => handleViewDoc(doc)}
                            className="text-xs text-primary hover:text-primary-foreground hover:bg-primary px-2.5 py-1 rounded-lg transition-all font-semibold shrink-0"
                          >
                            View
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Pipeline & CV Controls Column */}
              <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-white/5 pt-4 lg:pt-0 lg:pl-6 flex flex-col justify-between gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Hiring Stage</Label>
                  <Select value={app.status} onValueChange={(val) => handleStatusChange(app.id, val)}>
                    <SelectTrigger className="h-10 rounded-xl bg-card border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0d1117] border-white/5 text-white">
                      <SelectItem value="submitted" className="hover:bg-white/5 cursor-pointer">Applied / Submitted</SelectItem>
                      <SelectItem value="reviewing" className="hover:bg-white/5 cursor-pointer">Reviewing</SelectItem>
                      <SelectItem value="shortlisted" className="hover:bg-white/5 cursor-pointer">Shortlisted</SelectItem>
                      <SelectItem value="interview" className="hover:bg-white/5 cursor-pointer">Interviewing</SelectItem>
                      <SelectItem value="hired" className="hover:bg-white/5 cursor-pointer">Hired</SelectItem>
                      <SelectItem value="declined" className="hover:bg-white/5 cursor-pointer">Declined</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleViewCV(app)}
                    disabled={!app.cvPath && !app.mergedPdfPath}
                    variant="outline"
                    className="flex-1 border-white/10 text-white hover:bg-white/5 h-10 rounded-xl text-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <FileText className="w-4 h-4" /> {app.mergedPdfPath ? "View Package" : "View CV"}
                  </Button>
                </div>
              </div>

              {/* Recruiter Notes Column */}
              <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-white/5 pt-4 lg:pt-0 lg:pl-6 flex flex-col justify-between gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Recruiter Notes</Label>
                  <Textarea
                    value={editingNotes[app.id] || ""}
                    onChange={(e) => setEditingNotes({ ...editingNotes, [app.id]: e.target.value })}
                    placeholder="Type comments, assessment feedback, etc..."
                    className="min-h-[72px] bg-card border-white/10 text-white rounded-xl text-xs resize-none"
                  />
                </div>
                <Button
                  onClick={() => handleSaveNotes(app.id)}
                  disabled={savingNotesId === app.id || editingNotes[app.id] === app.recruiter_notes}
                  className="bg-primary/20 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground h-8 text-[11px] rounded-lg w-full flex items-center justify-center gap-1 transition-all"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingNotesId === app.id ? "Saving..." : "Save Notes"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const StageChip = ({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`h-8 px-4 rounded-full text-xs font-semibold flex items-center gap-2 border transition-all ${
      active
        ? "bg-primary text-primary-foreground border-primary"
        : "border-white/10 bg-[#0d1117] text-muted-foreground hover:border-white/20 hover:text-white"
    }`}
  >
    <span>{label}</span>
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? "bg-white/20 text-white" : "bg-white/5 text-muted-foreground"}`}>
      {count}
    </span>
  </button>
);
