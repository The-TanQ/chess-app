const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { execSync } = require('child_process');

async function exists(p) {
  try { await fsp.access(p); return true; } catch { return false; }
}

async function copyRecursive(src, dest) {
  const stat = await fsp.stat(src);
  if (stat.isDirectory()) {
    await fsp.mkdir(dest, { recursive: true });
    const entries = await fsp.readdir(src);
    for (const e of entries) {
      await copyRecursive(path.join(src, e), path.join(dest, e));
    }
  } else {
    await fsp.copyFile(src, dest);
  }
}

(async () => {
  const root = path.resolve(__dirname, '..');
  const dist = path.join(root, 'dist');

  if (await exists(dist)) {
    await fsp.rm(dist, { recursive: true, force: true });
  }
  await fsp.mkdir(dist, { recursive: true });

  // Files/folders to include in the build — adjust as needed
  const items = ['server.js', 'package.json', 'public', 'views'];

  for (const item of items) {
    const src = path.join(root, item);
    if (await exists(src)) {
      console.log(`Copying ${item} -> dist/${item}`);
      await copyRecursive(src, path.join(dist, item));
    }
  }

  console.log('Installing production dependencies inside dist/ ...');
  execSync('npm install --production', { cwd: dist, stdio: 'inherit' });

  console.log('Build complete — dist/ is ready for deployment.');
})().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
