/**
 * check-image-dims.js
 * Utility to check image dimensions in /src/assets and /public.
 * Run: node check-image-dims.js
 */

const fs = require("fs");
const path = require("path");

const DIRS = [
  path.resolve(__dirname, "src/assets"),
  path.resolve(__dirname, "public"),
];

const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico"];

const MAX_SIZE_KB = 500;

function walkDir(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else {
      const ext = path.extname(item.name).toLowerCase();
      if (IMAGE_EXTS.includes(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

function main() {
  console.log("\n🖼️  Checking image files...\n");

  let warnings = 0;

  for (const dir of DIRS) {
    const files = walkDir(dir);
    if (files.length === 0) continue;

    for (const file of files) {
      const stat = fs.statSync(file);
      const sizeKB = Math.round(stat.size / 1024);
      const relative = path.relative(__dirname, file);

      if (sizeKB > MAX_SIZE_KB) {
        console.log(`  ⚠️  ${relative} — ${sizeKB} KB (exceeds ${MAX_SIZE_KB} KB)`);
        warnings++;
      } else {
        console.log(`  ✅ ${relative} — ${sizeKB} KB`);
      }
    }
  }

  console.log(
    `\n${warnings === 0 ? "✅ All images OK." : `⚠️  ${warnings} image(s) exceed ${MAX_SIZE_KB} KB.`}\n`
  );

  process.exit(warnings > 0 ? 1 : 0);
}

main();