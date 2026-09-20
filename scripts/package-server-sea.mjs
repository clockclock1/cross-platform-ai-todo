#!/usr/bin/env node
/**
 * Package the bundled server (dist/server.cjs) into a Node SEA executable
 * for the given target, then zip it with the web UI assets.
 *
 * Usage:
 *   node scripts/package-server-sea.mjs --target linux-amd64 --outdir dist-bin
 */
import { createWriteStream, existsSync, mkdirSync, cpSync, copyFileSync, rmSync, writeFileSync, chmodSync } from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import os from 'os';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const NODE_VERSION = process.env.SEA_NODE_VERSION || '22.14.0';

const TARGETS = {
  'windows-amd64': { platform: 'win', arch: 'x64', ext: '.exe', nodeFile: 'node.exe' },
  'windows-arm64': { platform: 'win', arch: 'arm64', ext: '.exe', nodeFile: 'node.exe' },
  'linux-amd64': { platform: 'linux', arch: 'x64', ext: '', nodeFile: 'bin/node' },
  'linux-arm64': { platform: 'linux', arch: 'arm64', ext: '', nodeFile: 'bin/node' },
  'macos-amd64': { platform: 'darwin', arch: 'x64', ext: '', nodeFile: 'bin/node' },
  'macos-arm64': { platform: 'darwin', arch: 'arm64', ext: '', nodeFile: 'bin/node' },
};

function parseArgs(argv) {
  const out = { target: '', outdir: path.join(ROOT, 'dist-bin') };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--target') out.target = argv[++i];
    else if (argv[i] === '--outdir') out.outdir = path.resolve(argv[++i]);
  }
  return out;
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const get = (u) => {
      https
        .get(u, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            return get(res.headers.location);
          }
          if (res.statusCode !== 200) {
            reject(new Error(`Download failed ${res.statusCode}: ${u}`));
            return;
          }
          res.pipe(file);
          file.on('finish', () => file.close(() => resolve()));
        })
        .on('error', reject);
    };
    get(url);
  });
}

async function extractTarGz(archive, destDir) {
  mkdirSync(destDir, { recursive: true });
  execFileSync('tar', ['-xzf', archive, '-C', destDir], { stdio: 'inherit' });
}

async function extractZip(archive, destDir) {
  mkdirSync(destDir, { recursive: true });
  execFileSync('tar', ['-xf', archive, '-C', destDir], { stdio: 'inherit' });
}

function run(cmd, args, opts = {}) {
  console.log(`> ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { stdio: 'inherit', ...opts });
}

function ensurePostject() {
  const require = createRequire(import.meta.url);
  try {
    return require.resolve('postject/dist/cli.js');
  } catch {
    console.error('Missing dependency postject. Run: npm install');
    process.exit(1);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.target || !TARGETS[args.target]) {
    console.error(`Unknown --target. Use one of: ${Object.keys(TARGETS).join(', ')}`);
    process.exit(1);
  }

  const meta = TARGETS[args.target];
  const serverJs = path.join(ROOT, 'dist', 'server.cjs');
  const webIndex = path.join(ROOT, 'dist', 'index.html');
  if (!existsSync(serverJs)) {
    console.error('Missing dist/server.cjs — run npm run build first');
    process.exit(1);
  }
  if (!existsSync(webIndex)) {
    console.error('Missing dist/index.html — run npm run build first');
    process.exit(1);
  }

  mkdirSync(args.outdir, { recursive: true });
  // ASCII temp path — postject / PE tools are fragile with non-ASCII paths
  const work = path.join(os.tmpdir(), `aitodo-sea-${args.target}-${process.pid}`);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });

  const serverCopy = path.join(work, 'server.cjs');
  copyFileSync(serverJs, serverCopy);

  const hostPlat =
    process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'darwin' : 'linux';
  const hostArch = process.arch === 'arm64' ? 'arm64' : 'x64';

  async function fetchNode(platform, arch) {
    const name =
      platform === 'win' ? `node-v${NODE_VERSION}-win-${arch}` : `node-v${NODE_VERSION}-${platform}-${arch}`;
    const archive = platform === 'win' ? `${name}.zip` : `${name}.tar.gz`;
    const url = `https://nodejs.org/dist/v${NODE_VERSION}/${archive}`;
    const archivePath = path.join(work, archive);
    if (!existsSync(archivePath)) {
      console.log(`Downloading ${url}`);
      await download(url, archivePath);
    }
    const extractDir = path.join(work, `node-dist-${platform}-${arch}`);
    if (!existsSync(path.join(extractDir, name))) {
      mkdirSync(extractDir, { recursive: true });
      if (platform === 'win') await extractZip(archivePath, extractDir);
      else await extractTarGz(archivePath, extractDir);
    }
    const binary = path.join(extractDir, name, platform === 'win' ? 'node.exe' : 'bin/node');
    if (!existsSync(binary)) throw new Error(`Node binary missing: ${binary}`);
    return binary;
  }

  const nodeSrc = await fetchNode(meta.platform, meta.arch);
  const seaNode = await fetchNode(hostPlat, hostArch);

  const seaConfig = {
    main: serverCopy,
    output: path.join(work, 'sea-prep.blob'),
    disableExperimentalSEAWarning: true,
    useCodeCache: false,
  };
  const seaConfigPath = path.join(work, 'sea-config.json');
  writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2));

  console.log('Generating SEA blob with', seaNode);
  run(seaNode, ['--experimental-sea-config', seaConfigPath]);

  const outName = `ai-todo-server-${args.target}${meta.ext}`;
  const stagingDir = path.join(work, 'stage');
  mkdirSync(stagingDir, { recursive: true });
  const outBin = path.join(stagingDir, outName);
  copyFileSync(nodeSrc, outBin);

  if (meta.platform === 'darwin') {
    try {
      run('codesign', ['--remove-signature', outBin]);
    } catch {
      /* unsigned download is fine */
    }
  }

  const postjectCli = ensurePostject();
  const injectArgs = [
    postjectCli,
    outBin,
    'NODE_SEA_BLOB',
    seaConfig.output,
    '--sentinel-fuse',
    'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
  ];
  if (meta.platform === 'darwin') injectArgs.push('--macho-segment-name', 'NODE_SEA');
  run(process.execPath, injectArgs);

  if (meta.platform !== 'win') chmodSync(outBin, 0o755);
  if (meta.platform === 'darwin') {
    try {
      run('codesign', ['--sign', '-', outBin]);
    } catch (err) {
      console.warn('codesign ad-hoc failed (non-fatal):', err.message || err);
    }
  }

  const webDest = path.join(stagingDir, 'web');
  mkdirSync(webDest, { recursive: true });
  cpSync(path.join(ROOT, 'dist'), webDest, {
    recursive: true,
    filter: (src) => {
      const base = path.basename(src);
      return base !== 'server.cjs' && !base.endsWith('.map');
    },
  });
  copyFileSync(path.join(ROOT, '.env.example'), path.join(stagingDir, '.env.example'));
  writeFileSync(
    path.join(stagingDir, 'README.txt'),
    [
      'AI Todo Server (Node SEA)',
      '',
      '1. Copy .env.example to .env and set JWT_SECRET / CORS_ORIGINS',
      '2. Run the executable in this folder (keep the web/ directory beside it)',
      '3. Default bind: HOST=0.0.0.0 PORT=3000 NODE_ENV=production',
      '4. Data files are stored under ./data',
      '',
      'Examples:',
      '  Windows:  .\\' + outName,
      '  Unix:     ./' + outName,
      '  API only: set API_ONLY=1',
      '',
    ].join('\n')
  );

  mkdirSync(args.outdir, { recursive: true });
  const finalBin = path.join(args.outdir, outName);
  copyFileSync(outBin, finalBin);
  if (meta.platform !== 'win') chmodSync(finalBin, 0o755);

  const zipName = `ai-todo-server-${args.target}.zip`;
  const zipPath = path.join(args.outdir, zipName);
  rmSync(zipPath, { force: true });
  run('tar', ['-a', '-cf', zipPath, '-C', stagingDir, '.']);

  rmSync(work, { recursive: true, force: true });
  console.log('Wrote', finalBin);
  console.log('Wrote', zipPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
