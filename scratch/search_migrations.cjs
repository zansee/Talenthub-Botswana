const fs = require('fs');
const path = require('path');
const migrationsDir = 'supabase/migrations';
const files = fs.readdirSync(migrationsDir);
files.sort().forEach(file => {
  const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.toLowerCase().includes('policy') && (line.toLowerCase().includes('jobs') || line.toLowerCase().includes('applications'))) {
      console.log(`${file}:${idx + 1}: ${line.trim()}`);
    }
  });
});
