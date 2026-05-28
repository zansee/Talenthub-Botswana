import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Upload, AlertCircle, ShieldAlert, Loader2, Save, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface CoSettingsProps {
  companyId: string | null;
  userId: string;
  role: string;
  onCompanyUpdate: () => void;
}

const EMPLOYEE_COUNTS = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];
const INDUSTRIES = [
  "Administration", "Finance & Accounting", "Procurement & Supply Chain",
  "Human Resources", "Information Technology", "Marketing & Communications",
  "Engineering", "Healthcare", "Education & Training", "Legal",
  "Sales & Business Development", "Construction & Property",
  "Agriculture", "Customer Service", "Transport & Logistics", "NGO & Development",
];

export const CoSettings = ({ companyId, userId, role, onCompanyUpdate }: CoSettingsProps) => {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Form State
  const [form, setForm] = useState({
    name: "",
    tagline: "",
    website: "",
    location: "",
    industry: "",
    employee_count: "",
    founded_year: "",
    description: "",
  });

  const loadCompanyAndLogs = async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      
      // 1. Get company details
      const { data: comp, error: compErr } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .maybeSingle();

      if (compErr) throw compErr;
      setCompany(comp);

      if (comp) {
        setForm({
          name: comp.name || "",
          tagline: comp.tagline || "",
          website: comp.website || "",
          location: comp.location || "",
          industry: comp.industry || "",
          employee_count: comp.employee_count || "",
          founded_year: comp.founded_year?.toString() || "",
          description: comp.description || "",
        });
      }

      // 2. Get Audit logs
      const { data: logs, error: logsErr } = await supabase
        .from("employer_audit_logs")
        .select(`
          id,
          action_type,
          description,
          created_at,
          profiles:user_id (
            full_name
          )
        `)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (logsErr) throw logsErr;
      setAuditLogs(logs || []);

    } catch (err: any) {
      console.error("Error loading settings:", err.message);
      toast.error("Failed to load settings data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanyAndLogs();
  }, [companyId]);

  const handleUpdate = (k: string, v: string) => {
    setForm((prev) => ({ ...prev, [k]: v }));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      toast.error("Company Name is required.");
      return;
    }

    try {
      setBusy(true);
      const { error } = await supabase
        .from("companies")
        .update({
          name: form.name,
          tagline: form.tagline || null,
          website: form.website || null,
          location: form.location || null,
          industry: form.industry || null,
          employee_count: form.employee_count || null,
          founded_year: form.founded_year ? parseInt(form.founded_year, 10) : null,
          description: form.description || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", companyId!);

      if (error) throw error;

      // Log audit trail
      await supabase.from("employer_audit_logs").insert([
        {
          company_id: companyId!,
          user_id: userId,
          action_type: "update_profile",
          description: "Updated company profile details",
        },
      ]);

      toast.success("Company profile saved!");
      onCompanyUpdate();
      loadCompanyAndLogs();
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile.");
    } finally {
      setBusy(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size < 2MB
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image file size must be less than 2MB.");
      return;
    }

    try {
      setUploading(true);
      
      const fileExt = file.name.split(".").pop();
      const fileName = `logo_${companyId!}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload to bucket
      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("company-logos")
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Update companies table
      const { error: dbError } = await supabase
        .from("companies")
        .update({ logo_url: publicUrl })
        .eq("id", companyId!);

      if (dbError) throw dbError;

      // Log audit trail
      await supabase.from("employer_audit_logs").insert([
        {
          company_id: companyId!,
          user_id: userId,
          action_type: "update_logo",
          description: "Uploaded new company logo logo",
        },
      ]);

      toast.success("Logo uploaded successfully!");
      onCompanyUpdate();
      loadCompanyAndLogs();
    } catch (err: any) {
      console.error("Upload error:", err.message);
      toast.error(err.message || "Failed to upload logo.");
    } finally {
      setUploading(false);
    }
  };

  const isCompanyAdmin = role === "admin";

  if (!isCompanyAdmin) {
    return (
      <div className="p-8 text-center bg-[#0d1117] border border-white/5 rounded-2xl text-muted-foreground shadow-xl max-w-md mx-auto">
        <ShieldAlert className="w-12 h-12 text-red-500/20 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-white mb-2">Access Denied</h3>
        <p className="text-sm">
          Settings are restricted to Company Admins. Please contact your company administrator to make changes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Company Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure company profile, branding assets, and view administrative logs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Profile form */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Details Form */}
          <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-6 shadow-xl space-y-6">
            <h2 className="text-lg font-semibold text-white border-b border-white/5 pb-3">Company Profile</h2>
            
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300 font-semibold">Company Name *</Label>
                  <Input
                    required
                    value={form.name}
                    onChange={(e) => handleUpdate("name", e.target.value)}
                    placeholder="e.g. Acme Industries"
                    className="h-11 rounded-xl bg-[#111318] border-white/10 text-white placeholder:text-zinc-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300 font-semibold">Corporate Tagline</Label>
                  <Input
                    value={form.tagline}
                    onChange={(e) => handleUpdate("tagline", e.target.value)}
                    placeholder="e.g. Innovating the future of recruiting"
                    className="h-11 rounded-xl bg-[#111318] border-white/10 text-white placeholder:text-zinc-500"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300 font-semibold">Website URL</Label>
                  <Input
                    type="url"
                    value={form.website}
                    onChange={(e) => handleUpdate("website", e.target.value)}
                    placeholder="https://acme.com"
                    className="h-11 rounded-xl bg-[#111318] border-white/10 text-white placeholder:text-zinc-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300 font-semibold">Office Location</Label>
                  <Input
                    value={form.location}
                    onChange={(e) => handleUpdate("location", e.target.value)}
                    placeholder="Gaborone, Botswana"
                    className="h-11 rounded-xl bg-[#111318] border-white/10 text-white placeholder:text-zinc-500"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-1.5 md:col-span-1">
                  <Label className="text-xs text-zinc-300 font-semibold">Industry</Label>
                  <Select value={form.industry} onValueChange={(v) => handleUpdate("industry", v)}>
                    <SelectTrigger className="h-11 rounded-xl bg-[#111318] border-white/10 text-white">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                      {INDUSTRIES.map((ind) => (
                        <SelectItem key={ind} value={ind} className="hover:bg-white/5 cursor-pointer">{ind}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 md:col-span-1">
                  <Label className="text-xs text-zinc-300 font-semibold">Employee Count</Label>
                  <Select value={form.employee_count} onValueChange={(v) => handleUpdate("employee_count", v)}>
                    <SelectTrigger className="h-11 rounded-xl bg-[#111318] border-white/10 text-white">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                      {EMPLOYEE_COUNTS.map((e) => (
                        <SelectItem key={e} value={e} className="hover:bg-white/5 cursor-pointer">{e} staff</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 md:col-span-1">
                  <Label className="text-xs text-zinc-300 font-semibold">Founded Year</Label>
                  <Input
                    type="number"
                    value={form.founded_year}
                    onChange={(e) => handleUpdate("founded_year", e.target.value)}
                    placeholder="e.g. 2018"
                    className="h-11 rounded-xl bg-[#111318] border-white/10 text-white placeholder:text-zinc-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300 font-semibold">About the Company</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => handleUpdate("description", e.target.value)}
                  placeholder="Describe your company culture, mission, and focus..."
                  className="min-h-[120px] rounded-xl bg-[#111318] border-white/10 text-white placeholder:text-zinc-500"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  disabled={busy}
                  className="bg-primary hover:bg-primary/95 text-primary-foreground h-11 px-6 rounded-xl flex items-center gap-2"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Details
                </Button>
              </div>
            </form>
          </div>

          {/* Audit Logs Trail */}
          <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> Admin Audit Logs
            </h3>
            <p className="text-xs text-muted-foreground">
              Audit trail of team and settings actions performed inside the Company Suite.
            </p>

            <div className="border border-white/5 rounded-xl overflow-hidden divide-y divide-white/5 bg-card/10">
              {auditLogs.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">No recent actions logged.</div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-3 flex justify-between items-center text-xs hover:bg-white/[0.01] transition-colors">
                    <div>
                      <p className="font-semibold text-white/90">{log.description}</p>
                      <p className="text-muted-foreground/60 text-[10px] mt-0.5">
                        Performed by: {log.profiles?.full_name || "System"}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground/60 text-right">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Branding & Logo upload side panel */}
        <div className="space-y-6">
          {/* Logo Upload Panel */}
          <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-6 shadow-xl text-center space-y-4">
            <h3 className="text-base font-semibold text-white">Company Logo</h3>
            <p className="text-xs text-muted-foreground">
              Add a brand logo for candidate job postings and the navigation portal.
            </p>

            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                {company?.logo_url ? (
                  <img src={company.logo_url} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-10 h-10 text-muted-foreground" />
                )}
              </div>

              <div className="relative w-full">
                <input
                  type="file"
                  id="logo-input"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  disabled={uploading}
                />
                <Button
                  asChild
                  disabled={uploading}
                  className="w-full h-10 rounded-xl bg-card border border-white/10 hover:bg-white/5 text-white flex items-center justify-center gap-2 cursor-pointer"
                >
                  <label htmlFor="logo-input">
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" /> Upload Brand Image
                      </>
                    )}
                  </label>
                </Button>
              </div>
            </div>
          </div>

          {/* Subscription info */}
          <div className="bg-gradient-to-br from-[#0d1117] to-primary/5 border border-white/5 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-semibold text-white">Subscription Plan</h3>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Subscription tier</span>
              <span className="text-xs font-bold text-primary uppercase bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
                {company?.subscription_tier || "Free"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed pt-2 border-t border-white/5">
              To upgrade employee counts, unlock candidate search highlights, or access priority customer service, explore professional plans.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
