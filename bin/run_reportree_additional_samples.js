const fs = require('fs');
const path = require('path');
const { findPairs, runReportree, findLatestPartitionsForSub, watchedFolder } = require('./reportree_common');

const checkInterval = 30 * 1000;
let processedLabels = new Set();

function isLikelyTsv(fp) {
  try {
    if (!fs.existsSync(fp)) return false;
    const s = fs.statSync(fp);
    if (!s || s.size === 0) return false;
    const content = fs.readFileSync(fp, 'utf-8');
    return content.split(/\r?\n/)[0].includes('\t');
  } catch {
    return false;
  }
}

function checkForAdditionalReports() {
  const pairs = findPairs();
  for (const { sub, label, profile, meta } of pairs) {
    if (processedLabels.has(`${sub}:additional:${label}`)) continue;

    const profilePath = path.join(watchedFolder, sub, profile);
    const metaPath = path.join(watchedFolder, sub, meta);

    if (!isLikelyTsv(profilePath) || !isLikelyTsv(metaPath)) {
      console.warn(`⚠️ Skipping additional Reportree for ${label} (sub=${sub}) — profile or metadata not ready or empty`);
      continue;
    }

    const partitions = findLatestPartitionsForSub(sub);
    if (!partitions) {
      console.warn(`⚠️ No existing partitions found for sub=${sub} — cannot run additional-samples mode for ${label}`);
      continue;
    }

    // pass nomenclature-file pointing to the latest partitions in the clusters folder
    runReportree(metaPath, profilePath, label, sub, { nomenclatureFile: partitions });
    processedLabels.add(`${sub}:additional:${label}`);
  }

  if (pairs.length === 0) console.log(`⏳ No new R output files detected for additional-samples (${new Date().toLocaleTimeString()})`);
}

console.log(`👀 Watching for new 'additional' R output files in ${watchedFolder}`);
checkForAdditionalReports();
setInterval(checkForAdditionalReports, checkInterval);
