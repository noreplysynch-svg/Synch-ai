import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) {
    console.warn('[mailer] SMTP_HOST not set — emails will be logged to the console instead of sent.');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

export async function sendEmail({ to, subject, html }) {
  const t = getTransporter();
  if (!t) {
    // Dev fallback so the flow is still testable without SMTP configured
    console.log(`\n[mailer] (no SMTP configured) Would send email to ${to}\nSubject: ${subject}\n${html}\n`);
    return;
  }
  await t.sendMail({
    from: process.env.SMTP_FROM || 'Synch AI <no-reply@synch.app>',
    to,
    subject,
    html,
  });
}

export async function sendOtpEmail(to, code) {
  await sendEmail({
    to,
    subject: 'Your Synch AI sign-in code',
    html: `<p>Your sign-in code is:</p><h2 style="letter-spacing:4px">${code}</h2><p>This code expires in 10 minutes.</p>`,
  });
}

export async function sendPasswordResetEmail(to, resetUrl) {
  await sendEmail({
    to,
    subject: 'Reset your Synch AI password',
    html: `<p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
  });
}
