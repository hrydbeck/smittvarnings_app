const fs = require('fs').promises; // promises API
const path = require('path');
const glob = require('glob');
const notifier = require('node-notifier');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

// Send desktop notification + email
async function sendAlert(title, html) {
  console.log('ALERT:', title);
  console.log(html);

  notifier.notify({ title, message: html.replace(/<[^>]+>/g, ''), wait: false });

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: process.env.ALERT_EMAIL,
      subject: title,
      html,
    });
    console.log("📧 Email sent:", info.response);
  } catch (err) {
    console.error("❌ Failed to send email:", err);
  }
}

// Scan cluster folder for multi-sample clusters
async function checkClusters(clusterDir, MST_THRESHOLD = 10) {
  const pattern = path.join(clusterDir, '*_clusterComposition.tsv');

  const files = await new Promise((resolve, reject) => {
    glob(pattern, (err, matches) => err ? reject(err) : resolve(matches));
  });

  if (files.length === 0) {
    console.log(`ℹ️ No cluster files found in ${clusterDir}`);
    return;
  }

  console.log(`📝 Cluster files found: ${files.join(', ')}`);

  for (const f of files) {
    console.log(`📄 Reading cluster file: ${f}`);
    const content = await fs.readFile(f, 'utf-8');
    const lines = content.split(/\r?\n/);

    for (const l of lines) {
      if (!l.trim() || l.startsWith('partition')) continue;
      const cols = l.split('\t');
      if (cols.length < 4) continue;

      if (cols[3].includes(',')) {
        const samples = cols[3].split(',').map(s => s.trim()).filter(Boolean);
        console.log(`⚠️ Multi-sample cluster detected: ${samples.join(' and ')} (threshold ${MST_THRESHOLD})`);

        await sendAlert(
          'Mimosa Alert: Multi-sample cluster detected 🚨',
          `<p>Samples ${samples.join(' and ')} differ by less than ${MST_THRESHOLD} variants. Risk for outbreak!</p>`
        );
      }
    }
  }
}

module.exports = { checkClusters };
