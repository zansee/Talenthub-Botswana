import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, Plus, Trash2, Shield, UserCheck, Loader2,
  Copy, CheckCircle2, Eye, EyeOff, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface CoTeamProps {
  companyId: string | null;
  userId: string;
  role: string;
}

// ── Auto-generate a random readable password ──────────────────────────────
const generatePassword = () => {
  const words = ["Talent", "Hire", "Recruit", "Scout", "Team", "Crew", "Staff", "Bridge"];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(100 + Math.random() * 900);
  const syms = ["!", "@", "#", "$"];
  const sym = syms[Math.floor(Math.random() * syms.length)];
  return `${word}${num}${sym}`;
};

type ProvisionedCreds = {
  name: string;
  email: string;
  password: string;
  role: string;
};

export const CoTeam = ({ companyId, userId, role }: CoTeamProps) => {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [provisionedCreds, setProvisionedCreds] = useState<ProvisionedCreds | null>(null);

  // Form state
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: generatePassword(),
    role: "recruiter",
  });

  const loadTeamMembers = async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
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

      if (error) throw error;
      setMembers(data || []);
    } catch (err: any) {
      toast.error("Failed to load team members.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTeamMembers(); }, [companyId]);

  // ── Add team member: create account + link to company ──────────────────────
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.email.trim()) {
      toast.error("Full name and email are required.");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    try {
      setBusy(true);

      // ── Step 1: Save current company admin session ──
      // signUp() auto-signs-in the new user, which would log out the company admin.
      // We save the session now and restore it after.
      const { data: { session: adminSession } } = await supabase.auth.getSession();

      // ── Step 2: Create the new team member's account ──
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          data: { full_name: form.fullName.trim() },
        },
      });

      if (authErr) throw authErr;
      const newUserId = authData.user?.id;
      if (!newUserId) throw new Error("Account creation failed — no user ID returned.");

      // ── Step 3: Set profile: account_type = employer, full_name ──
      await supabase
        .from("profiles")
        .update({
          full_name: form.fullName.trim(),
          account_type: "employer",
        })
        .eq("id", newUserId);

      // ── Step 4: Add to company_members ──
      const { error: insErr } = await supabase
        .from("company_members")
        .insert([{
          company_id: companyId!,
          user_id: newUserId,
          role: form.role,
          invited_by: userId,
        }]);

      if (insErr) {
        if (insErr.code === "23505") {
          toast.error("This user is already a member of your company.");
        } else {
          throw insErr;
        }
        return;
      }

      // ── Step 5: Restore company admin session ──
      if (adminSession) {
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        });
      }

      // ── Step 6: Show credentials card ──
      setProvisionedCreds({
        name: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
      });

      setForm({ fullName: "", email: "", password: generatePassword(), role: "recruiter" });
      loadTeamMembers();
      toast.success(`${form.fullName} added to the team!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to add team member.");
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = async (memberId: string, memberUserId: string, newRole: string) => {
    if (memberUserId === userId) {
      toast.error("You cannot change your own role.");
      return;
    }
    try {
      const { error } = await supabase
        .from("company_members")
        .update({ role: newRole })
        .eq("id", memberId);
      if (error) throw error;
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)));
      toast.success("Role updated.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update role.");
    }
  };

  const handleRemoveMember = async (memberId: string, memberUserId: string) => {
    if (memberUserId === userId) {
      toast.error("You cannot remove yourself from the team.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this team member from the system? This will delete their account completely.")) {
      return;
    }
    try {
      const { error } = await (supabase.rpc as any)("delete_company_member", {
        target_user_id: memberUserId
      });
      if (error) throw error;
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      toast.success("Team member deleted from the system.");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove member.");
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const roleLabel = (r: string) =>
    r === "admin" ? "Company Admin" : r === "hiring_manager" ? "Hiring Manager" : "Recruiter";

  const isCompanyAdmin = role === "admin";

  if (!isCompanyAdmin) {
    return (
      <div className="p-8 text-center bg-[#0d1117] border border-white/5 rounded-2xl text-muted-foreground shadow-xl max-w-md mx-auto">
        <Shield className="w-12 h-12 text-red-500/20 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-white mb-2">Access Denied</h3>
        <p className="text-sm">Team Management is restricted to Company Admins.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Team Management</h1>
        <p className="text-muted-foreground mt-1">
          Create accounts for team members and assign their access roles.
        </p>
      </div>

      {/* ── Credentials card after adding a member ── */}
      {provisionedCreds && (
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ background: "rgba(134,239,172,0.07)", border: "1.5px solid rgba(134,239,172,0.25)" }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <p className="font-bold text-green-300 text-sm">
              {provisionedCreds.name} added as <span className="capitalize">{roleLabel(provisionedCreds.role)}</span>!
            </p>
          </div>
          <p className="text-xs text-green-400/80">
            Share these login credentials with your new team member. They can log in at <strong>/employer</strong>.
          </p>
          <div className="grid md:grid-cols-3 gap-3">
            {[
              { label: "Name", value: provisionedCreds.name },
              { label: "Login Email", value: provisionedCreds.email },
              { label: "Password", value: provisionedCreds.password },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-xl px-4 py-3 gap-2"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(134,239,172,0.2)" }}
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-green-400">{label}</p>
                  <p className="text-sm font-semibold text-white truncate">{value}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(value, label)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-green-400 transition-colors shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setProvisionedCreds(null)}
            className="text-xs text-green-500/70 hover:text-green-400 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ── Add Member Form ── */}
        <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-6 shadow-xl space-y-4 h-fit">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" /> Add Team Member
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            A new account will be created. Share the credentials with your team member so they can log in.
          </p>

          <form onSubmit={handleAddMember} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300 font-semibold">Full Name *</Label>
              <Input
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="e.g. Jane Mokoena"
                className="h-11 rounded-xl bg-[#111318] border-white/10 text-white placeholder:text-zinc-500"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300 font-semibold">Email Address *</Label>
              <Input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jane@company.com"
                className="h-11 rounded-xl bg-[#111318] border-white/10 text-white placeholder:text-zinc-500"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300 font-semibold">Login Password *</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    required
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    minLength={6}
                    className="h-11 rounded-xl bg-[#111318] border-white/10 text-white pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Regenerate button */}
                <button
                  type="button"
                  onClick={() => setForm({ ...form, password: generatePassword() })}
                  className="w-11 h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-white transition-colors shrink-0"
                  title="Generate new password"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300 font-semibold">Assign Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger className="h-11 rounded-xl bg-[#111318] border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                  <SelectItem value="recruiter" className="hover:bg-white/5 cursor-pointer">
                    Recruiter — Scoped access
                  </SelectItem>
                  <SelectItem value="hiring_manager" className="hover:bg-white/5 cursor-pointer">
                    Hiring Manager — Post jobs, own analytics
                  </SelectItem>
                  <SelectItem value="admin" className="hover:bg-white/5 cursor-pointer">
                    Company Admin — Full access
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="w-full h-11 bg-primary hover:bg-primary/95 text-primary-foreground rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
              {busy ? "Creating account…" : "Add to Team"}
            </Button>
          </form>
        </div>

        {/* ── Members List ── */}
        <div className="lg:col-span-2 bg-[#0d1117] border border-white/5 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Active Team Members ({members.length})
          </h2>

          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-white/5 rounded-xl" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No team members yet. Add one using the form.</p>
            </div>
          ) : (
            <div className="overflow-hidden border border-white/5 rounded-xl divide-y divide-white/5 bg-card/20">
              {members.map((member) => {
                const name = member.profiles?.full_name || "Unknown";
                const email = member.profiles?.email || "";
                const joined = new Date(member.created_at).toLocaleDateString();
                const isMe = member.user_id === userId;

                return (
                  <div
                    key={member.id}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/[0.01] transition-colors"
                  >
                    <div>
                      <p className="text-sm font-bold text-white flex items-center gap-1.5">
                        {name}
                        {isMe && (
                          <span className="text-[10px] bg-primary/20 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-semibold">
                            You
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{email}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-40">
                        <Select
                          disabled={isMe}
                          value={member.role}
                          onValueChange={(val) => handleRoleChange(member.id, member.user_id, val)}
                        >
                          <SelectTrigger className="h-8 text-xs bg-card border-white/10 text-white rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0d1117] border-white/5 text-white">
                            <SelectItem value="recruiter" className="text-xs hover:bg-white/5 cursor-pointer">Recruiter</SelectItem>
                            <SelectItem value="hiring_manager" className="text-xs hover:bg-white/5 cursor-pointer">Hiring Manager</SelectItem>
                            <SelectItem value="admin" className="text-xs hover:bg-white/5 cursor-pointer">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <span className="text-xs text-muted-foreground hidden md:block whitespace-nowrap">
                        Joined {joined}
                      </span>

                      <Button
                        disabled={isMe}
                        onClick={() => handleRemoveMember(member.id, member.user_id)}
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
