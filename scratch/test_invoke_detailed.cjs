const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL="([^"]+)"/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="([^"]+)"/);

const supabaseUrl = urlMatch ? urlMatch[1] : null;
const supabaseKey = keyMatch ? keyMatch[1] : null;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Invoking non-existent function...");
  const res1 = await supabase.functions.invoke("non-existent-function-12345");
  console.log("Non-existent error:", res1.error);
  
  console.log("Invoking actual function generate-brand-style without auth...");
  const res2 = await supabase.functions.invoke("generate-brand-style");
  console.log("Actual error:", res2.error);
}

test();
