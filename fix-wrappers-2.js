const fs = require('fs');
const files = [
  'app/(customer)/bookings/page.tsx',
  'app/(staff)/admin/managers/page.tsx',
  'app/(staff)/manager/board/page.tsx',
  'app/(staff)/manager/room-types/page.tsx',
  'app/(staff)/manager/rooms/page.tsx',
  'app/(staff)/manager/staff/page.tsx'
];
files.forEach(f => {
  if(fs.existsSync(f)) {
    let c = fs.readFileSync(f, 'utf8');
    c = c.replace(/className="p-8-gray-900"/g, 'className="p-8 max-w-6xl mx-auto text-gray-900"');
    fs.writeFileSync(f, c);
  }
});

const fImages = 'app/(staff)/manager/rooms/[id]/images/page.tsx';
if(fs.existsSync(fImages)) {
  let cImages = fs.readFileSync(fImages, 'utf8');
  cImages = cImages.replace(/className="p-8-gray-900">Loading/g, 'className="p-8 text-gray-900">Loading');
  cImages = cImages.replace(/className="p-8-gray-900">Room not/g, 'className="p-8 text-gray-900">Room not');
  cImages = cImages.replace(/className="p-8-gray-900">/g, 'className="p-8 max-w-4xl mx-auto text-gray-900">');
  fs.writeFileSync(fImages, cImages);
}

const fProfile = 'app/(staff)/profile/page.tsx';
if(fs.existsSync(fProfile)) {
  let cProfile = fs.readFileSync(fProfile, 'utf8');
  cProfile = cProfile.replace(/className="p-8-gray-900">Loading/g, 'className="p-8 text-gray-900">Loading');
  fs.writeFileSync(fProfile, cProfile);
}
