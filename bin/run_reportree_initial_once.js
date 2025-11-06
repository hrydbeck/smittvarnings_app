const { findPairs, runReportree, watchedFolder } = require('./reportree_common');
const fs = require('fs');
const path = require('path');

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

async function main() {
  console.log(`👀 One-shot: checking for initial R output files in ${watchedFolder}`);
  const pairs = findPairs();
  if (!pairs || pairs.length === 0) {
    console.log('⏳ No R output files detected (one-shot)');
    process.exit(0);
  }

  for (const { sub, label, profile, meta } of pairs) {
    const profilePath = path.join(watchedFolder, sub, profile);
    const metaPath = path.join(watchedFolder, sub, meta);
    if (!isLikelyTsv(profilePath) || !isLikelyTsv(metaPath)) {
      console.warn(`⚠️ Skipping Reportree for ${label} (sub=${sub}) — profile or metadata not ready or empty`);
      continue;
    }
    await runReportree(metaPath, profilePath, label, sub);
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(2); });
