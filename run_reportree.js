const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const notifier = require('node-notifier');

// Base folder where process_json.R writes results: each subfolder contains profiles and metadata
const resultsBase = path.resolve(__dirname, 'intermediate_files', 'profiles_for_reportree');
const watchedFolder = resultsBase; // each subfolder corresponds to input subfolder
const outputClusterBase = path.resolve(__dirname, 'intermediate_files', 'clusters');
const checkInterval = 30 * 1000;

if (!fs.existsSync(outputClusterBase)) fs.mkdirSync(outputClusterBase, { recursive: true });

let processedLabels = new Set();

function findPairs() {
  if (!fs.existsSync(watchedFolder)) return [];
  const subfolders = fs.readdirSync(watchedFolder, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  const pairs = [];
  for (const sub of subfolders) {
    const folder = path.join(watchedFolder, sub);
    const files = fs.readdirSync(folder).filter(f => f.startsWith('cgmlst.profile.') || f.startsWith('metadata.tsv.'));
    const profiles = files.filter(f => f.startsWith('cgmlst.profile.'));
    const metas = files.filter(f => f.startsWith('metadata.tsv.'));

    profiles.forEach(profile => {
      // extract label part from filename: cgmlst.profile.<label>_YYYY-MM-DD
      const m = profile.match(/^cgmlst\.profile\.(.+)_\d{4}-\d{2}-\d{2}$/);
      if (!m) return;
      const label = m[1];
      const meta = metas.find(mm => mm.includes(label));
      if (meta) pairs.push({ sub, label, profile, meta });
    });
  }
  return pairs;
}

function scanClusterComposition(sub, label) {
  const folder = path.join(outputClusterBase, sub, label);
  if (!fs.existsSync(folder)) return;
  const files = fs.readdirSync(folder).filter(f => f.endsWith('_clusterComposition.tsv'));
  if (files.length === 0) return;

  for (const file of files) {
    const filePath = path.join(folder, file);
    console.log(`🔍 Scanning cluster composition: ${filePath}`);
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#partition'));
    for (const line of lines) {
      const cols = line.split('\t');
      if (cols.length < 4) continue;
      const sampleList = cols[3].split(',').map(s => s.trim()).filter(Boolean);
      if (sampleList.length > 1) {
        const message = `Samples ${sampleList.join(' and ')} differ by <10 variants. Risk for outbreak!`;
        console.log(`⚠️  ${message}`);
        notifier.notify({ title: '🚨 Outbreak Alert', message, sound: true, wait: false });
      }
    }
  }
}

function runReportree(metaPath, allelePath, label, sub) {
  // Note: this uses docker run to invoke the official reportree image. For this to work
  // the environment running this script must have Docker available (or the container
  // must have access to the Docker socket).
  const absoluteResultsBase = path.resolve(__dirname, 'intermediate_files');

  // ensure the output directory for this subfolder exists on the host (so Docker can write into it)
  const hostOutputDir = path.join(absoluteResultsBase, 'clusters', sub);
  if (!fs.existsSync(hostOutputDir)) {
    fs.mkdirSync(hostOutputDir, { recursive: true });
  }

  // ensure label-specific output directory exists
  const hostLabelDir = path.join(hostOutputDir, label);
  if (!fs.existsSync(hostLabelDir)) {
    fs.mkdirSync(hostLabelDir, { recursive: true });
  }

  // run docker as the current user to avoid root-owned files and set the container working dir
  const uid = (typeof process.getuid === 'function') ? process.getuid() : 1000;
  const gid = (typeof process.getgid === 'function') ? process.getgid() : 1000;

  const cmd = [
    'docker run --rm',
    `-v ${absoluteResultsBase}:/data`,
    `-w /data`,
    `--user ${uid}:${gid}`,
    'insapathogenomics/reportree',
    'reportree.py',
    `-m /data/profiles_for_reportree/${sub}/${path.basename(metaPath)}`,
    `-a /data/profiles_for_reportree/${sub}/${path.basename(allelePath)}`,
    '--columns_summary_report Region,n_Region',
    `-out /data/clusters/${sub}/${label}`,
    '--analysis grapetree',
    '--method MSTreeV2',
    '-thr 10'
  ].join(' ');

  console.log(`🚀 Running Reportree for ${label} (subfolder=${sub})...`);
  console.log('▶️', cmd);

  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Reportree error for ${label}:`, error.message);
      return;
    }
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    console.log(`✅ Reportree finished for ${label}`);
    scanClusterComposition(sub, label);
  });
}

function checkForNewReports() {
  const pairs = findPairs();
  for (const { sub, label, profile, meta } of pairs) {
    if (processedLabels.has(`${sub}:${label}`)) continue;
    const profilePath = path.join(watchedFolder, sub, profile);
    const metaPath = path.join(watchedFolder, sub, meta);

    // Basic validation: ensure files exist, are non-empty and look like tabular TSVs
    function isLikelyTsv(fp) {
      try {
        if (!fs.existsSync(fp)) return false;
        const s = fs.statSync(fp);
        if (!s || s.size === 0) return false;
        const content = fs.readFileSync(fp, { encoding: 'utf8', flag: 'r' });
        const firstLine = content.split(/\r?\n/)[0] || '';
        // a crude check: TSV should have at least one tab or spaces separating columns
        return firstLine.includes('\t') || firstLine.match(/\s+/);
      } catch (e) {
        return false;
      }
    }

    if (!isLikelyTsv(profilePath) || !isLikelyTsv(metaPath)) {
      console.warn(`⚠️ Skipping Reportree for ${label} (sub=${sub}) — profile or metadata not ready or empty`);
      // don't mark as processed so we will retry on next interval
      continue;
    }

    runReportree(metaPath, profilePath, label, sub);
    processedLabels.add(`${sub}:${label}`);
  }
  if (pairs.length === 0) console.log(`⏳ No new R output files detected (${new Date().toLocaleTimeString()})`);
}

console.log(`👀 Watching for new R output files in ${watchedFolder}`);
checkForNewReports();
setInterval(checkForNewReports, checkInterval);
