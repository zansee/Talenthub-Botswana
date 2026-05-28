import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, Download, Loader2, Video, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const DeliveredDocs = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [revamps, setRevamps] = useState<any[]>([]);
  const [preps, setPreps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [r, p] = await Promise.all([
        supabase.from("revamp_requests").select("*").eq("user_id", user.id).eq("fulfilment_status", "delivered"),
        supabase.from("interview_preps").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      ]);
      setRevamps(r.data ?? []);
      setPreps(p.data ?? []);
      setLoading(false);
    })();
  }, [user]);

  const downloadFile = async (path: string, bucket: string = "cvs") => {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
    if (error || !data) {
      toast.error("Could not download file");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const generateICS = (session: any) => {
    const title = `Interview Prep: ${session.target_role || "Coaching Session"}`;
    const description = `Your interview preparation session. Meeting Link: ${session.meeting_link || "Pending link"}`;
    
    // Start date from session_scheduled_at
    const startDate = new Date(session.session_scheduled_at);
    // End date default to 1 hour after start
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    
    const formatICSDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    };
    
    const icsLines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Talenthub//NONSGML Event//EN",
      "BEGIN:VEVENT",
      `UID:${session.id}@talenthub.com`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(startDate)}`,
      `DTEND:${formatICSDate(endDate)}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${description}`,
      session.meeting_link ? `LOCATION:${session.meeting_link}` : "",
      "END:VEVENT",
      "END:VCALENDAR"
    ].filter(Boolean);
    
    return icsLines.join("\r\n");
  };

  const handleAddToCalendar = (session: any) => {
    if (!session.session_scheduled_at) return;
    try {
      const icsData = generateICS(session);
      const blob = new Blob([icsData], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `interview_prep_${session.id.substring(0,4)}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Calendar file (.ics) downloaded! Open it to add it to your calendar.");
    } catch (e: any) {
      console.error(e);
      toast.error("Could not generate calendar file.");
    }
  };

  const deliveredPreps = preps.filter(p => p.status === "delivered");
  const upcomingPreps = preps.filter(p => p.type !== "script" && (p.status === "scheduled" || p.status === "in_progress"));
  const pendingPreps = preps.filter(p => 
    p.status !== "delivered" && 
    (p.type === "script" || p.status === "new" || p.status === "pending")
  );

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden">
      <div className="p-6 pb-3 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-xl font-bold">My Coaching & Services</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (revamps.length === 0 && preps.length === 0) ? (
          <div className="text-center py-12 text-muted-foreground text-sm bg-card rounded-2xl border border-border">
            You don't have any coaching sessions or services yet.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Upcoming Coaching Sessions Section */}
            {upcomingPreps.length > 0 && (
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Upcoming Coaching Sessions</h2>
                <div className="space-y-3">
                  {upcomingPreps.map(p => (
                    <div key={p.id} className="bg-card rounded-2xl p-4 border border-border">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-semibold text-white">{p.target_role || "Interview Prep Session"}</p>
                          <div className="mt-2 text-xs text-muted-foreground space-y-1">
                            {p.session_scheduled_at ? (
                              <p className="flex items-center gap-1.5 text-foreground font-semibold">
                                <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                                {new Date(p.session_scheduled_at).toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })}
                              </p>
                            ) : (
                              <p>Date & Time: Pending confirmation</p>
                            )}
                          </div>
                        </div>
                        <Video className="w-5 h-5 text-primary shrink-0" />
                      </div>
                      <div className="mt-4 flex gap-2">
                        {p.meeting_link ? (
                          <Button size="sm" className="flex-1 text-xs h-9 bg-forest hover:bg-forest/90 text-white font-bold" onClick={() => window.open(p.meeting_link, "_blank")}>
                            <Video className="w-3.5 h-3.5 mr-1.5" /> Join Call
                          </Button>
                        ) : (
                          <Button size="sm" disabled className="flex-1 text-xs h-9 opacity-50 text-white font-bold">
                            Link Pending
                          </Button>
                        )}
                        {p.session_scheduled_at && (
                          <Button size="sm" variant="outline" className="flex-1 text-xs h-9 font-bold" onClick={() => handleAddToCalendar(p)}>
                            <Calendar className="w-3.5 h-3.5 mr-1.5" /> Add to Calendar
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Services Section */}
            {pendingPreps.length > 0 && (
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Pending Services & Scheduling</h2>
                <div className="space-y-3">
                  {pendingPreps.map(p => (
                    <div key={p.id} className="bg-card rounded-2xl p-4 border border-border opacity-85">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-semibold text-white/80">{p.target_role || "Interview Prep Request"}</p>
                          <p className="text-xs text-muted-foreground mt-1">Requested prep type: <span className="capitalize text-foreground font-semibold">{p.type}</span></p>
                          {p.type === "script" ? (
                            <p className="text-xs text-warning mt-1 font-medium">Preparing your custom Q&A script. Our hiring experts are working on it.</p>
                          ) : (
                            <p className="text-xs text-warning mt-1 font-medium">Coaches are currently scheduling this session. Check back shortly!</p>
                          )}
                        </div>
                        <Loader2 className="w-4 h-4 text-warning animate-spin shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completed CV Revamps */}
            {revamps.length > 0 && (
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">CV Revamps</h2>
                <div className="space-y-3">
                  {revamps.map(r => (
                    <div key={r.id} className="bg-card rounded-2xl p-4 border border-border">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-semibold">{r.target_job_title || "Target Role"}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Delivered on {new Date(r.delivered_at || r.updated_at).toLocaleDateString()}</p>
                        </div>
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="mt-4 flex gap-2">
                        {r.revamped_cv_path && (
                          <Button size="sm" variant="outline" className="w-full text-xs h-9" onClick={() => downloadFile(r.revamped_cv_path, "cvs")}>
                            <Download className="w-3.5 h-3.5 mr-1.5" /> Download CV
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completed Prep & Scripts */}
            {deliveredPreps.length > 0 && (
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Completed Services</h2>
                <div className="space-y-3">
                  {deliveredPreps.map(p => (
                    <div key={p.id} className="bg-card rounded-2xl p-4 border border-border">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-semibold">{p.target_role || "Interview Prep"}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Delivered on {new Date(p.delivered_at || p.updated_at).toLocaleDateString()}</p>
                          <span className="inline-block mt-2 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-secondary text-foreground">{p.type}</span>
                        </div>
                        <Video className="w-5 h-5 text-primary" />
                      </div>
                      <div className="mt-4 flex flex-col gap-2">
                        {p.script_path && (
                          <Button size="sm" variant="outline" className="w-full text-xs h-9" onClick={() => downloadFile(p.script_path, "app-docs")}>
                            <Download className="w-3.5 h-3.5 mr-1.5" /> Download Script
                          </Button>
                        )}
                        {p.type === "coaching" && p.meeting_link && (
                          <Button size="sm" className="w-full text-xs h-9 bg-forest hover:bg-forest/90 text-white" onClick={() => window.open(p.meeting_link, "_blank")}>
                            <Video className="w-3.5 h-3.5 mr-1.5" /> Join Coaching Call
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliveredDocs;
