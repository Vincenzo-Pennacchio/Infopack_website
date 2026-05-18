/**
 * build-single-file.js
 *
 * Reads index.html, finds every <img src="local-file.ext"> reference,
 * encodes the file as a base64 data URI, and writes a single self-contained
 * HTML file (infopack.html) you can distribute anywhere.
 *
 * Usage:
 *   node build-single-file.js
 *
 * No npm install required — pure Node.
 */

const fs = require('fs');
const path = require('path');

// ---- CONFIG ---------------------------------------------------------------
const INPUT_HTML  = 'index.html';
const OUTPUT_HTML = 'infopack.html';
const ASSET_DIR   = '.';   // where local images live (same folder by default)
// --------------------------------------------------------------------------

const MIME = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.avif': 'image/avif',
};

const isExternal = (src) =>
  /^(data:|https?:|\/\/)/i.test(src);

function inlineImages(html, baseDir) {
  let inlinedCount = 0;
  let skippedCount = 0;
  let totalBytes = 0;

  const result = html.replace(
    /<img([^>]*?)\ssrc=(["'])([^"']+)\2([^>]*?)>/gi,
    (match, before, _quote, src, after) => {
      if (isExternal(src)) {
        skippedCount++;
        return match; // leave http(s):// and data: URLs alone
      }

      const filePath = path.resolve(baseDir, src);
      if (!fs.existsSync(filePath)) {
        console.warn(`  ⚠  not found: ${src}`);
        skippedCount++;
        return match;
      }

      const ext = path.extname(filePath).toLowerCase();
      const mime = MIME[ext];
      if (!mime) {
        console.warn(`  ⚠  unsupported type: ${src}`);
        skippedCount++;
        return match;
      }

      const data = fs.readFileSync(filePath);
      const base64 = data.toString('base64');
      const dataUri = `data:${mime};base64,${base64}`;
      const sizeKB = (data.length / 1024).toFixed(1);

      console.log(`  ✓  ${src.padEnd(28)}  ${sizeKB.padStart(7)} KB`);
      inlinedCount++;
      totalBytes += data.length;

      return `<img${before} src="${dataUri}"${after}>`;
    }
  );

  return { html: result, inlinedCount, skippedCount, totalBytes };
}

// ---- RUN ------------------------------------------------------------------
const inputPath = path.resolve(INPUT_HTML);

if (!fs.existsSync(inputPath)) {
  console.error(`✗ Cannot find ${INPUT_HTML} in the current folder.`);
  process.exit(1);
}

const html = fs.readFileSync(inputPath, 'utf-8');
const baseDir = path.resolve(ASSET_DIR);

console.log(`\nInlining images from ${baseDir}\n`);

const { html: out, inlinedCount, skippedCount, totalBytes } = inlineImages(html, baseDir);

fs.writeFileSync(OUTPUT_HTML, out);

const origKB = (Buffer.byteLength(html)   / 1024).toFixed(1);
const newKB  = (Buffer.byteLength(out)    / 1024).toFixed(1);
const imgKB  = (totalBytes                / 1024).toFixed(1);
const newMB  = (Buffer.byteLength(out)    / (1024 * 1024)).toFixed(2);

console.log(`\n────────────────────────────────────────`);
console.log(`  inlined :  ${inlinedCount} image(s)  (${imgKB} KB total)`);
console.log(`  skipped :  ${skippedCount}`);
console.log(`  output  :  ${OUTPUT_HTML}`);
console.log(`            ${newKB} KB  (${newMB} MB)`);
console.log(`            was ${origKB} KB before inlining`);
console.log(`────────────────────────────────────────\n`);

if (Buffer.byteLength(out) > 20 * 1024 * 1024) {
  console.log(`  ⚠  Output > 20 MB. Consider compressing images first`);
  console.log(`     (squoosh.app, or sharp): aim for ≤400 KB per photo,`);
  console.log(`     max 1600px wide, JPEG quality 75–85.\n`);
}
