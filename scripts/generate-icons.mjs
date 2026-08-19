import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceIcon = join(rootDir, 'apps/desktop/src/renderer/assets/app-icon.png');
const tmpDir = join(rootDir, 'apps/desktop/.tmp-icon-build');

const targetDirs = [
  join(rootDir, 'apps/desktop/build'),
  join(rootDir, 'PH-Motopeças-Ponto-Frontend/build'),
];

for (const dir of targetDirs) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

if (!existsSync(tmpDir)) {
  mkdirSync(tmpDir, { recursive: true });
}

const iconsetDir = join(tmpDir, 'icon.iconset');
if (existsSync(iconsetDir)) rmSync(iconsetDir, { recursive: true });
mkdirSync(iconsetDir, { recursive: true });

const macSizes = [
  { name: 'icon_16x16.png', size: 16 },
  { name: 'icon_16x16@2x.png', size: 32 },
  { name: 'icon_32x32.png', size: 32 },
  { name: 'icon_32x32@2x.png', size: 64 },
  { name: 'icon_128x128.png', size: 128 },
  { name: 'icon_128x128@2x.png', size: 256 },
  { name: 'icon_256x256.png', size: 256 },
  { name: 'icon_256x256@2x.png', size: 512 },
  { name: 'icon_512x512.png', size: 512 },
  { name: 'icon_512x512@2x.png', size: 1024 },
];

for (const { name, size } of macSizes) {
  const dest = join(iconsetDir, name);
  execSync(`sips -z ${size} ${size} "${sourceIcon}" --out "${dest}"`, { stdio: 'ignore' });
}

// Generate ICNS for macOS
const icnsTmp = join(tmpDir, 'icon.icns');
try {
  execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsTmp}"`, { stdio: 'ignore' });
  const icnsBuffer = readFileSync(icnsTmp);
  for (const dir of targetDirs) {
    writeFileSync(join(dir, 'icon.icns'), icnsBuffer);
  }
  console.log('✓ Generated icon.icns');
} catch (e) {
  console.warn('Could not generate icns:', e.message);
}

// Generate ICO for Windows
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const pngBuffers = [];

for (const size of icoSizes) {
  const pngPath = join(tmpDir, `icon_${size}.png`);
  execSync(`sips -z ${size} ${size} "${sourceIcon}" --out "${pngPath}"`, { stdio: 'ignore' });
  pngBuffers.push({
    size,
    buffer: readFileSync(pngPath),
  });
}

function createIco(images) {
  const count = images.length;
  const headerSize = 6;
  const directorySize = 16 * count;
  let currentOffset = headerSize + directorySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(count, 4); // Number of images

  const dirEntries = [];
  const imageBuffers = [];

  for (const img of images) {
    const entry = Buffer.alloc(16);
    const width = img.size >= 256 ? 0 : img.size;
    const height = img.size >= 256 ? 0 : img.size;

    entry.writeUInt8(width, 0); // Width
    entry.writeUInt8(height, 1); // Height
    entry.writeUInt8(0, 2); // Color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8); // Image size in bytes
    entry.writeUInt32LE(currentOffset, 12); // Image data offset

    dirEntries.push(entry);
    imageBuffers.push(img.buffer);

    currentOffset += img.buffer.length;
  }

  return Buffer.concat([header, ...dirEntries, ...imageBuffers]);
}

const icoBuffer = createIco(pngBuffers);
for (const dir of targetDirs) {
  writeFileSync(join(dir, 'icon.ico'), icoBuffer);
  // Also copy 256x256 icon.png for Linux
  const png256 = pngBuffers.find((p) => p.size === 256)?.buffer ?? readFileSync(sourceIcon);
  writeFileSync(join(dir, 'icon.png'), png256);
}
console.log('✓ Generated icon.ico and icon.png for all build directories');

// Cleanup
rmSync(tmpDir, { recursive: true, force: true });
