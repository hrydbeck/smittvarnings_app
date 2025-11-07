#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function usage() {
  console.log('Usage: node ref_manager.js --action <append|rebuild|compare> --ref-dir <dir> --new <path> [--threshold N] [--force]');
  process.exit(2);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.replace(/^--+/, '');
    const next = argv[i+1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

const argv = parseArgs(process.argv.slice(2));
const action = argv.action;
const refDir = argv['ref-dir'];
const newPath = argv.new;
const threshold = argv.threshold ? Number(argv.threshold) : 10;
const force = argv.force === true || argv.force === 'true' || false;
const ttl = parseInt(argv.ttl || '3600', 10);

if (!action || !refDir) {
  usage();
}

const lockDir = path.resolve(refDir + '.lock');

function acquireLock() {
  try {
    fs.mkdirSync(lockDir);
    const info = { pid: process.pid, ts: new Date().toISOString() };
    fs.writeFileSync(path.join(lockDir, 'owner.json'), JSON.stringify(info));
    return true;
  } catch (err) {
    if (err.code === 'EEXIST') {
      try {
        const st = fs.statSync(lockDir);
        const age = (Date.now() - st.mtimeMs) / 1000;
        if (age > ttl) {
          if (force) {
            console.log('Stale lock found, --force specified: removing');
            fs.rmdirSync(lockDir, { recursive: true });
            return acquireLock();
          } else {
            console.error(`Lock exists and is older than ${ttl}s. Use --force to override.`);
            return false;
          }
        }
      } catch (e) {
        console.error('Could not stat lock dir:', e.message);
        return false;
      }
      console.error('Lock dir exists. Another process may be running.');
      return false;
    } else {
      console.error('Failed to create lock dir:', err.message);
      return false;
    }
  }
}

function releaseLock() {
  try {
    if (fs.existsSync(lockDir)) {
      fs.rmdirSync(lockDir, { recursive: true });
    }
  } catch (e) {
    console.error('Failed to remove lock dir:', e.message);
  }
}

process.on('exit', () => releaseLock());
process.on('SIGINT', () => process.exit(1));
process.on('SIGTERM', () => process.exit(1));

if (!acquireLock()) {
  process.exit(3);
}

function runPython(args) {
  const py = process.env.PYTHON || 'python3';
  console.log('Running:', py, args.join(' '));
  const res = spawnSync(py, args, { encoding: 'utf8' });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  return res.status;
}

let status = 0;
try {
  if (action === 'append') {
    if (!newPath) { console.error('--new is required for append'); process.exit(2); }
    status = runPython([path.join(__dirname, '..', 'append_profiles_to_npy.py'), '--ref-dir', refDir, '--new', newPath]);
  } else if (action === 'rebuild') {
    if (!newPath) { console.error('--new is required for rebuild (input dir or files)'); process.exit(2); }
    // allow multiple inputs (comma separated)
    const inputs = newPath.split(',');
    status = runPython([path.join(__dirname, '..', 'rebuild_profiles.py'), '--inputs', ...inputs, '--out-dir', refDir]);
  } else if (action === 'compare') {
    if (!newPath) { console.error('--new is required for compare'); process.exit(2); }
    status = runPython([path.join(__dirname, '..', 'compare_new_to_ref.py'), '--ref-dir', refDir, '--new', newPath, '--threshold', String(threshold)]);
  } else {
    console.error('Unknown action:', action);
    usage();
  }
} finally {
  releaseLock();
}

process.exit(status || 0);
