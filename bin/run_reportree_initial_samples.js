const fs = require('fs');
const path = require('path');
const { findPairs, runReportree, watchedFolder } = require('./reportree_common');

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

function checkForNewReports() {
  const pairs = findPairs();
  for (const { sub, label, profile, meta } of pairs) {
    if (processedLabels.has(`${sub}:${label}`)) continue;

    const profilePath = path.join(watchedFolder, sub, profile);
    const metaPath = path.join(watchedFolder, sub, meta);

    if (!isLikelyTsv(profilePath) || !isLikelyTsv(metaPath)) {
      console.warn(`⚠️ Skipping Reportree for ${label} (sub=${sub}) — profile or metadata not ready or empty`);
      continue;
    }

    runReportree(metaPath, profilePath, label, sub);
    processedLabels.add(`${sub}:${label}`);
  }

  if (pairs.length === 0) console.log(`⏳ No new R output files detected (${new Date().toLocaleTimeString()})`);
}

console.log(`👀 Watching for new initial R output files in ${watchedFolder}`);
checkForNewReports();
setInterval(checkForNewReports, checkInterval);
