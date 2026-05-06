import fs from 'fs';
import path from 'path';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const srcPkgPath = path.join(root, 'package.json');
const outPkgPath = path.join(distDir, 'package.json');

if (!fs.existsSync(distDir)) {
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(srcPkgPath, 'utf8'));
const out = {
  name: pkg.name,
  version: pkg.version,
  type: 'module',
  main: './index.js',
  types: './index.d.ts',
  peerDependencies: pkg.peerDependencies ?? {}
};

fs.writeFileSync(outPkgPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
