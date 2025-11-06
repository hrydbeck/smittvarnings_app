const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { checkClusters } = require('./evaluate_alert_by_clust_dist');

const repoRoot = path.resolve(__dirname, '..');
const resultsBase = path.resolve(repoRoot, 'intermediate_files', 'profiles_for_reportree');
const watchedFolder = resultsBase;
const outputClusterBase = path.resolve(repoRoot, 'intermediate_files', 'clusters');

if (!fs.existsSync(outputClusterBase)) fs.mkdirSync(outputClusterBase, { recursive: true });

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
      // Expect filenames: cgmlst.profile.<sub>_<YYYY-MM-DD>_<n>
      // and metadata: metadata.tsv.<sub>_<YYYY-MM-DD>_<n>
      const m = profile.match(/^cgmlst\.profile\.([A-Za-z0-9_]+)_(\d{4}-\d{2}-\d{2})_(\d+)$/);
      if (!m) return;
      const fileSub = m[1];
      // ensure the profile's subfolder matches the expected sub
      if (fileSub !== sub) return;
      const datePart = m[2];
      const seq = m[3];
      const label = `${datePart}_${seq}`;
      const expectedMeta = `metadata.tsv.${fileSub}_${datePart}_${seq}`;
      if (metas.includes(expectedMeta)) pairs.push({ sub, label, profile, meta: expectedMeta });
    });
  }
  return pairs;
}

async function scanClusterComposition(sub, label) {
  const folder = path.join(outputClusterBase, sub);
  if (!fs.existsSync(folder)) {
    console.log(`⚠️ Cluster folder does not exist: ${folder}`);
    return;
  }

  console.log(`🔍 Scanning cluster composition for ${sub}/${label}`);

  try {
    await checkClusters(folder);
    console.log(`✅ Finished scanning clusters for ${sub}/${label}`);
  } catch (err) {
    console.error('❌ Error scanning clusters:', err);
  }
}

function findLatestPartitionsForSub(sub) {
  const folder = path.join(outputClusterBase, sub);
  if (!fs.existsSync(folder)) return null;
  const files = fs.readdirSync(folder).filter(f => f.endsWith('_partitions.tsv'));
  if (files.length === 0) return null;
  // sort by mtime desc
  files.sort((a, b) => {
    const sa = fs.statSync(path.join(folder, a)).mtimeMs;
    const sb = fs.statSync(path.join(folder, b)).mtimeMs;
    return sb - sa;
  });
  return path.join(folder, files[0]);
}

function runReportree(metaPath, allelePath, label, sub, options = {}) {
  const absoluteResultsBase = path.resolve(repoRoot, 'intermediate_files');
  const hostResultsBase = process.env.HOST_RESULTS_BASE || absoluteResultsBase;

  const hostOutputDir = path.join(absoluteResultsBase, 'clusters', sub);
  if (!fs.existsSync(hostOutputDir)) fs.mkdirSync(hostOutputDir, { recursive: true });

  const hostLabelDir = path.join(hostOutputDir, label);
  if (!fs.existsSync(hostLabelDir)) fs.mkdirSync(hostLabelDir, { recursive: true });

  const uid = (typeof process.getuid === 'function') ? process.getuid() : 1000;
  const gid = (typeof process.getgid === 'function') ? process.getgid() : 1000;

  const cmdParts = [
    'docker run --rm',
    `-v ${hostResultsBase}:/data`,
    `-w /data`,
    `--user ${uid}:${gid}`,
    'insapathogenomics/reportree',
    'reportree.py',
    `-m /data/profiles_for_reportree/${sub}/${path.basename(metaPath)}`,
    `-a /data/profiles_for_reportree/${sub}/${path.basename(allelePath)}`
  ];

  if (options.nomenclatureFile) {
    // accept a host-side path and map it into /data
    const nomBasename = path.basename(options.nomenclatureFile);
    cmdParts.push(`--nomenclature-file /data/clusters/${sub}/${nomBasename}`);
  }

  cmdParts.push('--columns_summary_report Region,n_Region');
  cmdParts.push(`-out /data/clusters/${sub}/${label}`);
  cmdParts.push('--analysis grapetree');
  cmdParts.push('--method MSTreeV2');
  cmdParts.push('-thr 10');

  const cmd = cmdParts.join(' ');

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
    await scanClusterComposition(sub, label);
  });
}

module.exports = {
  findPairs,
  runReportree,
  scanClusterComposition,
  findLatestPartitionsForSub,
  watchedFolder,
  outputClusterBase
};
