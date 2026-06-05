const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL="([^"]+)"/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="([^"]+)"/);

const supabaseUrl = urlMatch ? urlMatch[1] : null;
const supabaseKey = keyMatch ? keyMatch[1] : null;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Fetching companies branding data...");
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, logo_url, brand_primary_color, brand_secondary_color, brand_accent_color");

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Success! Total companies:", data.length);
    data.forEach((c, idx) => {
      console.log(`[${idx}] ID: ${c.id} | Name: ${c.name} | Logo: ${c.logo_url} | Primary: ${c.brand_primary_color} | Secondary: ${c.brand_secondary_color} | Accent: ${c.brand_accent_color}`);
    });
  }
}

test();
