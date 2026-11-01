// `npm run dev`: starts the API server (restarts when its files change) and the Vite dev server together.
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
// Both run with this same Node, so no shell is needed.
const run = (label, args) => {
  const p = spawn(process.execPath, args, { cwd: app, stdio: 'inherit' });
  p.on('exit', (code) => {
    console.log(`${label} stopped (${code}).`);
    process.exit(code ?? 0);
  });
  return p;
};

const server = run('Server', ['--watch-path=server', '--watch-path=../config', 'server/index.js']);
const vite = run('Web app', [join(app, 'node_modules', 'vite', 'bin', 'vite.js'), '--strictPort']);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => [server, vite].forEach((p) => p.kill()));
