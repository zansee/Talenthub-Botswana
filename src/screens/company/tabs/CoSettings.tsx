import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Upload, AlertCircle, ShieldAlert, Loader2, Save, FileText, CheckCircle2, Palette, RefreshCw } from "lucide-react";
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

  // Brand Kit States
  const [brandPrimary, setBrandPrimary] = useState("#22C55E");
  const [brandSecondary, setBrandSecondary] = useState("#0D1117");
  const [brandAccent, setBrandAccent] = useState("#3B82F6");
  const [brandRecipe, setBrandRecipe] = useState<any>({});
  const [samplePostPath, setSamplePostPath] = useState<string | null>(null);
  const [analyzingStyle, setAnalyzingStyle] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const styleInputRef = useRef<HTMLInputElement>(null);

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
        setBrandPrimary(comp.brand_primary_color || "#22C55E");
        setBrandSecondary(comp.brand_secondary_color || "#0D1117");
        setBrandAccent(comp.brand_accent_color || "#3B82F6");
        setBrandRecipe(comp.brand_style_recipe || {});
        setSamplePostPath(comp.brand_sample_post_path || null);
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

  const handleSaveBrandKit = async () => {
    if (!companyId) return;
    try {
      setSavingBrand(true);
      const { error } = await supabase
        .from("companies")
        .update({
          brand_primary_color: brandPrimary,
          brand_secondary_color: brandSecondary,
          brand_accent_color: brandAccent,
          brand_style_recipe: brandRecipe,
          brand_sample_post_path: samplePostPath,
        } as any)
        .eq("id", companyId);

      if (error) throw error;

      await supabase.from("employer_audit_logs").insert([
        {
          company_id: companyId,
          user_id: userId,
          action_type: "update_branding",
          description: "Updated corporate branding assets and colors",
        },
      ]);

      toast.success("Corporate brand kit saved!");
      onCompanyUpdate();
      loadCompanyAndLogs();
    } catch (err: any) {
      toast.error(err.message || "Failed to save brand kit.");
    } finally {
      setSavingBrand(false);
    }
  };

  const extractColorsFromLogo = () => {
    if (!company?.logo_url) {
      toast.error("Please upload a logo first to extract colors.");
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = company.logo_url;
    
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = 50;
      canvas.height = 50;
      ctx.drawImage(img, 0, 0, 50, 50);

      const imgData = ctx.getImageData(0, 0, 50, 50).data;
      const colors: Record<string, number> = {};

      for (let i = 0; i < imgData.length; i += 4) {
        const r = imgData[i];
        const g = imgData[i + 1];
        const b = imgData[i + 2];
        const a = imgData[i + 3];

        if (a < 200) continue; 

        if (r > 245 && g > 245 && b > 245) continue;
        if (r < 15 && g < 15 && b < 15) continue;

        const roundFactor = 16;
        const rr = Math.min(255, Math.round(r / roundFactor) * roundFactor);
        const gg = Math.min(255, Math.round(g / roundFactor) * roundFactor);
        const bb = Math.min(255, Math.round(b / roundFactor) * roundFactor);
        
        const toHex = (val: number) => {
          const h = val.toString(16);
          return h.length === 1 ? "0" + h : h;
        };
        const hex = `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`.toUpperCase();

        colors[hex] = (colors[hex] || 0) + 1;
      }

      const sorted = Object.entries(colors).sort((a, b) => b[1] - a[1]);
      if (sorted.length > 0) {
        const primary = sorted[0][0];
        setBrandPrimary(primary);

        // Find an accent color that is visually distinct from the primary color
        let accent = primary;
        const getDistance = (c1: string, c2: string) => {
          const r1 = parseInt(c1.slice(1, 3), 16);
          const g1 = parseInt(c1.slice(3, 5), 16);
          const b1 = parseInt(c1.slice(5, 7), 16);
          const r2 = parseInt(c2.slice(1, 3), 16);
          const g2 = parseInt(c2.slice(3, 5), 16);
          const b2 = parseInt(c2.slice(5, 7), 16);
          return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
        };

        for (let i = 1; i < sorted.length; i++) {
          const candidate = sorted[i][0];
          if (getDistance(primary, candidate) >= 80) {
            accent = candidate;
            break;
          }
        }

        // Fallback to the second most dominant color if no distinct color is found
        if (accent === primary && sorted.length > 1) {
          accent = sorted[1][0];
        }

        setBrandAccent(accent);
        toast.success("Successfully extracted colors from logo!");
      } else {
        toast.error("Could not find dominant colors in the logo.");
      }
    };

    img.onerror = () => {
      toast.error("Failed to load logo image for color extraction.");
    };
  };

  const analyzeStyleSample = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzingStyle(true);
    try {
      // 1. Downscale image on canvas and get JPEG blob
      const imageBlob = await new Promise<Blob>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const maxDim = 512;
            let width = img.width;
            let height = img.height;

            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) { reject(new Error("Canvas context is unavailable")); return; }
            
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("Failed to generate image blob"));
              }
            }, "image/jpeg", 0.75);
          };
          img.onerror = () => reject(new Error("Failed to load sample image."));
        };
        reader.onerror = () => reject(new Error("Failed to read sample file."));
      });

      // 2. Upload the downscaled JPEG blob to brand-samples bucket
      const fileName = `sample_${companyId!}_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("brand-samples")
        .upload(fileName, imageBlob, { 
          contentType: "image/jpeg",
          upsert: true 
        });

      if (uploadError) throw uploadError;
      setSamplePostPath(fileName);

      // 3. Get public URL for the brand sample image
      const { data: urlData } = supabase.storage
        .from("brand-samples")
        .getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      // 4. Call Edge Function with the public URL
      const { data, error } = await supabase.functions.invoke("generate-brand-style", {
        body: {
          companyName: form.name,
          industry: form.industry,
          logoUrl: company?.logo_url || null,
          brandColors: [brandPrimary, brandSecondary, brandAccent],
          sampleImageUrl: publicUrl,
        },
      });

      if (error) throw error;
      if (!data?.recipe) throw new Error("No style recipe returned from AI");

      const recipe = data.recipe;
      setBrandPrimary(recipe.primaryColor);
      setBrandSecondary(recipe.secondaryColor);
      setBrandAccent(recipe.accentColor);
      setBrandRecipe(recipe);

      toast.success("AI successfully generated your corporate style recipe!");
    } catch (err: any) {
      console.error("AI analysis failed:", err);
      toast.error(err.message || "Failed to analyze style sample.");
    } finally {
      setAnalyzingStyle(false);
    }
  };

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

          {/* Corporate Brand Kit Panel */}
          <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-6 shadow-xl space-y-4 text-left">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" /> Corporate Brand Kit
            </h3>
            <p className="text-xs text-muted-foreground">
              Define your brand's style guide and color palette.
            </p>

            <div className="space-y-3.5">
              {/* Primary Color */}
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300 font-medium">Primary Brand Color</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="text"
                      value={brandPrimary}
                      onChange={(e) => setBrandPrimary(e.target.value)}
                      placeholder="#22C55E"
                      maxLength={7}
                      className="h-10 rounded-xl bg-[#111318] border-white/10 text-white pl-10 text-xs font-mono"
                    />
                    <div 
                      className="w-5 h-5 rounded absolute left-3 top-1/2 -translate-y-1/2 border border-white/10"
                      style={{ backgroundColor: brandPrimary }}
                    />
                  </div>
                  <input
                    type="color"
                    value={brandPrimary.startsWith('#') && brandPrimary.length === 7 ? brandPrimary : '#22c55e'}
                    onChange={(e) => setBrandPrimary(e.target.value.toUpperCase())}
                    className="w-10 h-10 p-0 rounded-xl border border-white/10 bg-transparent cursor-pointer overflow-hidden"
                  />
                </div>
              </div>

              {/* Secondary Color */}
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300 font-medium">Secondary Color (Background/Canvas)</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="text"
                      value={brandSecondary}
                      onChange={(e) => setBrandSecondary(e.target.value)}
                      placeholder="#0D1117"
                      maxLength={7}
                      className="h-10 rounded-xl bg-[#111318] border-white/10 text-white pl-10 text-xs font-mono"
                    />
                    <div 
                      className="w-5 h-5 rounded absolute left-3 top-1/2 -translate-y-1/2 border border-white/10"
                      style={{ backgroundColor: brandSecondary }}
                    />
                  </div>
                  <input
                    type="color"
                    value={brandSecondary.startsWith('#') && brandSecondary.length === 7 ? brandSecondary : '#0d1117'}
                    onChange={(e) => setBrandSecondary(e.target.value.toUpperCase())}
                    className="w-10 h-10 p-0 rounded-xl border border-white/10 bg-transparent cursor-pointer overflow-hidden"
                  />
                </div>
              </div>

              {/* Accent Color */}
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300 font-medium">Accent / Callout Color</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="text"
                      value={brandAccent}
                      onChange={(e) => setBrandAccent(e.target.value)}
                      placeholder="#3B82F6"
                      maxLength={7}
                      className="h-10 rounded-xl bg-[#111318] border-white/10 text-white pl-10 text-xs font-mono"
                    />
                    <div 
                      className="w-5 h-5 rounded absolute left-3 top-1/2 -translate-y-1/2 border border-white/10"
                      style={{ backgroundColor: brandAccent }}
                    />
                  </div>
                  <input
                    type="color"
                    value={brandAccent.startsWith('#') && brandAccent.length === 7 ? brandAccent : '#3b82f6'}
                    onChange={(e) => setBrandAccent(e.target.value.toUpperCase())}
                    className="w-10 h-10 p-0 rounded-xl border border-white/10 bg-transparent cursor-pointer overflow-hidden"
                  />
                </div>
              </div>

              {/* Dominant Color Extractor */}
              {company?.logo_url && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={extractColorsFromLogo}
                  className="w-full h-10 rounded-xl border-white/10 hover:bg-white/5 text-white flex items-center justify-center gap-2 text-xs font-semibold"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Extract Colors from Logo
                </Button>
              )}

              {/* AI Style Analyzer */}
              <div className="border-t border-white/5 pt-3.5 space-y-2">
                <Label className="text-xs text-zinc-300 font-medium">AI Style Analyzer</Label>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Upload an existing social media design sample to let Gemini analyze your layout rules, fonts, and style structure automatically.
                </p>
                <input
                  type="file"
                  ref={styleInputRef}
                  accept="image/*"
                  onChange={analyzeStyleSample}
                  className="hidden"
                  disabled={analyzingStyle}
                />
                <Button
                  type="button"
                  onClick={() => styleInputRef.current?.click()}
                  disabled={analyzingStyle}
                  className="w-full h-10 rounded-xl bg-card border border-white/10 hover:bg-white/5 text-white flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer"
                >
                  {analyzingStyle ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing graphic...
                    </>
                  ) : (
                    <>
                      <Palette className="w-3.5 h-3.5 text-primary" /> Analyze Style Sample Post
                    </>
                  )}
                </Button>
              </div>

              {/* Recipe Recipe Metadata Preview */}
              {brandRecipe && brandRecipe.visualStyle && (
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">AI Style Rules</p>
                  <p className="text-[11px] text-white/90 leading-relaxed font-medium">{brandRecipe.visualStyle}</p>
                  <p className="text-[9px] text-muted-foreground mt-1">Fonts: {brandRecipe.fontTitle} + {brandRecipe.fontBody} | Theme: {brandRecipe.layoutTheme}</p>
                </div>
              )}

              {/* Save Button */}
              <Button
                type="button"
                onClick={handleSaveBrandKit}
                disabled={savingBrand}
                className="w-full h-10 rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground font-semibold flex items-center justify-center gap-2 text-xs"
              >
                {savingBrand ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Brand Kit
              </Button>
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
