import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Edit2, Check, X, Plus, MapPin, GraduationCap, Briefcase, Wrench, UserCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import mascot from "@/assets/mascot-transparent.png";
import {
  INDUSTRIES,
  LOCATIONS,
  QUALIFICATIONS,
  fieldsForIndustries,
  getSuggestedSkills
} from "./ProfileSetup";

const ProfileDetails = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  // Form Edit State
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    current_location: "",
    residential_address: "",
    postal_address: "",
    highest_education: "",
    field_of_study: "",
    institution: "",
    graduation_year: "",
    years_experience: "",
    current_job_title: "",
    career_summary: "",
  });
  const [industries, setIndustries] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [customSkillInput, setCustomSkillInput] = useState("");

  const fetchProfile = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setProfile(data);
        // Prepopulate edit form values
        setForm({
          full_name: data.full_name ?? "",
          phone: data.phone ?? "",
          current_location: data.current_location ?? "",
          residential_address: data.residential_address ?? "",
          postal_address: data.postal_address ?? "",
          highest_education: data.highest_education ?? "",
          field_of_study: data.field_of_study ?? "",
          institution: (data as any).institution ?? "",
          graduation_year: (data as any).graduation_year != null ? String((data as any).graduation_year) : "",
          years_experience: data.years_experience?.toString() ?? "",
          current_job_title: data.current_job_title ?? "",
          career_summary: (data as any).career_summary ?? "",
        });
        setIndustries(((data as any).preferred_industries ?? []) as string[]);
        setSelectedSkills(data.skills ?? []);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load profile");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchProfile();
  }, [user, loading, navigate]);

  const updateField = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const toggleIndustry = (ind: string) =>
    setIndustries((p) => p.includes(ind) ? p.filter((x) => x !== ind) : [...p, ind]);

  const handleAddCustomSkill = () => {
    const rawInput = customSkillInput.trim();
    if (!rawInput) return;
    
    // Split by commas
    const skillsToAdd = rawInput
      .split(",")
      .map(s => s.trim())
      .filter(s => s.length > 0);
      
    if (skillsToAdd.length === 0) return;

    setSelectedSkills(prev => {
      const next = [...prev];
      let addedAny = false;
      
      skillsToAdd.forEach(skill => {
        if (!next.some(s => s.toLowerCase() === skill.toLowerCase())) {
          next.push(skill);
          addedAny = true;
        }
      });
      
      if (!addedAny && skillsToAdd.length === 1) {
        toast.error("This skill has already been added.");
      }
      
      return next;
    });
    setCustomSkillInput("");
  };

  const handleCustomSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCustomSkill();
    }
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const removeSkill = (skill: string) => {
    setSelectedSkills(prev => prev.filter(s => s !== skill));
  };

  const handleSave = async () => {
    if (!user) return;

    // Validations
    if (!form.full_name.trim()) { toast.error("Full name is required."); return; }
    if (!form.phone.trim()) { toast.error("Phone number is required."); return; }
    if (!form.current_location) { toast.error("Location is required."); return; }
    if (!form.residential_address.trim()) { toast.error("Residential address is required."); return; }
    
    const isQuickJobPoster = profile?.account_type === "quick_jobs";
    if (!isQuickJobPoster) {
      if (!form.highest_education) { toast.error("Highest education is required."); return; }
      if (industries.length === 0) { toast.error("Please select at least one industry of interest."); return; }
      if (selectedSkills.length === 0) { toast.error("Please select or add at least one skill."); return; }
    }
    
    if (form.graduation_year && (Number(form.graduation_year) < 1950 || Number(form.graduation_year) > 2100)) {
      toast.error("Please enter a valid graduation year between 1950 and 2100.");
      return;
    }
    if (form.years_experience && (Number(form.years_experience) < 0 || Number(form.years_experience) > 50)) {
      toast.error("Please enter a valid number of years of experience.");
      return;
    }

    setSaving(true);
    const payload: any = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      current_location: form.current_location,
      residential_address: form.residential_address.trim(),
      postal_address: form.postal_address.trim() || null,
      highest_education: isQuickJobPoster ? (form.highest_education || null) : form.highest_education,
      field_of_study: form.field_of_study || null,
      institution: form.institution.trim() || null,
      graduation_year: form.graduation_year ? Number(form.graduation_year) : null,
      years_experience: form.years_experience ? Number(form.years_experience) : null,
      current_job_title: form.current_job_title.trim() || null,
      career_summary: form.career_summary.trim() || null,
      skills: isQuickJobPoster ? (selectedSkills.length > 0 ? selectedSkills : null) : selectedSkills,
      preferred_industries: isQuickJobPoster ? (industries.length > 0 ? industries : null) : industries,
    };

    try {
      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", user.id);

      if (error) throw error;
      toast.success("Profile updated successfully!");
      setIsEditing(false);
      fetchProfile();
    } catch (e: any) {
      toast.error(e.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to loaded profile
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        phone: profile.phone ?? "",
        current_location: profile.current_location ?? "",
        residential_address: profile.residential_address ?? "",
        postal_address: profile.postal_address ?? "",
        highest_education: profile.highest_education ?? "",
        field_of_study: profile.field_of_study ?? "",
        institution: (profile as any).institution ?? "",
        graduation_year: (profile as any).graduation_year != null ? String((profile as any).graduation_year) : "",
        years_experience: profile.years_experience?.toString() ?? "",
        current_job_title: profile.current_job_title ?? "",
        career_summary: (profile as any).career_summary ?? "",
      });
      setIndustries(((profile as any).preferred_industries ?? []) as string[]);
      setSelectedSkills(profile.skills ?? []);
    }
    setIsEditing(false);
  };

  if (busy) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#0a0c10] text-[#e5e7eb] select-none">
        <div className="relative w-24 h-24 flex items-center justify-center p-2 animate-pulse-glow">
          <img
            src={mascot}
            alt="AI Assistant"
            className="w-full h-full object-contain animate-bob drop-shadow-[0_0_16px_rgba(130,200,80,0.5)]"
          />
          <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#82c850] to-transparent shadow-[0_0_8px_#82c850] animate-laser" />
        </div>
        <p className="mt-6 text-sm font-semibold tracking-wide text-white">Loading Profile Information...</p>
      </div>
    );
  }

  const isQuickJobPoster = profile?.account_type === "quick_jobs";
  const fieldsOfStudyOpts = fieldsForIndustries(industries);
  const suggestedSkills = getSuggestedSkills(form.field_of_study, industries);

  return (
    <div className="flex-1 flex flex-col bg-[#0a0c10] text-[#e5e7eb] overflow-y-auto">
      {/* Header */}
      <div className="p-5 flex items-center justify-between border-b border-white/5 bg-[#0f1218]/80 backdrop-blur sticky top-0 z-30 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (isEditing ? handleCancel() : navigate("/profile"))}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors text-muted-foreground hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-base font-bold text-white">
            {isEditing ? "Edit Profile" : "Personal Information"}
          </h1>
        </div>
        
        {!isEditing && (
          <Button
            size="sm"
            onClick={() => setIsEditing(true)}
            className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5 shadow-md shadow-primary/10"
          >
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </Button>
        )}
      </div>

      <div className="p-5 space-y-6 max-w-lg mx-auto w-full pb-10">
        {isEditing ? (
          /* ========================================================================= */
          /*                              EDIT MODE                                    */
          /* ========================================================================= */
          <div className="space-y-6 animate-fade-in">
            {/* Group 1: Personal Details */}
            <div className="bg-[#0f1218] border border-white/5 rounded-3xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-primary uppercase tracking-widest border-b border-white/5 pb-2">
                1. Personal Details
              </h3>
              
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">Full Name *</Label>
                <Input
                  value={form.full_name}
                  onChange={(e) => updateField("full_name", e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="h-11 rounded-xl bg-black/25 border-white/10 text-white placeholder:text-zinc-500 focus-visible:ring-primary focus-visible:ring-offset-0 focus:bg-black/40"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">Phone Number *</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="e.g. +267 71 234 567"
                  className="h-11 rounded-xl bg-black/25 border-white/10 text-white placeholder:text-zinc-500 focus-visible:ring-primary focus-visible:ring-offset-0 focus:bg-black/40"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">Current Location *</Label>
                <Select
                  value={form.current_location}
                  onValueChange={(val) => updateField("current_location", val)}
                >
                  <SelectTrigger className="h-11 rounded-xl bg-black/25 border-white/10 text-white focus:ring-primary">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0f1218] border-white/10 text-white max-h-72">
                    {LOCATIONS.map((loc) => (
                      <SelectItem key={loc} value={loc} className="hover:bg-white/5 cursor-pointer text-sm">
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">Residential Address *</Label>
                <Textarea
                  value={form.residential_address}
                  onChange={(e) => updateField("residential_address", e.target.value)}
                  placeholder="Plot 1234, Phase 2, Gaborone"
                  className="rounded-xl bg-black/25 border-white/10 text-white placeholder:text-zinc-500 focus-visible:ring-primary focus-visible:ring-offset-0 min-h-[80px] focus:bg-black/40"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">Postal Address (Optional)</Label>
                <Input
                  value={form.postal_address}
                  onChange={(e) => updateField("postal_address", e.target.value)}
                  placeholder="P.O. Box 1234, Gaborone"
                  className="h-11 rounded-xl bg-black/25 border-white/10 text-white placeholder:text-zinc-500 focus-visible:ring-primary focus-visible:ring-offset-0 focus:bg-black/40"
                />
              </div>
            </div>

            {/* Group 2: Education & Career */}
            {!isQuickJobPoster && (
            <div className="bg-[#0f1218] border border-white/5 rounded-3xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-primary uppercase tracking-widest border-b border-white/5 pb-2">
                2. Education & Career
              </h3>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">Highest Education *</Label>
                <Select
                  value={form.highest_education}
                  onValueChange={(val) => updateField("highest_education", val)}
                >
                  <SelectTrigger className="h-11 rounded-xl bg-black/25 border-white/10 text-white focus:ring-primary">
                    <SelectValue placeholder="Select qualification" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0f1218] border-white/10 text-white max-h-72">
                    {QUALIFICATIONS.map((qual) => (
                      <SelectItem key={qual} value={qual} className="hover:bg-white/5 cursor-pointer text-sm">
                        {qual}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">Institution (Optional)</Label>
                <Input
                  value={form.institution}
                  onChange={(e) => updateField("institution", e.target.value)}
                  placeholder="e.g. University of Botswana"
                  className="h-11 rounded-xl bg-black/25 border-white/10 text-white placeholder:text-zinc-500 focus-visible:ring-primary focus-visible:ring-offset-0 focus:bg-black/40"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">Graduation Year (Optional)</Label>
                <Input
                  type="number"
                  value={form.graduation_year}
                  onChange={(e) => updateField("graduation_year", e.target.value)}
                  placeholder="e.g. 2022"
                  className="h-11 rounded-xl bg-black/25 border-white/10 text-white placeholder:text-zinc-500 focus-visible:ring-primary focus-visible:ring-offset-0 focus:bg-black/40"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">Current / Most Recent Job Title (Optional)</Label>
                <Input
                  value={form.current_job_title}
                  onChange={(e) => updateField("current_job_title", e.target.value)}
                  placeholder="e.g. Accountant"
                  className="h-11 rounded-xl bg-black/25 border-white/10 text-white placeholder:text-zinc-500 focus-visible:ring-primary focus-visible:ring-offset-0 focus:bg-black/40"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">Years of Experience (Optional)</Label>
                <Input
                  type="number"
                  value={form.years_experience}
                  onChange={(e) => updateField("years_experience", e.target.value)}
                  placeholder="e.g. 3"
                  className="h-11 rounded-xl bg-black/25 border-white/10 text-white placeholder:text-zinc-500 focus-visible:ring-primary focus-visible:ring-offset-0 focus:bg-black/40"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">Career Summary (Optional)</Label>
                <Textarea
                  value={form.career_summary}
                  onChange={(e) => updateField("career_summary", e.target.value)}
                  placeholder="A brief overview of your background..."
                  className="rounded-xl bg-black/25 border-white/10 text-white placeholder:text-zinc-500 focus-visible:ring-primary focus-visible:ring-offset-0 min-h-[90px] focus:bg-black/40"
                />
              </div>
            </div>
            )}

            {/* Group 3: Interests & Skills */}
            {!isQuickJobPoster && (
            <div className="bg-[#0f1218] border border-white/5 rounded-3xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-primary uppercase tracking-widest border-b border-white/5 pb-2">
                3. Interests & Skills
              </h3>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase block pl-1">
                  Preferred Industries *
                </Label>
                <div className="flex flex-wrap gap-1.5 pt-1 max-h-48 overflow-y-auto pr-1">
                  {INDUSTRIES.map((ind) => {
                    const selected = industries.includes(ind);
                    return (
                      <button
                        key={ind}
                        type="button"
                        onClick={() => toggleIndustry(ind)}
                        className={`text-[10px] px-3 py-1.5 rounded-full border transition-all font-semibold ${
                          selected 
                            ? "bg-primary text-primary-foreground border-primary shadow-md scale-[1.02]" 
                            : "bg-black/25 border-white/10 text-zinc-300 hover:bg-white/5"
                        }`}
                      >
                        {ind}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <Label className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">Field of Study (Optional)</Label>
                <Select
                  value={form.field_of_study}
                  onValueChange={(val) => updateField("field_of_study", val)}
                >
                  <SelectTrigger className="h-11 rounded-xl bg-black/25 border-white/10 text-white focus:ring-primary">
                    <SelectValue placeholder="Select field of study" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0f1218] border-white/10 text-white max-h-72">
                    {fieldsOfStudyOpts.map((fld) => (
                      <SelectItem key={fld} value={fld} className="hover:bg-white/5 cursor-pointer text-sm">
                        {fld}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Skills selector */}
              <div className="space-y-3 pt-2">
                {/* Suggestions */}
                {suggestedSkills.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block pl-1">
                      Suggested Skills ({form.field_of_study || "General"})
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                      {suggestedSkills.map((sk) => {
                        const isSelected = selectedSkills.includes(sk);
                        return (
                          <button
                            key={sk}
                            type="button"
                            onClick={() => toggleSkill(sk)}
                            className={`text-[10px] px-2.5 py-1.5 rounded-full border transition-all font-semibold flex items-center gap-1 ${
                              isSelected 
                                ? "bg-primary text-primary-foreground border-primary shadow-sm scale-[1.02]" 
                                : "bg-black/25 border-white/10 text-zinc-300 hover:bg-white/5"
                            }`}
                          >
                            {sk}
                            {isSelected && <Check className="w-3 h-3" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Selected Skills */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block pl-1">
                    My Skills ({selectedSkills.length}) *
                  </span>
                  {selectedSkills.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1 p-2 rounded-xl border border-white/10 bg-black/10">
                      {selectedSkills.map((sk) => (
                        <span
                          key={sk}
                          className="text-[10px] px-2.5 py-1 rounded-full bg-zinc-800 text-white flex items-center gap-1.5 font-semibold border border-zinc-700 shadow-sm"
                        >
                          {sk}
                          <button
                            type="button"
                            onClick={() => removeSkill(sk)}
                            className="text-zinc-300 hover:text-white focus:outline-none transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-3 px-3 rounded-xl border border-dashed border-white/10 text-[11px] text-zinc-500 bg-white/5">
                      No skills added yet. Choose from suggestions or type a custom skill below.
                    </div>
                  )}
                </div>

                {/* Custom input */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block pl-1">
                    Add Other Skill
                  </span>
                  <div className="flex gap-2">
                    <Input
                      value={customSkillInput}
                      onChange={(e) => setCustomSkillInput(e.target.value)}
                      onKeyDown={handleCustomSkillKeyDown}
                      placeholder="e.g. QuickBooks, Figma"
                      className="h-10 rounded-xl bg-black/25 border-white/10 text-white placeholder:text-zinc-500 focus-visible:ring-primary focus-visible:ring-offset-0 focus:bg-black/40 flex-1 text-xs"
                    />
                    <Button
                      type="button"
                      onClick={handleAddCustomSkill}
                      className="h-10 w-10 p-0 rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground flex items-center justify-center shrink-0 shadow-lg shadow-primary/10"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Bottom Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={saving}
                className="flex-1 h-12 rounded-xl text-xs font-bold border-white/10 text-white hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 h-12 bg-primary hover:bg-primary/95 text-primary-foreground rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-primary/20"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Save Changes</>}
              </Button>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /*                            READ-ONLY MODE                                 */
          /* ========================================================================= */
          <div className="space-y-5 animate-fade-in text-left">
            {/* Card 1: Personal Details */}
            <div className="bg-[#0f1218] border border-white/5 rounded-3xl p-5 space-y-3.5 shadow-xl">
              <div className="flex items-center gap-2 text-primary border-b border-white/5 pb-2">
                <MapPin className="w-4 h-4" />
                <h2 className="text-xs font-bold uppercase tracking-widest">Personal Details</h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DetailRow label="Full Name" value={profile?.full_name} />
                <DetailRow label="Phone Number" value={profile?.phone} />
                <DetailRow label="Current Location" value={profile?.current_location} />
                <DetailRow label="Postal Address" value={profile?.postal_address} />
              </div>
              <div className="pt-2">
                <DetailRow label="Residential Address" value={profile?.residential_address} isFullWidth />
              </div>
            </div>

            {/* Card 2: Education & Career */}
            {!isQuickJobPoster && (
            <div className="bg-[#0f1218] border border-white/5 rounded-3xl p-5 space-y-3.5 shadow-xl">
              <div className="flex items-center gap-2 text-primary border-b border-white/5 pb-2">
                <GraduationCap className="w-4 h-4" />
                <h2 className="text-xs font-bold uppercase tracking-widest">Education & Career</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DetailRow label="Highest Qualification" value={profile?.highest_education} />
                <DetailRow label="Institution" value={profile?.institution} />
                <DetailRow label="Graduation Year" value={profile?.graduation_year} />
                <DetailRow label="Current Job Title" value={profile?.current_job_title} />
                <DetailRow label="Years of Experience" value={profile?.years_experience != null ? `${profile.years_experience} Years` : null} />
              </div>

              {profile?.career_summary && (
                <div className="pt-2">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase block tracking-wider mb-1">Career Summary</span>
                  <p className="text-xs text-zinc-300 leading-relaxed font-medium bg-black/10 p-3 rounded-xl border border-white/5">
                    {profile.career_summary}
                  </p>
                </div>
              )}
            </div>
            )}

            {/* Card 3: Skills & Interests */}
            {!isQuickJobPoster && (
            <div className="bg-[#0f1218] border border-white/5 rounded-3xl p-5 space-y-3.5 shadow-xl">
              <div className="flex items-center gap-2 text-primary border-b border-white/5 pb-2">
                <Wrench className="w-4 h-4" />
                <h2 className="text-xs font-bold uppercase tracking-widest">Interests & Skills</h2>
              </div>

              <DetailRow label="Field of Study" value={profile?.field_of_study} isFullWidth />

              {/* Industries */}
              <div className="pt-1.5">
                <span className="text-[9px] font-bold text-zinc-500 uppercase block tracking-wider mb-2">Preferred Industries</span>
                {profile?.preferred_industries && profile.preferred_industries.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {profile.preferred_industries.map((ind: string) => (
                      <span
                        key={ind}
                        className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 text-zinc-300 font-semibold border border-white/5"
                      >
                        {ind}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-zinc-500 italic">No industries selected.</span>
                )}
              </div>

              {/* Skills */}
              <div className="pt-2">
                <span className="text-[9px] font-bold text-zinc-500 uppercase block tracking-wider mb-2">Core Skills</span>
                {profile?.skills && profile.skills.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {profile.skills.map((sk: string) => (
                      <span
                        key={sk}
                        className="text-[10px] px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold shadow-sm"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-zinc-500 italic">No skills added.</span>
                )}
              </div>
            </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Sub-component for clean detail layout
const DetailRow = ({ label, value, isFullWidth = false }: { label: string; value: any; isFullWidth?: boolean }) => {
  return (
    <div className={isFullWidth ? "col-span-1 sm:col-span-2" : ""}>
      <span className="text-[9px] font-bold text-zinc-500 uppercase block tracking-wider mb-0.5">{label}</span>
      <span className="text-xs text-zinc-100 font-semibold truncate block">
        {value != null && String(value).trim() !== "" ? String(value) : "—"}
      </span>
    </div>
  );
};

export default ProfileDetails;
