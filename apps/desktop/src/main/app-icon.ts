import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { nativeImage, type NativeImage } from 'electron';

export function resolveAppIcon(moduleDirectory: string, rendererRoot: string): NativeImage {
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  const candidates: string[] = [
    // Preferred platform icon in build dir
    isWin ? join(moduleDirectory, '..', '..', 'build', 'icon.ico') : '',
    isMac ? join(moduleDirectory, '..', '..', 'build', 'icon.icns') : '',
    join(moduleDirectory, '..', '..', 'build', 'icon.png'),
    // Inside packaged resources or app.asar/build
    join(moduleDirectory, '..', 'build', isWin ? 'icon.ico' : 'icon.png'),
    join(moduleDirectory, '..', 'build', 'icon.png'),
    join(process.resourcesPath, 'build', isWin ? 'icon.ico' : 'icon.png'),
    join(process.resourcesPath, 'build', 'icon.png'),
    // Inside renderer / public / assets
    join(rendererRoot, 'assets', 'app-icon.png'),
    join(rendererRoot, 'app-icon.png'),
    join(rendererRoot, 'icon.png'),
    join(moduleDirectory, '..', 'assets', 'app-icon.png'),
    join(moduleDirectory, '..', 'app-icon.png'),
    join(moduleDirectory, '..', 'icon.png'),
    join(moduleDirectory, '..', '..', 'src', 'renderer', 'assets', 'app-icon.png'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      const image = nativeImage.createFromPath(candidate);
      if (!image.isEmpty()) {
        return image;
      }
    }
  }

  // Vite dynamic hashed fallback: search renderer/assets for app-icon-*.png
  const assetsDir = join(rendererRoot, 'assets');
  if (existsSync(assetsDir)) {
    try {
      const files = readdirSync(assetsDir);
      const iconFile = files.find((f) => f.startsWith('app-icon') && f.endsWith('.png'));
      if (iconFile) {
        const image = nativeImage.createFromPath(join(assetsDir, iconFile));
        if (!image.isEmpty()) return image;
      }
    } catch {
      // Ignore directory read errors and fallback to empty image
    }
  }

  return nativeImage.createEmpty();
}
