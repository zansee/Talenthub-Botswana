import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Manually parse .env
const envFile = fs.readFileSync(".env", "utf8");
const env = {};
envFile.split("\n").forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || "";
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing environment variables!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Fetching a sample quick job row to view columns...");
  const { data, error } = await supabase
    .from("quick_jobs")
    .select("*")
    .limit(1);

  if (error) {
    console.error("Query Error:", error);
  } else {
    console.log("Query Success! Rows found:", data.length);
    if (data.length > 0) {
      console.log("Sample Row Columns:", Object.keys(data[0]));
      console.log("Sample Row:", data[0]);
    } else {
      console.log("No quick_jobs rows found.");
    }
  }
}

test();
