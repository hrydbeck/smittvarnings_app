const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { checkClusters } = require('./evaluate_alert_by_clust_dist_email'); 
const notifier = require('node-notifier');

// Base folders
const resultsBase = path.resolve(__dirname, 'intermediate_files', 'profiles_for_reportree');
const watchedFolder = resultsBase;
const outputClusterBase = path.resolve(__dirname, 'intermediate_files', 'clusters');
const checkInterval = 30 * 1000;

if (!fs.existsSync(outputClusterBase)) fs.mkdirSync(outputClusterBase, { recursive: true });

let processedLabels = new Set();

// Find profile/metadata pairs ready for Reportree
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
      const m = profile.match(/^cgmlst\.profile\.(.+)_\d{4}-\d{2}-\d{2}$/);
      if (!m) return;
      const label = m[1];
      const meta = metas.find(mm => mm.includes(label));
      if (meta) pairs.push({ sub, label, profile, meta });
    });
  }
  return pairs;
}

// Async scan for clusters
async function scanClusterComposition(sub, label) {
  const folder = path.join(outputClusterBase, sub); // <-- remove label from path
  if (!fs.existsSync(folder)) {
    console.log(`⚠️ Cluster folder does not exist: ${folder}`);
    return;
  }

  console.log(`🔍 Scanning cluster composition for ${sub}/${label}`);

  try {
    await checkClusters(folder);
    console.log(`✅ Finished scanning clusters for ${sub}/${label}`);
  } catch (err) {
    console.error("❌ Error scanning clusters:", err);
  }
}

// Run Reportree via Docker
function runReportree(metaPath, allelePath, label, sub) {
  const absoluteResultsBase = path.resolve(__dirname, 'intermediate_files');

  // Prepare output directories
  const hostOutputDir = path.join(absoluteResultsBase, 'clusters', sub);
  if (!fs.existsSync(hostOutputDir)) fs.mkdirSync(hostOutputDir, { recursive: true });

  const hostLabelDir = path.join(hostOutputDir, label);
  if (!fs.existsSync(hostLabelDir)) fs.mkdirSync(hostLabelDir, { recursive: true });

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

  console.log(`🚀 Running Reportree for ${label} (subfolder=${sub})`);
  console.log('▶️', cmd);

  exec(cmd, async (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Reportree error for ${label}:`, error.message);
      return;
    }
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);

    console.log(`✅ Reportree finished for ${label}`);
    
    // Await cluster scanning to avoid “stuck” perception
    await scanClusterComposition(sub, label);
  });
}

// Main check loop
function checkForNewReports() {
  const pairs = findPairs();
  for (const { sub, label, profile, meta } of pairs) {
    if (processedLabels.has(`${sub}:${label}`)) continue;

    const profilePath = path.join(watchedFolder, sub, profile);
    const metaPath = path.join(watchedFolder, sub, meta);

    // Validate files
    const isLikelyTsv = (fp) => {
      try {
        if (!fs.existsSync(fp)) return false;
        const s = fs.statSync(fp);
        if (!s || s.size === 0) return false;
        const content = fs.readFileSync(fp, 'utf-8');
        return content.split(/\r?\n/)[0].includes('\t');
      } catch {
        return false;
      }
    };

    if (!isLikelyTsv(profilePath) || !isLikelyTsv(metaPath)) {
      console.warn(`⚠️ Skipping Reportree for ${label} (sub=${sub}) — profile or metadata not ready or empty`);
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
