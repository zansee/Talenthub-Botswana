import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, Users, Eye, Plus, Pencil, Trash2, X, AlertTriangle, ToggleLeft, ToggleRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface CoJobsProps {
  companyId: string | null;
  userId: string;
  role: string;
  companyName?: string;
}

const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Internship", "Temporary"];
const QUALIFICATIONS = ["Secondary School", "Certificate", "Diploma", "Bachelor's Degree", "Honours", "Master's Degree", "PhD"];
const INDUSTRIES = [
  "Administration", "Finance & Accounting", "Procurement & Supply Chain",
  "Human Resources", "Information Technology", "Marketing & Communications",
  "Engineering", "Healthcare", "Education & Training", "Legal",
  "Sales & Business Development", "Construction & Property",
  "Agriculture", "Customer Service", "Transport & Logistics", "NGO & Development",
];

const AVAILABLE_DOCUMENTS = [
  "Copy of ID / Passport",
  "Degree Certificate",
  "Academic Transcripts",
  "Reference Letter",
  "Driver's License",
  "Portfolio",
  "Payslip / Salary Slip"
];

export const CoJobs = ({ companyId, userId, role, companyName }: CoJobsProps) => {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<any[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<any | null>(null);
  
  // Dialog state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Form state
  const [form, setForm] = useState({
    title: "",
    company: companyName || "",
    location: "Gaborone, Botswana",
    industry: "",
    job_type: "Full-time",
    employment_type: "Full-time",
    salary_range: "",
    description: "",
    skills: "",
    application_email: "",
    hiring_contact_name: "",
    hiring_contact_title: "",
    required_years_experience: "",
    required_qualification: "",
    application_deadline: "",
    required_documents: [] as string[],
  });

  const loadJobs = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("jobs")
        .select(`
          *,
          applications(id),
          job_views(id)
        `)
        .order("created_at", { ascending: false });

      if (companyId) {
        query = query.eq("company_id", companyId);
      } else {
        query = query.eq("posted_by", userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setJobs(data || []);
    } catch (err: any) {
      console.error("Error loading jobs:", err.message);
      toast.error("Failed to load jobs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, [companyId, userId]);

  const resetForm = () => {
    setForm({
      title: "",
      company: companyName || "",
      location: "Gaborone, Botswana",
      industry: "",
      job_type: "Full-time",
      employment_type: "Full-time",
      salary_range: "",
      description: "",
      skills: "",
      application_email: "",
      hiring_contact_name: "",
      hiring_contact_title: "",
      required_years_experience: "",
      required_qualification: "",
      application_deadline: "",
      required_documents: [],
    });
    setEditingJob(null);
  };

  const handleOpenCreatePanel = () => {
    resetForm();
    setIsPanelOpen(true);
  };

  const handleOpenEditPanel = (job: any) => {
    setEditingJob(job);
    setForm({
      title: job.title || "",
      company: job.company || companyName || "",
      location: job.location || "Gaborone, Botswana",
      industry: job.industry || "",
      job_type: job.job_type || "Full-time",
      employment_type: job.employment_type || "Full-time",
      salary_range: job.salary_range || "",
      description: job.description || "",
      skills: Array.isArray(job.skills) ? job.skills.join(", ") : "",
      application_email: job.application_email || "",
      hiring_contact_name: job.hiring_contact_name || "",
      hiring_contact_title: job.hiring_contact_title || "",
      required_years_experience: job.required_years_experience?.toString() || "",
      required_qualification: job.required_qualification || "",
      application_deadline: job.application_deadline ? new Date(job.application_deadline).toISOString().substring(0, 10) : "",
      required_documents: Array.isArray(job.required_documents) ? job.required_documents : [],
    });
    setIsPanelOpen(true);
  };

  const toggleRequiredDocument = (doc: string) => {
    setForm((prev) => {
      const docs = prev.required_documents.includes(doc)
        ? prev.required_documents.filter((d) => d !== doc)
        : [...prev.required_documents, doc];
      return { ...prev, required_documents: docs };
    });
  };

  const updateField = (k: string, v: string) => {
    setForm((prev) => ({ ...prev, [k]: v }));
  };

  const toggleJobActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("jobs")
        .update({ is_active: !currentStatus })
        .eq("id", id);
      if (error) throw error;
      
      setJobs((prev) =>
        prev.map((j) => (j.id === id ? { ...j, is_active: !currentStatus } : j))
      );
      toast.success(`Job marked as ${!currentStatus ? 'active' : 'inactive'}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update job status.");
    }
  };

  const handleDeleteJob = async () => {
    if (!deleteConfirmId) return;
    try {
      setBusy(true);
      const { error } = await supabase.from("jobs").delete().eq("id", deleteConfirmId);
      if (error) throw error;

      setJobs((prev) => prev.filter((j) => j.id !== deleteConfirmId));
      toast.success("Job successfully deleted");
      setDeleteConfirmId(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete job.");
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.location || !form.industry || !form.description || !form.application_deadline) {
      toast.error("Please fill in all required fields.");
      return;
    }

    try {
      setBusy(true);
      const skillsArray = form.skills.split(",").map((s) => s.trim()).filter(Boolean);
      
      const payload: any = {
        title: form.title,
        company: companyName || form.company || "Your Company",
        location: form.location,
        industry: form.industry,
        job_type: form.job_type,
        employment_type: form.employment_type,
        salary_range: form.salary_range || null,
        description: form.description,
        skills: skillsArray,
        application_email: null,
        hiring_contact_name: form.hiring_contact_name || null,
        hiring_contact_title: form.hiring_contact_title || null,
        required_years_experience: form.required_years_experience ? parseInt(form.required_years_experience, 10) : null,
        required_qualification: form.required_qualification || null,
        application_deadline: new Date(form.application_deadline).toISOString(),
        company_id: companyId || null,
        required_documents: form.required_documents,
      };

      if (editingJob) {
        const { error } = await supabase
          .from("jobs")
          .update(payload)
          .eq("id", editingJob.id);
        if (error) throw error;
        toast.success("Job successfully updated!");
      } else {
        payload.posted_by = userId;
        payload.is_active = true;
        const { error } = await supabase
          .from("jobs")
          .insert([payload]);
        if (error) throw error;
        toast.success("Job successfully posted!");
      }

      setIsPanelOpen(false);
      resetForm();
      loadJobs();
    } catch (err: any) {
      toast.error(err.message || "Failed to save job.");
    } finally {
      setBusy(false);
    }
  };

  const isRecruiter = role === "recruiter";
  const isAdmin = role === "admin";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Jobs</h1>
          <p className="text-muted-foreground mt-1">
            Manage your company's job postings and monitor applicant volume.
          </p>
        </div>
        {!isRecruiter && (
          <Button onClick={handleOpenCreatePanel} className="bg-primary hover:bg-primary/95 text-primary-foreground flex items-center gap-2 rounded-xl">
            <Plus className="w-4 h-4" /> Post New Job
          </Button>
        )}
      </div>

      {/* Jobs Table */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-white/5 rounded-xl" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="p-12 text-center bg-[#0d1117] border border-white/5 rounded-2xl text-muted-foreground shadow-xl">
          <Briefcase className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-1">No Jobs Found</h3>
          <p className="text-sm text-muted-foreground mb-4">You haven't posted any job openings yet.</p>
          {!isRecruiter && (
            <Button onClick={handleOpenCreatePanel} variant="outline" className="border-white/10 hover:bg-white/5 text-white">
              Create First Job
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-[#0d1117] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-xs font-semibold text-muted-foreground uppercase bg-white/[0.02]">
                  <th className="px-6 py-4">Job Info</th>
                  <th className="px-6 py-4">Views</th>
                  <th className="px-6 py-4">Applicants</th>
                  <th className="px-6 py-4">Deadline</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-white">{job.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{job.industry} • {job.location}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-white/80">
                      <div className="flex items-center gap-1.5">
                        <Eye className="w-4 h-4 text-muted-foreground" />
                        {job.job_views?.length || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-white/80">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        {job.applications?.length || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-white/80">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        {job.application_deadline ? new Date(job.application_deadline).toLocaleDateString() : "No deadline"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => !isRecruiter && toggleJobActive(job.id, job.is_active)}
                        disabled={isRecruiter}
                        className={`focus:outline-none flex items-center transition-opacity ${isRecruiter ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'}`}
                      >
                        {job.is_active ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                            Inactive
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {!isRecruiter && (
                          <Button
                            onClick={() => handleOpenEditPanel(job)}
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-white"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            onClick={() => setDeleteConfirmId(job.id)}
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slide-over panel for Create/Edit Job */}
      {isPanelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#0a0c10] border-l border-white/5 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-250">
            {/* Header */}
            <div className="h-16 px-6 border-b border-white/5 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-semibold text-white">
                {editingJob ? "Edit Job Posting" : "Post a New Job"}
              </h2>
              <button
                onClick={() => setIsPanelOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable form content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300 font-semibold">Job Title *</Label>
                <Input
                  required
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder="e.g. Senior Software Engineer"
                  className="h-11 rounded-xl bg-[#111318] border-white/10 text-white placeholder:text-zinc-500"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300 font-semibold">Location *</Label>
                  <Input
                    required
                    value={form.location}
                    onChange={(e) => updateField("location", e.target.value)}
                    placeholder="e.g. Gaborone, Botswana"
                    className="h-11 rounded-xl bg-[#111318] border-white/10 text-white placeholder:text-zinc-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300 font-semibold">Industry *</Label>
                  <Select value={form.industry} onValueChange={(v) => updateField("industry", v)}>
                    <SelectTrigger className="h-11 rounded-xl bg-[#111318] border-white/10 text-white">
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                      {INDUSTRIES.map((ind) => (
                        <SelectItem key={ind} value={ind} className="hover:bg-white/5 cursor-pointer">
                          {ind}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300 font-semibold">Employment Type *</Label>
                  <Select value={form.employment_type} onValueChange={(v) => { updateField("employment_type", v); updateField("job_type", v); }}>
                    <SelectTrigger className="h-11 rounded-xl bg-[#111318] border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                      {EMPLOYMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="hover:bg-white/5 cursor-pointer">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300 font-semibold">Salary Range (optional)</Label>
                  <Input
                    value={form.salary_range}
                    onChange={(e) => updateField("salary_range", e.target.value)}
                    placeholder="e.g. BWP 15,000 - 20,000"
                    className="h-11 rounded-xl bg-[#111318] border-white/10 text-white placeholder:text-zinc-500"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300 font-semibold">Required Years of Experience (optional)</Label>
                  <Input
                    type="number"
                    value={form.required_years_experience}
                    onChange={(e) => updateField("required_years_experience", e.target.value)}
                    placeholder="e.g. 3"
                    className="h-11 rounded-xl bg-[#111318] border-white/10 text-white placeholder:text-zinc-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300 font-semibold">Required Qualification (optional)</Label>
                  <Select value={form.required_qualification} onValueChange={(v) => updateField("required_qualification", v)}>
                    <SelectTrigger className="h-11 rounded-xl bg-[#111318] border-white/10 text-white">
                      <SelectValue placeholder="Select qualification" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                      {QUALIFICATIONS.map((q) => (
                        <SelectItem key={q} value={q} className="hover:bg-white/5 cursor-pointer">
                          {q}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300 font-semibold">Key Skills (comma-separated) *</Label>
                <Input
                  required
                  value={form.skills}
                  onChange={(e) => updateField("skills", e.target.value)}
                  placeholder="React, SQL, Project Management"
                  className="h-11 rounded-xl bg-[#111318] border-white/10 text-white placeholder:text-zinc-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300 font-semibold">Job Description *</Label>
                <Textarea
                  required
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Describe the job role, tasks and requirements..."
                  className="min-h-[150px] rounded-xl bg-[#111318] border-white/10 text-white placeholder:text-zinc-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300 font-semibold">Application Deadline *</Label>
                <Input
                  type="date"
                  required
                  value={form.application_deadline}
                  onChange={(e) => updateField("application_deadline", e.target.value)}
                  className="h-11 rounded-xl bg-[#111318] border-white/10 text-white placeholder:text-zinc-500"
                />
              </div>

              {/* Required Documents Selector */}
              <div className="space-y-3 border-t border-white/5 pt-4">
                <div>
                  <Label className="text-xs text-zinc-300 font-semibold">Required Documents from Applicants</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select the documents that candidates must upload when applying to this job.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-[#111318] p-4 rounded-xl border border-white/5">
                  {AVAILABLE_DOCUMENTS.map((doc) => {
                    const isChecked = form.required_documents?.includes(doc);
                    return (
                      <label
                        key={doc}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-pointer select-none ${
                          isChecked
                            ? "bg-primary/10 border-primary/30 text-white"
                            : "bg-white/[0.01] border-white/5 text-zinc-400 hover:bg-white/5"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked || false}
                          onChange={() => toggleRequiredDocument(doc)}
                          className="w-4 h-4 rounded border-white/10 text-primary bg-[#111318] focus:ring-primary focus:ring-offset-0 focus:ring-offset-transparent cursor-pointer"
                        />
                        <span className="text-sm font-medium">{doc}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 border-t border-white/5 pt-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300 font-semibold">Hiring Contact Name (optional)</Label>
                  <Input
                    value={form.hiring_contact_name}
                    onChange={(e) => updateField("hiring_contact_name", e.target.value)}
                    placeholder="e.g. John Doe"
                    className="h-11 rounded-xl bg-[#111318] border-white/10 text-white placeholder:text-zinc-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300 font-semibold">Hiring Contact Title (optional)</Label>
                  <Input
                    value={form.hiring_contact_title}
                    onChange={(e) => updateField("hiring_contact_title", e.target.value)}
                    placeholder="e.g. Lead Talent Scout"
                    className="h-11 rounded-xl bg-[#111318] border-white/10 text-white placeholder:text-zinc-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <Button
                  type="button"
                  onClick={() => setIsPanelOpen(false)}
                  variant="outline"
                  className="flex-1 h-12 rounded-xl border-white/10 text-white hover:bg-white/5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={busy}
                  className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground"
                >
                  {busy ? "Saving Job..." : editingJob ? "Update Job" : "Publish Job"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Alert */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#0d1117] border border-white/5 rounded-2xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex gap-3 items-start">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Delete Job Posting?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Are you sure you want to delete this job posting? This will remove all associated statistics and database links. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                onClick={() => setDeleteConfirmId(null)}
                variant="outline"
                disabled={busy}
                className="h-10 rounded-xl border-white/10 text-white hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteJob}
                disabled={busy}
                className="h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white border-none"
              >
                {busy ? "Deleting..." : "Delete Job"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
