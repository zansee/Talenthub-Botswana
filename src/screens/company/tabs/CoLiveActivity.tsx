import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Play, Pause, Bell, Eye, Users, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CoLiveActivityProps {
  companyId: string | null;
  userId: string;
  role: string;
}

interface ActivityEvent {
  id: string;
  type: "application" | "view";
  title: string;
  subtitle: string;
  time: string;
  timestamp: Date;
}

export const CoLiveActivity = ({ companyId, userId }: CoLiveActivityProps) => {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [loading, setLoading] = useState(true);
  
  // Reference for holding latest state of isLive inside listener callback
  const isLiveRef = useRef(isLive);
  useEffect(() => {
    isLiveRef.current = isLive;
  }, [isLive]);

  const loadPastActivity = async () => {
    try {
      setLoading(true);
      
      // 1. Get company jobs
      let jobsQuery = supabase.from("jobs").select("id, title");
      if (companyId) {
        jobsQuery = jobsQuery.eq("company_id", companyId);
      } else {
        jobsQuery = jobsQuery.eq("posted_by", userId);
      }
      const { data: jobs, error: jobsErr } = await jobsQuery;
      if (jobsErr) throw jobsErr;

      const jobIds = (jobs || []).map((j) => j.id);
      const jobsMap: Record<string, string> = {};
      (jobs || []).forEach((j) => {
        jobsMap[j.id] = j.title;
      });

      if (jobIds.length === 0) {
        setEvents([]);
        setLoading(false);
        return;
      }

      // 2. Fetch past 15 applications
      const { data: apps, error: appsErr } = await supabase
        .from("applications")
        .select("id, created_at, user_id, job_id")
        .in("job_id", jobIds)
        .order("created_at", { ascending: false })
        .limit(15);
      if (appsErr) throw appsErr;

      // 3. Fetch past 15 views
      const { data: views, error: viewsErr } = await supabase
        .from("job_views")
        .select("id, created_at, user_id, job_id")
        .in("job_id", jobIds)
        .order("created_at", { ascending: false })
        .limit(15);
      if (viewsErr) throw viewsErr;

      // Gather profile IDs to resolve names
      const candidateIds = new Set<string>();
      (apps || []).forEach((a) => candidateIds.add(a.user_id));
      (views || []).forEach((v) => candidateIds.add(v.user_id));

      let profilesMap: Record<string, string> = {};
      if (candidateIds.size > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", Array.from(candidateIds));
        if (profs) {
          profs.forEach((p) => {
            profilesMap[p.id] = p.full_name || "Someone";
          });
        }
      }

      // Format past events
      const pastEvents: ActivityEvent[] = [];

      (apps || []).forEach((app) => {
        const fullName = profilesMap[app.user_id] || "Someone";

        pastEvents.push({
          id: app.id,
          type: "application",
          title: "New application received",
          subtitle: `${fullName} applied to ${jobsMap[app.job_id] || "Job Post"}`,
          timestamp: new Date(app.created_at),
          time: formatTimeAgo(new Date(app.created_at)),
        });
      });

      (views || []).forEach((view) => {
        // Job view might not have logged-in candidate ID if anonymous
        const fullName = profilesMap[view.user_id] || "A candidate";
        const displayName = view.user_id ? fullName : "A candidate";

        pastEvents.push({
          id: view.id,
          type: "view",
          title: "Job listing viewed",
          subtitle: `${displayName} viewed ${jobsMap[view.job_id] || "Job Post"}`,
          timestamp: new Date(view.created_at),
          time: formatTimeAgo(new Date(view.created_at)),
        });
      });

      // Sort by timestamp descending
      pastEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      setEvents(pastEvents.slice(0, 30));

    } catch (err: any) {
      console.error("Error loading activity feed:", err.message);
      toast.error("Failed to load activity feed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPastActivity();
  }, [companyId, userId]);

  useEffect(() => {
    if (!companyId) return;

    // Supabase Realtime channel subscription
    const channel = supabase
      .channel("employer-live-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "applications" },
        async (payload) => {
          if (!isLiveRef.current) return;
          
          // Verify if it belongs to our company's job
          const { data: job } = await supabase
            .from("jobs")
            .select("title, company_id")
            .eq("id", payload.new.job_id)
            .maybeSingle();

          if (job && job.company_id === companyId) {
            // Get profiles name
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", payload.new.user_id)
              .maybeSingle();

            const fullName = profile?.full_name || "Someone";

            const newEvent: ActivityEvent = {
              id: payload.new.id,
              type: "application",
              title: "New application received",
              subtitle: `${fullName} applied to ${job.title}`,
              timestamp: new Date(payload.new.created_at),
              time: "Just now",
            };

            setEvents((prev) => [newEvent, ...prev].slice(0, 50));
            toast.success(`New application! ${newEvent.subtitle}`);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "job_views" },
        async (payload) => {
          if (!isLiveRef.current) return;

          // Verify if it belongs to our company's job
          const { data: job } = await supabase
            .from("jobs")
            .select("title, company_id")
            .eq("id", payload.new.job_id)
            .maybeSingle();

          if (job && job.company_id === companyId) {
            let displayName = "A candidate";
            
            if (payload.new.user_id) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", payload.new.user_id)
                .maybeSingle();
              if (profile?.full_name) {
                displayName = profile.full_name;
              }
            }

            const newEvent: ActivityEvent = {
              id: payload.new.id,
              type: "view",
              title: "Job listing viewed",
              subtitle: `${displayName} viewed ${job.title}`,
              timestamp: new Date(payload.new.created_at),
              time: "Just now",
            };

            setEvents((prev) => [newEvent, ...prev].slice(0, 50));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  // Periodic relative time update
  useEffect(() => {
    const timer = setInterval(() => {
      setEvents((prev) =>
        prev.map((e) => ({
          ...e,
          time: formatTimeAgo(e.timestamp),
        }))
      );
    }, 30000); // every 30 seconds

    return () => clearInterval(timer);
  }, []);

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            Live Activity
            <span className="flex h-3 w-3 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isLive ? 'bg-green-400' : 'bg-orange-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isLive ? 'bg-green-500' : 'bg-orange-500'}`}></span>
            </span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Realtime monitoring of candidates viewing and applying to job posts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setIsLive(!isLive)}
            variant="outline"
            className={`border-white/10 h-10 rounded-xl flex items-center gap-2 ${
              isLive ? "text-green-400 hover:text-green-300" : "text-orange-400 hover:text-orange-300"
            }`}
          >
            {isLive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isLive ? "Live Streaming" : "Streaming Paused"}
          </Button>
          <Button
            onClick={loadPastActivity}
            variant="ghost"
            className="w-10 h-10 rounded-xl hover:bg-white/5 border border-white/5 flex items-center justify-center text-muted-foreground hover:text-white"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Events scrolling feed */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-white/5 rounded-xl" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="p-12 text-center bg-[#0d1117] border border-white/5 rounded-2xl text-muted-foreground shadow-xl">
          <Activity className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-1">No Activity Yet</h3>
          <p className="text-sm text-muted-foreground">Activities will stream here automatically when candidates view or apply.</p>
        </div>
      ) : (
        <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-6 shadow-xl space-y-4 max-h-[600px] overflow-y-auto">
          <div className="space-y-4">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex gap-4 items-start p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all animate-in slide-in-from-top-4 duration-300"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  event.type === "application" ? "bg-green-500/10 text-green-400" : "bg-blue-500/10 text-blue-400"
                }`}>
                  {event.type === "application" ? <Users className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white leading-snug">{event.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{event.subtitle}</p>
                </div>
                <div className="text-[10px] text-muted-foreground/60 shrink-0 font-medium self-center">
                  {event.time}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
