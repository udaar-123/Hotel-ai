const fs = require('fs');
const path = require('path');

const replacements = [
  { regex: /bg-slate-900/g, replacement: 'bg-gray-50' },
  { regex: /bg-slate-800\/50/g, replacement: 'bg-white shadow-sm' },
  { regex: /bg-slate-800/g, replacement: 'bg-white' },
  { regex: /bg-slate-700/g, replacement: 'bg-gray-100' },
  { regex: /border-slate-800/g, replacement: 'border-gray-100' },
  { regex: /border-slate-700/g, replacement: 'border-gray-200' },
  { regex: /text-slate-100/g, replacement: 'text-gray-900' },
  { regex: /text-slate-200/g, replacement: 'text-gray-800' },
  { regex: /text-slate-300/g, replacement: 'text-gray-700' },
  { regex: /text-slate-400/g, replacement: 'text-gray-500' },
  { regex: /text-slate-500/g, replacement: 'text-gray-400' },
  { regex: /bg-indigo-600\/20/g, replacement: 'bg-gray-100' },
  { regex: /bg-indigo-600\/30/g, replacement: 'bg-gray-200' },
  { regex: /bg-indigo-600/g, replacement: 'bg-black' },
  { regex: /hover:bg-indigo-600\/30/g, replacement: 'hover:bg-gray-200' },
  { regex: /hover:bg-indigo-700/g, replacement: 'hover:bg-gray-800' },
  { regex: /text-indigo-200\/70/g, replacement: 'text-gray-500' },
  { regex: /text-indigo-300/g, replacement: 'text-gray-900' },
  { regex: /text-indigo-400/g, replacement: 'text-gray-900' },
  { regex: /border-indigo-500/g, replacement: 'border-gray-300' },
  { regex: /bg-indigo-900\/50/g, replacement: 'bg-gray-100' },
  { regex: /bg-blue-600/g, replacement: 'bg-black' },
  { regex: /hover:bg-blue-700/g, replacement: 'hover:bg-gray-800' },
  { regex: /min-h-screen bg-gray-50 flex flex-col items-center p-8 relative text-white/g, replacement: 'min-h-screen bg-gray-50 flex flex-col items-center p-8 relative text-gray-900' }
];

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
      
      for (const rule of replacements) {
        content = content.replace(rule.regex, rule.replacement);
      }

      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Updated: ' + fullPath);
      }
    }
  }
}

processDirectory('./app');
processDirectory('./components');
