import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, TrendingUp, Users, Eye, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

interface CoAnalyticsProps {
  companyId: string | null;
  userId: string;
  role: string;
}

export const CoAnalytics = ({ companyId, userId }: CoAnalyticsProps) => {
  const [loading, setLoading] = useState(true);
  const [jobStats, setJobStats] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalViews: 0,
    totalApps: 0,
    conversion: 0,
  });
  const [funnel, setFunnel] = useState({
    applied: 0,
    reviewing: 0,
    shortlisted: 0,
    interview: 0,
    hired: 0,
  });
  const [dailyData, setDailyData] = useState<{ label: string; count: number }[]>([]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      // Fetch jobs with nested applications and views
      let query = supabase
        .from("jobs")
        .select(`
          id,
          title,
          is_active,
          job_views (id, created_at),
          applications (id, status, created_at)
        `);

      if (companyId) {
        query = query.eq("company_id", companyId);
      } else {
        query = query.eq("posted_by", userId);
      }

      const { data: jobs, error } = await query;
      if (error) throw error;

      if (!jobs || jobs.length === 0) {
        setJobStats([]);
        setSummary({ totalViews: 0, totalApps: 0, conversion: 0 });
        setLoading(false);
        return;
      }

      let totalViews = 0;
      let totalApps = 0;
      
      const counts = {
        applied: 0,
        reviewing: 0,
        shortlisted: 0,
        interview: 0,
        hired: 0,
      };

      // 14 days chart prep
      const dailyMap: Record<string, number> = {};
      const datesList: string[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        dailyMap[key] = 0;
        datesList.push(key);
      }

      const formattedStats = jobs.map((job) => {
        const viewsCount = job.job_views?.length || 0;
        const appsCount = job.applications?.length || 0;
        const conversionRate = viewsCount > 0 ? (appsCount / viewsCount) * 100 : 0;

        totalViews += viewsCount;
        totalApps += appsCount;

        // Count application stages
        (job.applications || []).forEach((app) => {
          if (app.status === "submitted" || app.status === "draft") counts.applied++;
          else if (app.status === "reviewing") counts.reviewing++;
          else if (app.status === "shortlisted") counts.shortlisted++;
          else if (app.status === "interview") counts.interview++;
          else if (app.status === "hired") counts.hired++;

          // For daily chart
          const appDate = app.created_at.split("T")[0];
          if (dailyMap[appDate] !== undefined) {
            dailyMap[appDate]++;
          }
        });

        return {
          id: job.id,
          title: job.title,
          views: viewsCount,
          applicants: appsCount,
          conversion: conversionRate.toFixed(1),
          active: job.is_active,
        };
      });

      const totalConversion = totalViews > 0 ? (totalApps / totalViews) * 100 : 0;

      setJobStats(formattedStats);
      setSummary({
        totalViews,
        totalApps,
        conversion: parseFloat(totalConversion.toFixed(1)),
      });
      setFunnel(counts);

      const chartData = datesList.map((d) => {
        const dateObj = new Date(d);
        return {
          label: dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          count: dailyMap[d],
        };
      });
      setDailyData(chartData);

    } catch (err: any) {
      console.error("Error loading analytics:", err.message);
      toast.error("Failed to load recruitment analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [companyId, userId]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-white/5 rounded-lg" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-white/5 rounded-2xl" />
          ))}
        </div>
        <div className="h-64 bg-white/5 rounded-2xl" />
      </div>
    );
  }

  // Calculate SVG dimensions for the chart
  const chartHeight = 150;
  const chartWidth = 500;
  const maxCount = Math.max(...dailyData.map((d) => d.count), 5); // Minimum peak of 5 for scaling
  
  // Create points path for SVG
  const points = dailyData.map((d, index) => {
    const x = (index / (dailyData.length - 1)) * chartWidth;
    const y = chartHeight - (d.count / maxCount) * chartHeight;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Measure recruitment funnel performance and job listing engagement.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-5 shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Aggregate Views</p>
            <h3 className="text-2xl font-bold text-white mt-1 leading-none">{summary.totalViews}</h3>
          </div>
        </div>
        <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-5 shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Applicants</p>
            <h3 className="text-2xl font-bold text-white mt-1 leading-none">{summary.totalApps}</h3>
          </div>
        </div>
        <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-5 shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Conversion Rate</p>
            <h3 className="text-2xl font-bold text-white mt-1 leading-none">{summary.conversion}%</h3>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Applications Trend Line Chart */}
        <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-base font-semibold text-white">Daily Applications Trend (Last 14 Days)</h3>
          
          <div className="w-full h-48 bg-[#0a0c10]/40 border border-white/5 rounded-xl p-4 flex items-center justify-center">
            {dailyData.length > 0 ? (
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible">
                {/* Grid Lines */}
                <line x1="0" y1="0" x2={chartWidth} y2="0" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                <line x1="0" y1={chartHeight / 2} x2={chartWidth} y2={chartHeight / 2} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                <line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                
                {/* Area under the line */}
                <path
                  d={`M0,${chartHeight} L${points} L${chartWidth},${chartHeight} Z`}
                  fill="url(#gradient)"
                  opacity="0.1"
                />
                
                {/* The line itself */}
                <polyline
                  fill="none"
                  stroke="#64825d"
                  strokeWidth="3"
                  points={points}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Definitions for Gradient */}
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#64825d" />
                    <stop offset="100%" stopColor="#64825d" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Interactive circles/labels */}
                {dailyData.map((d, index) => {
                  const x = (index / (dailyData.length - 1)) * chartWidth;
                  const y = chartHeight - (d.count / maxCount) * chartHeight;
                  return d.count > 0 ? (
                    <g key={index} className="group cursor-pointer">
                      <circle cx={x} cy={y} r="4" fill="#64825d" stroke="#0a0c10" strokeWidth="1.5" />
                      <rect x={x - 12} y={y - 20} width="24" height="14" rx="3" fill="#0d1117" stroke="rgba(255,255,255,0.1)" strokeWidth="1" className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      <text x={x} y={y - 10} textAnchor="middle" fill="#white" fontSize="8" className="opacity-0 group-hover:opacity-100 transition-opacity font-bold">{d.count}</text>
                    </g>
                  ) : null;
                })}
              </svg>
            ) : (
              <p className="text-xs text-muted-foreground">No trend data available.</p>
            )}
          </div>
          
          {/* X axis labels */}
          <div className="flex justify-between text-[9px] text-muted-foreground/60 px-1 font-semibold">
            <span>{dailyData[0]?.label}</span>
            <span>{dailyData[Math.floor(dailyData.length / 2)]?.label}</span>
            <span>{dailyData[dailyData.length - 1]?.label}</span>
          </div>
        </div>

        {/* Pipeline Funnel Analysis */}
        <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-6 shadow-xl space-y-5">
          <h3 className="text-base font-semibold text-white">Funnel Conversion Analysis</h3>
          
          <div className="space-y-4">
            <FunnelBar label="Applied" count={funnel.applied} percentage={100} color="bg-blue-500" />
            <FunnelBar label="Reviewing" count={funnel.reviewing} percentage={funnel.applied > 0 ? (funnel.reviewing / funnel.applied) * 100 : 0} color="bg-yellow-500" />
            <FunnelBar label="Shortlisted" count={funnel.shortlisted} percentage={funnel.reviewing > 0 ? (funnel.shortlisted / funnel.reviewing) * 100 : 0} color="bg-orange-500" />
            <FunnelBar label="Interview" count={funnel.interview} percentage={funnel.shortlisted > 0 ? (funnel.interview / funnel.shortlisted) * 100 : 0} color="bg-purple-500" />
            <FunnelBar label="Hired" count={funnel.hired} percentage={funnel.interview > 0 ? (funnel.hired / funnel.interview) * 100 : 0} color="bg-green-500" />
          </div>
        </div>
      </div>

      {/* Jobs Performance Table */}
      <div className="bg-[#0d1117] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-white/5">
          <h3 className="text-base font-semibold text-white">Job Listing Conversion Metrics</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-xs font-semibold text-muted-foreground uppercase bg-white/[0.02]">
                <th className="px-6 py-4">Job Title</th>
                <th className="px-6 py-4">Views</th>
                <th className="px-6 py-4">Applications</th>
                <th className="px-6 py-4">Conversion Rate</th>
                <th className="px-6 py-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {jobStats.map((stat) => (
                <tr key={stat.id} className="hover:bg-white/[0.01] transition-colors">
                  <td className="px-6 py-4 text-sm font-semibold text-white">{stat.title}</td>
                  <td className="px-6 py-4 text-sm text-white/80">{stat.views}</td>
                  <td className="px-6 py-4 text-sm text-white/80">{stat.applicants}</td>
                  <td className="px-6 py-4 text-sm font-medium text-primary">
                    <span className="flex items-center gap-1">
                      {stat.conversion}%
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      stat.active ? "bg-primary/10 text-primary" : "bg-white/5 text-muted-foreground"
                    }`}>
                      {stat.active ? "Active" : "Closed"}
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

const FunnelBar = ({ label, count, percentage, color }: { label: string; count: number; percentage: number; color: string }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-xs font-semibold">
      <span className="text-white">{label}</span>
      <span className="text-muted-foreground">
        {count} <span className="text-[10px] ml-1">({percentage.toFixed(0)}%)</span>
      </span>
    </div>
    <div className="h-3 bg-white/5 rounded-full overflow-hidden">
      <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${percentage}%` }} />
    </div>
  </div>
);
