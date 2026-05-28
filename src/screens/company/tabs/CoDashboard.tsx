import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Briefcase, Users, Eye, Clock, Plus, Search,
  ArrowUpRight, Zap, Activity, FileText,
  ChevronRight, UserCheck, BarChart3,
} from "lucide-react";
import { toast } from "sonner";

interface CoDashboardProps {
  companyId: string | null;
  userId: string;
  role: string;
  onTabChange: (tab: string) => void;
  companyName?: string;
}

// ── Quick-launch card ────────────────────────────────────────────────────────
const LaunchCard = ({
  icon, title, description, tag, tagColor, onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  tag: string;
  tagColor: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="group text-left w-full rounded-2xl p-5 transition-all duration-200 hover:scale-[1.02] hover:shadow-2xl"
    style={{ background: "#111318", border: "1px solid rgba(255,255,255,0.06)" }}
  >
    <div className="flex items-start justify-between mb-4">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        {icon}
      </div>
      <span
        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
        style={{ background: tagColor + "22", color: tagColor }}
      >
        {tag}
      </span>
    </div>
    <p className="text-sm font-bold text-white mb-1">{title}</p>
    <p className="text-xs leading-relaxed" style={{ color: "#6b7280" }}>
      {description}
    </p>
    <div className="mt-4 flex items-center gap-1 text-xs font-semibold" style={{ color: tagColor }}>
      Launch <ChevronRight className="w-3.5 h-3.5" />
    </div>
  </button>
);

// ── Stat card (NeuroNest colorful tile style) ────────────────────────────────
const StatCard = ({
  icon, label, value, sub, bg, iconColor, textColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  bg: string;
  iconColor: string;
  textColor: string;
}) => (
  <div
    className="rounded-2xl p-5 flex flex-col gap-4 transition-all duration-200 hover:scale-[1.02]"
    style={{ background: bg }}
  >
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.15)" }}
    >
      <span style={{ color: iconColor }}>{icon}</span>
    </div>
    <div>
      <p className="text-3xl font-extrabold leading-none" style={{ color: textColor }}>
        {value}
      </p>
      <p className="text-xs font-semibold mt-1.5 opacity-75" style={{ color: textColor }}>
        {label}
      </p>
      {sub && (
        <p className="text-[10px] mt-1 opacity-50" style={{ color: textColor }}>
          {sub}
        </p>
      )}
    </div>
  </div>
);

// ── Pipeline stage pill ──────────────────────────────────────────────────────
const PipelinePill = ({
  label, count, dot,
}: {
  label: string; count: number; dot: string;
}) => (
  <div
    className="flex items-center justify-between rounded-xl px-4 py-3"
    style={{ background: "#111318", border: "1px solid rgba(255,255,255,0.05)" }}
  >
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot }} />
      <span className="text-xs font-medium text-white">{label}</span>
    </div>
    <span className="text-sm font-bold text-white">{count}</span>
  </div>
);

// ── Main Dashboard ───────────────────────────────────────────────────────────
export const CoDashboard = ({
  companyId, userId, role, onTabChange, companyName,
}: CoDashboardProps) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ activeJobs: 0, totalApplicants: 0, newToday: 0, views: 0 });
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({
    submitted: 0, reviewing: 0, shortlisted: 0, interview: 0, hired: 0, declined: 0,
  });
  const [recentApplicants, setRecentApplicants] = useState<any[]>([]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      let jobsQuery = supabase.from("jobs").select("id, title, is_active");
      if (companyId) {
        jobsQuery = jobsQuery.eq("company_id", companyId);
      } else {
        jobsQuery = jobsQuery.eq("posted_by", userId);
      }
      const { data: jobs, error: jobsErr } = await jobsQuery;
      if (jobsErr) throw jobsErr;

      const jobIds = (jobs || []).map((j) => j.id);
      const activeJobsCount = (jobs || []).filter((j) => j.is_active).length;

      if (jobIds.length === 0) {
        setStats({ activeJobs: 0, totalApplicants: 0, newToday: 0, views: 0 });
        setStageCounts({ submitted: 0, reviewing: 0, shortlisted: 0, interview: 0, hired: 0, declined: 0 });
        setRecentApplicants([]);
        setLoading(false);
        return;
      }

      const [appsRes, viewsRes] = await Promise.all([
        supabase
          .from("applications")
          .select("id, status, created_at, user_id, job_id, jobs(title)")
          .in("job_id", jobIds)
          .order("created_at", { ascending: false }),
        supabase.from("job_views").select("id, created_at").in("job_id", jobIds),
      ]);

      const apps = appsRes.data || [];
      const views = viewsRes.data || [];

      const recentApps = apps.slice(0, 6);
      const candidateIds = recentApps.map((a) => a.user_id);
      let profilesMap: Record<string, string> = {};
      if (candidateIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", candidateIds);
        if (profs) profs.forEach((p) => { profilesMap[p.id] = p.full_name || "Unknown"; });
      }

      const formattedApplicants = recentApps.map((app) => {
        const fullName = profilesMap[app.user_id] || "Unknown Candidate";
        const parts = fullName.split(" ");
        const masked = `${parts[0]} ${parts.length > 1 ? parts[parts.length - 1][0] + "." : ""}`;
        return {
          id: app.id,
          name: masked,
          jobTitle: (app.jobs as any)?.title || "Unknown Job",
          status: app.status,
          date: new Date(app.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        };
      });

      const oneDayAgo = new Date(Date.now() - 86400000);
      const counts: Record<string, number> = { submitted: 0, reviewing: 0, shortlisted: 0, interview: 0, hired: 0, declined: 0 };
      apps.forEach((a) => { if (counts[a.status] !== undefined) counts[a.status]++; });

      setStats({
        activeJobs: activeJobsCount,
        totalApplicants: apps.length,
        newToday: apps.filter((a) => new Date(a.created_at) >= oneDayAgo).length,
        views: views.length,
      });
      setStageCounts(counts);
      setRecentApplicants(formattedApplicants);
    } catch (err: any) {
      toast.error("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboardData(); }, [companyId, userId]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-44 rounded-2xl bg-white/5" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 rounded-2xl bg-white/5" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map((i) => <div key={i} className="h-64 rounded-2xl bg-white/5" />)}
        </div>
      </div>
    );
  }

  const isRecruiter = role === "recruiter";
  const displayName = companyName || "Your Company";
  const conversionRate = stats.views > 0
    ? Math.round((stats.totalApplicants / stats.views) * 100)
    : 0;

  const statusStyle = (s: string) => {
    const map: Record<string, { bg: string; color: string }> = {
      hired:       { bg: "#052e1620", color: "#4ade80" },
      interview:   { bg: "#2d1b6922", color: "#c084fc" },
      shortlisted: { bg: "#431a0022", color: "#fb923c" },
      reviewing:   { bg: "#1a1a0022", color: "#fbbf24" },
      submitted:   { bg: "#0a172622", color: "#60a5fa" },
      declined:    { bg: "#1f000022", color: "#f87171" },
    };
    return map[s] || { bg: "#ffffff11", color: "#9ca3af" };
  };

  return (
    <div className="space-y-6">

      {/* ── Hero Banner ─────────────────────────────────────────────────── */}
      <div
        className="relative rounded-2xl overflow-hidden p-8"
        style={{
          background: "linear-gradient(135deg, #0d1117 0%, #131b0e 50%, #1a2510 100%)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Decorative floating blobs */}
        <div
          className="absolute -top-8 -right-8 w-48 h-48 rounded-full opacity-10 blur-2xl"
          style={{ background: "#5a6e3a" }}
        />
        <div
          className="absolute bottom-0 right-24 w-32 h-32 rounded-full opacity-10 blur-xl"
          style={{ background: "#7a9450" }}
        />

        {/* Floating icons top-right (NeuroNest style) */}
        <div className="absolute top-6 right-6 flex items-start gap-3 opacity-60">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Briefcase className="w-6 h-6 text-primary" />
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mt-4">
            <Users className="w-5 h-5 text-blue-400" />
          </div>
          <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mt-1">
            <Zap className="w-4 h-4 text-yellow-400" />
          </div>
        </div>

        <div className="max-w-lg">
          <p className="text-xs font-bold text-primary/80 uppercase tracking-widest mb-2">
            Recruitment Command Center
          </p>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white leading-tight">
            Welcome to <span style={{ color: "#7a9450" }}>{displayName}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-sm">
            Manage your hiring pipeline, source top talent, and track every applicant — all from one place.
          </p>

          <div className="flex items-center gap-3 mt-5">
            {!isRecruiter && (
              <button
                onClick={() => onTabChange("Jobs")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg,#4a5e2e,#6a8440)" }}
              >
                <Plus className="w-4 h-4" /> Post a Job
              </button>
            )}
            <button
              onClick={() => onTabChange("Talent Search")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:bg-white/10 transition-colors"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <Search className="w-4 h-4" /> Search Talent
            </button>
          </div>
        </div>
      </div>

      {/* ── Quick Stats ─────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
          Quick Stats
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Briefcase className="w-5 h-5" />}
            label="Active Jobs"
            value={stats.activeJobs}
            sub="Live listings"
            bg="linear-gradient(135deg,#1a2510,#2a3d18)"
            iconColor="#7a9450"
            textColor="#d1fae5"
          />
          <StatCard
            icon={<Users className="w-5 h-5" />}
            label="Total Applicants"
            value={stats.totalApplicants}
            sub="All time"
            bg="linear-gradient(135deg,#0f1c2e,#142440)"
            iconColor="#60a5fa"
            textColor="#bfdbfe"
          />
          <StatCard
            icon={<Clock className="w-5 h-5" />}
            label="New (24h)"
            value={stats.newToday}
            sub="New today"
            bg="linear-gradient(135deg,#1c1000,#2e1e00)"
            iconColor="#fbbf24"
            textColor="#fef3c7"
          />
          <StatCard
            icon={<Eye className="w-5 h-5" />}
            label="Job Views"
            value={stats.views}
            sub={`${conversionRate}% conversion`}
            bg="linear-gradient(135deg,#1a0f2e,#250e40)"
            iconColor="#c084fc"
            textColor="#ede9fe"
          />
        </div>
      </div>

      {/* ── Quick Launch + Pipeline ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Quick Launch Actions (col-span-2) */}
        <div className="lg:col-span-2 space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Quick Launch
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!isRecruiter && (
              <LaunchCard
                icon={<Briefcase className="w-4 h-4 text-primary" />}
                title="Post a New Job"
                description="Create a listing, set requirements, and start receiving candidates instantly."
                tag="Jobs"
                tagColor="#7a9450"
                onClick={() => onTabChange("Jobs")}
              />
            )}
            <LaunchCard
              icon={<Search className="w-4 h-4 text-blue-400" />}
              title="Search Talent Pool"
              description="Headhunt from thousands of active candidates filtered by skill and experience."
              tag="Talent"
              tagColor="#60a5fa"
              onClick={() => onTabChange("Talent Search")}
            />
            <LaunchCard
              icon={<FileText className="w-4 h-4 text-yellow-400" />}
              title="Review Applications"
              description="Move candidates through stages, add notes, and download CVs."
              tag="Pipeline"
              tagColor="#fbbf24"
              onClick={() => onTabChange("Applications")}
            />
            {!isRecruiter && (
              <LaunchCard
                icon={<Activity className="w-4 h-4 text-purple-400" />}
                title="Live Activity Feed"
                description="Watch real-time applications and job view events as they happen."
                tag="Live"
                tagColor="#c084fc"
                onClick={() => onTabChange("Live Activity")}
              />
            )}
            {!isRecruiter && (
              <LaunchCard
                icon={<BarChart3 className="w-4 h-4 text-orange-400" />}
                title="View Analytics"
                description="Conversion rates, views vs. applications, and per-job performance."
                tag="Analytics"
                tagColor="#fb923c"
                onClick={() => onTabChange("Analytics")}
              />
            )}
          </div>
        </div>

        {/* Application Pipeline */}
        <div
          className="rounded-2xl p-6 space-y-4 h-fit"
          style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-white">Application Pipeline</p>
            <button
              onClick={() => onTabChange("Applications")}
              className="text-[11px] font-semibold text-primary flex items-center gap-0.5 hover:underline"
            >
              View all <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2">
            <PipelinePill label="Applied" count={stageCounts.submitted} dot="#60a5fa" />
            <PipelinePill label="Reviewing" count={stageCounts.reviewing} dot="#fbbf24" />
            <PipelinePill label="Shortlisted" count={stageCounts.shortlisted} dot="#fb923c" />
            <PipelinePill label="Interviewing" count={stageCounts.interview} dot="#c084fc" />
            <PipelinePill label="Hired" count={stageCounts.hired} dot="#4ade80" />
          </div>

          {/* Funnel bar */}
          {stats.totalApplicants > 0 && (
            <div className="pt-2">
              <div className="h-2 rounded-full overflow-hidden flex gap-0.5">
                {[
                  { v: stageCounts.submitted, c: "#60a5fa" },
                  { v: stageCounts.reviewing, c: "#fbbf24" },
                  { v: stageCounts.shortlisted, c: "#fb923c" },
                  { v: stageCounts.interview, c: "#c084fc" },
                  { v: stageCounts.hired, c: "#4ade80" },
                ].map(({ v, c }, i) => (
                  <div
                    key={i}
                    style={{
                      width: `${(v / stats.totalApplicants) * 100}%`,
                      background: c,
                      minWidth: v > 0 ? "4px" : "0",
                    }}
                    className="h-full rounded-full"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Activity ──────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Recent Activity
          </p>
          <button
            onClick={() => onTabChange("Applications")}
            className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-0.5"
          >
            See all <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        {recentApplicants.length === 0 ? (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: "#111318", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <UserCheck className="w-10 h-10 mx-auto mb-3 opacity-20 text-primary" />
            <p className="text-sm text-muted-foreground">No applicants yet. Post a job to start receiving candidates.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentApplicants.map((app) => {
              const style = statusStyle(app.status);
              return (
                <button
                  key={app.id}
                  onClick={() => onTabChange("Applications")}
                  className="group text-left rounded-2xl p-4 transition-all duration-200 hover:scale-[1.02]"
                  style={{
                    background: "#111318",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: "rgba(255,255,255,0.07)" }}
                    >
                      {app.name.charAt(0).toUpperCase()}
                    </div>
                    <span
                      className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: style.bg, color: style.color }}
                    >
                      {app.status === "interview" ? "Interview" : app.status}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-white group-hover:text-primary transition-colors truncate">
                    {app.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{app.jobTitle}</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-2">{app.date}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
