import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Send, AlertCircle, RefreshCw, CheckCircle, Undo, Info, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import mascot from "@/assets/mascot-transparent.png";

interface CompanyAIAgentProps {
  companyName: string;
  companyId: string | null;
  userId: string;
  activeTab: string; // Dashboard, Jobs, Applications, etc.
  onTabChange?: (tab: string) => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: {
    type: string;
    details: any;
    description: string;
  } | null;
  isProactive?: boolean;
}

const mapStageToStatus = (stage: string): any => {
  const s = stage.toLowerCase().trim();
  if (s === "applied" || s === "submitted") return "submitted";
  if (s === "reviewed" || s === "reviewing") return "reviewing";
  if (s === "rejected" || s === "declined") return "declined";
  if (s === "interview" || s === "interviewing") return "interview";
  if (s === "offer" || s === "hired") return "offer";
  return s.replace(" ", "_");
};

export default function CompanyAIAgent({
  companyName,
  companyId,
  userId,
  activeTab,
  onTabChange,
}: CompanyAIAgentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(`teemane_chat_${userId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);

  // Persist chat messages to localStorage
  useEffect(() => {
    localStorage.setItem(`teemane_chat_${userId}`, JSON.stringify(messages));
  }, [messages, userId]);

  // Undo States
  const [undoAction, setUndoAction] = useState<any | null>(null);
  const [undoTimeLeft, setUndoTimeLeft] = useState(0);
  const undoTimerRef = useRef<any>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Proactive suggestions trigger
  useEffect(() => {
    if (!isOpen) return;

    let proactiveMsg: ChatMessage | null = null;

    if (activeTab === "Jobs") {
      proactiveMsg = {
        id: "proactive-jobs",
        role: "assistant",
        content: `Hi! I see you are managing job listings. I can help you draft descriptions, suggest keywords, or automatically generate pre-screening questions for any new role you'd like to post. Just ask me!`,
        isProactive: true,
      };
    } else if (activeTab === "Applications") {
      proactiveMsg = {
        id: "proactive-apps",
        role: "assistant",
        content: `Hello! You're viewing candidate applications. Would you like me to summarize the top performers based on their assessment scores, draft rejection letters, or move candidates along the pipeline?`,
        isProactive: true,
      };
    }

    if (proactiveMsg && !messages.some((m) => m.id === proactiveMsg!.id)) {
      setMessages((prev) => [...prev, proactiveMsg!]);
    }
  }, [activeTab, isOpen]);

  // Proactive check for 14-day job with low applicants
  useEffect(() => {
    async function checkAgingJobs() {
      if (!companyId || !isOpen) return;
      try {
        const { data: openJobs } = await supabase
          .from("jobs")
          .select("id, title, created_at, applications(id)")
          .eq("company_id", companyId)
          .eq("is_active", true);

        if (!openJobs) return;

        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const staleJob = openJobs.find((j) => {
          const createdDate = new Date(j.created_at);
          const appCount = j.applications?.length || 0;
          return createdDate < fourteenDaysAgo && appCount < 5;
        });

        if (staleJob) {
          const staleMsgId = `stale-job-${staleJob.id}`;
          if (!messages.some((m) => m.id === staleMsgId)) {
            setMessages((prev) => [
              ...prev,
              {
                id: staleMsgId,
                role: "assistant",
                content: `🚨 **Job Alert**: Your listing for **"${staleJob.title}"** has been open for 14 days with few applications. I recommend rewriting the description to include remote flexibility options or adding some basic pre-screening questions to clarify requirements. Shall I suggest improvements?`,
                isProactive: true,
              },
            ]);
          }
        }
      } catch (err) {
        console.error("Stale jobs check failed:", err);
      }
    }
    checkAgingJobs();
  }, [companyId, isOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Undo countdown timer
  useEffect(() => {
    if (undoTimeLeft > 0) {
      undoTimerRef.current = setTimeout(() => {
        setUndoTimeLeft((t) => t - 1);
      }, 1000);
    } else if (undoTimeLeft === 0 && undoAction) {
      // Clear undo once expired
      setUndoAction(null);
      toast.success("Action finalized!");
    }
    return () => clearTimeout(undoTimerRef.current);
  }, [undoTimeLeft, undoAction]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || loading) return;

    const userMsgText = inputValue.trim();
    setInputValue("");

    const newMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: userMsgText,
    };
    setMessages((prev) => [...prev, newMsg]);
    setLoading(true);

    try {
      // Gather context
      const { data: openJobs } = await supabase
        .from("jobs")
        .select("id, title")
        .eq("company_id", companyId || "");

      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Gather candidate list context for the AI
      let candidatesList: any[] = [];
      const jobIds = (openJobs || []).map((j) => j.id);
      if (jobIds.length > 0) {
        const [appsRes, extRes] = await Promise.all([
          supabase
            .from("applications")
            .select("id, status, job_id, user_id")
            .in("job_id", jobIds),
          supabase
            .from("external_applications")
            .select("id, status, job_id, full_name")
            .in("job_id", jobIds)
        ]);

        const apps = appsRes.data || [];
        const exts = extRes.data || [];

        // Fetch profiles separately
        const userIds = apps.map((a: any) => a.user_id).filter(Boolean);
        let profilesMap: Record<string, string> = {};
        if (userIds.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds);
          if (profs) {
            profs.forEach((p) => {
              profilesMap[p.id] = p.full_name || "Unknown Candidate";
            });
          }
        }

        apps.forEach((a: any) => {
          candidatesList.push({
            id: a.id,
            name: profilesMap[a.user_id] || "Unknown Candidate",
            isExternal: false,
            stage: a.status,
            jobTitle: openJobs?.find((j) => j.id === a.job_id)?.title || ""
          });
        });

        exts.forEach((a: any) => {
          candidatesList.push({
            id: a.id,
            name: a.full_name,
            isExternal: true,
            stage: a.status,
            jobTitle: openJobs?.find((j) => j.id === a.job_id)?.title || ""
          });
        });
      }

      const { data, error } = await supabase.functions.invoke("ai-agent", {
        body: {
          action: "chat",
          prompt: userMsgText,
          history: historyPayload,
          context: {
            companyName: companyName,
            jobs: openJobs || [],
            candidates: candidatesList,
            activeTab: activeTab,
          },
        },
      });

      if (error) throw error;

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.response || "I didn't receive a response. Try again.",
          action: data.action || null,
        },
      ]);
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.message || String(err);
      const hint = errMsg.includes("404") || errMsg.includes("Function not found")
        ? "\n\n💡 *Hint: The 'ai-agent' Edge Function might not be deployed yet. Run `supabase functions deploy ai-agent` to deploy it to your project.*"
        : "\n\n💡 *Hint: Please make sure your Supabase project has the `GEMINI_API_KEY` secret set. Run `supabase secrets set GEMINI_API_KEY=your_key`.*";
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `I'm having trouble connecting to the AI agent: ${errMsg}${hint}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAction = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, action: null } : m))
    );
    toast.info("Action cancelled.");
  };

  const handleExecuteAction = async (msgId: string, action: any) => {
    // Save current state for undo
    let backupState: any = null;

    try {
      if (action.type === "move_candidate") {
        const { candidateId, stage, isExternal } = action.details;
        const mappedStatus = mapStageToStatus(stage);

        const candidateName = action.details.candidateName || "";
        const description = action.description || "";
        const isBatchInDisguise = 
          candidateName.toLowerCase() === "everyone" || 
          candidateName.toLowerCase() === "all" || 
          candidateName.toLowerCase() === "the candidate" || 
          candidateName.toLowerCase() === "all applicants" ||
          description.toLowerCase().includes("all applicants") ||
          description.toLowerCase().includes("everyone");

        if (isBatchInDisguise) {
          let jobTitle = action.details.jobTitle || "";
          if (!jobTitle) {
            const match = description.match(/for the (.*?) role/i) || description.match(/for "(.*?)"/i) || description.match(/for (.*?) /i);
            if (match && match[1]) {
              jobTitle = match[1].trim();
            }
          }
          if (!jobTitle) {
            jobTitle = "software engineer";
          }

          let targetJobId = null;
          const { data: jobRes } = await supabase
            .from("jobs")
            .select("id")
            .eq("company_id", companyId || "")
            .ilike("title", `%${jobTitle}%`)
            .limit(1);
          
          if (jobRes && jobRes.length > 0) {
            targetJobId = jobRes[0].id;
          } else {
            const { data: firstJob } = await supabase
              .from("jobs")
              .select("id")
              .eq("company_id", companyId || "")
              .limit(1);
            if (firstJob && firstJob.length > 0) {
              targetJobId = firstJob[0].id;
            }
          }

          if (!targetJobId) {
            throw new Error("Could not find any job to execute the batch action.");
          }

          let fromStatus: any = "submitted";
          if (description.toLowerCase().includes("reviewing") || description.toLowerCase().includes("reviewed")) {
            fromStatus = "reviewing";
          } else if (description.toLowerCase().includes("shortlisted")) {
            fromStatus = "shortlisted";
          } else if (description.toLowerCase().includes("interview")) {
            fromStatus = "interview";
          }

          const { error: intErr } = await supabase
            .from("applications")
            .update({ status: mappedStatus })
            .eq("job_id", targetJobId)
            .eq("status", fromStatus);

          const { error: extErr } = await supabase
            .from("external_applications")
            .update({ status: mappedStatus })
            .eq("job_id", targetJobId)
            .eq("status", fromStatus);

          if (intErr) throw intErr;
          if (extErr) throw extErr;

          toast.success(`Successfully moved candidates to ${stage}!`);
          window.dispatchEvent(new Event("refresh-recruitment-data"));
          if (onTabChange) onTabChange("Applications");

          backupState = { type: "mock_send" };
          setUndoAction(backupState);
          setUndoTimeLeft(30);

          setMessages((prev) =>
            prev.map((m) => (m.id === msgId ? { ...m, action: null } : m))
          );
          return;
        }

        let targetId = candidateId;
        let targetIsExternal = isExternal;
        const isUuid = (id: any) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

        if (!isUuid(targetId)) {
          const candidateName = action.details.candidateName;
          if (candidateName) {
            const { data: openJobs } = await supabase
              .from("jobs")
              .select("id")
              .eq("company_id", companyId || "");
            const jobIds = (openJobs || []).map((j) => j.id);

            if (jobIds.length > 0) {
              const [appsRes, extRes] = await Promise.all([
                supabase
                  .from("applications")
                  .select("id, user_id")
                  .in("job_id", jobIds),
                supabase
                  .from("external_applications")
                  .select("id, full_name")
                  .in("job_id", jobIds)
              ]);

              const apps = appsRes.data || [];
              const exts = extRes.data || [];

              // Fetch profiles separately
              const userIds = apps.map((a: any) => a.user_id).filter(Boolean);
              let profiles: any[] = [];
              if (userIds.length > 0) {
                const { data: profs } = await supabase
                  .from("profiles")
                  .select("id, full_name")
                  .in("id", userIds);
                profiles = profs || [];
              }

              const matchedProfile = profiles.find((p: any) => {
                const rawName = p.full_name || "";
                return rawName.toLowerCase().includes(candidateName.toLowerCase()) ||
                       candidateName.toLowerCase().includes(rawName.toLowerCase());
              });

              if (matchedProfile) {
                const matchedApp = apps.find((a: any) => a.user_id === matchedProfile.id);
                if (matchedApp) {
                  targetId = matchedApp.id;
                  targetIsExternal = false;
                }
              } else {
                const matchedExt = exts.find((ea: any) => {
                  const rawName = ea.full_name || "";
                  return rawName.toLowerCase().includes(candidateName.toLowerCase()) ||
                         candidateName.toLowerCase().includes(rawName.toLowerCase());
                });

                if (matchedExt) {
                  targetId = matchedExt.id;
                  targetIsExternal = true;
                }
              }
            }
          }
        }

        if (!isUuid(targetId)) {
          throw new Error(`Could not find candidate profile for "${action.details.candidateName || "the candidate"}" to move.`);
        }

        const table = targetIsExternal ? "external_applications" : "applications";

        // Fetch current status for backup
        const { data: original } = (await supabase
          .from(table as any)
          .select("status")
          .eq("id", targetId)
          .single()) as any;

        backupState = {
          type: "move_candidate",
          table,
          id: targetId,
          originalStatus: original?.status,
        };

        const { error } = await supabase
          .from(table as any)
          .update({ status: mappedStatus })
          .eq("id", targetId);

        if (error) throw error;
      } else if (action.type === "move_candidates_batch") {
        const { jobId, jobTitle, stage, criteria, fromStage, candidateNames } = action.details;
        const mappedStatus = mapStageToStatus(stage);

        let targetJobId = jobId;
        if (!targetJobId && jobTitle) {
          const { data: jobRes } = await supabase
            .from("jobs")
            .select("id")
            .eq("company_id", companyId || "")
            .ilike("title", `%${jobTitle}%`)
            .limit(1);
          if (jobRes && jobRes.length > 0) {
            targetJobId = jobRes[0].id;
          }
        }

        if (!targetJobId) {
          const { data: jobRes } = await supabase
            .from("jobs")
            .select("id")
            .eq("company_id", companyId || "")
            .limit(1);
          if (jobRes && jobRes.length > 0) {
            targetJobId = jobRes[0].id;
          } else {
            throw new Error("Could not find any active job to execute the batch action.");
          }
        }

        if (criteria === "starred") {
          const { error: intErr } = await supabase
            .from("applications")
            .update({ status: mappedStatus })
            .eq("job_id", targetJobId)
            .eq("starred", true);

          const { error: extErr } = await supabase
            .from("external_applications")
            .update({ status: mappedStatus })
            .eq("job_id", targetJobId)
            .eq("starred", true);

          if (intErr) throw intErr;
          if (extErr) throw extErr;
          
          toast.success(`Successfully moved starred candidates to ${stage}!`);
        } else if (criteria === "stage" && fromStage) {
          const fromStatus = mapStageToStatus(fromStage);

          const { error: intErr } = await supabase
            .from("applications")
            .update({ status: mappedStatus })
            .eq("job_id", targetJobId)
            .eq("status", fromStatus);

          const { error: extErr } = await supabase
            .from("external_applications")
            .update({ status: mappedStatus })
            .eq("job_id", targetJobId)
            .eq("status", fromStatus);

          if (intErr) throw intErr;
          if (extErr) throw extErr;

          toast.success(`Successfully moved candidates from ${fromStage} to ${stage}!`);
        } else if (criteria === "named_list" && Array.isArray(candidateNames)) {
          const [appsRes, extRes] = await Promise.all([
            supabase
              .from("applications")
              .select("id, user_id")
              .eq("job_id", targetJobId),
            supabase
              .from("external_applications")
              .select("id, full_name")
              .eq("job_id", targetJobId)
          ]);

          const apps = appsRes.data || [];
          const exts = extRes.data || [];

          // Fetch profiles separately
          const userIds = apps.map((a: any) => a.user_id).filter(Boolean);
          let profiles: any[] = [];
          if (userIds.length > 0) {
            const { data: profs } = await supabase
              .from("profiles")
              .select("id, full_name")
              .in("id", userIds);
            profiles = profs || [];
          }

          const matchedIds: { id: string; isExternal: boolean }[] = [];

          candidateNames.forEach((name: string) => {
            const matchedProfile = profiles.find((p: any) => {
              const rawName = p.full_name || "";
              return rawName.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(rawName.toLowerCase());
            });

            if (matchedProfile) {
              const matchedApp = apps.find((a: any) => a.user_id === matchedProfile.id);
              if (matchedApp) {
                matchedIds.push({ id: matchedApp.id, isExternal: false });
              }
            } else {
              const matchedExt = exts.find((ea: any) => {
                const rawName = ea.full_name || "";
                return rawName.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(rawName.toLowerCase());
              });
              if (matchedExt) {
                matchedIds.push({ id: matchedExt.id, isExternal: true });
              }
            }
          });

          if (matchedIds.length === 0) {
            throw new Error("Could not find any of the specified candidates in this job's applications.");
          }

          for (const c of matchedIds) {
            const table = c.isExternal ? "external_applications" : "applications";
            await supabase
              .from(table as any)
              .update({ status: mappedStatus })
              .eq("id", c.id);
          }

          toast.success(`Successfully moved ${matchedIds.length} candidate(s) to ${stage}!`);
        } else {
          throw new Error("Invalid batch criteria or parameters.");
        }

        if (onTabChange) onTabChange("Applications");
      } else if (action.type === "send_assessment") {
        const { candidateId, email, fullName, jobTitle, isExternal } = action.details;
        const isUuid = (id: any) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

        let targetId = candidateId;
        let targetIsExternal = isExternal;

        if (!isUuid(targetId)) {
          const candidateName = fullName || action.details.candidateName;
          if (candidateName) {
            const { data: openJobs } = await supabase
              .from("jobs")
              .select("id")
              .eq("company_id", companyId || "");
            const jobIds = (openJobs || []).map((j) => j.id);

            if (jobIds.length > 0) {
              const [appsRes, extRes] = await Promise.all([
                supabase
                  .from("applications")
                  .select("id, user_id")
                  .in("job_id", jobIds),
                supabase
                  .from("external_applications")
                  .select("id, full_name")
                  .in("job_id", jobIds)
              ]);

              const apps = appsRes.data || [];
              const exts = extRes.data || [];

              // Fetch profiles separately
              const userIds = apps.map((a: any) => a.user_id).filter(Boolean);
              let profiles: any[] = [];
              if (userIds.length > 0) {
                const { data: profs } = await supabase
                  .from("profiles")
                  .select("id, full_name")
                  .in("id", userIds);
                profiles = profs || [];
              }

              const matchedProfile = profiles.find((p: any) => {
                const rawName = p.full_name || "";
                return rawName.toLowerCase().includes(candidateName.toLowerCase()) ||
                       candidateName.toLowerCase().includes(rawName.toLowerCase());
              });

              if (matchedProfile) {
                const matchedApp = apps.find((a: any) => a.user_id === matchedProfile.id);
                if (matchedApp) {
                  targetId = matchedApp.id;
                  targetIsExternal = false;
                }
              } else {
                const matchedExt = exts.find((ea: any) => {
                  const rawName = ea.full_name || "";
                  return rawName.toLowerCase().includes(candidateName.toLowerCase()) ||
                         candidateName.toLowerCase().includes(rawName.toLowerCase());
                });

                if (matchedExt) {
                  targetId = matchedExt.id;
                  targetIsExternal = true;
                }
              }
            }
          }
        }

        if (!isUuid(targetId)) {
          throw new Error(`Could not find candidate profile for "${fullName || "the candidate"}" to invite.`);
        }

        const table = targetIsExternal ? "external_applications" : "applications";

        const { data: original } = (await supabase
          .from(table as any)
          .select("status")
          .eq("id", targetId)
          .single()) as any;

        backupState = {
          type: "move_candidate",
          table,
          id: targetId,
          originalStatus: original?.status,
        };

        const { error } = await supabase
          .from(table as any)
          .update({ status: "assessment_sent" })
          .eq("id", targetId);

        if (error) throw error;

        toast.success(`Assessment invitation sent to ${fullName || "candidate"}!`);
      } else if (action.type === "filter_summarize" || action.type === "generate_report") {
        const { jobId, jobTitle } = action.details;
        let appCount = 0;
        let extCount = 0;
        let stageCounts: Record<string, number> = {};

        if (jobId) {
          const [appsRes, extRes] = await Promise.all([
            supabase.from("applications").select("status").eq("job_id", jobId),
            supabase.from("external_applications").select("status").eq("job_id", jobId)
          ]);
          
          const apps = appsRes.data || [];
          const exts = extRes.data || [];
          appCount = apps.length;
          extCount = exts.length;

          [...apps, ...exts].forEach((item: any) => {
            const st = item.status || "applied";
            stageCounts[st] = (stageCounts[st] || 0) + 1;
          });
        }

        const breakdown = Object.entries(stageCounts)
          .map(([stage, count]) => `- **${stage.charAt(0).toUpperCase() + stage.slice(1)}**: ${count}`)
          .join("\n");

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `📊 **Recruitment Report for "${jobTitle || "Job"}"**:\n\n- **TalentHub Applicants**: ${appCount}\n- **External Link Applicants**: ${extCount}\n- **Total Volume**: ${appCount + extCount}\n\n**Stage Breakdown:**\n${breakdown || "_No active candidates in pipeline stages yet._"}\n\nI have navigated your portal to the **Applications** workspace.`,
          }
        ]);

        if (onTabChange) onTabChange("Applications");
      } else if (action.type === "draft_notification") {
        const { candidateName, stage, message } = action.details;
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `✉️ **Draft Notification for ${candidateName || "Candidate"} (${stage || "Update"})**:\n\n\`\`\`\n${message || "Hi, thank you for your application. We will update you soon."}\n\`\`\`\n\n*Copy this draft to your clipboard or send it via email settings.*`,
          }
        ]);
      } else if (action.type === "post_job") {
        const { 
          title, 
          description, 
          skills, 
          location, 
          industry, 
          employment_type, 
          job_type, 
          salary_range,
          required_years_experience,
          required_qualification
        } = action.details;

        // Dispatch custom event to populate the job form in CoJobs
        window.dispatchEvent(
          new CustomEvent("ai-populate-job-form", {
            detail: {
              title,
              description,
              skills,
              location,
              industry,
              employment_type: employment_type || job_type,
              job_type: job_type || employment_type,
              salary_range,
              required_years_experience,
              required_qualification
            }
          })
        );

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `📝 **Post Job Action initiated** for **"${title || "New Job"}"**.\n\nI have automatically opened and populated the job creation drawer in the **Jobs** workspace. Please review, edit, or finalize the details and click **"Save Job Listing"** to publish.`,
          }
        ]);
        if (onTabChange) onTabChange("Jobs");
      } else if (action.type === "create_prescreening") {
        const { jobTitle } = action.details;
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `⚙️ **Pre-Screening Questions builder** for **"${jobTitle || "Job"}"**.\n\nI've moved you to the **Jobs** tab. Under the job list, click the **Assessment Builder** options to add pre-screening questions or AI suggested questions.`,
          }
        ]);
        if (onTabChange) onTabChange("Jobs");
      } else {
        toast.error("Executing this action is not implemented client-side yet.");
        return;
      }

      // Action succeeded - set up undo state
      setUndoAction(backupState);
      setUndoTimeLeft(30);

      // Remove action card from chat message
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, action: null } : m))
      );

      // Dispatch local event to refresh active tabs instantly
      window.dispatchEvent(new Event("refresh-recruitment-data"));

      toast.success("Action executed successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to execute action.");
    }
  };

  const handleUndo = async () => {
    if (!undoAction) return;

    try {
      if (undoAction.type === "move_candidate") {
        const { table, id, originalStatus } = undoAction;
        const { error } = await supabase
          .from(table as any)
          .update({ status: originalStatus })
          .eq("id", id);

        if (error) throw error;
        
        // Dispatch local event to refresh active tabs instantly
        window.dispatchEvent(new Event("refresh-recruitment-data"));
        
        toast.success("Stage change reverted successfully!");
      } else {
        toast.info("Mock action reverted.");
      }
    } catch (err: any) {
      toast.error("Failed to revert action.");
      console.error(err);
    } finally {
      setUndoAction(null);
      setUndoTimeLeft(0);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-primary/10 border-2 border-primary/30 rounded-full shadow-glow flex items-center justify-center cursor-pointer hover:scale-110 hover:border-primary transition-all z-50 backdrop-blur-sm"
        title="Ask Teemane"
      >
        {isOpen
          ? <X className="w-6 h-6 text-primary" />
          : <img src={mascot} alt="Teemane" className="w-12 h-12 object-contain animate-bob drop-shadow-[0_0_8px_rgba(130,200,80,0.6)]" />}
      </button>

      {/* Floating Panel (Apple transparency style glassmorphism) */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[380px] h-[520px] bg-[#0d1117]/85 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="h-14 px-4 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={mascot} alt="Teemane" className="w-8 h-8 object-contain animate-bob drop-shadow-[0_0_6px_rgba(130,200,80,0.5)]" />
              <div>
                <span className="font-bold text-xs text-white uppercase tracking-wider">Teemane</span>
                <span className="block text-[10px] text-primary/70">HR Intelligence Assistant</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  if (window.confirm("Are you sure you want to clear chat history?")) {
                    setMessages([]);
                    localStorage.removeItem(`teemane_chat_${userId}`);
                  }
                }}
                className="text-muted-foreground hover:text-red-400 p-1.5 rounded hover:bg-white/5 transition-colors"
                title="Clear Chat History"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-white p-1 rounded hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Deck */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-none">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-3">
                <div className="relative">
                  <img src={mascot} alt="Teemane" className="w-20 h-20 object-contain animate-bob drop-shadow-[0_0_16px_rgba(130,200,80,0.5)]" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary rounded-full border-2 border-[#0d1117] animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Hi! I'm Teemane 👋</h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[200px] mx-auto">
                    I can draft job posts, move candidates, suggest screening questions, or summarize your pipeline!
                  </p>
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col max-w-[85%] ${
                  m.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                }`}
              >
                <div
                  className={`p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-none"
                      : m.isProactive
                      ? "bg-primary/5 text-primary border border-primary/20 rounded-bl-none"
                      : "bg-white/[0.04] text-white/90 rounded-bl-none border border-white/5"
                  }`}
                >
                  {m.content}
                </div>

                {/* Render confirmation card if action is proposed */}
                {m.action && (
                  <div className="bg-[#111318] border border-white/10 rounded-xl p-3 mt-2 space-y-2 text-xs w-full">
                    <p className="font-semibold text-white flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-primary" /> Execute proposed action?
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-snug">{m.action.description}</p>
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => handleExecuteAction(m.id, m.action)}
                        className="bg-primary hover:bg-primary/95 text-primary-foreground h-8 text-[10px] rounded-lg flex-1 font-bold"
                      >
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCancelAction(m.id)}
                        className="border-white/10 text-white hover:bg-white/5 h-8 text-[10px] rounded-lg flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input Footer */}
          <form onSubmit={sendMessage} className="p-3 border-t border-white/5 bg-white/[0.01] flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask me to perform tasks or Q&A..."
              className="h-10 bg-[#111318] border-white/10 text-white text-xs rounded-xl focus:border-primary/50"
            />
            <Button
              type="submit"
              disabled={loading || !inputValue.trim()}
              size="icon"
              className="h-10 w-10 bg-primary hover:bg-primary/95 text-primary-foreground shrink-0 rounded-xl flex items-center justify-center cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      )}

      {/* Undo Banner / Toast */}
      {undoAction && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-[#0d1117]/95 border border-primary/25 rounded-2xl py-3.5 px-5 shadow-2xl flex items-center gap-4 z-50 animate-in slide-in-from-top-10 duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-white/90">Action completed successfully.</span>
          </div>
          <button
            onClick={handleUndo}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-white font-bold bg-primary/10 hover:bg-primary/25 border border-primary/30 py-1.5 px-3 rounded-lg transition-all cursor-pointer"
          >
            <Undo className="w-3.5 h-3.5" /> Undo ({undoTimeLeft}s)
          </button>
        </div>
      )}
    </>
  );
}
