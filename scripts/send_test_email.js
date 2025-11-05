#!/usr/bin/env node
/*
Simple test script to send an email using .env credentials.
Usage:
  node scripts/send_test_email.js

This script loads environment variables from `.env` via dotenv and uses
nodemailer to attempt a single test send to ALERT_EMAIL.
*/

require('dotenv').config();
const nodemailer = require('nodemailer');

function missing(key) {
  console.error(`Missing required env var: ${key}`);
  return true;
}

if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.ALERT_EMAIL || !process.env.SMTP_FROM) {
  console.error('One or more required SMTP env vars are missing. Please copy .env.example -> .env and fill in.');
  console.error('Required: SMTP_HOST, SMTP_PORT, SMTP_FROM, ALERT_EMAIL');
  process.exit(1);
}

(async () => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } } : {}),
    });

    console.log(`Sending test email to ${process.env.ALERT_EMAIL} via ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: process.env.ALERT_EMAIL,
      subject: process.env.TEST_EMAIL_SUBJECT || 'smittvarnings_app test email',
      text: process.env.TEST_EMAIL_TEXT || 'This is a test email from smittvarnings_app (ignore).',
    });

    console.log('Email sent OK:', info && info.response ? info.response : JSON.stringify(info));
    process.exit(0);
  } catch (err) {
    console.error('Send failed:', err && err.message ? err.message : err);
    process.exit(2);
  }
})();
