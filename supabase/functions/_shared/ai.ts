export async function callAIWithFallback(payload: any) {
  const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
  const GROQ_KEY = Deno.env.get("GROQ_API_KEY");

  if (!GEMINI_KEY && !GROQ_KEY) {
    throw new Error("No AI API keys configured. Please set GEMINI_API_KEY or GROQ_API_KEY.");
  }

  // Ensure tool_calls structure is strictly compatible across both endpoints if tools are provided
  let geminiPayload = { ...payload, model: "gemini-2.5-flash" };
  let groqPayload = { ...payload, model: "llama-3.3-70b-versatile" };

  // Try Gemini first
  if (GEMINI_KEY) {
    try {
      const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GEMINI_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(geminiPayload)
      });
      if (resp.ok) return resp;
      
      const errorText = await resp.text();
      console.warn(`Gemini failed with status ${resp.status}:`, errorText);
    } catch (e) {
      console.warn("Gemini network error:", e);
    }
  }

  // Fallback to Groq if Gemini failed or isn't configured
  if (GROQ_KEY) {
    console.log("Falling back to Groq API...");
    return await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(groqPayload)
    });
  }

  // If we reach here, Gemini failed and Groq isn't configured
  throw new Error("Gemini API failed and no Groq API key is configured for fallback.");
}
