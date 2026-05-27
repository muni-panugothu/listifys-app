const nodemailer = require("nodemailer");
const { logger } = require("../utils/logger");

// Escape HTML special characters to prevent injection in email templates
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    throw new Error("Email credentials missing");
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === "production",
    },
  });
}

function getContactEmailTemplate({ name, email, subject, message }) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
      .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
      .header { background: linear-gradient(135deg, #27BB97 0%, #1e9b7d 100%); padding: 32px 40px; text-align: center; }
      .header h1 { color: white; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
      .header p { color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px; }
      .body { padding: 32px 40px; }
      .field { margin-bottom: 20px; }
      .field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #27BB97; margin-bottom: 6px; }
      .field-value { font-size: 15px; color: #1a1a2e; padding: 12px 16px; background: #f8fafb; border-left: 3px solid #27BB97; border-radius: 0 8px 8px 0; }
      .message-box { font-size: 15px; color: #1a1a2e; padding: 20px; background: #f8fafb; border-left: 3px solid #27BB97; border-radius: 0 8px 8px 0; white-space: pre-wrap; line-height: 1.7; }
      .footer { background: #f8fafb; padding: 20px 40px; text-align: center; border-top: 1px solid #eef1f3; }
      .footer p { margin: 0; font-size: 12px; color: #999; }
      .badge { display: inline-block; background: #27BB97; color: white; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; margin-bottom: 16px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>📩 New Contact Message</h1>
        <p>Someone reached out via Listifys Contact Form</p>
      </div>
      <div class="body">
        <div style="text-align:center;margin-bottom:24px">
          <span class="badge">New Inquiry</span>
        </div>
        <div class="field">
          <div class="field-label">👤 Name</div>
          <div class="field-value">${escapeHtml(name)}</div>
        </div>
        <div class="field">
          <div class="field-label">📧 Email</div>
          <div class="field-value"><a href="mailto:${encodeURI(email)}" style="color:#27BB97;text-decoration:none">${escapeHtml(email)}</a></div>
        </div>
        <div class="field">
          <div class="field-label">📋 Subject</div>
          <div class="field-value">${escapeHtml(subject)}</div>
        </div>
        <div class="field">
          <div class="field-label">💬 Message</div>
          <div class="message-box">${escapeHtml(message)}</div>
        </div>
      </div>
      <div class="footer">
        <p>This email was sent from the Listifys contact form • ${new Date().getFullYear()}</p>
      </div>
    </div>
  </body>
  </html>`;
}

exports.submitContactForm = async (req, res) => {
  try {
    const { name, email, subject, message, website } = req.body;

    // Honeypot: bots fill hidden "website" field; real users leave it empty
    if (website) {
      // Silently accept to not tip off bots, but don't send email
      return res.json({ success: true, message: "Message sent successfully" });
    }

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }

    const transporter = createTransporter();
    const ADMIN_EMAIL = process.env.CONTACT_FORM_EMAIL || "munipanugothu2001@gmail.com";

    await transporter.sendMail({
      from: `"Listifys Contact" <${process.env.EMAIL_USER}>`,
      to: ADMIN_EMAIL,
      replyTo: email,
      subject: `[Listifys Contact] ${subject}`,
      html: getContactEmailTemplate({ name, email, subject, message }),
    });

    logger.info("[Contact] Form submitted", { name, email, subject });
    res.json({ success: true, message: "Message sent successfully" });
  } catch (error) {
    logger.error("[Contact] submitContactForm error:", error);
    res.status(500).json({ success: false, message: "Failed to send message. Please try again." });
  }
};
