import nodemailer from "nodemailer";

// Lazily create the transporter so missing env vars don't crash startup
let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587");
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn(
      "[mailer] SMTP_HOST / SMTP_USER / SMTP_PASS not fully configured. " +
        "Emails will NOT be sent. Set these in .env to enable password reset emails."
    );
  } else {
    console.info(`[mailer] Configured SMTP: ${host}:${port} user=${user}`);
  }

  _transporter = nodemailer.createTransport({
    host: host ?? "smtp.ethereal.email",
    port,
    secure,
    auth: { user: user ?? "", pass: pass ?? "" },
    // Required for Gmail
    tls: { rejectUnauthorized: false },
  });

  return _transporter;
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetUrl: string
): Promise<void> {
  // For Gmail, the From address MUST be the authenticated SMTP_USER
  const smtpUser = process.env.SMTP_USER;
  const configuredFrom = process.env.SMTP_FROM;
  // If using Gmail, override From to use the actual Gmail address
  const from = smtpUser?.includes("gmail.com")
    ? `IT Inventory <${smtpUser}>`
    : (configuredFrom ?? `IT Inventory <${smtpUser}>`);

  const expiresMinutes = process.env.RESET_TOKEN_EXPIRES_MINUTES ?? "60";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #1a56db; padding: 32px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 24px; }
    .body { padding: 32px; color: #333; line-height: 1.6; }
    .button { display: inline-block; margin: 24px 0; padding: 14px 28px; background: #1a56db; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; }
    .note { color: #888; font-size: 13px; margin-top: 24px; }
    .footer { background: #f5f5f5; padding: 16px 32px; font-size: 12px; color: #aaa; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔒 Password Reset</h1>
    </div>
    <div class="body">
      <p>Hello <strong>${name}</strong>,</p>
      <p>We received a request to reset your password for the <strong>Umurenge IT Inventory</strong> system.</p>
      <p>Click the button below to reset your password:</p>
      <a class="button" href="${resetUrl}">Reset My Password</a>
      <p>This link will expire in <strong>${expiresMinutes} minutes</strong>.</p>
      <p class="note">
        If you didn't request a password reset, you can safely ignore this email.
        Your password will not change.<br/><br/>
        Or copy this link into your browser:<br/>
        <small>${resetUrl}</small>
      </p>
    </div>
    <div class="footer">
      Umurenge IT Inventory Management System &mdash; This is an automated email, do not reply.
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Hello ${name},

We received a request to reset your Umurenge IT Inventory password.

Reset your password here: ${resetUrl}

This link expires in ${expiresMinutes} minutes.

If you didn't request this, ignore this email.

— Umurenge IT Inventory System
  `.trim();

  const transporter = getTransporter();
  await transporter.sendMail({ from, to, subject: "Password Reset – Umurenge IT Inventory", text, html });
}