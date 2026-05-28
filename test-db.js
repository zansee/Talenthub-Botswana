import fs from 'fs';

async function test() {
  console.log("Searching previous sql.txt for 'interview_prep'...");
  const content = fs.readFileSync('previous sql.txt', 'utf8');
  const lines = content.split('\n');
  lines.forEach((l, i) => {
    if (l.toLowerCase().includes('interview_prep') && !l.toLowerCase().includes('interview_preps')) {
      console.log(`${i + 1}: ${l}`);
    }
  });
}

test();
