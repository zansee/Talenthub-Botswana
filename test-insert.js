import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
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
  console.log("Fetching a user from profiles to use as test user...");
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id")
    .limit(1);

  if (pErr || !profiles || profiles.length === 0) {
    console.error("Error fetching user:", pErr);
    return;
  }

  const userId = profiles[0].id;
  console.log("Found user ID:", userId);

  console.log("Attempting insert as that user...");
  // Since we can't authenticate as the user, we try to insert with their user_id.
  // Note: RLS checks auth.uid() = user_id. An unauthenticated insert has auth.uid() = null.
  // Wait! If RLS is enabled, this will fail. Let's see if we can check the policies or columns by doing a SELECT.
  // Let's do a select of columns by querying revamp_requests to see how it works.
  
  // Let's check if we can query user_roles
  const { data: roles, error: rErr } = await supabase
    .from("user_roles")
    .select("*")
    .limit(5);
  console.log("User roles query result:", rErr ? rErr : roles);

  // Let's check revamp_requests columns
  const { data: revamps, error: revErr } = await supabase
    .from("revamp_requests")
    .select("*")
    .limit(1);
  console.log("Revamp requests query result:", revErr ? revErr : revamps);
}

test();
