const url = "https://hovxyfqpinwqomvevrfb.supabase.co/functions/v1/generate-brand-style";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhvdnh5ZnFwaW53cW9tdmV2cmZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NDI4NzUsImV4cCI6MjA5NTMxODg3NX0.EBAAeG8CHG-JAlMKNat1J3yQ25YruYOpvJZRTJTw1MI";

async function test() {
  try {
    console.log("Invoking Edge Function...");
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${anonKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        companyName: "Hungry Lion",
        industry: "Human Resources",
        logoUrl: null,
        brandColors: ["#E02020", "#0D1117", "#00E000"],
        sampleImageBase64: null
      })
    });

    console.log(`Status: ${resp.status}`);
    const text = await resp.text();
    console.log(`Response body: ${text}`);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

test();
