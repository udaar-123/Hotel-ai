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
      
      content = content.replace(/className="([^"]*)text-white([^"]*)"/g, (match, p1, p2) => {
        // If it's a button or badge with bg-something that is dark, keep text-white
        if (p1.includes('bg-black') || p2.includes('bg-black') || p1.includes('bg-red-500') || p2.includes('bg-red-500') || p1.includes('bg-orange-600') || p2.includes('bg-orange-600') || p1.includes('bg-purple-600') || p1.includes('bg-red-900') || p1.includes('bg-emerald-600') || p1.includes('bg-gray-900')) {
          return match;
        }
        return 'className="' + p1 + 'text-gray-900' + p2 + '"';
      });

      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Fixed icon/text colors: ' + fullPath);
      }
    }
  }
}

processDirectory('./app/auth');
