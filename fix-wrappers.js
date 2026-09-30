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
      
      // Fix wrappers
      content = content.replace(/className="p-8([^"]*)text-white([^"]*)"/g, 'className="p-8-gray-900"');
      content = content.replace(/className="([^"]*)text-white([^"]*p-8[^"]*)"/g, 'className="-gray-900"');
      
      // Fix specific text-white elements that are wrappers or basic text
      content = content.replace(/<span className="font-medium text-white">/g, '<span className="font-medium text-gray-900">');
      
      // Fix buttons with gray backgrounds
      content = content.replace(/bg-gray-100 hover:bg-slate-600/g, 'bg-gray-100 hover:bg-gray-200 text-gray-900');
      content = content.replace(/bg-gray-100 hover:bg-slate-700/g, 'bg-gray-100 hover:bg-gray-200 text-gray-900');
      content = content.replace(/bg-gray-100 text-white/g, 'bg-gray-100 text-gray-900');

      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Fixed wrapper text visibility: ' + fullPath);
      }
    }
  }
}

processDirectory('./app');
