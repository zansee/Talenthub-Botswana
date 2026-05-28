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
  console.log("Checking storage buckets...");
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error("Error listing buckets:", error);
  } else {
    console.log("Buckets:", buckets);
  }
}

test();
