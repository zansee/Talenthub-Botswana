import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Layers, Heart, FileText, User, Bell, LayoutDashboard, Zap, PlusCircle } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";

const candidateTabs = [
  { to: "/swipe", label: "Swipe", icon: Layers },
  { to: "/matches", label: "Matches", icon: Heart },
  { to: "/applications", label: "Applications", icon: FileText },
  { to: "/quick-jobs", label: "Quick Jobs", icon: Zap },
  { to: "/notifications", label: "Alerts", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
];

// Job posters only: Dashboard (showing posted jobs & interests) + Alerts + Profile
const jobPosterTabs = [
  { to: "/quick-jobs", label: "Post Job", icon: PlusCircle },
  { to: "/notifications", label: "Alerts", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
];

// Inactive-subscription users: Alerts + Profile only (locked out of job posting too)
const inactiveTabs = [
  { to: "/notifications", label: "Alerts", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
];

const adminTabs = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/notifications", label: "Alerts", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
];

export const BottomNav = () => {
  const { user, isAdmin } = useAuth();
  const [unread, setUnread] = useState(0);
  const [quickJobsGlow, setQuickJobsGlow] = useState(false);
  const [quickJobsPulse, setQuickJobsPulse] = useState(false);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("free");
  const location = useLocation();

  useEffect(() => {
    if (!user) { setUnread(0); return; }
    const fetchCount = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      setUnread(count ?? 0);
    };
    fetchCount();

    // Fetch account type + subscription for nav gating
    supabase.from("profiles").select("account_type, subscription_status").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        setAccountType(data?.account_type ?? null);
        setSubscriptionStatus(data?.subscription_status ?? "free");
      });

    const ch = supabase
      .channel("notif-badge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        fetchCount,
      )
      .subscribe();

    // Check for new quick jobs
    const checkQuickJobs = async () => {
      const { data } = await supabase.from("quick_jobs").select("created_at").eq("status", "approved").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (data) {
        const lastViewed = localStorage.getItem("last_quick_job_view");
        if (!lastViewed || new Date(data.created_at).getTime() > Number(lastViewed)) {
          setQuickJobsGlow(true);
          setQuickJobsPulse(true);
          setTimeout(() => setQuickJobsPulse(false), 4000);
        }
      }
    };
    checkQuickJobs();

    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const { navStyle } = useApp();

  // Determine which tab set to use
  const isJobPoster = accountType === "quick_jobs";
  const isSubscriptionInactive = !isAdmin && !isJobPoster && subscriptionStatus !== "active";
  let tabs = candidateTabs;
  if (isAdmin) tabs = adminTabs;
  else if (isJobPoster) tabs = jobPosterTabs;
  else if (isSubscriptionInactive) tabs = inactiveTabs;

  const getNavClass = () => {
    if (navStyle === "glass") {
      // Apple-style frosted glass: semi-transparent + heavy backdrop blur + hairline white border
      return "px-2 py-1.5 flex items-center shrink-0 relative z-30" +
        " border-t border-white/20" +
        " bg-white/60 dark:bg-black/50" +
        " [backdrop-filter:blur(24px)_saturate(180%)] [-webkit-backdrop-filter:blur(24px)_saturate(180%)]" +
        " shadow-[0_-1px_0_rgba(0,0,0,0.06)]";
    }
    if (navStyle === "minimal") {
      return "border-t border-border bg-card/95 backdrop-blur px-2 py-1.5 flex justify-around items-center shrink-0 relative z-30";
    }
    if (navStyle === "bubble") {
      return "border-t border-border bg-card/95 backdrop-blur px-2 py-2.5 flex justify-around items-center shrink-0 relative z-30";
    }
    return "border-t border-border bg-card/95 backdrop-blur px-2 py-2 flex justify-around items-center shrink-0 relative z-30";
  };

  const getLinkClass = (isActive: boolean) => {
    if (navStyle === "bubble") {
      return `relative flex items-center gap-1.5 py-1.5 px-3 rounded-full transition-all duration-300 ${
        isActive ? "bg-primary text-primary-foreground shadow-sm scale-105" : "text-muted-foreground hover:bg-muted/30"
      }`;
    }
    if (navStyle === "glass") {
      return `relative flex flex-col items-center justify-center flex-1 transition-all duration-200 gap-0.5 py-1.5 px-1 ${
        isActive ? "text-primary" : "text-foreground/40 hover:text-foreground/70"
      }`;
    }
    const base = "relative flex flex-col items-center justify-center rounded-xl transition-all duration-300";
    if (navStyle === "minimal") {
      return `${base} p-2.5 ${isActive ? "bg-primary/10 text-primary scale-105" : "text-muted-foreground hover:bg-muted/50"}`;
    }
    return `${base} gap-1 py-1.5 px-2 ${isActive ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`;
  };

  // Determine the active tab path for layoutId indicator
  const activeTab = tabs.find((t) => location.pathname === t.to || location.pathname.startsWith(t.to + "/"))?.to ?? null;

  return (
    <nav className={getNavClass()}>
      {tabs.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={() => {
            if (to === "/quick-jobs") {
              setQuickJobsGlow(false);
              setQuickJobsPulse(false);
              localStorage.setItem("last_quick_job_view", Date.now().toString());
            }
          }}
          className={({ isActive }) => getLinkClass(isActive)}
        >
          {({ isActive }) => (
            <>
              {navStyle === "glass" ? (
                <div className="relative flex flex-col items-center gap-0.5">
                  {/* Frosted glass active pill — animated with layoutId */}
                  <div className={`relative flex items-center justify-center w-12 h-8 rounded-full transition-all duration-200 ${
                    isActive
                      ? "bg-primary/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_1px_3px_rgba(0,0,0,0.07)]"
                      : "bg-transparent"
                  }`}>
                    {isActive && (
                      <motion.div
                        layoutId="tab-indicator"
                        className="absolute inset-0 rounded-full bg-primary/20"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <Icon
                      className={`w-5 h-5 relative z-10 ${
                        to === "/quick-jobs" && quickJobsPulse
                        ? "text-yellow-500 fill-yellow-500 animate-pulse drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]"
                        : to === "/quick-jobs" && quickJobsGlow
                        ? "text-yellow-500 fill-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]"
                        : ""
                      }`}
                      strokeWidth={isActive ? 2.5 : 1.8}
                    />
                    {to === "/notifications" && unread > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </div>
                  {/* Label always visible — active = primary, inactive = muted */}
                  <span className="text-[9px] font-semibold tracking-tight leading-none">{label}</span>
                </div>
              ) : (
                <>
                  <div className="relative flex items-center justify-center">
                    <Icon className={`w-5 h-5 ${
                      to === "/quick-jobs" && quickJobsPulse
                        ? "text-yellow-500 fill-yellow-500 animate-pulse drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]"
                        : to === "/quick-jobs" && quickJobsGlow
                        ? "text-yellow-500 fill-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]"
                        : ""
                    }`} strokeWidth={isActive ? 2.5 : 2} />
                    {to === "/notifications" && unread > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </div>
                  {navStyle !== "minimal" && (navStyle !== "bubble" || isActive) && (
                    <span className="text-[10px] font-semibold transition-all duration-300">{label}</span>
                  )}
                  {/* Sliding indicator bar for classic and minimal styles */}
                  {(navStyle === "classic" || navStyle === "minimal" || (!navStyle)) && isActive && (
                    <motion.div
                      layoutId="tab-indicator"
                      className="absolute bottom-0 h-0.5 w-8 rounded-full bg-primary"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
};
