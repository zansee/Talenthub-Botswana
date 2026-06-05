import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAIWithFallback } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { companyName, industry, logoUrl, brandColors, sampleImageBase64, sampleImageUrl } = body;

    if (!companyName) {
      return json({ error: "Company name is required" }, 400);
    }

    // System prompt instructing the model to suggest a cohesive style recipe
    // System prompt instructing the model to suggest a cohesive style recipe
    const systemPrompt = `You are a professional brand designer.
Analyze the company profile, optional logo, optional branding colors, and optional style sample post image.
Generate a structured, modern visual brand style recipe.
IMPORTANT: Pay close attention to the uploaded style sample post's background and layout style.
If the style sample post uses a light background (e.g. white or light grey), set the secondaryColor to a light color (e.g. '#FFFFFF' or '#F9FAFB').
If the style sample post uses a dark background, set the secondaryColor to a dark color.
Suggest cohesive brand colors (primary, secondary, accent), typography (Google Fonts), and layout settings for high-converting social media job graphics.`;

    // Try multimodal first (Gemini supports image payloads)
    let aiResp: Response;
    try {
      const userContent: any[] = [
        {
          type: "text",
          text: `Generate a brand style recipe for:
Company: ${companyName}
Industry: ${industry || "Technology"}
Colors Provided: ${brandColors ? brandColors.join(", ") : "None"}
Logo URL: ${logoUrl || "None"}`
        }
      ];

      // If sample image url exists, fetch it and convert to base64 so Gemini's OpenAI layer can process it
      if (sampleImageUrl) {
        try {
          const imgResp = await fetch(sampleImageUrl);
          if (imgResp.ok) {
            const arrayBuffer = await imgResp.arrayBuffer();
            const uint8 = new Uint8Array(arrayBuffer);
            let binary = "";
            const len = uint8.byteLength;
            for (let i = 0; i < len; i++) {
              binary += String.fromCharCode(uint8[i]);
            }
            const base64 = btoa(binary);
            const contentType = imgResp.headers.get("Content-Type") || "image/jpeg";
            userContent.push({
              type: "image_url",
              image_url: {
                url: `data:${contentType};base64,${base64}`
              }
            });
            console.log("Successfully fetched and converted remote image to base64 data URL for Gemini");
          } else {
            console.warn(`Failed to fetch sampleImageUrl: status ${imgResp.status}`);
          }
        } catch (fetchErr) {
          console.warn("Error converting remote image to base64:", fetchErr);
        }
      } else if (sampleImageBase64) {
        // base64 format should be e.g. "data:image/jpeg;base64,..."
        userContent.push({
          type: "image_url",
          image_url: {
            url: sampleImageBase64
          }
        });
      }

      const payload = {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_brand_style",
            description: "Save the generated corporate brand style recipe.",
            parameters: {
              type: "object",
              properties: {
                primaryColor: { type: "string", description: "Primary brand color (hex format, e.g., '#10B981')" },
                secondaryColor: { type: "string", description: "Secondary background/canvas color (hex format). If the uploaded style sample has a light/white background, this MUST be a light color (like '#FFFFFF' or '#F9FAFB'). If the sample has a dark background, this should be dark (like '#0D1117' or '#1A1A1A')." },
                accentColor: { type: "string", description: "Accent/callout color (hex format, e.g., '#3B82F6')" },
                fontTitle: { type: "string", description: "Google Font family for headers (e.g., 'Outfit', 'Montserrat', 'Poppins', 'Playfair Display')" },
                fontBody: { type: "string", description: "Google Font family for body text (e.g., 'Inter', 'Open Sans', 'Roboto')" },
                layoutTheme: { type: "string", enum: ["minimalist", "bold", "geometric", "corporate", "elegant"], description: "Layout theme style. Select 'corporate' if the style sample has a clear structured document layout (like two columns, banner headers), 'minimalist' for clean/spacious layouts, 'bold' for loud color block layouts." },
                textPosition: { type: "string", enum: ["center", "left", "bottom", "right"] },
                visualStyle: { type: "string", description: "Short creative summary of visual style (e.g., 'Sleek dark mode glassmorphism with high contrast typography' or 'Red top header banner with white background and dark text')" }
              },
              required: ["primaryColor", "secondaryColor", "accentColor", "fontTitle", "fontBody", "layoutTheme", "textPosition", "visualStyle"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "save_brand_style" } }
      };

      aiResp = await callAIWithFallback(payload);
    } catch (visionErr) {
      console.warn("Multimodal request failed, falling back to text-only:", visionErr);
      
      // Text-only fallback (for models like Groq or if vision model limits are hit)
      const textOnlyPayload = {
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Generate a brand style recipe for:
Company: ${companyName}
Industry: ${industry || "Technology"}
Colors Provided: ${brandColors ? brandColors.join(", ") : "None"}
(Ignore sample image as text-only processing is active)`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_brand_style",
            description: "Save the generated corporate brand style recipe.",
            parameters: {
              type: "object",
              properties: {
                primaryColor: { type: "string" },
                secondaryColor: { type: "string" },
                accentColor: { type: "string" },
                fontTitle: { type: "string" },
                fontBody: { type: "string" },
                layoutTheme: { type: "string", enum: ["minimalist", "bold", "geometric", "corporate", "elegant"] },
                textPosition: { type: "string", enum: ["center", "left", "bottom", "right"] },
                visualStyle: { type: "string" }
              },
              required: ["primaryColor", "secondaryColor", "accentColor", "fontTitle", "fontBody", "layoutTheme", "textPosition", "visualStyle"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "save_brand_style" } }
      };

      aiResp = await callAIWithFallback(textOnlyPayload);
    }

    if (!aiResp.ok) {
      return json({ error: `AI request failed with status ${aiResp.status}` }, 500);
    }

    const aiData = await aiResp.json();
    const args = aiData?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) {
      return json({ error: "No structured brand style generated by AI" }, 500);
    }

    const recipe = JSON.parse(args);
    return json({ recipe });
  } catch (e) {
    console.error("generate-brand-style error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
