const fs = require('fs');
const path = require('path');
const glob = require('glob');
const notifier = require('node-notifier');

function sendAlert(title, html) {
  console.log('ALERT:', title);
  console.log(html);
  notifier.notify({ title, message: html.replace(/<[^>]+>/g, ''), wait: false });
}

function checkClusters(clusterDir, MST_THRESHOLD = 10) {
  const pattern = path.join(clusterDir, '*_clusterComposition.tsv');
  const files = glob.sync(pattern);
  files.forEach(f => {
    const lines = fs.readFileSync(f, 'utf-8').split('\n');
    lines.forEach(l => {
      if (!l.trim() || l.startsWith('partition')) return;
      const cols = l.split('\t');
      if (cols.length < 4) return;
      if (cols[3].includes(',')) {
        const samples = cols[3].split(',').map(s => s.trim()).filter(Boolean);
        sendAlert(
          'Mimosa Alert: Multi-sample cluster detected 🚨',
          `<p>Samples ${samples.join(' and ')} differ by less than ${MST_THRESHOLD} variants. Risk for outbreak!</p>`
        );
      }
    });
  });
}

module.exports = { checkClusters };

if (require.main === module) {
  const workdir = process.argv[2] || path.resolve(__dirname, 'intermediate_files', 'clusters');
  console.log(`🔍 Checking clusters in ${workdir}`);
  checkClusters(workdir);
}
