// Placeholder icon generation script
// In production, replace with actual icon images

const fs = require('fs');
const path = require('path');

const sizes = [16, 48, 128];
const iconsDir = path.join(__dirname, '../src/assets');

// Create assets directory if it doesn't exist
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

// Create placeholder SVG for each size
sizes.forEach(size => {
    const svg = `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#667eea"/>
  <text x="50%" y="50%" font-size="${size / 2}" fill="white" text-anchor="middle" dominant-baseline="middle">A</text>
</svg>
  `.trim();

    fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), svg);
});

console.log('✅ Placeholder icons created in src/assets/');
console.log('⚠️  Replace with real PNG icons before production');
