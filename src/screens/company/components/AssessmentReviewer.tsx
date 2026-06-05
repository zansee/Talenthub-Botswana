import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Award, Clock, Play, Plus, RefreshCw, Send, Trash2, Video, AlertCircle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface AssessmentReviewerProps {
  responseId: string;
}

export default function AssessmentReviewer({ responseId }: AssessmentReviewerProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [response, setResponse] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  
  // Signed URLs mapping for videos: question_id -> signedUrl string
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});

  // Note entry state: question_id -> note string
  const [newNotes, setNewNotes] = useState<Record<string, string>>({});
  const [addingNoteId, setAddingNoteId] = useState<string | null>(null);

  // References to video players: question_id -> HTMLVideoElement
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  const loadResponseDetails = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch response
      const { data: resp, error: respErr } = await supabase
        .from("assessment_responses")
        .select("*, assessments(*)")
        .eq("id", responseId)
        .single();
      
      if (respErr) throw respErr;
      setResponse(resp);

      // 2. Fetch questions
      const { data: qData, error: qErr } = await supabase
        .from("assessment_questions")
        .select("*")
        .eq("assessment_id", resp.assessment_id)
        .order("order_index", { ascending: true });

      if (qErr) throw qErr;

      // Handle IQ/Aptitude sub-questions if the block exists
      let finalQuestionsList: any[] = [];
      const answersMap = (resp.answers as Record<string, any>) || {};
      
      for (const q of qData || []) {
        if (q.question_type === "iq_aptitude") {
          // Find any sub-questions in answers keys that match iq- prefix
          const iqSubQuestionIds = Object.keys(answersMap).filter(k => k.startsWith("iq-"));
          if (iqSubQuestionIds.length > 0) {
            // Select these IQ questions details
            const cleanIds = iqSubQuestionIds.map(id => id.replace("iq-", ""));
            const { data: iqDetails } = await supabase
              .from("iq_question_bank")
              .select("*")
              .in("id", cleanIds);

            if (iqDetails) {
              const iqSubQuestionsEnriched = iqDetails.map(iqQ => ({
                id: `iq-${iqQ.id}`,
                isIQSubQuestion: true,
                question_type: "iq_question",
                question_text: iqQ.question_text,
                options: iqQ.options,
                correct_answers: [iqQ.options[iqQ.correct_option_index]],
                category: iqQ.category,
              }));
              finalQuestionsList.push(...iqSubQuestionsEnriched);
            }
          }
        } else {
          finalQuestionsList.push(q);
        }
      }

      setQuestions(finalQuestionsList);

      // 3. Fetch video review notes
      const { data: notesData } = await supabase
        .from("video_notes")
        .select("*, profiles (full_name)")
        .eq("response_id", responseId)
        .order("timestamp", { ascending: true });
      
      setNotes(notesData || []);

      // 4. Generate signed URLs for video questions
      const urls: Record<string, string> = {};
      for (const q of finalQuestionsList) {
        if (q.question_type === "video" && answersMap[q.id]) {
          try {
            const videoPath = answersMap[q.id];
            const { data: signedData } = await supabase.storage
              .from("assessment-videos")
              .createSignedUrl(videoPath, 3600);
            
            if (signedData?.signedUrl) {
              urls[q.id] = signedData.signedUrl;
            }
          } catch (err) {
            console.error("Failed to generate signed URL for question", q.id, err);
          }
        }
      }
      setVideoUrls(urls);

    } catch (err: any) {
      console.error("Failed to load assessment review:", err.message);
      toast.error("Failed to load candidate assessment response.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResponseDetails();
  }, [responseId]);

  const handleAddNote = async (questionId: string) => {
    const video = videoRefs.current[questionId];
    const noteText = newNotes[questionId]?.trim();
    if (!video || !noteText) return;

    const timestamp = video.currentTime;

    try {
      setAddingNoteId(questionId);
      const { data, error } = await supabase
        .from("video_notes")
        .insert([
          {
            response_id: responseId,
            question_id: questionId,
            timestamp: parseFloat(timestamp.toFixed(2)),
            note: noteText,
            created_by: user!.id,
          },
        ])
        .select("*, profiles(full_name)")
        .single();

      if (error) throw error;

      setNotes((prev) => [...prev, data].sort((a, b) => a.timestamp - b.timestamp));
      setNewNotes({ ...newNotes, [questionId]: "" });
      toast.success("Timestamped note added!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save note.");
    } finally {
      setAddingNoteId(null);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from("video_notes")
        .delete()
        .eq("id", noteId);
      
      if (error) throw error;
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success("Note deleted successfully.");
    } catch (err: any) {
      toast.error("Failed to delete note.");
    }
  };

  const handleSeekVideo = (questionId: string, timestamp: number) => {
    const video = videoRefs.current[questionId];
    if (video) {
      video.currentTime = timestamp;
      video.play();
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Compute category scores for IQ block
  const iqStats = (() => {
    const answersMap = (response?.answers as Record<string, any>) || {};
    let stats = {
      logical: { correct: 0, total: 0 },
      numerical: { correct: 0, total: 0 },
      verbal: { correct: 0, total: 0 },
    };

    questions.forEach((q) => {
      if (q.isIQSubQuestion) {
        const cat = q.category as "logical" | "numerical" | "verbal";
        if (stats[cat]) {
          stats[cat].total++;
          const ans = answersMap[q.id];
          const correct = q.correct_answers?.[0];
          if (ans && correct && ans.toLowerCase() === correct.toLowerCase()) {
            stats[cat].correct++;
          }
        }
      }
    });

    return stats;
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 text-xs text-muted-foreground gap-2 animate-pulse">
        <RefreshCw className="w-4 h-4 animate-spin text-primary" />
        <span>Loading assessment details...</span>
      </div>
    );
  }

  const answersMap = (response?.answers as Record<string, any>) || {};

  return (
    <div className="space-y-6 text-xs text-white">
      {/* Top summary grid card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-[#111318]/50 border border-white/5 p-4 rounded-2xl">
        <div className="space-y-1">
          <span className="text-muted-foreground font-semibold">Overall Objective Score</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Award className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-white">
              {response?.score !== null ? `${response.score}%` : "N/A"}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-muted-foreground font-semibold">Time Taken</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-white">
              {response?.time_taken_seconds ? `${Math.floor(response.time_taken_seconds / 60)}m ${response.time_taken_seconds % 60}s` : "N/A"}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-muted-foreground font-semibold">Attempts Spent</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <RefreshCw className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-white">{response?.attempt_number || 1} Attempt</span>
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-muted-foreground font-semibold">Video Questions Awaiting Review</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Video className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-white">
              {questions.filter((q) => q.question_type === "video").length} Video response(s)
            </span>
          </div>
        </div>
      </div>

      {/* IQ Category Scores Grid if IQ block was answered */}
      {Object.values(iqStats).some((s) => s.total > 0) && (
        <div className="space-y-2 border-t border-white/5 pt-4">
          <h4 className="font-bold text-zinc-300 uppercase tracking-wider">Cognitive Aptitude Breakdowns</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {["logical", "numerical", "verbal"].map((cat) => {
              const stats = iqStats[cat as keyof typeof iqStats];
              if (stats.total === 0) return null;
              const pct = Math.round((stats.correct / stats.total) * 100);
              return (
                <div key={cat} className="bg-card p-3 rounded-xl border border-white/5 space-y-1 flex flex-col justify-between">
                  <span className="capitalize text-muted-foreground font-semibold">{cat} Score</span>
                  <div className="flex justify-between items-center mt-1">
                    <span className="font-bold text-white">{stats.correct} / {stats.total} correct</span>
                    <span className="text-primary font-bold">{pct}%</span>
                  </div>
                  <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden mt-1.5">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Questions Answers List */}
      <div className="space-y-5 border-t border-white/5 pt-4">
        <h4 className="font-bold text-zinc-300 uppercase tracking-wider">Question Responses</h4>
        
        {questions.map((q, idx) => {
          const ans = answersMap[q.id];

          return (
            <div key={q.id} className="bg-card p-4 rounded-xl border border-white/5 space-y-3">
              <div className="flex justify-between items-start gap-4">
                <span className="font-bold text-primary uppercase tracking-wider text-[10px]">
                  Question {idx + 1} — {q.question_type.replace("_", " ")}
                </span>
              </div>
              <p className="font-semibold text-white/90 leading-snug">{q.question_text}</p>

              {/* Written response type */}
              {q.question_type === "text" && (
                <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3 text-white/90 leading-relaxed whitespace-pre-wrap">
                  {ans || <span className="italic text-muted-foreground">No response submitted.</span>}
                </div>
              )}

              {/* Multiple Choice response (Normal MCQ or IQ block subquestion) */}
              {(q.question_type === "multiple_choice" || q.question_type === "iq_question") && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  {q.options?.map((opt: string) => {
                    const isCandidateChoice = ans === opt;
                    const isCorrect = q.correct_answers?.[0] === opt;
                    return (
                      <div
                        key={opt}
                        className={`p-2.5 rounded-lg border text-left flex justify-between items-center ${
                          isCorrect
                            ? "bg-green-500/10 border-green-500/30 text-green-400"
                            : isCandidateChoice
                            ? "bg-red-500/10 border-red-500/30 text-red-400"
                            : "bg-[#111318]/50 border-white/5 text-zinc-400"
                        }`}
                      >
                        <span>{opt}</span>
                        {isCandidateChoice && <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-white/10 ml-2">Selected</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Video response review with timestamped notes */}
              {q.question_type === "video" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  <div className="lg:col-span-7 space-y-2">
                    <div className="aspect-video w-full bg-zinc-950 border border-white/5 rounded-xl overflow-hidden relative">
                      {videoUrls[q.id] ? (
                        <video
                          ref={(el) => {
                            videoRefs.current[q.id] = el;
                          }}
                          src={videoUrls[q.id]}
                          controls
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground italic bg-zinc-950">
                          <AlertCircle className="w-5 h-5 text-white/20 mr-1.5" />
                          No video recorded for this question.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-5 space-y-3">
                    <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Timestamped Notes</span>
                    
                    {/* Notes listing */}
                    <div className="max-h-36 overflow-y-auto space-y-2 bg-[#111318]/50 p-2.5 border border-white/5 rounded-xl">
                      {notes.filter((n) => n.question_id === q.id).length === 0 ? (
                        <p className="text-[10px] text-muted-foreground italic py-4 text-center">
                          No timestamped notes yet. Add one while playing.
                        </p>
                      ) : (
                        notes
                          .filter((n) => n.question_id === q.id)
                          .map((n) => (
                            <div key={n.id} className="flex justify-between items-start gap-2 bg-white/[0.01] hover:bg-white/[0.03] p-1.5 rounded border border-white/5 text-[10px] group transition-colors">
                              <div className="min-w-0">
                                <button
                                  onClick={() => handleSeekVideo(q.id, n.timestamp)}
                                  className="text-primary hover:underline font-bold text-left flex items-center gap-1 shrink-0"
                                >
                                  <Play className="w-2.5 h-2.5 fill-primary" /> {formatTime(n.timestamp)}
                                </button>
                                <p className="text-white/90 mt-1 whitespace-pre-wrap">{n.note}</p>
                                <p className="text-[8px] text-muted-foreground mt-0.5">By {n.profiles?.full_name || "Reviewer"}</p>
                              </div>
                              <button
                                onClick={() => handleDeleteNote(n.id)}
                                className="text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                                title="Delete note"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                      )}
                    </div>

                    {/* Add note input form */}
                    {videoUrls[q.id] && (
                      <div className="flex gap-2">
                        <Input
                          value={newNotes[q.id] || ""}
                          onChange={(e) => setNewNotes({ ...newNotes, [q.id]: e.target.value })}
                          placeholder="Type a note (e.g. Good communication...)"
                          className="h-8 bg-card border-white/10 text-white rounded-lg text-xs"
                        />
                        <Button
                          onClick={() => handleAddNote(q.id)}
                          disabled={addingNoteId === q.id || !newNotes[q.id]?.trim()}
                          size="sm"
                          className="bg-primary/20 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground h-8 text-xs rounded-lg px-3 shrink-0 flex items-center gap-1 font-semibold"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
