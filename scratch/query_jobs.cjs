const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL="([^"]+)"/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="([^"]+)"/);

const supabaseUrl = urlMatch ? urlMatch[1] : null;
const supabaseKey = keyMatch ? keyMatch[1] : null;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Fetching jobs...");
  const { data, error } = await supabase
    .from("jobs")
    .select("id, title, location, employment_type, job_type");

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Success! Total jobs:", data.length);
    data.forEach((j, idx) => {
      console.log(`[${idx}] ID: ${j.id} | Title: "${j.title}" | Location: "${j.location}" | Type: "${j.employment_type || j.job_type}"`);
    });
  }
}

test();
