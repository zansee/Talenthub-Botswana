const fs = require('fs');
const content = fs.readFileSync('previous sql.txt', 'utf8');
const lines = content.split('\n');
const results = lines.filter(line => line.toLowerCase().includes('policy') && line.toLowerCase().includes('jobs'));
console.log(results.slice(0, 50).join('\n'));
