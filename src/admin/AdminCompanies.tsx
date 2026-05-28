import { useEffect, useState, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2, Plus, Users, Trash2, Eye, EyeOff, Copy, CheckCircle2, KeyRound, Shield,
  Loader2, ChevronRight, ChevronDown, Activity, Clock, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const INDUSTRIES = [
  "Administration", "Finance & Accounting", "Procurement & Supply Chain",
  "Human Resources", "Information Technology", "Marketing & Communications",
  "Engineering", "Healthcare", "Education & Training", "Legal",
  "Sales & Business Development", "Construction & Property",
  "Agriculture", "Customer Service", "Transport & Logistics", "NGO & Development",
];

const EMPTY_FORM = {
  // Company
  name: "",
  tagline: "",
  industry: "",
  website: "",
  location: "Gaborone, Botswana",
  subscriptionTier: "free",
  // Company Admin (new account)
  adminFullName: "",
  adminEmail: "",
  adminPassword: "",
};

type ProvisionedCreds = {
  companyName: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
};

export const AdminCompanies = () => {
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<any[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  // After successful provision — show credentials to admin
  const [provisionedCreds, setProvisionedCreds] = useState<ProvisionedCreds | null>(null);

  // Expanded company state
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);
  const [companyMembers, setCompanyMembers] = useState<any[]>([]);
  const [companyLogs, setCompanyLogs] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const handleToggleExpand = async (companyId: string) => {
    if (expandedCompanyId === companyId) {
      setExpandedCompanyId(null);
      return;
    }
    setExpandedCompanyId(companyId);
    setCompanyMembers([]);
    setCompanyLogs([]);
    setLoadingDetails(true);
    try {
      // Fetch company members with profiles
      const { data: mems, error: memErr } = await supabase
        .from("company_members")
        .select(`
          id,
          role,
          created_at,
          user_id,
          profiles:user_id (
            id,
            full_name,
            email
          )
        `)
        .eq("company_id", companyId);

      if (memErr) throw memErr;

      // Fetch company audit logs with profiles (actor)
      const { data: logs, error: logErr } = await supabase
        .from("employer_audit_logs")
        .select(`
          id,
          action_type,
          description,
          created_at,
          user_id,
          profiles:user_id (
            full_name,
            email
          )
        `)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (logErr) throw logErr;

      setCompanyMembers(mems || []);
      setCompanyLogs(logs || []);
    } catch (err: any) {
      toast.error("Failed to load company details: " + err.message);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDeleteMember = async (memberUserId: string, companyId: string) => {
    if (!window.confirm("Are you sure you want to delete this team member from the system? This will delete their account completely.")) {
      return;
    }
    try {
      const { error } = await (supabase.rpc as any)("delete_company_member", {
        target_user_id: memberUserId
      });
      if (error) throw error;
      toast.success("Team member deleted successfully.");
      
      // Refresh local lists
      const { data: mems } = await supabase
        .from("company_members")
        .select(`
          id,
          role,
          created_at,
          user_id,
          profiles:user_id (
            id,
            full_name,
            email
          )
        `)
        .eq("company_id", companyId);
      setCompanyMembers(mems || []);

      const { data: logs } = await supabase
        .from("employer_audit_logs")
        .select(`
          id,
          action_type,
          description,
          created_at,
          user_id,
          profiles:user_id (
            full_name,
            email
          )
        `)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      setCompanyLogs(logs || []);

      // Refresh parent table counts
      loadCompanies();
    } catch (err: any) {
      toast.error("Failed to delete member: " + err.message);
    }
  };

  // ── Load companies ─────────────────────────────────────────────────────────
  const loadCompanies = async () => {
    try {
      setLoading(true);
      const { data: comps, error } = await supabase
        .from("companies")
        .select("*, company_members(id)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const ownerIds = (comps || [])
        .map((c) => c.owner_user_id)
        .filter((id): id is string => id !== null);

      let profilesMap: Record<string, any> = {};
      if (ownerIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", ownerIds);
        if (profs) profs.forEach((p) => { profilesMap[p.id] = p; });
      }

      setCompanies(
        (comps || []).map((c) => ({
          ...c,
          ownerName: c.owner_user_id
            ? profilesMap[c.owner_user_id]?.full_name || "Unknown Owner"
            : "No Owner Assigned",
          ownerEmail: c.owner_user_id ? profilesMap[c.owner_user_id]?.email || "" : "",
          memberCount: c.company_members?.length || 0,
        }))
      );
    } catch (err: any) {
      toast.error("Failed to load companies.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCompanies(); }, []);

  // ── Provision company + admin account ──────────────────────────────────────
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name || !form.industry) {
      toast.error("Company name and industry are required.");
      return;
    }
    if (!form.adminFullName || !form.adminEmail || !form.adminPassword) {
      toast.error("Company admin full name, email and password are required.");
      return;
    }
    if (form.adminPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    try {
      setBusy(true);

      // ── Step 1: Save the current admin session BEFORE signUp ──
      // supabase.auth.signUp() automatically signs in the new user, which would
      // kick the admin out. We save the session here and restore it afterwards.
      const { data: { session: adminSession } } = await supabase.auth.getSession();

      // ── Step 2: Create the company admin user account ──
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.adminEmail.trim().toLowerCase(),
        password: form.adminPassword,
        options: {
          data: { full_name: form.adminFullName.trim() },
        },
      });

      if (authErr) throw authErr;
      const newUserId = authData.user?.id;
      if (!newUserId) throw new Error("User account creation failed — no user ID returned.");

      // ── Step 2: Update their profile: account_type = employer ──
      await supabase
        .from("profiles")
        .update({
          full_name: form.adminFullName.trim(),
          account_type: "employer",
        })
        .eq("id", newUserId);

      // ── Step 3: Create the company ──
      const { data: newComp, error: compErr } = await supabase
        .from("companies")
        .insert([{
          name: form.name.trim(),
          tagline: form.tagline.trim() || null,
          industry: form.industry,
          website: form.website.trim() || null,
          location: form.location,
          owner_user_id: newUserId,
          subscription_tier: form.subscriptionTier,
        }])
        .select()
        .single();

      if (compErr) throw compErr;

      // ── Step 4: Link admin as company_member with role 'admin' ──
      await supabase.from("company_members").insert([{
        company_id: newComp.id,
        user_id: newUserId,
        role: "admin",
      }]);

      // ── Step 5: Write audit log ──
      await supabase.from("employer_audit_logs").insert([{
        company_id: newComp.id,
        user_id: newUserId,
        action_type: "create_company",
        description: `Company Suite provisioned by platform admin for ${newComp.name}`,
      }]);

      // ── Step 6: Restore admin session ──
      // signUp() silently switched the active session to the new user.
      // Restore the saved admin session so the admin stays logged in.
      if (adminSession) {
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        });
      }

      // ── Step 7: Surface the credentials to the admin ──
      setProvisionedCreds({
        companyName: newComp.name,
        adminName: form.adminFullName.trim(),
        adminEmail: form.adminEmail.trim().toLowerCase(),
        adminPassword: form.adminPassword,
      });

      setForm(EMPTY_FORM);
      setIsCreateOpen(false);
      loadCompanies();
      toast.success(`${newComp.name} provisioned! Share credentials with the company admin.`);
    } catch (err: any) {
      toast.error(err.message || "Provisioning failed.");
    } finally {
      setBusy(false);
    }
  };

  // ── Delete company ──────────────────────────────────────────────────────────
  const handleDeleteCompany = async (id: string) => {
    if (!window.confirm(
      "Delete this company? All jobs, applications, and team memberships will be removed. This cannot be undone."
    )) return;
    try {
      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw error;
      toast.success("Company deleted.");
      loadCompanies();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete company.");
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1f2937]">Company Suite Provisioning</h1>
          <p className="text-sm text-[#6b7280] mt-0.5">
            Create a company and its admin account in one step.
          </p>
        </div>
        <button
          onClick={() => { setIsCreateOpen(true); setProvisionedCreds(null); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-md hover:shadow-lg transition-shadow"
          style={{ background: "linear-gradient(135deg,#4a5e2e,#6a8440)" }}
        >
          <Plus className="w-4 h-4" /> Provision Company
        </button>
      </div>

      {/* ── Credentials Card (shown after successful provisioning) ── */}
      {provisionedCreds && (
        <div
          className="mb-6 rounded-2xl p-5 space-y-4"
          style={{ background: "#f0fdf4", border: "2px solid #86efac" }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <p className="font-bold text-green-800 text-sm">
              "{provisionedCreds.companyName}" successfully provisioned!
            </p>
          </div>
          <p className="text-xs text-green-700">
            Share the following login credentials with the company administrator. They can log in at{" "}
            <strong>/employer</strong> and add team members from their dashboard.
          </p>
          <div className="grid md:grid-cols-3 gap-3">
            {[
              { label: "Admin Name", value: provisionedCreds.adminName },
              { label: "Login Email", value: provisionedCreds.adminEmail },
              { label: "Password", value: provisionedCreds.adminPassword },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-xl px-4 py-3 gap-2"
                style={{ background: "#ffffff", border: "1.5px solid #86efac" }}
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-green-600">{label}</p>
                  <p className="text-sm font-semibold text-[#1f2937] truncate">{value}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(value, label)}
                  className="p-1.5 rounded-lg hover:bg-green-100 text-green-600 transition-colors shrink-0"
                  title={`Copy ${label}`}
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setProvisionedCreds(null)}
            className="text-xs text-green-700 hover:text-green-900 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Companies List ── */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl" style={{ background: "#e8ecdf" }} />
          ))}
        </div>
      ) : companies.length === 0 ? (
        <div
          className="p-12 text-center rounded-2xl"
          style={{ background: "#ffffff", border: "1.5px solid #e8ecdf" }}
        >
          <Building2 className="w-12 h-12 mx-auto mb-4" style={{ color: "#9ca3af" }} />
          <h3 className="text-lg font-bold text-[#1f2937] mb-1">No Companies Provisioned</h3>
          <p className="text-sm text-[#6b7280]">Click "Provision Company" above to get started.</p>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "#ffffff", border: "1.5px solid #e8ecdf", boxShadow: "0 2px 8px 0 rgba(90,110,58,0.06)" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ background: "#f8f9f6", borderBottom: "1.5px solid #e8ecdf" }}>
                  <th className="w-10 px-4 py-3"></th>
                  <th className="px-6 py-3 text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider">Company</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider">Company Admin</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider">Subscription</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider">Team</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-right text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => {
                  const isExpanded = expandedCompanyId === c.id;
                  return (
                    <Fragment key={c.id}>
                      <tr
                        className="hover:bg-[#f8f9f6] transition-colors cursor-pointer"
                        style={{ borderTop: "1px solid #f0f2ec" }}
                        onClick={() => handleToggleExpand(c.id)}
                      >
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            className="p-1 rounded-lg hover:bg-[#e8ecdf] transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleExpand(c.id);
                            }}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-[#5a6e3a]" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-[#9ca3af]" />
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-[#1f2937]">{c.name}</p>
                          <p className="text-xs text-[#6b7280] mt-0.5">{c.industry} • {c.location}</p>
                        </td>
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <p className="font-medium text-[#374151]">{c.ownerName}</p>
                          {c.ownerEmail && <p className="text-xs text-[#9ca3af]">{c.ownerEmail}</p>}
                        </td>
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <span
                            className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase border ${
                              c.subscription_tier === "growth"
                                ? "bg-blue-100 text-blue-700 border-blue-200"
                                : c.subscription_tier === "enterprise"
                                ? "bg-purple-100 text-purple-700 border-purple-200"
                                : "bg-[#f0f2ec] text-[#5a6e3a] border-[#e8ecdf]"
                            }`}
                          >
                            {c.subscription_tier || "Free"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[#374151]">
                          <div className="flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-[#9ca3af]" />
                            {c.memberCount} members
                          </div>
                        </td>
                        <td className="px-6 py-4 text-[#6b7280]">
                          {new Date(c.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            onClick={() => handleDeleteCompany(c.id)}
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 rounded-lg hover:bg-red-50 text-[#9ca3af] hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-[#fcfdfa]">
                          <td colSpan={7} className="px-8 py-6 border-t border-b border-[#e8ecdf]" onClick={(e) => e.stopPropagation()}>
                            {loadingDetails ? (
                              <div className="flex items-center justify-center py-8 gap-2 text-[#9ca3af]">
                                <Loader2 className="w-5 h-5 animate-spin text-[#5a6e3a]" />
                                <span className="text-sm font-semibold">Loading details...</span>
                              </div>
                            ) : (
                              <div className="space-y-6 text-left">
                                {/* Metadata grid */}
                                <div className="flex flex-wrap gap-x-8 gap-y-3 text-xs bg-white border border-[#e8ecdf] rounded-xl p-4 shadow-sm">
                                  {c.founded_year && (
                                    <div>
                                      <span className="font-bold text-[#9ca3af] uppercase text-[10px] block">Founded</span>
                                      <span className="font-semibold text-[#374151]">{c.founded_year}</span>
                                    </div>
                                  )}
                                  {c.employee_count && (
                                    <div>
                                      <span className="font-bold text-[#9ca3af] uppercase text-[10px] block">Employees</span>
                                      <span className="font-semibold text-[#374151]">{c.employee_count}</span>
                                    </div>
                                  )}
                                  {c.website && (
                                    <div>
                                      <span className="font-bold text-[#9ca3af] uppercase text-[10px] block">Website</span>
                                      <a
                                        href={c.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#5a6e3a] hover:underline font-semibold flex items-center gap-1"
                                      >
                                        {c.website.replace(/^https?:\/\//i, "")} <ExternalLink className="w-3 h-3" />
                                      </a>
                                    </div>
                                  )}
                                  {c.tagline && (
                                    <div className="flex-1 min-w-[200px]">
                                      <span className="font-bold text-[#9ca3af] uppercase text-[10px] block">Tagline</span>
                                      <span className="text-[#374151] italic">"{c.tagline}"</span>
                                    </div>
                                  )}
                                </div>

                                {/* Main contents grid */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                  {/* Left Panel: Members */}
                                  <div className="bg-white border border-[#e8ecdf] rounded-xl p-5 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between pb-3 border-b border-[#f0f2ec]">
                                      <h4 className="font-bold text-[#1f2937] flex items-center gap-2 text-sm">
                                        <Users className="w-4 h-4 text-[#5a6e3a]" /> Team Members ({companyMembers.length})
                                      </h4>
                                    </div>
                                    {companyMembers.length === 0 ? (
                                      <p className="text-xs text-[#9ca3af] py-6 text-center">No team members found.</p>
                                    ) : (
                                      <div className="divide-y divide-[#f0f2ec] max-h-60 overflow-y-auto pr-1">
                                        {companyMembers.map((m) => {
                                          const isOwner = c.owner_user_id === m.user_id;
                                          return (
                                            <div key={m.id} className="py-2.5 flex items-center justify-between gap-4">
                                              <div>
                                                <p className="text-xs font-bold text-[#1f2937]">
                                                  {m.profiles?.full_name || "Unknown"}
                                                  {isOwner && (
                                                    <span className="ml-1.5 text-[9px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold uppercase">Owner</span>
                                                  )}
                                                </p>
                                                <p className="text-[11px] text-[#9ca3af]">{m.profiles?.email || ""}</p>
                                              </div>
                                              <div className="flex items-center gap-3">
                                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#f0f2ec] text-[#5a6e3a]">
                                                  {m.role === "hiring_manager" ? "Hiring Manager" : m.role}
                                                </span>
                                                <button
                                                  disabled={isOwner}
                                                  onClick={() => handleDeleteMember(m.user_id, c.id)}
                                                  className="p-1 rounded text-[#9ca3af] hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                                  title={isOwner ? "Cannot delete the company owner" : "Delete user from the system"}
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>

                                  {/* Right Panel: Audit Logs */}
                                  <div className="bg-white border border-[#e8ecdf] rounded-xl p-5 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between pb-3 border-b border-[#f0f2ec]">
                                      <h4 className="font-bold text-[#1f2937] flex items-center gap-2 text-sm">
                                        <Activity className="w-4 h-4 text-[#5a6e3a]" /> Audit Trail
                                      </h4>
                                    </div>
                                    {companyLogs.length === 0 ? (
                                      <p className="text-xs text-[#9ca3af] py-6 text-center">No logs recorded yet.</p>
                                    ) : (
                                      <div className="divide-y divide-[#f0f2ec] max-h-60 overflow-y-auto pr-1">
                                        {companyLogs.map((log) => (
                                          <div key={log.id} className="py-2.5 text-xs">
                                            <div className="flex items-start justify-between gap-4">
                                              <p className="font-medium text-[#374151] leading-relaxed">
                                                {log.description}
                                              </p>
                                              <span className="text-[10px] text-[#9ca3af] shrink-0 whitespace-nowrap mt-0.5">
                                                {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                              </span>
                                            </div>
                                            <p className="text-[10px] text-[#9ca3af] mt-1 flex items-center gap-1">
                                              <Clock className="w-3 h-3 text-[#9ca3af]" />
                                              By: {log.profiles?.full_name || log.profiles?.email || "System"}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Description */}
                                {c.description && (
                                  <div className="bg-white border border-[#e8ecdf] rounded-xl p-4 shadow-sm text-xs text-[#6b7280] leading-relaxed">
                                    <p className="font-bold text-[#374151] mb-1">Company Description</p>
                                    {c.description}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Provisioning Modal ── */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div
            className="w-full max-w-lg rounded-2xl p-6 my-4"
            style={{ background: "#ffffff", border: "1.5px solid #e8ecdf", boxShadow: "0 20px 60px 0 rgba(0,0,0,0.15)" }}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between mb-5"
              style={{ borderBottom: "1.5px solid #e8ecdf", paddingBottom: "14px" }}
            >
              <h3 className="text-lg font-bold text-[#1f2937] flex items-center gap-2">
                <Building2 className="w-5 h-5" style={{ color: "#5a6e3a" }} />
                Provision Company Suite
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-[#9ca3af] hover:text-[#374151] text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCompany} className="space-y-5">

              {/* ── Section: Company Details ── */}
              <div>
                <p className="text-[11px] font-bold text-[#5a6e3a] uppercase tracking-widest mb-3">
                  Company Details
                </p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-[#374151]">Company Name *</Label>
                      <Input
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="e.g. Acme Corporation"
                        className="h-10 rounded-xl text-[#1f2937]"
                        style={{ border: "1.5px solid #e8ecdf" }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-[#374151]">Industry *</Label>
                      <Select value={form.industry} onValueChange={(v) => setForm({ ...form, industry: v })}>
                        <SelectTrigger className="h-10 rounded-xl text-[#1f2937]" style={{ border: "1.5px solid #e8ecdf" }}>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {INDUSTRIES.map((ind) => (
                            <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-[#374151]">Location</Label>
                      <Input
                        value={form.location}
                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                        placeholder="Gaborone, Botswana"
                        className="h-10 rounded-xl text-[#1f2937]"
                        style={{ border: "1.5px solid #e8ecdf" }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-[#374151]">Subscription Tier</Label>
                      <Select value={form.subscriptionTier} onValueChange={(v) => setForm({ ...form, subscriptionTier: v })}>
                        <SelectTrigger className="h-10 rounded-xl text-[#1f2937]" style={{ border: "1.5px solid #e8ecdf" }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="growth">Growth</SelectItem>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#374151]">Tagline (optional)</Label>
                    <Input
                      value={form.tagline}
                      onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                      placeholder="e.g. Building the future, today"
                      className="h-10 rounded-xl text-[#1f2937]"
                      style={{ border: "1.5px solid #e8ecdf" }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#374151]">Website (optional)</Label>
                    <Input
                      type="url"
                      value={form.website}
                      onChange={(e) => setForm({ ...form, website: e.target.value })}
                      placeholder="https://acme.com"
                      className="h-10 rounded-xl text-[#1f2937]"
                      style={{ border: "1.5px solid #e8ecdf" }}
                    />
                  </div>
                </div>
              </div>

              {/* ── Section: Company Admin Account ── */}
              <div
                className="pt-4 space-y-3"
                style={{ borderTop: "1.5px solid #e8ecdf" }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{ background: "#f0f2ec" }}
                  >
                    <Shield className="w-3.5 h-3.5" style={{ color: "#5a6e3a" }} />
                  </div>
                  <p className="text-[11px] font-bold text-[#5a6e3a] uppercase tracking-widest">
                    Company Admin Account
                  </p>
                </div>
                <p className="text-xs text-[#6b7280]">
                  A new login account will be created with these credentials. Share them with the company admin so they can access the employer portal at <strong>/employer</strong>.
                </p>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#374151]">Admin Full Name *</Label>
                  <Input
                    required
                    value={form.adminFullName}
                    onChange={(e) => setForm({ ...form, adminFullName: e.target.value })}
                    placeholder="e.g. John Doe"
                    className="h-10 rounded-xl text-[#1f2937]"
                    style={{ border: "1.5px solid #e8ecdf" }}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#374151]">Admin Email *</Label>
                  <Input
                    required
                    type="email"
                    value={form.adminEmail}
                    onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                    placeholder="e.g. admin@acme.com"
                    className="h-10 rounded-xl text-[#1f2937]"
                    style={{ border: "1.5px solid #e8ecdf" }}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#374151]">
                    Admin Password * <span className="font-normal text-[#9ca3af]">(min 6 characters)</span>
                  </Label>
                  <div className="relative">
                    <Input
                      required
                      type={showPassword ? "text" : "password"}
                      value={form.adminPassword}
                      onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                      placeholder="Set a strong password"
                      minLength={6}
                      className="h-10 rounded-xl text-[#1f2937] pr-10"
                      style={{ border: "1.5px solid #e8ecdf" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#374151]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Action buttons ── */}
              <div
                className="flex justify-end gap-3 pt-4"
                style={{ borderTop: "1.5px solid #e8ecdf" }}
              >
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={busy}
                  className="h-10 px-4 rounded-xl text-sm font-semibold text-[#374151] hover:bg-[#f0f2ec] transition-colors"
                  style={{ border: "1.5px solid #e8ecdf" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="h-10 px-6 rounded-xl text-sm font-bold text-white shadow-md hover:shadow-lg transition-shadow disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#4a5e2e,#6a8440)" }}
                >
                  {busy ? "Provisioning…" : "Provision Suite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCompanies;
