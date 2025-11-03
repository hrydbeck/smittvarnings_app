const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');

// Configuration via env with sensible defaults
const watchRoot = process.env.WATCH_DIR || path.resolve(__dirname, 'jasen_out');
const resultsBase = process.env.RESULTS_BASE || path.resolve(__dirname, 'intermediate_files', 'profiles_for_reportree');
const rScript = path.resolve(__dirname, 'process_json.R');
const reportreeScript = path.resolve(__dirname, 'run_reportree.js');
const checkIntervalMs = 30 * 1000;

// we'll start the reportree watcher once when this script starts
let reportreeProc = null;

let knownFiles = new Set();
let updateCount = 0;

console.log(`👀 Watching for new JSON files under: ${watchRoot}`);
console.log(`📥 Results base for R output: ${resultsBase}`);
// NOTE: do not auto-fork the run_reportree watcher here to avoid file-descriptor issues when
// running under nohup/background. Run `node run_reportree.js` in a separate terminal instead.

function findJsonFilesInSubfolders() {
  if (!fs.existsSync(watchRoot)) {
    console.log('❌ Watch root does not exist:', watchRoot);
    return [];
  }
  console.log('📂 Scanning watch root:', watchRoot);
  let subfolders = fs.readdirSync(watchRoot, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  // sort for deterministic behavior across runs (filesystem order may vary)
  subfolders = subfolders.sort();
  console.log('📂 Found subfolders (sorted):', subfolders);
  const found = [];
  for (const sub of subfolders) {
    const folder = path.join(watchRoot, sub);
    try {
      let files = fs.readdirSync(folder).filter(f => f.toLowerCase().endsWith('.json'));
      // sort files to ensure deterministic ordering (matches shell glob ordering)
      files = files.sort();
      console.log(`📂 Found ${files.length} JSON files in ${sub} (sorted):`, files);
      for (const f of files) found.push(path.join(folder, f));
    } catch (err) {
      console.error(`❌ Error reading subfolder ${sub}:`, err.message);
    }
  }
  console.log('📂 Total JSON files found:', found.length);
  return found;
}

function detectNewFiles() {
  console.log('\n🔍 Checking for new files...');
  const current = findJsonFilesInSubfolders();
  console.log('💾 Known files:', Array.from(knownFiles));
  console.log('📄 Current files:', current);
  const currentSet = new Set(current);
  const newFiles = current.filter(f => !knownFiles.has(f));
  current.forEach(f => knownFiles.add(f));
  console.log('🆕 New files:', newFiles);
  return newFiles;
}

function runRScriptForFiles(files) {
  if (files.length === 0) return;

  // group by subfolder (we pass files from same subfolder in one call)
  const groups = files.reduce((acc, f) => {
    const sub = path.basename(path.dirname(f));
    acc[sub] = acc[sub] || [];
    acc[sub].push(f);
    return acc;
  }, {});

  Object.entries(groups).forEach(([subfolder, filesInSub]) => {
    updateCount++;
    // Use mimosa-style watched_N label format
    const label = `watched_${updateCount}`;

    console.log(`🧠 Found ${filesInSub.length} new JSON(s) in '${subfolder}' → label=${label}`);
    filesInSub.forEach(f => console.log('  -', f));

    // build args: results_base update_label file1 file2 ...
    const args = [resultsBase, label, ...filesInSub];

  // Ensure R runs with a defined TZ to avoid calls to timedatectl on systems without systemd
  const rEnv = Object.assign({}, process.env, { TZ: process.env.TZ || 'UTC' });
  const rProc = spawn('Rscript', [rScript, ...args], { stdio: ['ignore', 'pipe', 'pipe'], env: rEnv });

    rProc.stdout.on('data', d => process.stdout.write(`📤 R: ${d}`));
    rProc.stderr.on('data', d => process.stderr.write(`⚠️ R: ${d}`));
    rProc.on('close', code => {
      console.log(`✅ Rscript exited with code ${code} for ${label}`);
      if (code === 0) {
        console.log(`ℹ️ R processing finished for ${label}. run_reportree.js watcher (if running) will pick up the new files.`);
      }
    });
  });
}

function checkCycle() {
  const newFiles = detectNewFiles();
  if (newFiles.length === 0) {
    console.log(`⏳ No new JSONs (${new Date().toLocaleTimeString()})`);
    return;
  }
  runRScriptForFiles(newFiles);
}

// Don't populate knownFiles initially - let the first check cycle find all files as new
console.log('⏳ Initial scan - starting check cycles...');
knownFiles = new Set(); // start fresh
setInterval(checkCycle, checkIntervalMs);
// resume stdin only if available and not destroyed. This avoids EBADF when running under nohup/background.
try {
  if (process.stdin && !process.stdin.destroyed) process.stdin.resume();
} catch (e) {
  // ignore - running without a valid stdin (e.g. under nohup) is fine
}
