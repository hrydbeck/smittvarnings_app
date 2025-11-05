const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const glob = require('glob');
const notifier = require('node-notifier');
require('dotenv').config();

let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (e) { /* optional */ }

// Create transporter if SMTP config is present and nodemailer is available
function makeTransporter() {
  if (!nodemailer) return null;
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !port || !process.env.ALERT_EMAIL) return null;
  const opts = { host, port, secure: port === 465 };
  if (user && pass) opts.auth = { user, pass };
  return nodemailer.createTransport(opts);
}

const transporter = makeTransporter();

async function sendAlert(title, html) {
  console.log('ALERT:', title);
  console.log(html);
  try {
    notifier.notify({ title, message: html.replace(/<[^>]+>/g, ''), wait: false });
  } catch (e) {
    console.warn('Notifier failed:', e && e.message ? e.message : e);
  }

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || `mimosa@${process.env.SMTP_HOST || 'localhost'}`,
        to: process.env.ALERT_EMAIL,
        subject: title,
        html,
      });
      console.log('📧 Email sent:', info && info.response ? info.response : info);
    } catch (err) {
      console.error('❌ Failed to send email alert:', err && err.message ? err.message : err);
    }
  }
}

async function checkClusters(clusterDir, MST_THRESHOLD = 10) {
  const pattern = path.join(clusterDir, '*_clusterComposition.tsv');
  const files = glob.sync(pattern);
  if (!files || files.length === 0) {
    console.log(`ℹ️ No cluster files found in ${clusterDir}`);
    return;
  }

  for (const f of files) {
    let content = '';
    try {
      content = await fsp.readFile(f, 'utf-8');
    } catch (e) {
      console.error(`❌ Failed to read ${f}:`, e && e.message ? e.message : e);
      continue;
    }
    const lines = content.split(/\r?\n/);
    for (const l of lines) {
      if (!l.trim() || l.startsWith('partition')) continue;
      const cols = l.split('\t');
      if (cols.length < 4) continue;
      if (cols[3].includes(',')) {
        const samples = cols[3].split(',').map(s => s.trim()).filter(Boolean);
        await sendAlert(
          'Mimosa Alert: Multi-sample cluster detected 🚨',
          `<p>Samples ${samples.join(' and ')} differ by less than ${MST_THRESHOLD} variants. Risk for outbreak!</p>`
        );
      }
    }
  }
}

module.exports = { checkClusters };

if (require.main === module) {
  const workdir = process.argv[2] || path.resolve(__dirname, '..', 'intermediate_files', 'clusters');
  const thr = Number(process.argv[3]) || 10;
  console.log(`🔍 Checking clusters in ${workdir} (threshold=${thr})`);
  (async () => {
    try {
      await checkClusters(workdir, thr);
      console.log('✅ Done scanning clusters');
    } catch (err) {
      console.error('❌ Error scanning clusters:', err && err.message ? err.message : err);
      process.exit(1);
    }
  })();
}
