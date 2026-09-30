const fs = require('fs');
const path = require('path');

function processDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!fullPath.includes('node_modules') && !fullPath.includes('.next') && !fullPath.includes('.git')) {
        processDirectory(fullPath);
      }
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let originalContent = content;
      
      content = content.replace(/border-gray-200 text-white/g, 'border-gray-200 text-gray-900');
      content = content.replace(/text-white placeholder-slate-500/g, 'text-gray-900 placeholder-gray-400');
      content = content.replace(/bg-gray-50 text-white/g, 'bg-gray-50 text-gray-900');
      content = content.replace(/text-white font-semibold/g, 'text-gray-900 font-semibold');
      content = content.replace(/text-lg font-semibold text-white/g, 'text-lg font-semibold text-gray-900');
      content = content.replace(/font-bold text-white/g, 'font-bold text-gray-900');

      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Fixed auth inputs text colors: ' + fullPath);
      }
    }
  }
}

processDirectory('./app/auth');
processDirectory('./app/(staff)');
processDirectory('./components');
