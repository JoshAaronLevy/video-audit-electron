import { spawnSync } from 'node:child_process';

run('npm', ['run', 'icons']);
run('npm', ['run', 'build']);
run('npx', ['electron-builder', '--mac', 'dir']);

console.log('\nLocal macOS app build complete. Check the release/ directory for Collie Video.app.');

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
