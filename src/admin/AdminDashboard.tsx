import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, FileText, Eye, TrendingUp, Users, Zap, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

type Stats = {
  totalJobs: number;
  totalUsers: number;
  totalApplications: number;
  totalViews: number;
  conversion: number;
  pendingQuickJobs: number;
};

// ─── Metric Card ───────────────────────────────────────────────────────────
const MetricCard = ({
  label, value, icon: Icon, hint, primary,
}: {
  label: string; value: string | number; icon: any; hint?: string; primary?: boolean;
}) => (
  <div
    className="relative rounded-2xl p-5 overflow-hidden"
    style={
      primary
        ? {
            background: "linear-gradient(135deg, #4a5e2e 0%, #6a8440 60%, #7a9450 100%)",
            boxShadow: "0 4px 20px 0 rgba(74,94,46,0.30)",
          }
        : {
            background: "#ffffff",
            border: "1.5px solid #e8ecdf",
            boxShadow: "0 2px 8px 0 rgba(90,110,58,0.06)",
          }
    }
  >
    {primary && (
      <div
        className="absolute -top-6 -right-6 rounded-full opacity-20"
        style={{ width: 100, height: 100, background: "rgba(255,255,255,0.3)" }}
      />
    )}
    <div className="flex items-start justify-between gap-2">
      <div>
        <p
          className="text-[11px] font-bold uppercase tracking-widest"
          style={{ color: primary ? "rgba(255,255,255,0.75)" : "#9ca3af" }}
        >
          {label}
        </p>
        <p
          className="text-3xl font-extrabold mt-1.5 leading-none"
          style={{ color: primary ? "#ffffff" : "#1f2937" }}
        >
          {value}
        </p>
        {hint && (
          <p
            className="text-[11px] mt-1.5 font-medium"
            style={{ color: primary ? "rgba(255,255,255,0.65)" : "#6b7280" }}
          >
            {hint}
          </p>
        )}
      </div>
      <div
        className="rounded-full flex items-center justify-center shrink-0"
        style={
          primary
            ? { width: 40, height: 40, background: "rgba(255,255,255,0.2)" }
            : { width: 40, height: 40, border: "2px solid #e8ecdf", background: "#f8f9f6" }
        }
      >
        <Icon
          className="w-5 h-5"
          style={{ color: primary ? "#ffffff" : "#5a6e3a" }}
        />
      </div>
    </div>
    {!primary && (
      <div className="mt-3 flex items-center gap-1">
        <ArrowUpRight className="w-3.5 h-3.5" style={{ color: "#5a6e3a" }} />
        <span className="text-[11px] font-semibold" style={{ color: "#5a6e3a" }}>
          All time
        </span>
      </div>
    )}
  </div>
);

// ─── SVG Bar Chart ─────────────────────────────────────────────────────────
const BarChart = ({
  data,
}: {
  data: Array<{ title: string; views: number; apps: number }>;
}) => {
  const top = data.slice(0, 7);
  const maxViews = Math.max(...top.map((d) => d.views), 1);
  const W = 480;
  const H = 180;
  const barW = 30;
  const gap = (W - top.length * barW) / (top.length + 1);

  return (
    <svg viewBox={`0 0 ${W} ${H + 40}`} className="w-full" style={{ maxHeight: 240 }}>
      <defs>
        {/* Stripe pattern for apps bars */}
        <pattern id="diag-stripe" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#5a6e3a" strokeWidth="2.5" strokeOpacity="0.35" />
        </pattern>
        <linearGradient id="views-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5a6e3a" />
          <stop offset="100%" stopColor="#7a9450" />
        </linearGradient>
      </defs>

      {/* Y gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line
          key={t}
          x1={0}
          y1={H * (1 - t)}
          x2={W}
          y2={H * (1 - t)}
          stroke="#e8ecdf"
          strokeWidth="1"
          strokeDasharray={t === 0 ? "0" : "4 4"}
        />
      ))}

      {top.map((d, i) => {
        const x = gap + i * (barW + gap);
        const viewH = (d.views / maxViews) * H;
        const appH = (d.apps / maxViews) * H;

        return (
          <g key={i}>
            {/* Views bar — solid olive with pill top */}
            <rect
              x={x}
              y={H - viewH}
              width={barW}
              height={viewH}
              rx={6}
              ry={6}
              fill="url(#views-grad)"
            />
            {/* Apps bar overlay — stripe pattern */}
            <rect
              x={x + 4}
              y={H - appH}
              width={barW - 8}
              height={appH}
              rx={4}
              ry={4}
              fill="url(#diag-stripe)"
            />
            {/* Label */}
            <text
              x={x + barW / 2}
              y={H + 16}
              textAnchor="middle"
              fontSize="8"
              fontWeight="600"
              fill="#9ca3af"
              fontFamily="Inter, sans-serif"
            >
              {d.title.slice(0, 10)}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <g transform={`translate(${W - 120}, ${H + 30})`}>
        <rect width="10" height="10" rx="2" fill="url(#views-grad)" />
        <text x="14" y="9" fontSize="8" fill="#6b7280" fontFamily="Inter, sans-serif">Views</text>
        <rect x="50" width="10" height="10" rx="2" fill="url(#diag-stripe)" stroke="#5a6e3a" strokeWidth="0.5" />
        <text x="64" y="9" fontSize="8" fill="#6b7280" fontFamily="Inter, sans-serif">Apps</text>
      </g>
    </svg>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [perJob, setPerJob] = useState<Array<{ title: string; views: number; apps: number; conv: number }>>([]);

  useEffect(() => {
    (async () => {
      const [jobsR, profilesR, appsR, viewsR, jobsListR, appsListR, viewsListR, pendingQuickJobsR] =
        await Promise.all([
          supabase.from("jobs").select("*", { count: "exact", head: true }),
          supabase.from("profiles").select("*", { count: "exact", head: true }).neq("account_type", "employer"),
          supabase.from("applications").select("*", { count: "exact", head: true }).eq("status", "submitted"),
          supabase.from("job_views").select("*", { count: "exact", head: true }),
          supabase.from("jobs").select("id,title").order("created_at", { ascending: false }).limit(50),
          supabase.from("applications").select("job_id").eq("status", "submitted"),
          supabase.from("job_views").select("job_id"),
          supabase.from("quick_jobs").select("id", { count: "exact", head: true }).eq("status", "pending"),
        ]);

      const totalApps = appsR.count ?? 0;
      const totalViews = viewsR.count ?? 0;
      setStats({
        totalJobs: jobsR.count ?? 0,
        totalUsers: profilesR.count ?? 0,
        totalApplications: totalApps,
        totalViews,
        conversion: totalViews ? Math.round((totalApps / totalViews) * 100) : 0,
        pendingQuickJobs: pendingQuickJobsR.count ?? 0,
      });

      const viewsByJob = new Map<string, number>();
      (viewsListR.data ?? []).forEach((v: any) =>
        viewsByJob.set(v.job_id, (viewsByJob.get(v.job_id) ?? 0) + 1)
      );
      const appsByJob = new Map<string, number>();
      (appsListR.data ?? []).forEach((a: any) =>
        appsByJob.set(a.job_id, (appsByJob.get(a.job_id) ?? 0) + 1)
      );
      const rows = (jobsListR.data ?? [])
        .map((j: any) => {
          const v = viewsByJob.get(j.id) ?? 0;
          const a = appsByJob.get(j.id) ?? 0;
          return { title: j.title, views: v, apps: a, conv: v ? Math.round((a / v) * 100) : 0 };
        })
        .sort((a, b) => b.views - a.views);
      setPerJob(rows);
    })();
  }, []);

  const metrics = [
    { label: "Active Jobs", value: stats?.totalJobs ?? "…", icon: Briefcase, primary: true },
    { label: "Registered Users", value: stats?.totalUsers ?? "…", icon: Users, hint: "All time sign-ups" },
    { label: "Job Views", value: stats?.totalViews ?? "…", icon: Eye, hint: "Unique impressions" },
    { label: "Applications", value: stats?.totalApplications ?? "…", icon: FileText, hint: "Submitted CVs" },
    { label: "Conversion", value: `${stats?.conversion ?? 0}%`, icon: TrendingUp, hint: "Apps ÷ views" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* ── Page heading ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-[#1f2937]">Dashboard</h1>
        <p className="text-sm text-[#6b7280] mt-0.5">
          Plan, prioritize, and monitor activity across TalentHub Botswana.
        </p>
      </div>

      {/* ── Metrics row ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {metrics.map((m) => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      {/* ── Quick action ── */}
      <div className="mb-8">
        <Link
          to="/admin/quick-jobs"
          className="relative inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-md hover:shadow-lg transition-shadow"
          style={{ background: "linear-gradient(135deg, #4a5e2e 0%, #6a8440 100%)" }}
        >
          <Zap className="w-4 h-4" />
          Manage Quick Jobs
          {stats?.pendingQuickJobs ? (
            <span
              className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-white"
            >
              {stats.pendingQuickJobs}
            </span>
          ) : null}
        </Link>
      </div>

      {/* ── Analytics Chart ── */}
      {perJob.length > 0 && (
        <div
          className="rounded-2xl p-6 mb-6"
          style={{
            background: "#ffffff",
            border: "1.5px solid #e8ecdf",
            boxShadow: "0 2px 8px 0 rgba(90,110,58,0.06)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[15px] font-bold text-[#1f2937]">Project Analytics</h2>
              <p className="text-[12px] text-[#9ca3af]">Views vs. Applications per listing</p>
            </div>
            <div className="text-[11px] font-semibold px-3 py-1 rounded-full" style={{ background: "#f0f2ec", color: "#5a6e3a" }}>
              Top {Math.min(perJob.length, 7)} jobs
            </div>
          </div>
          <BarChart data={perJob} />
        </div>
      )}

      {/* ── Per-job performance table ── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "#ffffff",
          border: "1.5px solid #e8ecdf",
          boxShadow: "0 2px 8px 0 rgba(90,110,58,0.06)",
        }}
      >
        <div className="px-6 py-4" style={{ borderBottom: "1.5px solid #e8ecdf" }}>
          <h2 className="text-[15px] font-bold text-[#1f2937]">Per-job Performance</h2>
          <p className="text-[12px] text-[#9ca3af]">Sorted by total views, highest first</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#f8f9f6", borderBottom: "1.5px solid #e8ecdf" }}>
                <th className="text-left px-6 py-3 text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider">
                  Job Title
                </th>
                <th className="text-right px-6 py-3 text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider">
                  Views
                </th>
                <th className="text-right px-6 py-3 text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider">
                  Applications
                </th>
                <th className="text-right px-6 py-3 text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider">
                  Conversion
                </th>
              </tr>
            </thead>
            <tbody>
              {perJob.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-[#9ca3af] text-sm">
                    No job performance data yet.
                  </td>
                </tr>
              )}
              {perJob.map((r, idx) => (
                <tr
                  key={r.title + idx}
                  style={{ borderTop: "1px solid #f0f2ec" }}
                  className="hover:bg-[#f8f9f6] transition-colors"
                >
                  <td className="px-6 py-3.5 font-semibold text-[#1f2937] max-w-xs truncate">
                    {r.title}
                  </td>
                  <td className="px-6 py-3.5 text-right font-medium text-[#374151]">{r.views}</td>
                  <td className="px-6 py-3.5 text-right font-medium text-[#374151]">{r.apps}</td>
                  <td className="px-6 py-3.5 text-right">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                      style={
                        r.conv >= 10
                          ? { background: "#dcfce7", color: "#166534" }
                          : r.conv >= 5
                          ? { background: "#fef9c3", color: "#854d0e" }
                          : { background: "#f0f2ec", color: "#5a6e3a" }
                      }
                    >
                      {r.conv}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
