const fs = require('fs');
const path = require('path');

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      out.push(...walk(full));
    } else if (full.endsWith('.js') || full.endsWith('.jsx')) {
      out.push(path.relative('.', full).replace(/\\/g,'/'));
    }
  }
  return out;
}

function resolveImport(file, req) {
  const base = path.dirname(file);
  const target = path.resolve(base, req);
  const candidates = [target, target + '.js', target + '.jsx', path.join(target, 'index.js'), path.join(target, 'index.jsx')];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

function exactPath(p) {
  const parts = p.replace(/\\/g,'/').split('/').filter(Boolean);
  let cur = '.';
  for (const part of parts) {
    const entries = fs.readdirSync(cur);
    const found = entries.find(e => e === part);
    if (!found) return null;
    cur = path.join(cur, found);
  }
  return path.relative('.', cur).replace(/\\/g,'/');
}

const files = walk('src');
const regex = /(?:require\(['\"]([^'\"]+)['\"]\))|(?:import .* from ['\"]([^'\"]+)['\"])/g;
const problems = [];
for (const file of files) {
  const content = fs.readFileSync(file,'utf8');
  let m;
  while ((m = regex.exec(content))) {
    const req = m[1] || m[2];
    if (!req) continue;
    if (!(req.startsWith('.')||req.startsWith('/'))) continue;
    const resolved = resolveImport(file, req);
    if (!resolved) { problems.push({file, req, issue:'not found'}); continue; }
    const exact = exactPath(path.relative('.', resolved));
    const expected = path.relative('.', resolved).replace(/\\/g,'/');
    if (exact !== expected) problems.push({file, req, expected, exact});
  }
}
console.log(JSON.stringify({problems}, null, 2));
