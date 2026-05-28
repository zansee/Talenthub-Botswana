import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import {
  Briefcase,
  Users,
  BarChart3,
  Search,
  Bell,
  MessageSquare,
  LayoutDashboard,
  Settings,
  Activity,
  Building2,
  ChevronRight,
  LogOut,
  Shield,
  Loader2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

// Tab Components
import { CoDashboard } from "./tabs/CoDashboard";
import { CoJobs } from "./tabs/CoJobs";
import { CoApplications } from "./tabs/CoApplications";
import { CoTalentSearch } from "./tabs/CoTalentSearch";
import { CoAnalytics } from "./tabs/CoAnalytics";
import { CoLiveActivity } from "./tabs/CoLiveActivity";
import { CoTeam } from "./tabs/CoTeam";
import { CoSettings } from "./tabs/CoSettings";

const INDUSTRIES = [
  "Administration", "Finance & Accounting", "Procurement & Supply Chain",
  "Human Resources", "Information Technology", "Marketing & Communications",
  "Engineering", "Healthcare", "Education & Training", "Legal",
  "Sales & Business Development", "Construction & Property",
  "Agriculture", "Customer Service", "Transport & Logistics", "NGO & Development",
];

export const CompanySuite = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  
  // Navigation State
  const [activeTab, setActiveTab] = useState("Dashboard");

  // Portal State
  const [loading, setLoading] = useState(true);
  const [isEmployer, setIsEmployer] = useState<boolean | null>(null);
  const [companyMember, setCompanyMember] = useState<any | null>(null);
  
  // Onboarding Company form state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyIndustry, setNewCompanyIndustry] = useState("");
  const [onboardingBusy, setOnboardingBusy] = useState(false);

  const loadCompanySession = async () => {
    if (!user) return;
    try {
      setLoading(true);

      // 1. Fetch user profiles to check account type
      const { data: profile } = await supabase
        .from("profiles")
        .select("account_type, full_name")
        .eq("id", user.id)
        .maybeSingle();

      const accType = profile?.account_type;
      const isAllowed = accType === "employer" || accType === "job_poster";
      setIsEmployer(isAllowed);

      if (!isAllowed) {
        setLoading(false);
        return;
      }

      // 2. Fetch company membership
      const { data: member, error } = await supabase
        .from("company_members")
        .select("*, company:companies(*)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (member) {
        setCompanyMember(member);
        setShowOnboarding(false);
      } else {
        // No membership found - show onboarding screen to create a company
        setCompanyMember(null);
        setShowOnboarding(true);
      }
    } catch (err: any) {
      console.error("Error loading company portal session:", err.message);
      toast.error("Failed to load recruitment session.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/employer/landing", { replace: true });
      return;
    }
    loadCompanySession();
  }, [authLoading, user]);

  const handleOnboardCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim() || !newCompanyIndustry) {
      toast.error("Please fill in all company onboarding details.");
      return;
    }

    try {
      setOnboardingBusy(true);

      // 1. Create company record
      const { data: company, error: compErr } = await supabase
        .from("companies")
        .insert([
          {
            name: newCompanyName.trim(),
            industry: newCompanyIndustry,
            owner_user_id: user!.id,
            subscription_tier: "free",
          },
        ])
        .select()
        .single();

      if (compErr) throw compErr;

      // 2. Create company member record as admin
      const { error: memErr } = await supabase
        .from("company_members")
        .insert([
          {
            company_id: company.id,
            user_id: user!.id,
            role: "admin",
          },
        ]);

      if (memErr) throw memErr;

      // 3. Log audit trail
      await supabase.from("employer_audit_logs").insert([
        {
          company_id: company.id,
          user_id: user!.id,
          action_type: "create_company",
          description: `Initialized company suite for ${company.name}`,
        },
      ]);

      toast.success("Welcome to your new Company Suite!");
      await loadCompanySession();
    } catch (err: any) {
      toast.error(err.message || "Failed to initialize company.");
    } finally {
      setOnboardingBusy(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground bg-[#0a0c10] flex-col gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <span>Loading Company Suite...</span>
      </div>
    );
  }

  if (!isEmployer) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-[#0a0c10] text-white">
        <Shield className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          Your account is not registered as an Employer. Please register or contact an administrator.
        </p>
        <Button onClick={() => { signOut(); navigate("/employer/landing"); }} variant="outline" className="mt-6 border-white/10 text-white hover:bg-white/5">
          Sign Out
        </Button>
      </div>
    );
  }

  if (showOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0c10] p-4">
        <div className="w-full max-w-md bg-[#0d1117] border border-white/5 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-primary/10 text-primary border border-primary/20 rounded-xl flex items-center justify-center mx-auto">
              <Building2 className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Onboard Your Company</h2>
            <p className="text-sm text-muted-foreground">
              Set up your organization workspace to begin candidate sourcing.
            </p>
          </div>

          <form onSubmit={handleOnboardCompany} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Company Name</Label>
              <Input
                required
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="e.g. Acme Corporation"
                className="h-11 rounded-xl bg-card border-white/10 text-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Corporate Industry</Label>
              <Select value={newCompanyIndustry} onValueChange={setNewCompanyIndustry}>
                <SelectTrigger className="h-11 rounded-xl bg-card border-white/10 text-white">
                  <SelectValue placeholder="Select Industry" />
                </SelectTrigger>
                <SelectContent className="bg-[#0d1117] border-white/5 text-white">
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind} className="hover:bg-white/5 cursor-pointer">
                      {ind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              disabled={onboardingBusy}
              className="w-full h-11 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded-xl"
            >
              {onboardingBusy ? "Initializing workspace..." : "Create Corporate Space"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const company = companyMember?.company;
  const role = companyMember?.role || "recruiter";

  // Role permissions checking
  const isRecruiter = role === "recruiter";
  const isCompanyAdmin = role === "admin";

  const renderActiveTab = () => {
    switch (activeTab) {
      case "Dashboard":
        return <CoDashboard companyId={company.id} userId={user!.id} role={role} onTabChange={setActiveTab} companyName={company?.name} />;
      case "Jobs":
        return <CoJobs companyId={company.id} userId={user!.id} role={role} companyName={company?.name} />;
      case "Applications":
        return <CoApplications companyId={company.id} userId={user!.id} role={role} />;
      case "Talent Search":
        return <CoTalentSearch userId={user!.id} role={role} />;
      case "Analytics":
        return <CoAnalytics companyId={company.id} userId={user!.id} role={role} />;
      case "Live Activity":
        return <CoLiveActivity companyId={company.id} userId={user!.id} role={role} />;
      case "Team":
        return <CoTeam companyId={company.id} userId={user!.id} role={role} />;
      case "Settings":
        return <CoSettings companyId={company.id} userId={user!.id} role={role} onCompanyUpdate={loadCompanySession} />;
      default:
        return <CoDashboard companyId={company.id} userId={user!.id} role={role} onTabChange={setActiveTab} />;
    }
  };

  return (
    <div className="dark min-h-screen flex bg-[#0a0c10] text-[#e5e7eb] font-sans selection:bg-primary/30">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-white/5 bg-[#0d1117] flex flex-col shrink-0 hidden lg:flex">
        <div className="h-20 px-6 flex items-center border-b border-white/5 gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
            {company?.logo_url ? (
              <img src={company.logo_url} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <Briefcase className="w-5 h-5 text-primary" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-sm tracking-tight text-white truncate">
              {company?.name || "Corporate Hub"}
            </span>
            <span className="text-[9px] uppercase tracking-widest text-primary font-bold mt-0.5">
              {role.replace("_", " ")} Portal
            </span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <SidebarItem
            icon={<LayoutDashboard className="w-4 h-4" />}
            label="Dashboard"
            active={activeTab === "Dashboard"}
            onClick={() => setActiveTab("Dashboard")}
          />
          <SidebarItem
            icon={<Briefcase className="w-4 h-4" />}
            label="Jobs"
            active={activeTab === "Jobs"}
            onClick={() => setActiveTab("Jobs")}
          />
          <SidebarItem
            icon={<Users className="w-4 h-4" />}
            label="Applications"
            active={activeTab === "Applications"}
            onClick={() => setActiveTab("Applications")}
          />
          <SidebarItem
            icon={<Search className="w-4 h-4" />}
            label="Talent Search"
            active={activeTab === "Talent Search"}
            onClick={() => setActiveTab("Talent Search")}
          />
          
          {/* Analytics available to Admin/HM */}
          {!isRecruiter && (
            <SidebarItem
              icon={<BarChart3 className="w-4 h-4" />}
              label="Analytics"
              active={activeTab === "Analytics"}
              onClick={() => setActiveTab("Analytics")}
            />
          )}

          {/* Live activity feed to Admin/HM */}
          {!isRecruiter && (
            <SidebarItem
              icon={<Activity className="w-4 h-4" />}
              label="Live Activity"
              active={activeTab === "Live Activity"}
              onClick={() => setActiveTab("Live Activity")}
            />
          )}

          {/* Team management for Admins only */}
          {isCompanyAdmin && (
            <SidebarItem
              icon={<Users className="w-4 h-4" />}
              label="Team"
              active={activeTab === "Team"}
              onClick={() => setActiveTab("Team")}
            />
          )}

          {/* Settings for Admins only */}
          {isCompanyAdmin && (
            <SidebarItem
              icon={<Settings className="w-4 h-4" />}
              label="Settings"
              active={activeTab === "Settings"}
              onClick={() => setActiveTab("Settings")}
            />
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0 border border-primary/20">
              {role.substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">Active Member</p>
              <p className="text-[10px] text-muted-foreground capitalize truncate">{role.replace("_", " ")}</p>
            </div>
            <button
              onClick={() => { signOut(); navigate("/employer/landing"); }}
              className="text-muted-foreground hover:text-red-400 p-1 rounded hover:bg-white/5 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Console Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-[#0d1117]/80 backdrop-blur-md sticky top-0 z-20 shrink-0">
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search candidates, jobs..."
                className="w-full h-10 bg-white/5 border border-white/10 rounded-xl pl-10 pr-12 text-sm focus:outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground/50 text-white"
                onClick={() => setActiveTab("Talent Search")}
              />
            </div>
          </div>
          <div className="flex items-center gap-6 ml-auto">
            <div className="flex items-center gap-4 text-muted-foreground">
              <button
                className="relative hover:text-white transition-colors"
                onClick={() => setActiveTab("Live Activity")}
              >
                <Bell className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-3 pl-6 border-l border-white/5">
              <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0 border border-primary/20">
                {company?.name ? company.name.substring(0, 2).toUpperCase() : "CO"}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-white">{company?.name || "Acme Inc."}</p>
                <p className="text-[11px] text-primary capitalize">{role.replace("_", " ")}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Container for Active tab */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-[1400px] mx-auto">
            {renderActiveTab()}
          </div>
        </main>
      </div>
    </div>
  );
};

const SidebarItem = ({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
      active
        ? "bg-primary/10 text-primary border border-primary/20 shadow-sm"
        : "text-muted-foreground hover:bg-white/5 hover:text-white"
    }`}
  >
    {icon} <span>{label}</span>
  </button>
);

export default CompanySuite;
