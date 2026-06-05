import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Camera, Clock, Check, ChevronRight, AlertCircle, RefreshCw, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import mascotTransparent from "@/assets/mascot-transparent.png";

export default function ExternalAssessment() {
  const { token } = useParams<{ token: string }>();

  // Token & Load States
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tokenRecord, setTokenRecord] = useState<any>(null);
  const [assessment, setAssessment] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);

  // Assessment Progress States
  const [step, setStep] = useState<"intro" | "questions" | "success">("intro");
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeTaken, setTimeTaken] = useState(0);
  const timerIntervalRef = useRef<any>(null);

  // Written answer character count
  const [writtenAnswer, setWrittenAnswer] = useState("");

  // Video recording states
  const [isRecording, setIsRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [recordingTimeLeft, setRecordingTimeLeft] = useState(60);
  const [videoAttemptsLeft, setVideoAttemptsLeft] = useState(2); // 1 re-record allowed (2 total attempts)
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // IQ timed block states
  const [iqTimeLeft, setIqTimeLeft] = useState(60);
  const iqTimerRef = useRef<any>(null);

  useEffect(() => {
    async function loadExternalAssessment() {
      if (!token) return;
      try {
        setLoading(true);

        // 1. Fetch and validate assessment token
        const { data: tokData, error: tokErr } = await supabase
          .from("assessment_tokens")
          .select("*")
          .eq("token", token)
          .single();

        if (tokErr || !tokData) {
          throw new Error("Invalid assessment link. Please check your email.");
        }

        if (tokData.used_at) {
          throw new Error("This assessment link has already been used.");
        }

        if (tokData.expires_at && new Date(tokData.expires_at) < new Date()) {
          throw new Error("This assessment link has expired.");
        }

        setTokenRecord(tokData);

        // 2. Fetch assessment config
        const { data: assessData, error: assessErr } = await supabase
          .from("assessments")
          .select("*")
          .eq("id", tokData.assessment_id)
          .single();

        if (assessErr) throw assessErr;
        setAssessment(assessData);

        // 3. Fetch questions
        const { data: qData, error: qErr } = await supabase
          .from("assessment_questions")
          .select("*")
          .eq("assessment_id", assessData.id)
          .order("order_index", { ascending: true });

        if (qErr) throw qErr;

        // Process questions: inject IQ questions if needed
        let finalQuestionsList: any[] = [];
        for (const q of qData || []) {
          if (q.question_type === "iq_aptitude") {
            const { data: iqBank } = await supabase
              .from("iq_question_bank")
              .select("*")
              .eq("difficulty", q.iq_difficulty || "mid")
              .limit(q.iq_count || 10);
            
            if (iqBank && iqBank.length > 0) {
              const iqQuestionsEnriched = iqBank.map((iqQ, iqIdx) => ({
                id: `iq-${iqQ.id}`,
                isIQSubQuestion: true,
                question_type: "iq_question",
                question_text: iqQ.question_text,
                options: iqQ.options,
                correct_answers: [iqQ.options[iqQ.correct_option_index]],
                category: iqQ.category,
                time_limit_seconds: iqQ.time_limit_seconds || 45,
                order_index: q.order_index + (iqIdx * 0.01),
              }));
              finalQuestionsList.push(...iqQuestionsEnriched);
            }
          } else {
            finalQuestionsList.push(q);
          }
        }

        setQuestions(finalQuestionsList);
      } catch (err: any) {
        console.error(err);
        setAssessment({ error: err.message });
      } finally {
        setLoading(false);
      }
    }
    loadExternalAssessment();
  }, [token]);

  // Overall timer
  useEffect(() => {
    if (step === "questions") {
      timerIntervalRef.current = setInterval(() => {
        setTimeTaken((t) => t + 1);
      }, 1000);
    } else {
      clearInterval(timerIntervalRef.current);
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [step]);

  // IQ timer ticking
  useEffect(() => {
    if (step !== "questions") return;
    const currentQ = questions[currentQIndex];

    if (currentQ?.isIQSubQuestion) {
      setIqTimeLeft(currentQ.time_limit_seconds || 60);
      
      if (iqTimerRef.current) clearInterval(iqTimerRef.current);
      
      iqTimerRef.current = setInterval(() => {
        setIqTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(iqTimerRef.current);
            handleNextQuestion();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } else {
      if (iqTimerRef.current) clearInterval(iqTimerRef.current);
    }

    return () => clearInterval(iqTimerRef.current);
  }, [currentQIndex, step, questions]);

  const handleStart = () => {
    setStep("questions");
    setCurrentQIndex(0);
    setTimeTaken(0);
  };

  // Video recording handlers
  const startCamera = async () => {
    try {
      setVideoBlob(null);
      setVideoUrl(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setCameraStream(stream);
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }
    } catch (err) {
      toast.error("Camera access denied. Please allow camera permissions.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
  };

  const startVideoRecording = () => {
    if (!cameraStream) return;
    recordedChunksRef.current = [];
    setCountdown(3);

    const countInterval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(countInterval);
          const recorder = new MediaRecorder(cameraStream, { mimeType: "video/webm" });
          mediaRecorderRef.current = recorder;
          
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              recordedChunksRef.current.push(e.data);
            }
          };

          recorder.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
            setVideoBlob(blob);
            setVideoUrl(URL.createObjectURL(blob));
          };

          recorder.start();
          setIsRecording(true);
          setRecordingTimeLeft(questions[currentQIndex].video_max_duration || 60);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    let t: any = null;
    if (isRecording && recordingTimeLeft > 0) {
      t = setInterval(() => {
        setRecordingTimeLeft((time) => {
          if (time <= 1) {
            stopVideoRecording();
            return 0;
          }
          return time - 1;
        });
      }, 1000);
    }
    return () => clearInterval(t);
  }, [isRecording, recordingTimeLeft]);

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleReRecord = () => {
    if (videoAttemptsLeft <= 1) {
      toast.error("No attempts remaining for this video question.");
      return;
    }
    setVideoAttemptsLeft((a) => a - 1);
    startCamera();
  };

  const handleNextQuestion = async () => {
    const currentQ = questions[currentQIndex];

    let candidateAnswer: any = "";
    if (currentQ.question_type === "text") {
      candidateAnswer = writtenAnswer;
      setWrittenAnswer("");
    } else if (currentQ.question_type === "multiple_choice" || currentQ.question_type === "iq_question") {
      candidateAnswer = answers[currentQ.id] || "";
    } else if (currentQ.question_type === "video") {
      if (!videoBlob) {
        toast.error("Please record a video response first.");
        return;
      }
      setSubmitting(true);
      try {
        const filePath = `${assessment.id}/ext_${tokenRecord.external_application_id}_${currentQ.id}.webm`;
        const { error: uploadErr } = await supabase.storage
          .from("assessment-videos")
          .upload(filePath, videoBlob, { upsert: true });

        if (uploadErr) throw uploadErr;
        candidateAnswer = filePath;
        stopCamera();
        setVideoBlob(null);
        setVideoUrl(null);
      } catch (err: any) {
        toast.error("Failed to upload video response.");
        setSubmitting(false);
        return;
      } finally {
        setSubmitting(false);
      }
    }

    setAnswers((prev) => ({ ...prev, [currentQ.id]: candidateAnswer }));

    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex((idx) => idx + 1);
      setVideoAttemptsLeft(2);
    } else {
      await handleSubmitAssessment({ ...answers, [currentQ.id]: candidateAnswer });
    }
  };

  const handleSubmitAssessment = async (finalAnswers: Record<string, any>) => {
    try {
      setSubmitting(true);

      // 1. Score Calculation (MC & IQ)
      let correctCount = 0;
      let objectiveCount = 0;

      questions.forEach((q) => {
        if (q.question_type === "multiple_choice" || q.question_type === "iq_question") {
          objectiveCount++;
          const ans = finalAnswers[q.id];
          const correct = q.correct_answers?.[0];
          if (ans && correct && ans.toLowerCase() === correct.toLowerCase()) {
            correctCount++;
          }
        }
      });

      const finalScore = objectiveCount > 0 ? Math.round((correctCount / objectiveCount) * 100) : null;

      // 2. Insert assessment response
      const { error: respErr } = await supabase.from("assessment_responses").insert([
        {
          assessment_id: assessment.id,
          external_application_id: tokenRecord.external_application_id,
          answers: finalAnswers,
          score: finalScore,
          completed_at: new Date().toISOString(),
          time_taken_seconds: timeTaken,
        },
      ]);

      if (respErr) throw respErr;

      // 3. Update external application status to Reviewed
      await supabase
        .from("external_applications")
        .update({ status: "reviewing" })
        .eq("id", tokenRecord.external_application_id);

      // 4. Mark token as used
      await supabase
        .from("assessment_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("token", token || "");

      setStep("success");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit assessment.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0c10] text-[#e5e7eb] flex flex-col items-center justify-center p-6">
        <RefreshCw className="w-8 h-8 text-primary animate-spin mb-4" />
        <span className="text-xs text-muted-foreground">Validating assessment token...</span>
      </div>
    );
  }

  // Handle Token / Assessment Configuration Errors
  if (assessment?.error || !assessment) {
    return (
      <div className="min-h-screen bg-[#0a0c10] text-[#e5e7eb] flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4 animate-bounce" />
        <h2 className="text-xl font-bold">Assessment Link Error</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          {assessment?.error || "This assessment link is invalid, has expired, or has already been used."}
        </p>
        <p className="text-xs text-muted-foreground mt-4">
          Please contact the hiring department if you believe this is in error.
        </p>
      </div>
    );
  }

  // Success view (Teemane Mascot celebration)
  if (step === "success") {
    return (
      <div className="min-h-screen bg-[#0a0c10] text-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-[#0d1117] border border-white/5 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-48 h-48 mx-auto">
            <img src={mascotTransparent} alt="Teemane mascot" className="w-full h-full object-contain animate-bounce" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">Assessment Submitted!</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Teemane is celebrating! Your responses have been uploaded and submitted to the company's recruitment portal. 
            </p>
            <p className="text-xs text-primary font-medium mt-1">
              You may close this tab now.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentQIndex];

  // External intro/welcome layout (centered on large desktop, mobile optimized card)
  if (step === "intro") {
    return (
      <div className="min-h-screen bg-[#0a0c10] text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#0d1117] border border-white/5 rounded-3xl p-8 space-y-6 shadow-2xl">
          <div className="w-12 h-12 bg-primary/10 border border-primary/20 text-primary rounded-xl flex items-center justify-center">
            <Brain className="w-6 h-6" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-tight text-white">{assessment.name}</h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Welcome to your interview assessment. This online test contains {questions.length} questions. Please answer honestly.
            </p>
          </div>

          <div className="bg-[#111318] border border-white/5 rounded-2xl p-4 space-y-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-primary" />
              <span>
                Timing model: {assessment.is_live_timed ? "Live timed session (must complete in one sitting)" : "Self-paced"}
              </span>
            </div>
            {assessment.deadline_days && (
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-primary" />
                <span>Deadline: {assessment.deadline_days} days to complete</span>
              </div>
            )}
          </div>

          <Button
            onClick={handleStart}
            className="w-full bg-primary hover:bg-primary/95 text-primary-foreground h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5"
          >
            Start Assessment <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0c10] text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0d1117] border border-white/5 rounded-3xl p-6 flex flex-col justify-between h-[560px] shadow-2xl relative">
        
        {/* Top Progress */}
        <div className="space-y-3">
          <div className="flex justify-between items-center text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
            <span>Question {currentQIndex + 1} of {questions.length}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-primary" />
              {currentQ.isIQSubQuestion ? `Time Left: ${iqTimeLeft}s` : `Total Time: ${Math.floor(timeTaken / 60)}m ${timeTaken % 60}s`}
            </span>
          </div>
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((currentQIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Question Area */}
        <div className="flex-1 flex flex-col justify-center py-6 min-h-0">
          <h2 className="text-base font-bold text-white leading-snug mb-5">
            {currentQ.question_text}
          </h2>

          <div className="overflow-y-auto max-h-[300px] pr-1 scrollbar-none">
            {/* Written input */}
            {currentQ.question_type === "text" && (
              <div className="space-y-1">
                <Textarea
                  value={writtenAnswer}
                  onChange={(e) => setWrittenAnswer(e.target.value)}
                  placeholder="Type your response here..."
                  maxLength={2000}
                  className="min-h-[160px] bg-[#111318] border-white/10 text-white rounded-2xl text-xs"
                />
                <p className="text-[9px] text-muted-foreground text-right">
                  {writtenAnswer.length} / 2000 characters
                </p>
              </div>
            )}

            {/* MCQ Option mapping */}
            {(currentQ.question_type === "multiple_choice" || currentQ.question_type === "iq_question") && (
              <div className="space-y-2">
                {currentQ.options?.map((opt: string) => (
                  <button
                    key={opt}
                    onClick={() => setAnswers({ ...answers, [currentQ.id]: opt })}
                    className={`w-full h-11 px-4 rounded-xl border text-xs text-left font-medium transition-all flex items-center justify-between ${
                      answers[currentQ.id] === opt
                        ? "bg-primary/10 border-primary text-primary"
                        : "border-white/5 bg-[#111318]/50 hover:bg-white/5 text-white/80"
                    }`}
                  >
                    <span>{opt}</span>
                    {answers[currentQ.id] === opt && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            )}

            {/* Camera / Webcam Recording */}
            {currentQ.question_type === "video" && (
              <div className="space-y-3">
                <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-zinc-950 border border-white/5 flex items-center justify-center">
                  {!cameraStream && !videoUrl && (
                    <div className="text-center p-4 space-y-2">
                      <Camera className="w-8 h-8 text-muted-foreground mx-auto" />
                      <p className="text-[10px] text-muted-foreground">Click below to activate camera.</p>
                      <Button
                        onClick={startCamera}
                        size="sm"
                        className="bg-primary/20 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground text-[10px] rounded-lg h-8"
                      >
                        Activate Camera
                      </Button>
                    </div>
                  )}

                  {(cameraStream || videoUrl) && (
                    <video
                      ref={videoPreviewRef}
                      src={videoUrl || undefined}
                      autoPlay
                      playsInline
                      muted={!videoUrl}
                      controls={!!videoUrl}
                      className="w-full h-full object-cover"
                    />
                  )}

                  {countdown > 0 && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                      <span className="text-4xl font-bold text-primary animate-ping">{countdown}</span>
                    </div>
                  )}

                  {isRecording && (
                    <div className="absolute top-3 left-3 bg-red-600/90 text-white font-bold text-[8px] px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-white" />
                      REC ({recordingTimeLeft}s)
                    </div>
                  )}
                </div>

                {cameraStream && !isRecording && !videoUrl && (
                  <Button
                    onClick={startVideoRecording}
                    className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs h-9 font-bold"
                  >
                    Start Recording
                  </Button>
                )}

                {isRecording && (
                  <Button
                    onClick={stopVideoRecording}
                    className="w-full bg-zinc-700 hover:bg-zinc-800 text-white rounded-xl text-xs h-9 font-bold"
                  >
                    Stop Recording
                  </Button>
                )}

                {videoUrl && (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleReRecord}
                      disabled={videoAttemptsLeft <= 1}
                      variant="outline"
                      className="flex-1 border-white/10 text-white hover:bg-white/5 rounded-xl h-9 text-xs"
                    >
                      Re-record ({videoAttemptsLeft - 1} left)
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Trigger */}
        <Button
          onClick={handleNextQuestion}
          disabled={
            submitting ||
            (currentQ.question_type === "text" && !writtenAnswer.trim()) ||
            (currentQ.question_type === "multiple_choice" && !answers[currentQ.id]) ||
            (currentQ.question_type === "iq_question" && !answers[currentQ.id] && iqTimeLeft > 0) ||
            (currentQ.question_type === "video" && !videoUrl)
          }
          className="w-full bg-primary hover:bg-primary/95 text-primary-foreground h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shrink-0"
        >
          {submitting ? "Uploading response..." : currentQIndex < questions.length - 1 ? "Next Question" : "Submit Assessment"}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
