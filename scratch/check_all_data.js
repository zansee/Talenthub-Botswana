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

async function checkAll() {
  console.log("Fetching all companies...");
  const { data: companies, error: compError } = await supabase
    .from("companies")
    .select("*");

  if (compError) {
    console.error("Companies Error:", compError);
  } else {
    console.log("Companies:", JSON.stringify(companies, null, 2));
  }

  console.log("Fetching company members...");
  const { data: members, error: membError } = await supabase
    .from("company_members")
    .select("*");

  if (membError) {
    console.error("Members Error:", membError);
  } else {
    console.log("Members:", JSON.stringify(members, null, 2));
  }
}

checkAll();
