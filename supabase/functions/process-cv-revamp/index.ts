import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Minimal PDF text extractor
function extractPdfText(bytes: Uint8Array): string {
  const text = new TextDecoder("latin1").decode(bytes);
  const out: string[] = [];
  const re = /\(([^)]*)\)\s*Tj|\[([^\]]*)\]\s*TJ/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1] ?? m[2] ?? "";
    const cleaned = raw
      .replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
      .replace(/\\([nrtbf()\\])/g, (_, c) => ({ n: "\n", r: "\r", t: "\t", b: "", f: "", "(": "(", ")": ")", "\\": "\\" }[c] ?? c))
      .replace(/\)\s*-?\d+(\.\d+)?\s*\(/g, "")
      .replace(/[()]/g, "");
    if (cleaned.trim()) out.push(cleaned);
  }
  return out.join(" ");
}

async function extractText(buf: Uint8Array, filename: string): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") {
    return extractPdfText(buf);
  } else {
    return new TextDecoder("utf-8", { fatal: false }).decode(buf).replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");
  }
}

function base64Encode(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function callQwen(model: string, messages: any[], responseFormat?: any) {
  const apiKey = Deno.env.get("QWEN_API_KEY");
  if (!apiKey) throw new Error("QWEN_API_KEY is not configured.");

  const payload: any = {
    model,
    messages,
  };
  if (responseFormat) {
    payload.response_format = responseFormat;
  }

  const response = await fetch("https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Qwen API error: ${response.status}`, errorText);
    throw new Error(`Qwen API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

async function extractImageText(buf: Uint8Array, filename: string, mimeType: string): Promise<string> {
  const b64 = base64Encode(buf);
  const prompt = "Extract the qualification name, institution, date, and any relevant details visible in this document/image. Return ONLY a concise text summary of what you found.";
  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${b64}` } }
      ]
    }
  ];
  try {
    return await callQwen("qwen-max", messages);
  } catch (err) {
    console.error(`Failed to extract text from image ${filename}:`, err);
    return `[Image file: ${filename} - extraction failed]`;
  }
}

function cleanAndParseJson(text: string) {
  const clean = text.replace(/```json|```/g, "").trim();
  const match = clean.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : clean);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json();
    const record = body?.record;
    if (!record?.id) {
      return new Response(JSON.stringify({ error: "Missing record ID" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const revampId = record.id;
    const userId = record.user_id;

    // 1. Set status to ai_processing and debate_step to 1 (starting)
    await admin.from("revamp_requests").update({
      fulfilment_status: "ai_processing",
      ai_debate_step: 1
    } as any).eq("id", revampId);

    // Fetch full request details to make sure we have latest paths
    const { data: requestDetails, error: reqErr } = await admin
      .from("revamp_requests")
      .select("*")
      .eq("id", revampId)
      .single();

    if (reqErr || !requestDetails) throw new Error("Could not fetch revamp request details");

    const cv_path = requestDetails.cv_path;
    const attachment_paths = requestDetails.attachment_paths || [];

    // 2. Fetch candidate profile metadata
    const { data: profile } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
    const userMetadataContext = `
Candidate Profile Information:
Full Name: ${profile?.full_name || "N/A"}
Email: ${profile?.email || "N/A"}
Phone: ${profile?.phone || "N/A"}
Location: ${profile?.current_location || "N/A"}
Current Job Title: ${profile?.current_job_title || "N/A"}
Manual Skills: ${(profile?.skills ?? []).join(", ")}
Years of Experience: ${profile?.years_experience || "N/A"}
`;

    // 3. Download and extract original CV
    let cvText = "";
    if (cv_path) {
      const { data: fileData, error: cvErr } = await admin.storage.from("revamp-documents").download(cv_path);
      if (cvErr || !fileData) {
        console.warn("Could not download original CV", cvErr);
      } else {
        const buf = new Uint8Array(await fileData.arrayBuffer());
        cvText = await extractText(buf, cv_path);
      }
    }

    if (!cvText.trim()) {
      cvText = "(Original CV is empty or text could not be extracted)";
    }

    // 4. Download and extract supporting documents
    let extractedDocsContext = "";
    const documentsReferenced: string[] = [];

    if (attachment_paths && attachment_paths.length > 0) {
      for (const path of attachment_paths) {
        const filename = path.split("/").pop() || "document";
        const ext = filename.split(".").pop()?.toLowerCase() || "";
        const isImage = ["png", "jpg", "jpeg"].includes(ext);
        const mimeType = isImage ? `image/${ext === "jpg" ? "jpeg" : ext}` : "application/octet-stream";

        try {
          const { data: fileData, error: dlErr } = await admin.storage.from("revamp-documents").download(path);
          if (dlErr || !fileData) {
            console.warn(`Could not download document ${path}`, dlErr);
            continue;
          }
          const buf = new Uint8Array(await fileData.arrayBuffer());
          let text = "";
          if (isImage) {
            text = await extractImageText(buf, filename, mimeType);
          } else {
            text = await extractText(buf, filename);
          }

          let docType = "Supporting Document";
          if (path.includes("/academic/")) docType = "Academic Certificate";
          else if (path.includes("/certifications/")) docType = "Professional Certification";
          else if (path.includes("/licenses/")) docType = "Professional Licence";
          else if (path.includes("/references/")) docType = "Reference / ID / License";

          extractedDocsContext += `\n\n--- Document: ${docType} (${filename}) ---\n${text}`;
          documentsReferenced.push(`${docType} · ${filename}: ${text.slice(0, 150).trim()}...`);
        } catch (err) {
          console.warn(`Error parsing supporting document ${path}:`, err);
        }
      }
    }

    if (!extractedDocsContext.trim()) {
      extractedDocsContext = "(No supporting documents uploaded)";
    }

    // Initialize debate variables
    let rewrittenCv = "";
    let finalConsensusScore = 0;
    let roundsNeeded = 0;
    const debateRounds: any[] = [];
    let changesMade: string[] = [];
    let resolvedDisagreements: string[] = [];
    let aiSummaryComment = "";
    let missingDocsDetected: string[] = [];

    // Loop logic - Up to 3 attempts
    for (let attempt = 1; attempt <= 3; attempt++) {
      roundsNeeded = attempt;

      // ── ROUND 1 ──
      // Update step indicator to Step 2 (ATS Review) and Step 3 (Quality Review)
      await admin.from("revamp_requests").update({ ai_debate_step: 2 } as any).eq("id", revampId);

      const qwenMaxSystemPrompt = `You are a strict ATS compliance expert. Review this CV and score it from 0 to 100 based purely on ATS compatibility. Check for keyword presence relevant to the candidate's industry, clean formatting with no tables or graphics, measurable achievements, complete contact information, no unexplained gaps, appropriate section headings. Return a JSON object with:
{
  "overall_score": <number 0-100>,
  "issues": [{"category": "string", "severity": "high"|"medium"|"low", "description": "string", "recommendation": "string"}],
  "keyword_gaps": ["string"]
}`;

      const qwenPlusSystemPrompt = `You are a professional CV writing expert reviewing for human readability and impact. Review this CV and score it from 0 to 100 based on writing quality, professional tone, narrative coherence, impact of language and whether it would impress a human recruiter. Return a JSON object with:
{
  "overall_score": <number 0-100>,
  "issues": [{"category": "string", "severity": "high"|"medium"|"low", "description": "string", "recommendation": "string"}],
  "strengths": ["string"]
}`;

      const [maxRound1Raw, plusRound1Raw] = await Promise.all([
        callQwen("qwen-max", [
          { role: "system", content: qwenMaxSystemPrompt },
          { role: "user", content: `Here is the candidate profile metadata:\n${userMetadataContext}\n\nHere is the original CV:\n${cvText}\n\nHere are the supporting documents:\n${extractedDocsContext}` }
        ], { type: "json_object" }),
        callQwen("qwen-plus", [
          { role: "system", content: qwenPlusSystemPrompt },
          { role: "user", content: `Here is the candidate profile metadata:\n${userMetadataContext}\n\nHere is the original CV:\n${cvText}\n\nHere are the supporting documents:\n${extractedDocsContext}` }
        ], { type: "json_object" })
      ]);

      const cleanMaxRound1 = cleanAndParseJson(maxRound1Raw);
      const cleanPlusRound1 = cleanAndParseJson(plusRound1Raw);

      // ── ROUND 2: DEBATE ──
      // Update step indicator to Step 4 (Debate comparing notes)
      await admin.from("revamp_requests").update({ ai_debate_step: 4 } as any).eq("id", revampId);

      const qwenMaxDebatePrompt = `You are a strict ATS compliance expert. You are debating another reviewer (human recruiter expert) on this candidate's CV. Read the other expert's review and decide if you agree or disagree with their assessment. Does seeing their review change your score? Return a JSON object with:
{
  "overall_score": <adjusted score 0-100>,
  "issues": [{"category": "string", "severity": "high"|"medium"|"low", "description": "string", "recommendation": "string"}],
  "keyword_gaps": ["string"],
  "disagreements": ["specific points where you strongly differ from the other expert's view"]
}`;

      const qwenPlusDebatePrompt = `You are a professional recruiter CV writing expert. You are debating another reviewer (ATS expert) on this candidate's CV. Read the other expert's review and decide if you agree or disagree with their assessment. Does seeing their review change your score? Return a JSON object with:
{
  "overall_score": <adjusted score 0-100>,
  "issues": [{"category": "string", "severity": "high"|"medium"|"low", "description": "string", "recommendation": "string"}],
  "strengths": ["string"],
  "disagreements": ["specific points where you strongly differ from the other expert's view"]
}`;

      const [maxRound2Raw, plusRound2Raw] = await Promise.all([
        callQwen("qwen-max", [
          { role: "system", content: qwenMaxDebatePrompt },
          { role: "user", content: `Here is the original CV:\n${cvText}\n\nHere is your Round 1 review:\n${JSON.stringify(cleanMaxRound1)}\n\nHere is the other expert's Round 1 review:\n${JSON.stringify(cleanPlusRound1)}` }
        ], { type: "json_object" }),
        callQwen("qwen-plus", [
          { role: "system", content: qwenPlusDebatePrompt },
          { role: "user", content: `Here is the original CV:\n${cvText}\n\nHere is your Round 1 review:\n${JSON.stringify(cleanPlusRound1)}\n\nHere is the other expert's Round 1 review:\n${JSON.stringify(cleanMaxRound1)}` }
        ], { type: "json_object" })
      ]);

      const cleanMaxRound2 = cleanAndParseJson(maxRound2Raw);
      const cleanPlusRound2 = cleanAndParseJson(plusRound2Raw);

      // ── ROUND 3: ARBITRATION & REWRITE ──
      // Update step indicator to Step 5 (Senior writer crafting new CV)
      await admin.from("revamp_requests").update({ ai_debate_step: 5 } as any).eq("id", revampId);

      const qwenTurboSystemPrompt = `You are a senior CV writer and arbitrator. You have received two expert reviews of this CV (ATS compliance and recruiter quality). Synthesise their feedback, resolve disagreements, and rewrite the CV to a professional standard that satisfies both ATS requirements and human readability. Write it for the Botswana job market context. Preserve details, achievements, companies, and dates without sounding generic. Make sure the rewritten CV includes the candidate's name, email, phone and location from the profile metadata context. Return a JSON object with:
{
  "rewritten_cv": "the complete rewritten CV in markdown/plaintext format",
  "changes_made": ["string detail of what was changed and why"],
  "resolved_disagreements": ["string detail of how you resolved conflicts"],
  "ai_summary_comment": "a friendly summary comment explaining what you did for the partner to see",
  "missing_docs_detected": ["names of missing academic certificates, professional memberships/licences or references mentioned in the CV but missing from the uploaded files context"]
}`;

      const turboRound3Raw = await callQwen("qwen-turbo", [
        { role: "system", content: qwenTurboSystemPrompt },
        { role: "user", content: `Here is the candidate profile metadata:\n${userMetadataContext}\n\nHere is the original CV:\n${cvText}\n\nHere are the supporting documents:\n${extractedDocsContext}\n\nHere is Qwen-Max's final debate review:\n${JSON.stringify(cleanMaxRound2)}\n\nHere is Qwen-Plus's final debate review:\n${JSON.stringify(cleanPlusRound2)}` }
      ], { type: "json_object" });

      const cleanTurbo = cleanAndParseJson(turboRound3Raw);
      rewrittenCv = cleanTurbo.rewritten_cv;
      changesMade = cleanTurbo.changes_made || [];
      resolvedDisagreements = cleanTurbo.resolved_disagreements || [];
      aiSummaryComment = cleanTurbo.ai_summary_comment || "";
      missingDocsDetected = cleanTurbo.missing_docs_detected || [];

      // ── ROUND 4: RESCORE ──
      // Update step indicator to Step 6 (Final quality check)
      await admin.from("revamp_requests").update({ ai_debate_step: 6 } as any).eq("id", revampId);

      const [maxRound4Raw, plusRound4Raw] = await Promise.all([
        callQwen("qwen-max", [
          { role: "system", content: "You are a strict ATS compliance expert. Rescore this rewritten CV from 0 to 100 based purely on ATS compatibility. Return a JSON object with overall_score as a number." },
          { role: "user", content: `Here is the rewritten CV:\n${rewrittenCv}` }
        ], { type: "json_object" }),
        callQwen("qwen-plus", [
          { role: "system", content: "You are a professional CV writing expert. Rescore this rewritten CV from 0 to 100 based on narrative quality and human readability. Return a JSON object with overall_score as a number." },
          { role: "user", content: `Here is the rewritten CV:\n${rewrittenCv}` }
        ], { type: "json_object" })
      ]);

      const cleanMaxRound4 = cleanAndParseJson(maxRound4Raw);
      const cleanPlusRound4 = cleanAndParseJson(plusRound4Raw);

      finalConsensusScore = Math.round(((cleanMaxRound4.overall_score || 0) + (cleanPlusRound4.overall_score || 0)) / 2);

      debateRounds.push({
        attempt,
        max_round1: cleanMaxRound1,
        plus_round1: cleanPlusRound1,
        max_round2: cleanMaxRound2,
        plus_round2: cleanPlusRound2,
        max_rescore: cleanMaxRound4,
        plus_rescore: cleanPlusRound4,
        consensus_score: finalConsensusScore
      });

      console.log(`Debate attempt ${attempt} finished with consensus score: ${finalConsensusScore}`);

      // Threshold check
      if (finalConsensusScore >= 78) {
        break;
      }
    }

    // ── SAVE RESULTS TO DATABASE ──
    const debateReport = {
      rounds: debateRounds,
      changes_made: changesMade,
      resolved_disagreements: resolvedDisagreements,
      ai_summary_comment: aiSummaryComment,
      missing_docs_detected: missingDocsDetected,
      documents_referenced: documentsReferenced
    };

    // Upload raw AI-rewritten CV to revamp-documents bucket
    const textBytes = new TextEncoder().encode(rewrittenCv);
    const textPath = `${userId}/${revampId}/ai_rewritten.txt`;
    await admin.storage.from("revamp-documents").upload(textPath, textBytes, {
      contentType: "text/plain",
      upsert: true
    });

    // Update status to ai_complete, step to 7 (with coach/consultant), and write debate stats
    await admin.from("revamp_requests").update({
      fulfilment_status: "ai_complete",
      ai_debate_step: 7,
      ai_rewritten_cv: rewrittenCv,
      ai_consensus_score: finalConsensusScore,
      ai_debate_report: debateReport as any,
      rounds_needed: roundsNeeded,
      revamped_cv_path: textPath, // Use text file for edit references
      revamped_cv_filename: "AI_Rewritten_CV.txt"
    } as any).eq("id", revampId);

    // Notify assigned partner if any
    const partnerId = requestDetails.partner_notes; // Check if assigned? In our app, let's notify the system/partners
    await admin.from("notifications").insert({
      user_id: "admin", // Broadcast notification for partners
      title: "AI CV Revamp Complete",
      body: `AI CV revamp for request CVR-${revampId.substring(0, 4).toUpperCase()} is ready for coach review.`,
      type: "ai_complete"
    });

    return new Response(JSON.stringify({ success: true, finalConsensusScore }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e: any) {
    console.error("process-cv-revamp function error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "AI revamp failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
