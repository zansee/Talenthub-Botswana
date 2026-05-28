const fs = require('fs');
const https = require('https');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL="([^"]+)"/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="([^"]+)"/);

const supabaseUrl = urlMatch ? urlMatch[1] : null;
const supabaseKey = keyMatch ? keyMatch[1] : null;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing environment variables!");
  process.exit(1);
}

const options = {
  hostname: supabaseUrl.replace('https://', ''),
  path: '/rest/v1/?apikey=' + supabaseKey,
  method: 'GET',
  headers: {
    'Accept': 'application/openapi+json',
    'apikey': supabaseKey
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const schema = JSON.parse(data);
      const table = schema.definitions.interview_preps;
      if (table) {
        console.log("Remote schema for 'interview_preps':");
        console.log(JSON.stringify(table, null, 2));
      } else {
        console.log("Table 'interview_preps' not found in remote API schema definitions!");
        console.log("Available definitions:", Object.keys(schema.definitions));
      }
    } catch (e) {
      console.error("Error parsing response:", e);
      console.log("Raw response (truncated):", data.substring(0, 1000));
    }
  });
});

req.on('error', (e) => {
  console.error(e);
});
req.end();
