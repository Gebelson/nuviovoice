const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../../web/dist');
const destDir = path.resolve(__dirname, '../web-dist');

if (!fs.existsSync(srcDir)) {
  console.warn(`[copy-web] Warning: Source web dist not found at ${srcDir}. Please build @concord/web first.`);
  process.exit(0);
}

console.log(`[copy-web] Copying web dist from ${srcDir} to ${destDir}...`);

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (fs.existsSync(destDir)) {
  fs.rmSync(destDir, { recursive: true, force: true });
}

copyDirRecursive(srcDir, destDir);
console.log('[copy-web] Web dist successfully copied to packages/desktop/web-dist.');
