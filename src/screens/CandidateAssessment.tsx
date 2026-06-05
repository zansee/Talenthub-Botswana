import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { Brain, Camera, Clock, Check, ChevronRight, Monitor, ArrowRight, Play, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import mascotTransparent from "@/assets/mascot-transparent.png";

export default function CandidateAssessment() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refresh } = useApp();

  // Load States
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [application, setApplication] = useState<any>(null);
  const [iqQuestionsBank, setIqQuestionsBank] = useState<any[]>([]);

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
    async function loadAssessmentFlow() {
      if (!jobId || !user) return;
      try {
        setLoading(true);

        // 1. Fetch application to get ID and verify status
        const { data: appData, error: appErr } = await supabase
          .from("applications")
          .select("id, status")
          .eq("job_id", jobId)
          .eq("user_id", user.id)
          .single();

        if (appErr) throw appErr;
        setApplication(appData);

        // 2. Fetch assessment config
        const { data: assessData, error: assessErr } = await supabase
          .from("assessments")
          .select("*")
          .eq("job_id", jobId)
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

        // Process questions: if IQ block is present, fetch/inject bank questions
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
        console.error("Failed to load candidate assessment:", err.message);
        toast.error("You do not have a pending assessment for this role.");
        navigate("/applications");
      } finally {
        setLoading(false);
      }
    }
    loadAssessmentFlow();
  }, [jobId, user]);

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

  // Handle IQ countdown ticking
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
            // Auto submit / advance when time runs out
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

  const handleEmailDesktopLink = async () => {
    if (!user) return;
    try {
      // Create token
      const token = crypto.randomUUID().substring(0, 8);
      await supabase.from("assessment_tokens").insert([{
        assessment_id: assessment.id,
        application_id: application.id,
        token: token,
        expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
      }]);

      const { data: profile } = await supabase.from("profiles").select("email, full_name").eq("id", user.id).single();

      await supabase.functions.invoke("send-email", {
        body: {
          type: "assessment_invitation",
          email: profile?.email || user.email,
          fullName: profile?.full_name || "Candidate",
          jobTitle: assessment.name,
          companyName: "TalentHub Employer",
          token: token,
        },
      });

      toast.success("Desktop link sent to your email!");
    } catch (err: any) {
      toast.error("Failed to send email link.");
    }
  };

  // Video recording logic
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
      toast.error("Camera access denied. Please allow camera and mic permissions.");
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
          // Actually start recording
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

  // Video recording timer
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

    // Save answer
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
      setLoading(true);
      try {
        // Upload video response
        const filePath = `${assessment.id}/${application.id}_${currentQ.id}.webm`;
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
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    }

    setAnswers((prev) => ({ ...prev, [currentQ.id]: candidateAnswer }));

    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex((idx) => idx + 1);
      // Reset re-record attempts for next video question
      setVideoAttemptsLeft(2);
    } else {
      // Completed last question! Submit assessment
      await handleSubmitAssessment({ ...answers, [currentQ.id]: candidateAnswer });
    }
  };

  const handleSubmitAssessment = async (finalAnswers: Record<string, any>) => {
    try {
      setLoading(true);

      // 1. Calculate Score for objective questions (MC & IQ)
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
          application_id: application.id,
          answers: finalAnswers,
          score: finalScore,
          completed_at: new Date().toISOString(),
          time_taken_seconds: timeTaken,
        },
      ]);

      if (respErr) throw respErr;

      // 3. Update application status
      await supabase
        .from("applications")
        .update({ status: "reviewing" }) // Candidate completed assessment, moves to reviewing
        .eq("id", application.id);

      // Refresh application tracker
      await refresh();

      setStep("success");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit assessment.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#0a0c10] text-[#e5e7eb]">
        <RefreshCw className="w-8 h-8 text-primary animate-spin mb-4" />
        <span className="text-xs text-muted-foreground">Preparing evaluation environment...</span>
      </div>
    );
  }

  // Success view (Teemane Mascot celebration)
  if (step === "success") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6 bg-[#0a0c10]">
        <div className="w-48 h-48 mx-auto relative">
          <img src={mascotTransparent} alt="Teemane mascot" className="w-full h-full object-contain animate-bounce" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight">Assessment Completed!</h2>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Teemane is celebrating! Your assessment has been securely submitted to the company's recruitment portal. Your Application Tracker has been updated.
          </p>
        </div>
        <Button
          onClick={() => {
            navigate("/applications");
          }}
          className="w-full max-w-xs bg-primary hover:bg-primary/95 text-primary-foreground h-11 rounded-xl text-xs font-bold"
        >
          Return to Tracker
        </Button>
      </div>
    );
  }

  const currentQ = questions[currentQIndex];

  // Intro welcome slide
  if (step === "intro") {
    return (
      <div className="flex-1 flex flex-col justify-between p-6 bg-[#0a0c10] text-white">
        <div className="space-y-6 pt-8">
          <div className="w-12 h-12 bg-primary/10 border border-primary/20 text-primary rounded-xl flex items-center justify-center">
            <Brain className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">{assessment?.name}</h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              You are invited to complete this evaluation for the job posting. It contains {questions.length} questions.
            </p>
          </div>

          <div className="bg-[#111318] border border-white/5 rounded-2xl p-4 space-y-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-primary" />
              <span>
                Timing model: {assessment?.is_live_timed ? "Live timed session (must complete in one sitting)" : "Self-paced"}
              </span>
            </div>
            {assessment?.deadline_days && (
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-primary" />
                <span>Completion Deadline: {assessment.deadline_days} days</span>
              </div>
            )}
          </div>

          {/* Desktop nudge choice */}
          <div className="border border-white/5 bg-[#111318]/50 p-4 rounded-2xl space-y-2">
            <div className="flex items-start gap-2.5">
              <Monitor className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-semibold text-white">Rather take this on a computer?</p>
                <p className="text-muted-foreground mt-0.5">
                  If you prefer a larger screen or external webcam, we can send you a secure link to open on your desktop browser.
                </p>
              </div>
            </div>
            <Button
              onClick={handleEmailDesktopLink}
              variant="outline"
              type="button"
              className="w-full border-white/10 text-white hover:bg-white/5 h-9 rounded-xl text-xs"
            >
              Email Me Desktop Link
            </Button>
          </div>
        </div>

        <Button
          onClick={handleStart}
          className="w-full bg-primary hover:bg-primary/95 text-primary-foreground h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-1"
        >
          Begin Evaluation <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  // Active Questions layout
  return (
    <div className="flex-1 flex flex-col justify-between bg-[#0a0c10] text-white p-6 min-h-screen">
      {/* Top progress bar */}
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

      {/* Main Question Body */}
      <div className="flex-1 flex flex-col justify-center py-8">
        <h2 className="text-lg font-bold text-white leading-snug mb-6">
          {currentQ.question_text}
        </h2>

        {/* Render Written question */}
        {currentQ.question_type === "text" && (
          <div className="space-y-2">
            <Textarea
              value={writtenAnswer}
              onChange={(e) => setWrittenAnswer(e.target.value)}
              placeholder="Type your response here..."
              maxLength={2000}
              className="min-h-[180px] bg-[#111318] border-white/10 text-white rounded-2xl text-xs placeholder:text-zinc-500"
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {writtenAnswer.length} / 2000 characters
            </p>
          </div>
        )}

        {/* Render Multiple Choice (MCQ or IQ block subquestion) */}
        {(currentQ.question_type === "multiple_choice" || currentQ.question_type === "iq_question") && (
          <div className="space-y-3">
            {currentQ.options?.map((opt: string) => (
              <button
                key={opt}
                onClick={() => setAnswers({ ...answers, [currentQ.id]: opt })}
                className={`w-full h-12 px-4 rounded-xl border text-xs text-left font-medium transition-all flex items-center justify-between ${
                  answers[currentQ.id] === opt
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-white/5 bg-[#111318]/50 hover:bg-white/5 text-white/85"
                }`}
              >
                <span>{opt}</span>
                {answers[currentQ.id] === opt && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        )}

        {/* Render Video Camera Recording */}
        {currentQ.question_type === "video" && (
          <div className="space-y-4">
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-zinc-950 border border-white/5 flex items-center justify-center">
              {!cameraStream && !videoUrl && (
                <div className="text-center p-6 space-y-3">
                  <Camera className="w-10 h-10 text-muted-foreground mx-auto" />
                  <p className="text-xs text-muted-foreground">Click below to activate camera and record your response.</p>
                  <Button
                    onClick={startCamera}
                    size="sm"
                    className="bg-primary/20 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground text-xs rounded-xl"
                  >
                    Activate Camera
                  </Button>
                </div>
              )}

              {/* Live Preview / Playback */}
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

              {/* Countdown overlay */}
              {countdown > 0 && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                  <span className="text-5xl font-bold text-primary animate-ping">{countdown}</span>
                </div>
              )}

              {/* Recording indicator */}
              {isRecording && (
                <div className="absolute top-4 left-4 bg-red-600/90 text-white font-bold text-[9px] px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  REC ({recordingTimeLeft}s)
                </div>
              )}
            </div>

            {/* Camera controls */}
            {cameraStream && !isRecording && !videoUrl && (
              <Button
                onClick={startVideoRecording}
                className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs h-10 font-bold"
              >
                Start Recording
              </Button>
            )}

            {isRecording && (
              <Button
                onClick={stopVideoRecording}
                className="w-full bg-zinc-700 hover:bg-zinc-800 text-white rounded-xl text-xs h-10 font-bold"
              >
                Stop Recording
              </Button>
            )}

            {/* Video preview / re-record */}
            {videoUrl && (
              <div className="flex gap-3 text-xs">
                <Button
                  onClick={handleReRecord}
                  disabled={videoAttemptsLeft <= 1}
                  variant="outline"
                  className="flex-1 border-white/10 text-white hover:bg-white/5 rounded-xl h-10 text-xs disabled:opacity-50"
                >
                  Re-record ({videoAttemptsLeft - 1} left)
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer next button */}
      <Button
        onClick={handleNextQuestion}
        disabled={
          (currentQ.question_type === "text" && !writtenAnswer.trim()) ||
          (currentQ.question_type === "multiple_choice" && !answers[currentQ.id]) ||
          (currentQ.question_type === "iq_question" && !answers[currentQ.id] && iqTimeLeft > 0) ||
          (currentQ.question_type === "video" && !videoUrl)
        }
        className="w-full bg-primary hover:bg-primary/95 text-primary-foreground h-12 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
      >
        {currentQIndex < questions.length - 1 ? "Next Question" : "Submit Assessment"}
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
