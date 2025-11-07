const { spawn } = require('child_process');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration via env with sensible defaults (bin/ is under repo root)
const repoRoot = path.resolve(__dirname, '..');
const watchRoot = process.env.WATCH_DIR || path.resolve(repoRoot, 'jasen_out');
const resultsBase = process.env.RESULTS_BASE || path.resolve(repoRoot, 'intermediate_files', 'profiles_for_reportree');
const rScript = path.resolve(repoRoot, 'R', 'process_json.R');
const checkIntervalMs = parseInt(process.env.CHECK_INTERVAL_MS || String(30 * 1000), 10);

// CLI flags: --once or --check-once will run a single scan cycle and exit after
// any spawned R processes finish. Useful for testing.
const once = process.argv.includes('--once') || process.argv.includes('--check-once');

// track active R child processes so --once can wait for them to finish
const activeProcs = new Set();

let knownFiles = new Set();
let updateCount = 0;

console.log(`👀 Watching for new JSON files under: ${watchRoot}`);
console.log(`📥 Results base for R output: ${resultsBase}`);

// Global safety: log uncaught exceptions/rejections to prevent the process from crashing
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception in watcher:', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection in watcher:', reason);
});

function findJsonFilesInSubfolders() {
  try {
    if (!fs.existsSync(watchRoot)) {
      console.log('❌ Watch root does not exist:', watchRoot);
      return [];
    }
    let subfolders = fs.readdirSync(watchRoot, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
    subfolders = subfolders.sort();
    const found = [];
    for (const sub of subfolders) {
      const folder = path.join(watchRoot, sub);
      try {
        let files = fs.readdirSync(folder).filter(f => f.toLowerCase().endsWith('.json'));
        files = files.sort();
        for (const f of files) found.push(path.join(folder, f));
      } catch (err) {
        console.error(`❌ Error reading subfolder ${sub}:`, err && err.message ? err.message : err);
      }
    }
    return found;
  } catch (err) {
    console.error('❌ Error scanning watch root for JSON files:', err && err.message ? err.message : err);
    return [];
  }
}

function detectNewFiles() {
  const current = findJsonFilesInSubfolders();
  const newFiles = current.filter(f => !knownFiles.has(f));
  return newFiles;
}

function runRScriptForFiles(files) {
  if (files.length === 0) return;

  const groups = files.reduce((acc, f) => {
    const sub = path.basename(path.dirname(f));
    acc[sub] = acc[sub] || [];
    acc[sub].push(f);
    return acc;
  }, {});

  Object.entries(groups).forEach(([subfolder, filesInSub]) => {
    updateCount++;
    const label = `${subfolder}_${updateCount}`;

    console.log(`🧠 Found ${filesInSub.length} new JSON(s) in '${subfolder}' → label=${label}`);

    const args = [resultsBase, label, ...filesInSub];

    const rEnv = Object.assign({}, process.env, { TZ: process.env.TZ || 'UTC' });
    const rProc = spawn('Rscript', [rScript, ...args], { stdio: ['ignore', 'pipe', 'pipe'], env: rEnv });
      activeProcs.add(rProc);

    // defensive: attach error handlers to child streams so a stream-level EBADF doesn't crash the watcher
    if (rProc.stdout) {
      rProc.stdout.on('data', d => {
        try {
          if (process.stdout && process.stdout.writable) process.stdout.write(`📤 R: ${d}`);
        } catch (werr) {
          console.error('Error writing R stdout to watcher stdout:', werr && werr.message ? werr.message : werr);
        }
      });
      rProc.stdout.on('error', err => {
        console.error('Error on R stdout stream:', err && err.message ? err.message : err);
      });
    }
    if (rProc.stderr) {
      rProc.stderr.on('data', d => {
        try {
          if (process.stderr && process.stderr.writable) process.stderr.write(`⚠️ R: ${d}`);
        } catch (werr) {
          console.error('Error writing R stderr to watcher stderr:', werr && werr.message ? werr.message : werr);
        }
      });
      rProc.stderr.on('error', err => {
        console.error('Error on R stderr stream:', err && err.message ? err.message : err);
      });
    }
    rProc.on('close', code => {
      console.log(`✅ Rscript exited with code ${code} for ${label}`);
      activeProcs.delete(rProc);
      // if running once and no active children remain, exit gracefully
      if (once && activeProcs.size === 0) {
        console.log('⏹ --once complete; no active R processes remain. Exiting.');
        process.exit(0);
      }
      if (code === 0) {
        filesInSub.forEach(f => knownFiles.add(f));
        console.log(`ℹ️ R processing finished for ${label}. Marked ${filesInSub.length} file(s) as processed.`);
        // Try to find the produced cgmlst profile in the results folder for this subfolder.
        try {
          const outFolder = path.join(resultsBase, subfolder);
          if (fs.existsSync(outFolder)) {
            const profFiles = fs.readdirSync(outFolder).filter(fn => fn.startsWith('cgmlst.profile.'));
            profFiles.sort((a,b) => {
              const sa = fs.statSync(path.join(outFolder,a)).mtimeMs;
              const sb = fs.statSync(path.join(outFolder,b)).mtimeMs;
              return sa - sb;
            });
            if (profFiles.length > 0) {
              const latest = path.join(outFolder, profFiles[profFiles.length - 1]);
              console.log(`🔎 Found output profile: ${latest}. Running fast_profiles compare/append.`);
              const nodeMgr = path.resolve(repoRoot, 'fast_profiles', 'node', 'ref_manager.js');
              // run compare first
              try {
                const cmp = spawnSync('node', [nodeMgr, '--action', 'compare', '--ref-dir', path.resolve(repoRoot, 'fast_profiles', 'ref'), '--new', latest, '--threshold', process.env.FAST_THRESHOLD || '10'], { stdio: 'inherit' });
                if (cmp.status === 0) {
                  console.log('ℹ️ Compare finished OK, appending to reference');
                  const app = spawnSync('node', [nodeMgr, '--action', 'append', '--ref-dir', path.resolve(repoRoot, 'fast_profiles', 'ref'), '--new', latest], { stdio: 'inherit' });
                  if (app.status === 0) {
                    console.log('✅ Append finished OK');
                  } else {
                    console.error('❌ Append failed with code', app.status);
                  }
                } else {
                  console.log('ℹ️ Compare reported non-zero status; skipping append');
                }
              } catch (err) {
                console.error('❌ Error running node ref_manager:', err && err.message ? err.message : err);
              }
            }
          }
        } catch (err) {
          console.error('Error while running fast_profiles integration:', err && err.message ? err.message : err);
        }
      } else {
        console.error(`❌ Rscript failed for ${label} (exit ${code}). Files will remain unmarked and retried next cycle.`);
      }
    });
    rProc.on('error', err => {
      console.error(`❌ Failed to start Rscript for ${label}:`, err && err.message ? err.message : err);
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

console.log('⏳ Initial scan - starting check cycles...');
knownFiles = new Set();
setInterval(() => {
  try {
    checkCycle();
  } catch (err) {
    console.error('Error during check cycle:', err && err.stack ? err.stack : err);
  }
}, checkIntervalMs);
// don't touch process.stdin — under nohup/daemonized runs this can lead to EBADF on some platforms
