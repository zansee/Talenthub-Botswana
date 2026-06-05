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

async function test() {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    });
    const text = await res.text();
    console.log("Response Text (truncated):", text.slice(0, 1000));
    const schema = JSON.parse(text);
    console.log("Schema root keys:", Object.keys(schema));
    if (schema.definitions) {
      console.log("Definitions (tables):", Object.keys(schema.definitions));
    }
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
