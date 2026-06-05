import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAIWithFallback } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json();
    const { action, prompt, history, context, jobDetails } = payload;

    console.log(`[AI Agent] Action: ${action}`);

    if (action === "suggest_pre_screening") {
      const { title, description, skills } = jobDetails || {};
      const aiPrompt = `
        You are an expert HR recruitment specialist. Generate 10 relevant pre-screening interview questions for a job listing with the details:
        Job Title: ${title || "Software Engineer"}
        Description: ${description || "Building modern web applications."}
        Required Skills: ${skills || "React, TypeScript, database schema design"}

        Pre-screening questions are asked during the initial application. Provide a mix of types:
        - "yes_no" (simple eligibility checks, e.g. "Are you legally allowed to work in Botswana?")
        - "multiple_choice" (up to 6 options, e.g. "What is your primary programming language?")
        - "rating" (scale 1 to 5, e.g. "Rate your experience with SQL")
        - "short_text" (concise answers, e.g. "What is your notice period?")
        - "long_text" (qualitative answers, e.g. "Describe a project you worked on.")

        You must format the response as a valid JSON array of objects. Do not wrap the JSON in markdown code blocks like \`\`\`json. Each object must have:
        1. "question_text" (string)
        2. "question_type" (string: 'yes_no', 'multiple_choice', 'rating', 'short_text', 'long_text')
        3. "options" (array of strings, only for 'multiple_choice', max 6 options, null for others)
        4. "is_required" (boolean)
        5. "is_disqualifying" (boolean)
        6. "correct_answer" (string matching correct/acceptable value, e.g. 'Yes' for yes/no, or option value, or minimum rating '3' or '4' for rating scale. Null for text types)
      `;

      const aiPayload = {
        messages: [
          { role: "system", content: "You output strictly raw JSON matching the requested structure. Never add headers, formatting, or commentary." },
          { role: "user", content: aiPrompt }
        ]
      };

      const resp = await callAIWithFallback(aiPayload);
      if (!resp.ok) throw new Error("AI suggestion request failed");

      const rawText = await resp.text();
      let cleanJson = "";
      try {
        const parsed = JSON.parse(rawText);
        cleanJson = JSON.stringify(parsed?.choices?.[0]?.message?.content || parsed);
      } catch {
        // Fallback cleaning of content text
        const match = rawText.match(/\[[\s\S]*\]/);
        cleanJson = match ? match[0] : rawText;
      }

      // Try to parse the inner message
      let jsonObject = JSON.parse(cleanJson);
      if (typeof jsonObject === "string") {
        jsonObject = JSON.parse(jsonObject);
      }

      return new Response(JSON.stringify({ questions: jsonObject }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate_iq_questions") {
      const { difficulty, count } = payload;
      const aiPrompt = `
        Create an IQ and cognitive aptitude test block with ${count || 10} questions.
        Difficulty level: ${difficulty || "mid"} (entry, mid, senior).
        The questions must cover a mix of:
        - Logical reasoning (pattern completion, logic grids)
        - Numerical reasoning (sequence math, percentage word problems)
        - Verbal reasoning (synonyms/antonyms, word analogy, logical fill-in)

        Each question must have an individual time limit in seconds:
        - Logical: 45 to 60 seconds
        - Numerical: 60 to 90 seconds
        - Verbal: 30 to 45 seconds

        Format the response as a valid JSON array of objects. Do not wrap the JSON in markdown code blocks. Each object must have:
        1. "category" (string: 'logical', 'numerical', 'verbal')
        2. "question_text" (string)
        3. "options" (array of strings, exactly 4 options)
        4. "correct_option_index" (integer 0, 1, 2, or 3)
        5. "time_limit_seconds" (integer)
        6. "difficulty" (string matching the input difficulty)
      `;

      const aiPayload = {
        messages: [
          { role: "system", content: "You output strictly raw JSON matching the requested structure. Never add headers, formatting, or commentary." },
          { role: "user", content: aiPrompt }
        ]
      };

      const resp = await callAIWithFallback(aiPayload);
      if (!resp.ok) throw new Error("AI IQ generation request failed");

      const rawText = await resp.text();
      let cleanJson = "";
      try {
        const parsed = JSON.parse(rawText);
        cleanJson = JSON.stringify(parsed?.choices?.[0]?.message?.content || parsed);
      } catch {
        const match = rawText.match(/\[[\s\S]*\]/);
        cleanJson = match ? match[0] : rawText;
      }

      let jsonObject = JSON.parse(cleanJson);
      if (typeof jsonObject === "string") {
        jsonObject = JSON.parse(jsonObject);
      }

      return new Response(JSON.stringify({ questions: jsonObject }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default chat & actions parsing action
    const aiSystemPrompt = `
      Your name is Teemane. You are the AI mascot and corporate recruitment assistant for TalentHub Botswana. The user is a recruiter or hiring manager (do NOT call the user Teemane).

      Company Portal Current Context:
      - Active Company: ${context?.companyName || "Unknown"}
      - Open Jobs: ${JSON.stringify(context?.jobs || [])}
      - Candidate Applications (starred status, current stage): ${JSON.stringify(context?.candidates || [])}
      - Recruiters/Team Members: ${JSON.stringify(context?.team || [])}
      - Recent Activity: ${JSON.stringify(context?.activity || [])}

      Recruiter prompt: "${prompt}"

      Identify if the recruiter wants you to perform an action. You can recognize these actions:
      1. post_job: Given details like title, description, skills.
      2. move_candidate: Update an applicant's stage. Targets: Applied, Reviewed, Shortlisted, Assessment Sent, Interview, Offer, Rejected. Need candidate name/ID. Try to find candidateId and isExternal from the candidate list in context.
      3. send_assessment: Send assessment to candidate name/ID. Try to find candidateId and isExternal from context.
      4. filter_summarize: Filter and summarize applications for a job.
      5. generate_report: Draw summary report of applicants for a job.
      6. draft_notification: Draft shortlist or rejection notification message for a candidate.
      7. create_prescreening: Create list of pre-screening questions for a job.
      8. move_candidates_batch: Update multiple applicants' stages under a job vacancy. Details must include:
         - jobTitle: The job vacancy title (e.g. "Software Engineer").
         - stage: Target stage (Applied, Reviewed, Shortlisted, Assessment Sent, Interview, Offer, Rejected).
         - criteria: "starred" (move all starred candidates), "stage" (move all candidates from a certain stage, e.g. "move all reviewing to interview"), or "named_list" (move specific candidate names, e.g. "move Zandile and John").
         - fromStage: (only if criteria is "stage", e.g. "Reviewing").
         - candidateNames: (only if criteria is "named_list", e.g. ["Zandile B.", "John D."]).

      If they want to perform one of these actions, you MUST return a response containing a JSON block with the action details so the frontend can display a confirmation card.
      If they are just asking a question (Q&A), reply normally in markdown. Highlight key points. Keep replies professional, friendly, and helpful. Mention Teemane when suitable.

      If an action is detected, prefix the action structure in your JSON output.
      
      For "post_job", you MUST generate the actual, professional, multi-paragraph job description (detailing key responsibilities, requirements, and duties) in the details.description field (do NOT put short conversational summaries there). Additionally, always draft 2 to 4 relevant pre-screening questions inside details.pre_screening array. Each question object must have:
      - question_text (string)
      - question_type (string: 'yes_no', 'multiple_choice', 'rating', 'short_text', 'long_text')
      - options (array of strings, only for multiple_choice, else null)
      - is_required (boolean)
      - is_disqualifying (boolean)
      - correct_answer (string matching correct/acceptable value, e.g. 'Yes' for yes/no, or option value, or minimum rating '3' or '4' for rating scale. Null for text types)

      Example JSON for post_job:
      {
        "action": {
          "type": "post_job",
          "details": {
            "title": "Procurement Officer",
            "description": "We are seeking a detail-oriented Procurement Officer to manage our company's purchasing processes. You will research vendors, negotiate contracts, and ensure we acquire high-quality goods at competitive prices.\n\nKey Responsibilities:\n- Source and evaluate potential suppliers and vendors.\n- Negotiate pricing, terms, and delivery schedules.\n- Maintain accurate procurement records and inventory logs.",
            "skills": "Sourcing, Contract Negotiation, Supply Chain, Inventory Management",
            "location": "Gaborone, Botswana",
            "industry": "Supply Chain & Logistics",
            "employment_type": "Full-time",
            "salary_range": "BWP 15,000 - 20,000",
            "required_years_experience": "3",
            "required_qualification": "Bachelor's Degree in Logistics or related field",
            "pre_screening": [
              {
                "question_text": "Do you have at least 3 years of experience in procurement?",
                "question_type": "yes_no",
                "is_required": true,
                "is_disqualifying": true,
                "correct_answer": "Yes"
              },
              {
                "question_text": "Rate your negotiation skills from 1 to 5.",
                "question_type": "rating",
                "is_required": true,
                "is_disqualifying": false,
                "correct_answer": "4"
              }
            ]
          },
          "description": "Post new job listing for Procurement Officer with pre-screening questions"
        },
        "response": "I have drafted the job listing and pre-screening questions. Please confirm the action below to review it."
      }

      Example JSON for move_candidate:
      {
        "action": {
          "type": "move_candidate", 
          "details": { "candidateName": "John D.", "candidateId": "uuid", "stage": "Interview", "isExternal": false },
          "description": "Move John D. to the Interview stage"
        },
        "response": "Sure, I can help with that. Please confirm the action below."
      }

      Example JSON for batch actions:
      {
        "action": {
          "type": "move_candidates_batch",
          "details": {
            "jobTitle": "Software Engineer",
            "stage": "Interview",
            "criteria": "starred"
          },
          "description": "Move all starred candidates for Software Engineer to the Interview stage"
        },
        "response": "I will move all starred candidates for Software Engineer to the Interview stage. Please confirm below."
      }
    `;

    const chatHistory = history || [];
    const messages = [
      { role: "system", content: aiSystemPrompt },
      ...chatHistory,
      { role: "user", content: prompt }
    ];

    const resp = await callAIWithFallback({ messages });
    if (!resp.ok) throw new Error("AI chat request failed");

    const data = await resp.json();
    const contentText = data?.choices?.[0]?.message?.content || "";

    // Parse if it contains structured action JSON
    let result = { response: contentText, action: null };
    try {
      const match = contentText.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.action && parsed.response) {
          result = parsed;
        }
      }
    } catch {
      // Return as text
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("ai-agent error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
