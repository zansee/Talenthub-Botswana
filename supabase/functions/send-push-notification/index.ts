import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ONESIGNAL_APP_ID = "65e7fb40-66af-4043-956a-e06c0d4c7a3c";
const ONESIGNAL_REST_KEY = "4mxm7by6ue5hnoxsrxj16bbfq";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("[OneSignal Push] Received payload:", JSON.stringify(payload));

    // Extract row details from Supabase webhook structure
    const record = payload.record;
    if (!record) {
      return new Response(JSON.stringify({ error: "Missing payload record" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, title, body, type, job_id } = record;

    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: "Missing user_id or title in notification row" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine deep-link redirect target page based on notification type
    let targetLink = "/";
    if (type === "new_match" && job_id) {
      targetLink = `/review/${job_id}`;
    } else if (type === "draft_reminder" && job_id) {
      targetLink = `/review/${job_id}`;
    } else if (type === "prep" || type === "interview_prep") {
      targetLink = "/delivered-services";
    } else if (type === "docs_requested" || type === "revamp_status" || type === "revamp") {
      targetLink = "/cv-revamp";
    } else if (type === "application" || type === "job") {
      targetLink = "/applications";
    } else if (type === "cv_request") {
      targetLink = "/profile";
    } else if (type === "cv_approved") {
      targetLink = "/employer";
    }

    // Call OneSignal REST API
    const osResponse = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Key ${ONESIGNAL_REST_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_aliases: {
          external_id: [user_id],
        },
        target_channel: "push",
        headings: { en: title },
        contents: { en: body || "You have a new update in TalentHub" },
        data: { link: targetLink, type },
      }),
    });

    const osData = await osResponse.json();
    console.log("[OneSignal Push] Response status:", osResponse.status, "Data:", osData);

    return new Response(JSON.stringify({ success: true, response: osData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[OneSignal Push] Error occurred:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
