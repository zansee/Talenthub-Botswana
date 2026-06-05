import { Navigate, useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { Briefcase, ChevronRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { listContainerVariants, listItemVariants } from "@/lib/animations";

const Applications = () => {
  const { jobs, swipes, applications } = useApp();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  if (isAdmin) return <Navigate to="/admin" replace />;

  const likedIds = new Set(swipes.filter((s) => s.action === "like").map((s) => s.job_id));
  const liked = jobs.filter((j) => likedIds.has(j.id));
  
  // Submitted is any application where status is not draft
  const submittedApps = applications.filter((a) => a.status && a.status !== "draft");
  const submittedJobIds = new Set(submittedApps.map((a) => a.job_id));

  const submitted = liked.filter((j) => submittedJobIds.has(j.id));
  const pending = liked.filter((j) => !submittedJobIds.has(j.id));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "submitted":
        return <span className="text-[10px] bg-success/15 text-success px-2 py-1 rounded-full font-semibold">Applied</span>;
      case "reviewing":
        return <span className="text-[10px] bg-blue-500/15 text-blue-400 px-2 py-1 rounded-full font-semibold">Reviewed</span>;
      case "shortlisted":
        return <span className="text-[10px] bg-purple-500/15 text-purple-400 px-2 py-1 rounded-full font-semibold">Shortlisted</span>;
      case "assessment_sent":
        return <span className="text-[10px] bg-orange-500/15 text-orange-400 px-2 py-1 rounded-full font-semibold">Assessment Sent</span>;
      case "interview":
        return <span className="text-[10px] bg-teal-500/15 text-teal-400 px-2 py-1 rounded-full font-semibold">Interviewing</span>;
      case "offer":
      case "hired":
        return <span className="text-[10px] bg-green-500/15 text-green-400 px-2 py-1 rounded-full font-semibold">Offer Received</span>;
      case "declined":
      case "rejected":
        return <span className="text-[10px] bg-red-500/15 text-red-400 px-2 py-1 rounded-full font-semibold">Declined</span>;
      default:
        return <span className="text-[10px] bg-zinc-500/15 text-zinc-400 px-2 py-1 rounded-full font-semibold">Submitted</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col p-5">
      <h1 className="text-2xl font-bold">Applications</h1>

      {pending.length > 0 && (
        <div className="mt-4 bg-warning/10 border border-warning/30 rounded-2xl p-3 flex items-start gap-3">
          <span className="text-xl">📬</span>
          <div className="text-xs">
            <p className="font-semibold text-foreground">{pending.length} application{pending.length > 1 ? "s" : ""} not yet completed</p>
            <p className="text-muted-foreground">Review and send them before it's too late.</p>
          </div>
        </div>
      )}

      {/* Assessment Invitations Notification Box */}
      {submittedApps.some(a => a.status === "assessment_sent") && (
        <div className="mt-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <span className="text-xl">📝</span>
            <div className="text-xs">
              <p className="font-semibold text-orange-400 text-sm">Assessments Available</p>
              <p className="text-muted-foreground mt-0.5">A company has requested you to complete an assessment. Tap below to start.</p>
            </div>
          </div>
        </div>
      )}

      <section className="mt-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">In Progress</p>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">All caught up.</p>
        ) : (
          <motion.div
            className="space-y-2"
            variants={listContainerVariants}
            initial="hidden"
            animate="visible"
          >
            {pending.map((j) => (
              <motion.div key={j.id} variants={listItemVariants}>
                <button onClick={() => navigate(`/review/${j.id}`)} className="w-full bg-card rounded-2xl p-3 flex items-center gap-3 shadow-soft text-left">
                  <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center"><Briefcase className="w-4 h-4 text-warning" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{j.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{j.company}</p>
                  </div>
                  <span className="text-[10px] bg-warning/15 text-warning px-2 py-1 rounded-full font-semibold">In Progress</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      <section className="mt-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">Submitted</p>
        {submitted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">None yet.</p>
        ) : (
          <motion.div
            className="space-y-2"
            variants={listContainerVariants}
            initial="hidden"
            animate="visible"
          >
            {submitted.map((j) => {
              const app = submittedApps.find(a => a.job_id === j.id);
              const status = app?.status || "submitted";
              return (
                <motion.div key={j.id} variants={listItemVariants}>
                  <div className="bg-card rounded-2xl p-3 flex flex-col gap-3 shadow-soft">
                    <div className="flex items-center gap-3 w-full">
                      <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center"><Briefcase className="w-4 h-4 text-success" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{j.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{j.company}</p>
                      </div>
                      {getStatusBadge(status)}
                    </div>
                    
                    {/* Start Assessment button link */}
                    {status === "assessment_sent" && (
                      <Button
                        onClick={() => navigate(`/candidate-assessment/${j.id}`)}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs h-9 flex items-center justify-center gap-1.5 font-bold"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" /> Start Assessment
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </section>
    </div>
  );
};

export default Applications;
