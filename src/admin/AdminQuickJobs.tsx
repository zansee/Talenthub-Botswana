import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, X, ToggleLeft, ToggleRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const AdminQuickJobs = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [enabled, setEnabled] = useState(false);

  const refresh = async () => {
    const [{ data: rows }, { data: flag }] = await Promise.all([
      supabase.from("quick_jobs" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("feature_flags").select("enabled").eq("key", "quick_jobs").maybeSingle(),
    ]);
    setPosts((rows as any[]) ?? []);
    setEnabled(Boolean((flag as any)?.enabled));
  };

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) { navigate("/profile"); return; }
    refresh();
  }, [isAdmin, loading, navigate]);

  const setStatus = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("quick_jobs" as any).update({
      status, is_active: status === "approved",
    } as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "approved" ? "Approved" : "Rejected");
    refresh();
  };

  const toggleFlag = async () => {
    const { error } = await supabase.from("feature_flags").upsert({ key: "quick_jobs", enabled: !enabled });
    if (error) { toast.error(error.message); return; }
    setEnabled(!enabled);
  };

  return (
    <div className="flex-1 flex flex-col bg-background overflow-y-auto">
      <div className="p-5 flex items-center gap-3 border-b border-border">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-bold flex-1">Admin: Quick Jobs</h1>
        <button onClick={toggleFlag} className="flex items-center gap-1 text-xs font-semibold">
          {enabled ? <ToggleRight className="w-6 h-6 text-success" /> : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
          {enabled ? "Live" : "Locked"}
        </button>
      </div>

      <div className="p-5 space-y-3">
        {posts.length === 0 && <p className="text-sm text-muted-foreground">No quick jobs yet.</p>}
        {posts.map((p) => (
          <div key={p.id} className="bg-card rounded-2xl p-4 shadow-soft space-y-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-sm">{p.title}</p>
                <p className="text-[11px] text-muted-foreground">{p.category} · {p.location}</p>
              </div>
              <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-bold ${
                p.status === "approved" ? "bg-success/15 text-success" :
                p.status === "rejected" ? "bg-destructive/15 text-destructive" :
                p.status === "closed" ? "bg-zinc-500/15 text-zinc-400" :
                "bg-warning/15 text-warning"
              }`}>{p.status}</span>
            </div>
            <div className="pt-2 pb-2">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Job Description</span>
              <p className="text-xs text-zinc-300 leading-relaxed bg-black/10 p-3 rounded-xl border border-white/5 whitespace-pre-wrap">{p.description}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-white/5 mt-2 bg-white/[0.01] p-3 rounded-xl border border-white/5">
              <div><span className="font-semibold text-muted-foreground">Compensation:</span> BWP {p.pay_amount} ({p.pay_type})</div>
              <div><span className="font-semibold text-muted-foreground">Duration:</span> {p.duration}</div>
              <div><span className="font-semibold text-muted-foreground">Date Needed:</span> {p.date_needed}</div>
              <div><span className="font-semibold text-muted-foreground">Preferred Gender:</span> {p.preferred_gender || "Any"}</div>
              <div><span className="font-semibold text-muted-foreground">Category:</span> {p.category}</div>
              <div><span className="font-semibold text-muted-foreground">Location:</span> {p.location}</div>
              <div className="col-span-2"><span className="font-semibold text-muted-foreground">Poster Name:</span> {p.poster_name ?? "user"}</div>
              <div className="col-span-2"><span className="font-semibold text-muted-foreground">Contact Phone:</span> {p.contact_number}</div>
            </div>
            {p.status === "closed" && (
              <div className="mt-2 text-xs bg-zinc-500/5 border border-zinc-500/10 p-3 rounded-xl space-y-1 mt-2">
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Gig Closure Information</span>
                <div><span className="font-semibold text-zinc-500">Closure Reason:</span> {
                  p.close_reason === 'hired_on_platform' ? 'Hired on Talenthub' :
                  p.close_reason === 'hired_off_platform' ? 'Hired outside Talenthub' :
                  p.close_reason === 'cancelled' ? 'Cancelled / No longer needed' : 'Other'
                }</div>
                {p.hired_user_name && <div><span className="font-semibold text-zinc-500">Hired Candidate:</span> {p.hired_user_name}</div>}
                {p.close_text && <div><span className="font-semibold text-zinc-500">Explanation:</span> "{p.close_text}"</div>}
                {p.closed_at && <div className="text-[10px] text-zinc-600 mt-1">Closed on {new Date(p.closed_at).toLocaleString("en-GB")}</div>}
              </div>
            )}
            {p.status === "pending" && (
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => setStatus(p.id, "approved")} className="flex-1 h-9 bg-success hover:bg-success/90 rounded-xl text-xs">
                  <Check className="w-3.5 h-3.5 mr-1" /> Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => setStatus(p.id, "rejected")} className="flex-1 h-9 rounded-xl text-xs">
                  <X className="w-3.5 h-3.5 mr-1" /> Reject
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminQuickJobs;
