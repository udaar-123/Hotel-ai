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
      
      content = content.replace(/className="bg-white text-white border-gray-200"/g, 'className="bg-white text-gray-900 border-gray-200 hover:bg-gray-50"');
      content = content.replace(/className="([^"]*)bg-white([^"]*)text-white([^"]*)"/g, 'className="$1bg-white$2text-gray-900$3"');

      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Fixed white on white: ' + fullPath);
      }
    }
  }
}

processDirectory('./app');
processDirectory('./components');
