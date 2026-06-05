const fs = require('fs');
const path = require('path');

function searchDir(dir, query) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        searchDir(fullPath, query);
      }
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.json')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes(query)) {
          console.log(`Found "${query}" in: ${fullPath}`);
        }
      }
    }
  }
}

const startDir = path.resolve(__dirname, '../src');
console.log(`Searching in ${startDir}...`);
searchDir(startDir, 'extractColors');
searchDir(startDir, 'toHex');
searchDir(startDir, 'Math.round(g / roundFactor)');
console.log('Search done.');
