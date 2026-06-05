import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  
  try {
    const { type, email, fullName, jobTitle, companyName, token, deadline } = await req.json();
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    console.log(`[Email Service Triggered] Type: ${type}, Recipient: ${email}`);

    let subject = "";
    let htmlContent = "";

    if (type === "application_confirmation") {
      subject = `Application Received: ${jobTitle} at ${companyName}`;
      htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #10b981;">TalentHub Botswana</h2>
          <p>Hi <strong>${fullName}</strong>,</p>
          <p>Your application for the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong> has been successfully received.</p>
          <p>Thank you for your interest! The company recruitment team will review your application and documents shortly.</p>
          <p style="margin-top: 30px; font-size: 12px; color: #888;">This is an automated confirmation from TalentHub Botswana.</p>
        </div>
      `;
    } else if (type === "assessment_invitation") {
      const referer = req.headers.get("referer") || "http://localhost:5173";
      // Ensure no double slashes when combining URL parts
      const link = `${referer.endsWith("/") ? referer.slice(0, -1) : referer}/assessment/${token}`;
      subject = `Action Required: Assessment for ${jobTitle} at ${companyName}`;
      htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #10b981;">TalentHub Botswana</h2>
          <p>Hi <strong>${fullName}</strong>,</p>
          <p><strong>${companyName}</strong> has invited you to complete an assessment for the <strong>${jobTitle}</strong> position.</p>
          <p>This is a secure assessment and does not require a TalentHub account to complete.</p>
          <div style="margin: 25px 0;">
            <a href="${link}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Start Assessment</a>
          </div>
          ${deadline ? `<p><strong>Deadline:</strong> ${new Date(deadline).toLocaleString()}</p>` : ""}
          <p style="font-size: 13px; color: #555;">If you are opening this on your phone, you can also copy the link below and paste it into a computer browser if you prefer a larger screen:</p>
          <p style="font-size: 11px; background-color: #f5f5f5; padding: 10px; border-radius: 5px; word-break: break-all;">${link}</p>
          <p style="margin-top: 30px; font-size: 12px; color: #888;">This is an automated assessment request from TalentHub Botswana.</p>
        </div>
      `;
    }

    if (RESEND_API_KEY) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "TalentHub <notifications@talenthub.co.bw>",
            to: [email],
            subject: subject,
            html: htmlContent,
          }),
        });
        
        if (res.ok) {
          return new Response(JSON.stringify({ success: true, message: "Email sent via Resend" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        const err = await res.text();
        console.warn("Resend failed:", err);
      } catch (fetchErr) {
        console.warn("Resend API fetch error:", fetchErr);
      }
    }

    // Logging/Mock fallback if Resend fails or is unconfigured
    console.log("---------------- MOCK EMAIL LOG ----------------");
    console.log(`To: ${email}`);
    console.log(`Subject: ${subject}`);
    console.log("HTML Body Preview:");
    console.log(htmlContent);
    console.log("------------------------------------------------");

    return new Response(JSON.stringify({ success: true, message: "Email logged in console (Mock)" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("send-email error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
