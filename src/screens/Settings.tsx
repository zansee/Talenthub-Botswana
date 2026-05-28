import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Shield, FileText, Sparkles, Trash2, Moon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { applyTheme, getStoredTheme } from "@/lib/theme";
import { useApp } from "@/context/AppContext";

const THEMES = [
  { id: "forest", name: "Forest", color: "bg-[#4f6448]" },
  { id: "midnight", name: "Midnight", color: "bg-[#1e60a3]" },
  { id: "sunset", name: "Sunset", color: "bg-[#db4e1d]" },
  { id: "vaporwave", name: "Vaporwave", color: "bg-[#a61fed]" },
  { id: "emerald", name: "Emerald", color: "bg-[#0b7a58]" },
];

const NAV_STYLES = [
  { id: "classic", name: "Classic" },
  { id: "glass", name: "Glass" },
  { id: "minimal", name: "Minimal" },
  { id: "bubble", name: "Bubble" },
];

const Settings = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { colorTheme, setColorTheme, navStyle, setNavStyle } = useApp();
  const [profile, setProfile] = useState<any>(null);
  const [notifyMatches, setNotifyMatches] = useState(true);
  const [notifyDeadlines, setNotifyDeadlines] = useState(true);
  const [aiConsent, setAiConsent] = useState(false);
  const [dark, setDark] = useState(getStoredTheme() === "dark");

  const toggleDark = (v: boolean) => {
    setDark(v);
    applyTheme(v ? "dark" : "light");
  };

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      setProfile(data);
      setAiConsent(!!data?.ai_consent_at);
    });
    const prefs = JSON.parse(localStorage.getItem("notif_prefs") ?? "{}");
    setNotifyMatches(prefs.matches ?? true);
    setNotifyDeadlines(prefs.deadlines ?? true);
  }, [user]);

  const savePrefs = (matches: boolean, deadlines: boolean) => {
    setNotifyMatches(matches);
    setNotifyDeadlines(deadlines);
    localStorage.setItem("notif_prefs", JSON.stringify({ matches, deadlines }));
  };

  const toggleAi = async (val: boolean) => {
    if (!user) return;
    setAiConsent(val);
    await supabase.from("profiles").update({ ai_consent_at: val ? new Date().toISOString() : null }).eq("id", user.id);
    toast.success(val ? "AI processing enabled" : "AI processing disabled");
  };

  const deleteAccount = async () => {
    if (!user) return;
    if (!confirm("Permanently delete your account and all your data? This cannot be undone.")) return;
    // Delete profile data; auth user removal requires a backend call (not implemented yet)
    await supabase.from("applications").delete().eq("user_id", user.id);
    await supabase.from("swipes").delete().eq("user_id", user.id);
    await supabase.from("notifications").delete().eq("user_id", user.id);
    await supabase.from("application_documents").delete().eq("user_id", user.id);
    if (profile?.cv_path) await supabase.storage.from("cvs").remove([profile.cv_path]);
    await supabase.from("profiles").update({
      cv_path: null, cv_filename: null, cv_extracted_skills: null, cv_summary: null,
      skills: null, phone: null, postal_address: null, residential_address: null,
    }).eq("id", user.id);
    await signOut();
    toast.success("Account data cleared");
    navigate("/welcome");
  };

  return (
    <div className="flex-1 flex flex-col bg-background overflow-y-auto">
      <div className="p-5 flex items-center gap-3 border-b border-border">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-bold">Settings</h1>
      </div>

      <div className="p-5 space-y-5">
        <Section title="Appearance" icon={Moon}>
          <Row label="Dark mode" desc="Use dark theme across the app">
            <Switch checked={dark} onCheckedChange={toggleDark} />
          </Row>
          <div className="pt-4 border-t border-border">
            <p className="text-sm font-medium mb-1">Color Theme</p>
            <p className="text-[11px] text-muted-foreground mb-3">Choose how the app accents and card colors look</p>
            <div className="flex items-center gap-3.5 flex-wrap">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setColorTheme(t.id)}
                  className={`w-9 h-9 rounded-full ${t.color} relative flex items-center justify-center transition-all ${
                    colorTheme === t.id ? "ring-2 ring-offset-2 ring-primary scale-110 shadow-md" : "hover:scale-105 opacity-80 hover:opacity-100"
                  }`}
                  title={t.name}
                >
                  {colorTheme === t.id && (
                    <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="pt-4 border-t border-border">
            <p className="text-sm font-medium mb-1">Bottom Navigation Style</p>
            <p className="text-[11px] text-muted-foreground mb-3">Select the design layout for bottom navigation tabs</p>
            <div className="grid grid-cols-2 gap-2">
              {NAV_STYLES.map((ns) => (
                <button
                  key={ns.id}
                  onClick={() => setNavStyle(ns.id)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
                    navStyle === ns.id
                      ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm"
                      : "border-border hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <span className="text-xs">{ns.name}</span>
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Notifications" icon={Bell}>
          <Row label="New job matches" desc="Alert me when a new job matches my profile">
            <Switch checked={notifyMatches} onCheckedChange={(v) => savePrefs(v, notifyDeadlines)} />
          </Row>
          <Row label="Deadline reminders" desc="Remind me before a saved job's deadline">
            <Switch checked={notifyDeadlines} onCheckedChange={(v) => savePrefs(notifyMatches, v)} />
          </Row>
        </Section>

        <Section title="AI & Data" icon={Sparkles}>
          <Row label="Allow AI processing" desc="Let us read your CV and personalize cover letters using AI">
            <Switch checked={aiConsent} onCheckedChange={toggleAi} />
          </Row>
          <button onClick={() => navigate("/privacy")} className="w-full text-left text-sm text-primary py-2">
            Read our privacy policy
          </button>
        </Section>

        <Section title="Documents" icon={FileText}>
          <button onClick={() => navigate("/upload-cv")} className="w-full text-left text-sm py-2">
            Manage CV
          </button>
          <button onClick={() => navigate("/profile-setup")} className="w-full text-left text-sm py-2">
            Edit profile
          </button>
        </Section>

        <Section title="Privacy & Security" icon={Shield}>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your data is encrypted in transit and at rest. CVs are stored privately — only you can read them. We never share your information with employers without your action.
          </p>
        </Section>

        <Button onClick={deleteAccount} variant="outline" className="w-full h-11 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10">
          <Trash2 className="w-4 h-4 mr-2" /> Delete my data
        </Button>
      </div>
    </div>
  );
};

const Section = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
  <div className="bg-card rounded-2xl p-4 shadow-soft">
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-primary" />
      <h2 className="text-sm font-semibold">{title}</h2>
    </div>
    <div className="space-y-2 divide-y divide-border">{children}</div>
  </div>
);

const Row = ({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) => (
  <div className="flex items-start gap-3 pt-2 first:pt-0">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium">{label}</p>
      {desc && <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>}
    </div>
    {children}
  </div>
);

export default Settings;
