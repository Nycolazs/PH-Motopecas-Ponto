/* eslint-disable @typescript-eslint/no-require-imports -- electron-builder loads this file with require() */
// electron-builder configuration. Names, ids and the update feed come from the white-label
// brand (packages/shared/src/brand.ts, built to dist): customer branches never edit this file.
// Requires `pnpm shared:build` first (the package:* scripts do it).
const { copyFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

const { BRAND } = require('../../packages/shared/dist/brand.js');

// One square PNG (>= 512 px) per brand; electron-builder derives .ico and .icns from it.
mkdirSync(join(__dirname, 'build'), { recursive: true });
copyFileSync(
  join(__dirname, '../../packages/shared/brand/icon.png'),
  join(__dirname, 'build/icon.png'),
);

const { productName, companyName } = BRAND;
const { appId, executableName, artifactPrefix, releasesOwner, releasesRepo, maintainer } =
  BRAND.desktop;

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId,
  productName,
  executableName,
  extraMetadata: { name: executableName, desktopName: executableName, author: maintainer },
  asar: true,
  directories: { output: 'release', buildResources: 'build' },
  publish: { provider: 'github', owner: releasesOwner, repo: releasesRepo },
  files: ['dist/**/*', 'build/**/*', 'package.json'],
  win: {
    icon: 'build/icon.png',
    target: [{ target: 'nsis', arch: ['x64'] }],
    artifactName: `${artifactPrefix}-Setup-\${version}.\${ext}`,
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowElevation: false,
    allowToChangeInstallationDirectory: false,
    createDesktopShortcut: 'always',
    createStartMenuShortcut: true,
    shortcutName: productName,
  },
  mac: {
    icon: 'build/icon.png',
    category: 'public.app-category.business',
    target: [
      { target: 'dmg', arch: ['arm64', 'x64'] },
      { target: 'zip', arch: ['arm64', 'x64'] },
    ],
    artifactName: `${artifactPrefix}-\${version}-\${arch}.\${ext}`,
  },
  deb: { afterInstall: 'scripts/after-install.sh' },
  linux: {
    icon: 'build/icon.png',
    category: 'Office',
    executableName,
    syncDesktopName: true,
    maintainer,
    desktop: {
      entry: {
        StartupWMClass: productName,
        Comment: `Controle de ponto - ${companyName}`,
      },
    },
    target: [
      { target: 'AppImage', arch: ['x64'] },
      { target: 'deb', arch: ['x64'] },
    ],
    artifactName: `${artifactPrefix}-\${version}-\${arch}.\${ext}`,
  },
};
