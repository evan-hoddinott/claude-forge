#!/usr/bin/env node
/**
 * Generates app icons in all required formats from the SVG source.
 *
 * Output:
 *   assets/icons/icon.png      — 1024×1024 master PNG
 *   assets/icons/icon.ico      — Windows multi-size ICO (16–256)
 *   assets/icons/icon.icns     — macOS (created as PNG set; packager handles icns)
 *   assets/icons/16x16.png … 512x512.png — individual sizes for Linux/icns
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SVG_PATH = join(ROOT, 'assets', 'icon.svg');
const OUT_DIR = join(ROOT, 'assets', 'icons');

mkdirSync(OUT_DIR, { recursive: true });

const svgBuffer = readFileSync(SVG_PATH);

// Sizes needed for various platforms
const SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

async function main() {
  console.log('Generating icons from SVG...');

  // Generate all PNG sizes
  const pngBuffers = {};
  for (const size of SIZES) {
    const buf = await sharp(svgBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 10, g: 10, b: 15, alpha: 1 } })
      .png()
      .toBuffer();
    pngBuffers[size] = buf;
    writeFileSync(join(OUT_DIR, `${size}x${size}.png`), buf);
    console.log(`  ✓ ${size}x${size}.png`);
  }

  // Master 1024px icon
  writeFileSync(join(OUT_DIR, 'icon.png'), pngBuffers[1024]);
  console.log('  ✓ icon.png (1024x1024)');

  // Windows ICO (contains 16, 24, 32, 48, 64, 128, 256)
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const icoInputs = icoSizes.map((s) => pngBuffers[s]);
  const icoBuffer = await pngToIco(icoInputs);
  writeFileSync(join(OUT_DIR, 'icon.ico'), icoBuffer);
  console.log('  ✓ icon.ico');

  // For macOS .icns — electron-forge packager can build icns from a
  // properly-named icon.png (1024x1024). On macOS it will be converted
  // automatically. We also keep the individual sizes for manual icns
  // creation if needed.

  console.log('\nDone! Icons written to assets/icons/');
}

main().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
