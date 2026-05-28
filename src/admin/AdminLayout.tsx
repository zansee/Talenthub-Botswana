import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Briefcase, Users, BarChart3, Bell, ArrowLeft, LogOut, Shield,
  Sparkles, Flag, Zap, AlertTriangle, Building2, ChevronLeft, ChevronRight,
  Search, Mail, Menu,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const items = [
  { to: "/admin", end: true, label: "Dashboard", icon: BarChart3 },
  { to: "/admin/companies", label: "Companies", icon: Building2 },
  { to: "/admin/jobs", label: "Jobs", icon: Briefcase },
  { to: "/admin/quick-jobs", label: "Quick Jobs", icon: Zap },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "/admin/revamp", label: "CV Revamp", icon: Sparkles },
  { to: "/admin/late-deliveries", label: "Late Deliveries", icon: AlertTriangle },
  { to: "/admin/flags", label: "Feature Flags", icon: Flag },
];

const AdminLayout = () => {
  const navigate = useNavigate();
  const { isAdmin, loading, signOut, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [pendingQuickJobs, setPendingQuickJobs] = useState(0);
  const [lateCount, setLateCount] = useState(0);
  const [profile, setProfile] = useState<{ full_name: string | null; email: string | null } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from("quick_jobs").select("id", { count: "exact" }).eq("status", "pending")
      .then(({ count }) => setPendingQuickJobs(count ?? 0));
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    Promise.all([
      supabase.from("revamp_requests").select("id", { count: "exact" }).lt("created_at", threeDaysAgo).not("fulfilment_status", "eq", "delivered"),
      supabase.from("interview_preps").select("id", { count: "exact" }).lt("created_at", threeDaysAgo).not("status", "eq", "delivered"),
    ]).then(([r, p]) => setLateCount((r.count ?? 0) + (p.count ?? 0)));

    if (user?.id) {
      supabase.from("profiles").select("full_name, email").eq("id", user.id).single()
        .then(({ data }) => { if (data) setProfile(data); });
    }
  }, [isAdmin, user?.id]);

  useEffect(() => {
    if (!loading && !isAdmin) navigate("/swipe", { replace: true });
  }, [loading, isAdmin, navigate]);

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f6f2]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-[#5a6e3a]/30 border-t-[#5a6e3a] animate-spin" />
          <p className="text-sm text-[#5a6e3a] font-medium">Checking admin access…</p>
        </div>
      </div>
    );
  }

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "AD";

  return (
    <div className="min-h-screen w-full flex" style={{ background: "#f0f2ec", fontFamily: "'Inter', sans-serif" }}>
      {/* ── Sidebar ── */}
      <aside
        className={`${collapsed ? "w-[72px]" : "w-[240px]"} shrink-0 flex flex-col transition-all duration-300 ease-in-out`}
        style={{
          background: "#ffffff",
          borderRight: "1.5px solid #e8ecdf",
          boxShadow: "2px 0 12px 0 rgba(90,110,58,0.06)",
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-4 transition-all"
          style={{ height: "64px", borderBottom: "1.5px solid #e8ecdf" }}
        >
          <div
            className="flex items-center justify-center rounded-xl shrink-0"
            style={{ width: 38, height: 38, background: "linear-gradient(135deg, #5a6e3a 0%, #7a9450 100%)" }}
          >
            <Shield className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-[14px] font-bold text-[#1f2937] leading-tight">TalentHub</p>
              <p className="text-[10px] font-semibold text-[#5a6e3a] uppercase tracking-widest">Admin</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {!collapsed && (
            <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-widest px-3 mb-2 mt-1">Main Menu</p>
          )}
          {items.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-[#5a6e3a]/10 text-[#3d4d27]"
                    : "text-[#6b7280] hover:bg-[#f0f2ec] hover:text-[#3d4d27]"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Active indicator bar */}
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                      style={{ width: 3, height: 22, background: "#5a6e3a" }}
                    />
                  )}
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${isActive ? "text-[#5a6e3a]" : "text-[#9ca3af] group-hover:text-[#5a6e3a]"}`}
                  />
                  {!collapsed && <span>{label}</span>}
                  {!collapsed && label === "Quick Jobs" && pendingQuickJobs > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {pendingQuickJobs}
                    </span>
                  )}
                  {!collapsed && label === "Late Deliveries" && lateCount > 0 && (
                    <span className="ml-auto bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {lateCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="p-3 space-y-0.5" style={{ borderTop: "1.5px solid #e8ecdf" }}>
          <button
            onClick={() => navigate("/swipe")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#6b7280] hover:bg-[#f0f2ec] hover:text-[#3d4d27] transition-colors"
          >
            <ArrowLeft className="w-4 h-4 shrink-0 text-[#9ca3af]" />
            {!collapsed && <span>Back to app</span>}
          </button>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#6b7280] hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="w-full flex items-center justify-center mt-1 p-2 rounded-xl text-[#9ca3af] hover:bg-[#f0f2ec] hover:text-[#5a6e3a] transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* ── Top Header ── */}
        <header
          className="shrink-0 flex items-center gap-4 px-6"
          style={{
            height: "64px",
            background: "#ffffff",
            borderBottom: "1.5px solid #e8ecdf",
            boxShadow: "0 2px 8px 0 rgba(90,110,58,0.06)",
          }}
        >
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search anything…"
              className="w-full pl-10 pr-4 py-2 text-[13px] rounded-xl bg-[#f0f2ec] border border-transparent focus:border-[#5a6e3a]/30 focus:outline-none focus:bg-white transition-all text-[#1f2937] placeholder:text-[#9ca3af]"
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Mail icon */}
            <button className="w-9 h-9 rounded-full flex items-center justify-center bg-[#f0f2ec] hover:bg-[#e8ecdf] transition-colors">
              <Mail className="w-4 h-4 text-[#6b7280]" />
            </button>

            {/* Bell with badge */}
            <button className="relative w-9 h-9 rounded-full flex items-center justify-center bg-[#f0f2ec] hover:bg-[#e8ecdf] transition-colors">
              <Bell className="w-4 h-4 text-[#6b7280]" />
              {(pendingQuickJobs + lateCount) > 0 && (
                <span
                  className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white"
                />
              )}
            </button>

            {/* Divider */}
            <div className="w-px h-8 bg-[#e8ecdf] mx-1" />

            {/* Profile pill */}
            <div className="flex items-center gap-2.5 pl-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ background: "linear-gradient(135deg, #5a6e3a 0%, #7a9450 100%)" }}
              >
                {initials}
              </div>
              <div className="hidden sm:block">
                <p className="text-[12px] font-semibold text-[#1f2937] leading-tight">
                  {profile?.full_name ?? "Administrator"}
                </p>
                <p className="text-[10px] text-[#9ca3af] leading-tight truncate max-w-[140px]">
                  {profile?.email ?? ""}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* ── Page Content ── */}
        <main className="flex-1 overflow-y-auto" style={{ background: "#f0f2ec" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
