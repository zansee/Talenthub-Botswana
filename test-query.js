import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env", "utf8");
const urlMatch = env.match(/VITE_SUPABASE_URL="([^"]+)"/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="([^"]+)"/);

const supabaseUrl = urlMatch ? urlMatch[1] : null;
const supabaseKey = keyMatch ? keyMatch[1] : null;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing environment variables!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Fetching all revamp requests using service client...");
  // Note: we can't use service role key as it's not in .env, so we query as anon.
  // Wait, if RLS allows anon? No, RLS blocks anon.
  // Let's print table size or check if we can query using the REST API or schema.
  const { data, error } = await supabase
    .from("revamp_requests")
    .select("id, fulfilment_status, created_at, user_id");

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Success! Total rows fetched:", data.length);
    data.forEach((r, idx) => {
      console.log(`[${idx}] ID: ${r.id} | Status: ${r.fulfilment_status} | Created: ${r.created_at} | User ID: ${r.user_id}`);
    });
  }
}

test();
