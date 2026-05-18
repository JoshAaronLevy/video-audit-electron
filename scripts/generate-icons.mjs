import { copyFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const sourceIcon = join('assets', 'icon-source.png');
const iconsetDir = join('assets', 'icon.iconset');
const pngIcon = join('assets', 'icon.png');
const icnsIcon = join('assets', 'icon.icns');

const iconSizes = [
  [16, 'icon_16x16.png'],
  [32, 'icon_16x16@2x.png'],
  [32, 'icon_32x32.png'],
  [64, 'icon_32x32@2x.png'],
  [128, 'icon_128x128.png'],
  [256, 'icon_128x128@2x.png'],
  [256, 'icon_256x256.png'],
  [512, 'icon_256x256@2x.png'],
  [512, 'icon_512x512.png'],
  [1024, 'icon_512x512@2x.png']
];

mkdirSync(iconsetDir, { recursive: true });

for (const [size, fileName] of iconSizes) {
  run('sips', ['-z', String(size), String(size), sourceIcon, '--out', join(iconsetDir, fileName)]);
}

run('iconutil', ['-c', 'icns', iconsetDir, '-o', icnsIcon]);
copyFileSync(sourceIcon, pngIcon);

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
