import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outPath = path.join(root, 'data', 'image-manifest.json');
const cardsRoot = path.join(root, 'assets', 'images', 'cards');

async function walk(dir, out = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await walk(fullPath, out);
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
      out.push(path.relative(root, fullPath).split(path.sep).join('/'));
    }
  }

  return out;
}

const images = (await walk(cardsRoot))
  .sort((a, b) => a.localeCompare(b));

const payload = {
  generatedAt: new Date().toISOString(),
  count: images.length,
  images
};

await fs.writeFile(outPath, JSON.stringify(payload, null, 2), 'utf8');
console.log(`Wrote ${images.length} image paths to ${outPath}`);
