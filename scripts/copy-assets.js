const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'assets', 'images');
const destDir = path.join(__dirname, '..', 'public', 'images');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

if (fs.existsSync(srcDir)) {
  const files = fs.readdirSync(srcDir);
  files.forEach(file => {
    const srcFile = path.join(srcDir, file);
    const destFile = path.join(destDir, file);
    fs.copyFileSync(srcFile, destFile);
  });
  console.log(`Copied ${files.length} images from src/assets/images to public/images`);
}

// Ensure standard aliases exist
const aliasMap = {
  'scrim_bermuda_1786956536583.jpg': ['bermuda.jpg', 'map-bermuda.jpg'],
  'scrim_purgatory_1786956554900.jpg': ['purgatory.jpg', 'map-purgatory.jpg'],
  'scrim_kalahari_1786956572959.jpg': ['kalahari.jpg', 'map-kalahari.jpg'],
  'scrim_alpine_1786956632185.jpg': ['alpine.jpg', 'map-alpine.jpg'],
  'scrim_nexterra_1786956615965.jpg': ['nexterra.jpg', 'map-nexterra.jpg'],
  'sakura_warrior_1786871705952.jpg': ['sakura-warrior.jpg', 'sakura.jpg', 'hero-warrior.jpg'],
  'sakura_wallpaper_1786956488749.jpg': ['sakura-wallpaper.jpg', 'hero-bg.jpg'],
  'victory_trophy_1786956520406.jpg': ['victory.jpg', 'trophy.jpg'],
  'scrim_1_1786463314303.jpg': ['scrim-1.jpg'],
  'scrim_2_1786463326090.jpg': ['scrim-2.jpg'],
  'scrim_3_1786463337806.jpg': ['scrim-3.jpg'],
  'scrim_4_1786463350883.jpg': ['scrim-4.jpg'],
  'scrim_5_1786463361139.jpg': ['scrim-5.jpg'],
  'scrim_6_1786463377125.jpg': ['scrim-6.jpg'],
  'scrim_7_1786463390080.jpg': ['scrim-7.jpg'],
  'scrim_8_1786463400546.jpg': ['scrim-8.jpg'],
  'scrim_9_1786463411191.jpg': ['scrim-9.jpg'],
  'scrim_10_1786463422038.jpg': ['scrim-10.jpg'],
  'scrim_11_1786463436471.jpg': ['scrim-11.jpg'],
  'scrim_12_1786463459348.jpg': ['scrim-12.jpg'],
};

for (const [srcName, aliases] of Object.entries(aliasMap)) {
  const srcPath = path.join(srcDir, srcName);
  if (fs.existsSync(srcPath)) {
    for (const alias of aliases) {
      const targetPath = path.join(destDir, alias);
      fs.copyFileSync(srcPath, targetPath);
    }
  }
}
console.log('Finished copying asset aliases for production builds.');
