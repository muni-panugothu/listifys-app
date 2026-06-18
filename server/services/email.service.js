const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const nodemailer = require("nodemailer");
const { logger } = require("../utils/logger");

const SMTP_TIMEOUTS = {
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 15_000,
};

// Create transporter
function createTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    throw new Error(
      "Email credentials missing. Add EMAIL_USER and EMAIL_PASSWORD to .env file",
    );
  }

  const pass = process.env.EMAIL_PASSWORD.replace(/\s/g, "");
  const auth = {
    user: process.env.EMAIL_USER,
    pass,
  };

  // Custom relay (Brevo, SendGrid, Resend, etc.) — required on cloud hosts that block Gmail SMTP.
  if (process.env.SMTP_HOST) {
    const port = Number.parseInt(process.env.SMTP_PORT || "587", 10);
    const secure =
      process.env.SMTP_SECURE === "true" || port === 465;

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth,
      requireTLS: !secure,
      ...SMTP_TIMEOUTS,
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === "production",
      },
    });
  }

  // Gmail via STARTTLS on 587 — more reliable than implicit SSL when outbound 465 is blocked.
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth,
    ...SMTP_TIMEOUTS,
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === "production",
    },
  });
}

// Use EMAIL_FROM when set (required for Brevo/SendGrid verified senders).
// Falls back to the authenticated SMTP user for plain Gmail setups.
function getSenderAddress() {
  const from = process.env.EMAIL_FROM?.trim();
  if (from) return from;

  const user = process.env.EMAIL_USER;
  return `"Listifys" <${user}>`;
}

/** Deep link into the mobile app (not the beta website). */
function getAppDeepLink(path = "") {
  const scheme = (process.env.APP_DEEP_LINK_SCHEME || "listifyapp").replace(/:$/, "");
  const normalizedPath = String(path).replace(/^\//, "");
  return normalizedPath ? `${scheme}://${normalizedPath}` : `${scheme}://`;
}

function getAppSignInUrl() {
  return process.env.APP_SIGN_IN_URL?.trim() || getAppDeepLink("sign-in");
}

function getAppHomeUrl() {
  return process.env.APP_HOME_URL?.trim() || getAppDeepLink("");
}

function parseSenderAddress(raw) {
  const from = raw.trim();
  const quoted = from.match(/^"([^"]+)"\s*<([^>]+)>$/);
  if (quoted) return { name: quoted[1], email: quoted[2] };
  const plain = from.match(/^([^<]+?)\s*<([^>]+)>$/);
  if (plain) return { name: plain[1].trim(), email: plain[2].trim() };
  return { name: "Listifys", email: from };
}

/** Send via Brevo HTTP API (preferred) or SMTP when no API key is configured. */
async function sendTransactionalEmail({ to, subject, html }) {
  const brevoKey = process.env.BREVO_API_KEY?.trim();
  if (brevoKey) {
    const sender = parseSenderAddress(getSenderAddress());
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender,
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Brevo API error ${response.status}: ${body}`);
    }

    const data = await response.json();
    return { success: true, messageId: data.messageId, relay: "brevo-api" };
  }

  const transporter = createTransporter();
  const result = await transporter.sendMail({
    from: getSenderAddress(),
    to,
    subject,
    html,
  });
  return {
    success: true,
    messageId: result.messageId,
    relay: process.env.SMTP_HOST || "smtp.gmail.com",
  };
}

/** Verify SMTP on startup — logs a clear error when relay credentials are wrong. */
async function verifyEmailTransport() {
  const brevoKey = process.env.BREVO_API_KEY?.trim();
  if (brevoKey) {
    try {
      const response = await fetch("https://api.brevo.com/v3/account", {
        headers: { "api-key": brevoKey, accept: "application/json" },
      });
      if (response.ok) {
        logger.info("Email transport ready", {
          relay: "brevo-api",
          from: getSenderAddress(),
        });
        return { ok: true };
      }
      const body = await response.text();
      throw new Error(`Brevo API ${response.status}: ${body}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Brevo API verification failed — OTP emails will not deliver", {
        error: message,
        hint: "Create an API key at Brevo → SMTP & API → API Keys, and verify EMAIL_FROM sender",
      });
      return { ok: false, reason: message };
    }
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    logger.warn(
      "Email not configured — OTP emails will fail. Set BREVO_API_KEY or EMAIL_USER/EMAIL_PASSWORD in server/.env",
    );
    return { ok: false, reason: "missing_credentials" };
  }

  const relay = process.env.SMTP_HOST || "smtp.gmail.com";

  try {
    const transporter = createTransporter();
    await transporter.verify();
    logger.info("Email transport ready", { relay, from: getSenderAddress() });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Email transport verification failed — OTP/password emails will not deliver", {
      relay,
      error: message,
      hint: process.env.SMTP_HOST
        ? "SMTP blocked on this network — set BREVO_API_KEY for HTTP delivery (see server/.env.example)"
        : "Gmail SMTP is blocked on many hosts — set BREVO_API_KEY or SMTP_HOST (see server/.env.example)",
    });
    return { ok: false, reason: message };
  }
}

// OTP Email Template
function getOTPEmailTemplate(username, otpCode) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { 
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
        line-height: 1.6; 
        color: #333; 
        margin: 0;
        padding: 0;
        background-color: #f5f5f5;
      }
      .container { 
        max-width: 600px; 
        margin: 0 auto; 
        padding: 0;
        background: white;
        border-radius: 10px;
        overflow: hidden;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }
      .header { 
        background: linear-gradient(135deg, #27bb97 0%, #1fa987 100%); 
        color: white; 
        padding: 40px 20px; 
        text-align: center;
      }
      .header h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 600;
      }
      .content { 
        padding: 40px; 
        background: #ffffff;
      }
      .otp-container {
        text-align: center;
        margin: 30px 0;
      }
      .otp-code { 
        background: #27bb97; 
        color: white; 
        padding: 20px; 
        font-size: 32px; 
        font-weight: bold; 
        text-align: center; 
        letter-spacing: 8px;
        border-radius: 8px;
        margin: 20px auto;
        display: inline-block;
        min-width: 200px;
        box-shadow: 0 4px 15px rgba(39, 187, 151, 0.3);
      }
      .security-note { 
        background: #fff8e1; 
        padding: 20px; 
        border-left: 4px solid #ffc107;
        border-radius: 4px;
        margin: 30px 0;
        font-size: 14px;
      }
      .security-note h3 {
        color: #d97706;
        margin-top: 0;
      }
      .footer { 
        text-align: center; 
        padding: 20px; 
        color: #666;
        font-size: 12px;
        border-top: 1px solid #eee;
        background: #f9f9f9;
      }
      .brand {
        font-weight: bold;
        color: #27bb97;
        font-size: 18px;
        margin-bottom: 10px;
      }
      .expiry {
        color: #666;
        font-style: italic;
        margin: 10px 0;
      }
      @media only screen and (max-width: 600px) {
        .content { padding: 20px; }
        .otp-code { font-size: 24px; letter-spacing: 5px; }
        .header { padding: 30px 15px; }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Verify Your Email</h1>
      </div>
      <div class="content">
        <div class="brand">Listifys</div>
        <h2 style="color: #333; margin-bottom: 20px;">Hello ${username}!</h2>
        <p style="font-size: 16px; color: #555; margin-bottom: 25px;">
          Welcome to Listifys! Use the OTP below to complete your registration.
        </p>
        
        <div class="otp-container">
          <p style="margin-bottom: 15px; color: #666;">Your One-Time Password:</p>
          <div class="otp-code">${otpCode}</div>
          <p class="expiry">⏰ Expires in 10 minutes</p>
        </div>
        
        <div class="security-note">
          <h3>🔒 Security Notice:</h3>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Never share this code with anyone</li>
            <li>Our team will never ask for your OTP</li>
            <li>This code can only be used once</li>
          </ul>
        </div>
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} Listifys. All rights reserved.</p>
        <p>Edit Smarter. Export Faster. Create Anywhere.</p>
      </div>
    </div>
  </body>
  </html>
  `;
}

// Send OTP Email - REAL EMAILS ONLY
async function sendOTPEmail(email, username, otp) {
  try {
    logger.info('Sending OTP email', { to: email });

    const result = await sendTransactionalEmail({
      to: email,
      subject: "Your Listifys Verification Code",
      html: getOTPEmailTemplate(username, otp),
    });

    logger.info('OTP email sent successfully', {
      messageId: result.messageId,
      relay: result.relay,
      from: getSenderAddress(),
    });

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error) {
    logger.error('Error sending OTP email', { error: error.message });

    if (
      error.message.includes("Invalid login") ||
      error.message.includes("Authentication failed")
    ) {
      logger.error('Email authentication failed — check BREVO_API_KEY or SMTP credentials');
    }

    throw error;
  }
}

// Forgot Password OTP Template
const getForgotPasswordOTPTemplate = (username, otpCode) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { 
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
        line-height: 1.6; 
        color: #333; 
        margin: 0;
        padding: 0;
        background-color: #f5f5f5;
      }
      .container { 
        max-width: 600px; 
        margin: 0 auto; 
        padding: 0;
        background: white;
        border-radius: 10px;
        overflow: hidden;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }
      .header { 
        background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%); 
        color: white; 
        padding: 40px 20px; 
        text-align: center;
      }
      .header h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 600;
      }
      .content { 
        padding: 40px; 
        background: #ffffff;
      }
      .otp-container {
        text-align: center;
        margin: 30px 0;
      }
      .otp-code { 
        background: #DC2626; 
        color: white; 
        padding: 20px; 
        font-size: 32px; 
        font-weight: bold; 
        text-align: center; 
        letter-spacing: 8px;
        border-radius: 8px;
        margin: 20px auto;
        display: inline-block;
        min-width: 200px;
        box-shadow: 0 4px 15px rgba(220, 38, 38, 0.3);
      }
      .security-note { 
        background: #fff8e1; 
        padding: 20px; 
        border-left: 4px solid #ffc107;
        border-radius: 4px;
        margin: 30px 0;
        font-size: 14px;
      }
      .security-note h3 {
        color: #d97706;
        margin-top: 0;
      }
      .footer { 
        text-align: center; 
        padding: 20px; 
        color: #666;
        font-size: 12px;
        border-top: 1px solid #eee;
        background: #f9f9f9;
      }
      .brand {
        font-weight: bold;
        color: #27bb97;
        font-size: 18px;
        margin-bottom: 10px;
      }
      .expiry {
        color: #666;
        font-style: italic;
        margin: 10px 0;
      }
      .reset-instruction {
        background: #f0f9ff;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
        border-left: 4px solid #0ea5e9;
      }
      @media only screen and (max-width: 600px) {
        .content { padding: 20px; }
        .otp-code { font-size: 24px; letter-spacing: 5px; }
        .header { padding: 30px 15px; }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Reset Your Password</h1>
      </div>
      <div class="content">
        <div class="brand">Listifys</div>
        <h2 style="color: #333; margin-bottom: 20px;">Hello ${username}!</h2>
        <p style="font-size: 16px; color: #555; margin-bottom: 25px;">
          We received a request to reset your password for your Listifys account.
          Use the OTP below to verify your identity and reset your password.
        </p>
        
        <div class="otp-container">
          <p style="margin-bottom: 15px; color: #666;">Your Password Reset OTP:</p>
          <div class="otp-code">${otpCode}</div>
          <p class="expiry">⏰ Expires in 10 minutes</p>
        </div>
        
        <div class="reset-instruction">
          <h3 style="color: #0ea5e9; margin-top: 0;">Instructions:</h3>
          <p style="margin: 10px 0;">
            1. Enter this OTP in the password reset page<br>
            2. Create a new secure password<br>
            3. Login with your new password
          </p>
        </div>
        
        <div class="security-note">
          <h3>🔒 Security Notice:</h3>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Never share this code with anyone</li>
            <li>Our team will never ask for your OTP</li>
            <li>If you didn't request this, please secure your account</li>
            <li>This code can only be used once</li>
          </ul>
        </div>
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} Listifys. All rights reserved.</p>
        <p>Edit Smarter. Export Faster. Create Anywhere.</p>
      </div>
    </div>
  </body>
  </html>
  `;
};

// Send Forgot Password OTP Email
async function sendForgotPasswordOTPEmail(email, username, otp) {
  try {
    logger.info('Sending forgot password OTP email', { to: email });

    const result = await sendTransactionalEmail({
      to: email,
      subject: "Password Reset OTP - Listifys",
      html: getForgotPasswordOTPTemplate(username, otp),
    });

    logger.info('Forgot password OTP email sent', {
      messageId: result.messageId,
      relay: result.relay,
      from: getSenderAddress(),
    });

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error) {
    logger.error('Error sending forgot password OTP email', { error: error.message });

    if (
      error.message.includes("Invalid login") ||
      error.message.includes("Authentication failed")
    ) {
      logger.error('Email authentication failed — check BREVO_API_KEY or SMTP credentials');
    }

    throw error;
  }
}

// Password Reset Success Email
async function sendPasswordResetSuccessEmail(email, username) {
  try {
    logger.info('Sending password reset success email', { to: email });

    const result = await sendTransactionalEmail({
      to: email,
      subject: "Password Reset Successful - Listifys",
      html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 0;
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header { 
            background: linear-gradient(135deg, #10B981 0%, #059669 100%); 
            color: white; 
            padding: 40px 20px; 
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
          }
          .content { 
            padding: 40px; 
            background: #ffffff;
          }
          .success-icon {
            text-align: center;
            margin: 20px 0;
          }
          .footer { 
            text-align: center; 
            padding: 20px; 
            color: #666;
            font-size: 12px;
            border-top: 1px solid #eee;
            background: #f9f9f9;
          }
          .brand {
            font-weight: bold;
            color: #27bb97;
            font-size: 18px;
            margin-bottom: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Successful</h1>
          </div>
          <div class="content">
            <div class="brand">Listifys</div>
            <h2 style="color: #333; margin-bottom: 20px;">Hello ${username}!</h2>
            <p style="font-size: 16px; color: #555; margin-bottom: 25px;">
              Your password has been successfully reset. You can now log in to your Listifys account using your new password.
            </p>
            
            <div class="success-icon">
              <div style="width: 80px; height: 80px; background: #10B981; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>
            
            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0ea5e9;">
              <h3 style="color: #0ea5e9; margin-top: 0;">Security Tips:</h3>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Use a strong, unique password</li>
                <li>Don't share your password with anyone</li>
                <li>Enable two-factor authentication if available</li>
                <li>Log out from shared devices</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${getAppSignInUrl()}" style="display: inline-block; background: #27bb97; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                Open Listifys App
              </a>
              <p style="font-size: 13px; color: #888; margin-top: 14px;">
                Tap to open the Listifys mobile app and sign in with your new password.
              </p>
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Listifys. All rights reserved.</p>
            <p>Edit Smarter. Export Faster. Create Anywhere.</p>
          </div>
        </div>
      </body>
      </html>
      `,
    });

    logger.info('Password reset success email sent', { to: email, messageId: result.messageId });

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error) {
    logger.error('Error sending password reset success email', { error: error.message });
    throw error;
  }
}

// Login Notification Email
async function sendLoginNotificationEmail(email, username, loginDetails = {}) {
  try {
    logger.info('Sending login notification email', { to: email });

    const loginTime = loginDetails.time
      ? new Date(loginDetails.time).toLocaleString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
          hour: "2-digit", minute: "2-digit", timeZoneName: "short",
        })
      : new Date().toLocaleString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
          hour: "2-digit", minute: "2-digit", timeZoneName: "short",
        });

    const locationText = loginDetails.location?.city && loginDetails.location?.country
      ? `${loginDetails.location.city}, ${loginDetails.location.region || ""} ${loginDetails.location.country}`
      : "Unknown location";

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; color: #333; margin: 0; padding: 0;
            background-color: #f5f5f5;
          }
          .container { 
            max-width: 600px; margin: 0 auto; padding: 0; background: white;
            border-radius: 10px; overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header { 
            background: linear-gradient(135deg, #27bb97 0%, #1fa987 100%); 
            color: white; padding: 40px 20px; text-align: center;
          }
          .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
          .content { padding: 40px; background: #ffffff; }
          .login-details {
            background: #f8fffe; border: 1px solid #e0f2ef;
            border-radius: 8px; padding: 24px; margin: 24px 0;
          }
          .detail-row {
            display: flex; padding: 10px 0;
            border-bottom: 1px solid #e0f2ef;
          }
          .detail-row:last-child { border-bottom: none; }
          .detail-label {
            color: #666; font-size: 14px; min-width: 120px; font-weight: 600;
          }
          .detail-value { color: #333; font-size: 14px; }
          .security-alert {
            background: #fff8e1; padding: 20px;
            border-left: 4px solid #ffc107; border-radius: 4px;
            margin: 24px 0; font-size: 14px;
          }
          .security-alert h3 { color: #d97706; margin-top: 0; }
          .footer { 
            text-align: center; padding: 20px; color: #666;
            font-size: 12px; border-top: 1px solid #eee; background: #f9f9f9;
          }
          .brand { font-weight: bold; color: #27bb97; font-size: 18px; margin-bottom: 10px; }
          .check-icon {
            width: 60px; height: 60px; background: #27bb97; border-radius: 50%;
            display: inline-flex; align-items: center; justify-content: center;
            margin-bottom: 15px;
          }
          @media only screen and (max-width: 600px) {
            .content { padding: 20px; }
            .header { padding: 30px 15px; }
            .detail-label { min-width: 100px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="check-icon">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h1>Successful Login</h1>
          </div>
          <div class="content">
            <div class="brand">Listifys</div>
            <h2 style="color: #333; margin-bottom: 10px;">Hello ${username}!</h2>
            <p style="font-size: 16px; color: #555; margin-bottom: 5px;">
              We noticed a new login to your Listifys account. Here are the details:
            </p>

            <div class="login-details">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e0f2ef; color: #666; font-size: 14px; font-weight: 600; width: 130px;">Date &amp; Time</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e0f2ef; color: #333; font-size: 14px;">${loginTime}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e0f2ef; color: #666; font-size: 14px; font-weight: 600;">Device</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e0f2ef; color: #333; font-size: 14px;">${loginDetails.device || "Unknown device"}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e0f2ef; color: #666; font-size: 14px; font-weight: 600;">Browser</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e0f2ef; color: #333; font-size: 14px;">${loginDetails.browser || "Unknown"}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e0f2ef; color: #666; font-size: 14px; font-weight: 600;">Operating System</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e0f2ef; color: #333; font-size: 14px;">${loginDetails.os || "Unknown"}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e0f2ef; color: #666; font-size: 14px; font-weight: 600;">Location</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e0f2ef; color: #333; font-size: 14px;">${locationText}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #666; font-size: 14px; font-weight: 600;">IP Address</td>
                  <td style="padding: 10px 0; color: #333; font-size: 14px;">${loginDetails.ip || "Unknown"}</td>
                </tr>
              </table>
            </div>

            <div class="security-alert">
              <h3>&#x1F6E1;&#xFE0F; Wasn't you?</h3>
              <p style="margin: 10px 0;">
                If you did not log in, your account may be compromised. Please take these steps immediately:
              </p>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Change your password right away</li>
                <li>Review your recent account activity</li>
                <li>Contact our support team if needed</li>
              </ul>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated security notification from Listifys.</p>
            <p>&copy; ${new Date().getFullYear()} Listifys. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
      `;

    const result = await sendTransactionalEmail({
      to: email,
      subject: "New Login to Your Listifys Account",
      html,
    });
    logger.info('Login notification email sent', { to: email, messageId: result.messageId, relay: result.relay });

    return { success: true, messageId: result.messageId };
  } catch (error) {
    logger.error('Error sending login notification email', { error: error.message });
    throw error;
  }
}

// ==================== OFFER NOTIFICATION EMAIL ====================
function getOfferEmailTemplate({ sellerName, buyerName, productTitle, listingPrice, offerPrice, productImage, chatUrl }) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { 
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
        line-height: 1.6; 
        color: #333; 
        margin: 0;
        padding: 0;
        background-color: #f5f5f5;
      }
      .container { 
        max-width: 600px; 
        margin: 0 auto; 
        padding: 0;
        background: white;
        border-radius: 10px;
        overflow: hidden;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }
      .header { 
        background: linear-gradient(135deg, #27bb97 0%, #1fa987 100%); 
        color: white; 
        padding: 40px 20px; 
        text-align: center;
      }
      .header h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 600;
      }
      .header p {
        margin: 8px 0 0;
        font-size: 14px;
        opacity: 0.9;
      }
      .content { 
        padding: 40px; 
        background: #ffffff;
      }
      .brand {
        font-weight: bold;
        color: #27bb97;
        font-size: 18px;
        margin-bottom: 10px;
      }
      .offer-card {
        background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
        border: 2px solid #27bb97;
        border-radius: 12px;
        padding: 24px;
        margin: 24px 0;
        text-align: center;
      }
      .offer-card .label {
        font-size: 13px;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 8px;
      }
      .offer-card .amount {
        font-size: 36px;
        font-weight: 700;
        color: #27bb97;
        margin: 4px 0;
      }
      .product-info {
        background: #f9fafb;
        border-radius: 10px;
        padding: 20px;
        margin: 24px 0;
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .product-info img {
        width: 80px;
        height: 80px;
        object-fit: cover;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
      }
      .product-info .details h4 {
        margin: 0 0 4px;
        font-size: 16px;
        color: #111827;
      }
      .product-info .details p {
        margin: 0;
        font-size: 14px;
        color: #6b7280;
      }
      .price-comparison {
        display: flex;
        justify-content: center;
        gap: 30px;
        margin: 20px 0;
        text-align: center;
      }
      .price-comparison .price-item .label {
        font-size: 12px;
        color: #9ca3af;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .price-comparison .price-item .value {
        font-size: 20px;
        font-weight: 600;
        color: #374151;
        margin-top: 4px;
      }
      .price-comparison .price-item .value.highlight {
        color: #27bb97;
      }
      .chat-btn {
        display: inline-block;
        background: linear-gradient(135deg, #27bb97 0%, #1fa987 100%);
        color: white !important;
        padding: 16px 40px;
        text-decoration: none;
        border-radius: 10px;
        font-weight: 600;
        font-size: 16px;
        margin: 24px 0;
        box-shadow: 0 4px 15px rgba(39, 187, 151, 0.3);
        transition: all 0.3s;
      }
      .chat-btn:hover {
        box-shadow: 0 6px 20px rgba(39, 187, 151, 0.4);
      }
      .tip-box {
        background: #eff6ff;
        padding: 16px 20px;
        border-left: 4px solid #3b82f6;
        border-radius: 4px;
        margin: 24px 0;
        font-size: 14px;
        color: #1e40af;
      }
      .footer { 
        text-align: center; 
        padding: 20px; 
        color: #666;
        font-size: 12px;
        border-top: 1px solid #eee;
        background: #f9f9f9;
      }
      @media only screen and (max-width: 600px) {
        .content { padding: 20px; }
        .header { padding: 30px 15px; }
        .offer-card .amount { font-size: 28px; }
        .product-info { flex-direction: column; text-align: center; }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>You've Received an Offer!</h1>
        <p>${buyerName} is interested in your listing</p>
      </div>
      <div class="content">
        <div class="brand">Listifys</div>
        <h2 style="color: #333; margin-bottom: 10px;">Hello ${sellerName}!</h2>
        <p style="font-size: 16px; color: #555; margin-bottom: 0;">
          Great news! <strong>${buyerName}</strong> has made an offer on your listing.
        </p>

        <div class="offer-card">
          <div class="label">Offer Amount</div>
          <div class="amount">${offerPrice}</div>
        </div>

        ${productImage ? `
        <div class="product-info">
          <img src="${productImage}" alt="${productTitle}" />
          <div class="details">
            <h4>${productTitle}</h4>
            <p>Listed Price: ${listingPrice}</p>
          </div>
        </div>
        ` : `
        <div class="product-info">
          <div class="details">
            <h4>${productTitle}</h4>
            <p>Listed Price: ${listingPrice}</p>
          </div>
        </div>
        `}

        <div class="price-comparison">
          <div class="price-item">
            <div class="label">Your Price</div>
            <div class="value">${listingPrice}</div>
          </div>
          <div class="price-item">
            <div class="label">Their Offer</div>
            <div class="value highlight">${offerPrice}</div>
          </div>
        </div>

        <div style="text-align: center;">
          <a href="${chatUrl}" class="chat-btn">
            💬 Chat with ${buyerName}
          </a>
          <p style="font-size: 13px; color: #9ca3af; margin-top: 8px;">
            Respond to the offer directly in your Listifys chat
          </p>
        </div>

        <div class="tip-box">
          <strong>💡 Tip:</strong> Respond quickly to offers — buyers are more likely to complete a purchase when they get a fast reply!
        </div>
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} Listifys. All rights reserved.</p>
        <p>You're receiving this because someone made an offer on your listing.</p>
      </div>
    </div>
  </body>
  </html>
  `;
}

async function sendOfferNotificationEmail({ sellerEmail, sellerName, buyerName, productTitle, listingPrice, offerPrice, productImage, chatUrl }) {
  try {
    if (!sellerEmail) {
      logger.error('Offer email skipped — no seller email address found');
      return { success: false, error: 'No seller email address' };
    }

    logger.info('Sending offer notification email', { to: sellerEmail, productTitle });

    const result = await sendTransactionalEmail({
      to: sellerEmail,
      subject: `💰 New Offer on "${productTitle}" - Listifys`,
      html: getOfferEmailTemplate({ sellerName, buyerName, productTitle, listingPrice, offerPrice, productImage, chatUrl }),
    });
    logger.info('Offer notification email sent', {
      to: sellerEmail,
      messageId: result.messageId,
      relay: result.relay,
    });

    return { success: true, messageId: result.messageId };
  } catch (error) {
    logger.error('Error sending offer notification email', { error: error.message });
    // Don't throw — email failure should not break the offer flow
    return { success: false, error: error.message };
  }
}


// ==================== WELCOME EMAIL ====================
async function sendWelcomeEmail(email, username) {
  try {
    logger.info('Sending welcome email', { to: email });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,.1); }
          .header { background: linear-gradient(135deg, #27bb97 0%, #1fa987 100%); color: white; padding: 50px 20px; text-align: center; }
          .header h1 { margin: 0; font-size: 32px; font-weight: 700; }
          .header p { margin: 10px 0 0; font-size: 16px; opacity: .9; }
          .content { padding: 40px; }
          .brand { font-weight: bold; color: #27bb97; font-size: 18px; margin-bottom: 10px; }
          .feature { display: flex; align-items: flex-start; gap: 12px; margin: 16px 0; }
          .feature-icon { width: 40px; height: 40px; background: #f0fdf9; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 18px; }
          .cta-btn { display: inline-block; background: linear-gradient(135deg, #27bb97 0%, #1fa987 100%); color: white !important; padding: 16px 40px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px; margin: 24px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #eee; background: #f9f9f9; }
          @media (max-width: 600px) { .content { padding: 24px; } }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to Listifys!</h1>
            <p>Your account is set up and ready to go</p>
          </div>
          <div class="content">
            <div class="brand">Listifys</div>
            <h2 style="color:#333">Hello ${username}! 👋</h2>
            <p style="color:#555;font-size:16px">We're thrilled to have you onboard. Here's what you can do right now:</p>

            <div class="feature">
              <div class="feature-icon">🏷️</div>
              <div><strong>List anything</strong><br><span style="color:#666;font-size:14px">Post vehicles, electronics, services, events and more in minutes.</span></div>
            </div>
            <div class="feature">
              <div class="feature-icon">🔍</div>
              <div><strong>Discover great deals</strong><br><span style="color:#666;font-size:14px">Browse thousands of listings in your area.</span></div>
            </div>
            <div class="feature">
              <div class="feature-icon">💬</div>
              <div><strong>Chat securely</strong><br><span style="color:#666;font-size:14px">Message sellers and buyers directly on our platform.</span></div>
            </div>

            <div style="text-align:center;margin:32px 0">
              <a href="${getAppHomeUrl()}" class="cta-btn">Open Listifys App →</a>
            </div>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Listifys. All rights reserved.</p>
            <p>If you didn't create this account, please ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
      `;

    const result = await sendTransactionalEmail({
      to: email,
      subject: "🎉 Welcome to Listifys — You're In!",
      html,
    });
    logger.info('Welcome email sent', { to: email, messageId: result.messageId, relay: result.relay });
    return { success: true, messageId: result.messageId };
  } catch (error) {
    logger.error('Error sending welcome email', { error: error.message });
    throw error;
  }
}

// ── Account Action Email (Ban / Suspend / Activate) ──────────────
function getAccountActionTemplate(username, action) {
  const config = {
    banned: {
      title: "Account Banned",
      icon: "🚫",
      color: "#DC2626",
      bgColor: "#FEF2F2",
      message: "Your account has been <strong>permanently banned</strong> due to a violation of our community guidelines.",
      detail: "You will no longer be able to access your account, create listings, or communicate with other users.",
    },
    suspended: {
      title: "Account Suspended",
      icon: "⚠️",
      color: "#D97706",
      bgColor: "#FFFBEB",
      message: "Your account has been <strong>temporarily suspended</strong> by our admin team.",
      detail: "During this period, your listings will be hidden and you won't be able to use platform features.",
    },
    active: {
      title: "Account Reactivated",
      icon: "✅",
      color: "#059669",
      bgColor: "#ECFDF5",
      message: "Great news! Your account has been <strong>reactivated</strong>.",
      detail: "You can now access all platform features, your listings are visible again, and you can communicate with others.",
    },
  };

  const c = config[action] || config.suspended;

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
      .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
      .header { background: linear-gradient(135deg, ${c.color} 0%, ${c.color}dd 100%); padding: 36px 40px; text-align: center; }
      .header h1 { color: white; margin: 0; font-size: 24px; font-weight: 700; }
      .header .icon { font-size: 48px; margin-bottom: 12px; }
      .body { padding: 36px 40px; }
      .greeting { font-size: 18px; font-weight: 600; color: #1a1a2e; margin-bottom: 16px; }
      .alert-box { background: ${c.bgColor}; border-left: 4px solid ${c.color}; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 20px 0; }
      .alert-box p { margin: 0; font-size: 15px; color: #1a1a2e; line-height: 1.7; }
      .detail { font-size: 14px; color: #666; line-height: 1.7; margin: 16px 0; }
      .cta-box { text-align: center; margin: 28px 0; }
      .cta-btn { display: inline-block; padding: 12px 32px; background: #27BB97; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; }
      .footer { background: #f8fafb; padding: 20px 40px; text-align: center; border-top: 1px solid #eef1f3; }
      .footer p { margin: 4px 0; font-size: 12px; color: #999; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="icon">${c.icon}</div>
        <h1>${c.title}</h1>
      </div>
      <div class="body">
        <p class="greeting">Hi ${username},</p>
        <div class="alert-box">
          <p>${c.message}</p>
        </div>
        <p class="detail">${c.detail}</p>
        <p class="detail">If you believe this is a mistake or have questions, please contact our support team.</p>
        <div class="cta-box">
          <a href="mailto:${process.env.SUPPORT_EMAIL || 'support@listifys.com'}" class="cta-btn">Contact Support</a>
        </div>
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} Listifys. All rights reserved.</p>
        <p>This is an automated message from the Listifys admin team.</p>
      </div>
    </div>
  </body>
  </html>`;
}

async function sendAccountActionEmail(email, username, action) {
  try {
    const titles = {
      banned: "Your Listifys Account Has Been Banned",
      suspended: "Your Listifys Account Has Been Suspended",
      active: "Your Listifys Account Has Been Reactivated",
    };

    const result = await sendTransactionalEmail({
      to: email,
      subject: titles[action] || `Listifys Account Update`,
      html: getAccountActionTemplate(username, action),
    });
    logger.info('Account action email sent', {
      to: email,
      action,
      messageId: result.messageId,
      relay: result.relay,
    });
    return { success: true, messageId: result.messageId };
  } catch (error) {
    logger.error('Error sending account action email', { error: error.message, action });
    throw error;
  }
}

// ── Email-change: OTP to NEW address ────────────────────────────────────────
function getEmailChangeOTPTemplate(username, otpCode, newEmail) {
  return `<!DOCTYPE html><html><head><style>
    body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f5f5f5}
    .container{max-width:600px;margin:0 auto;background:white;border-radius:10px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.1)}
    .header{background:linear-gradient(135deg,#27bb97 0%,#1fa987 100%);color:white;padding:40px 20px;text-align:center}
    .header h1{margin:0;font-size:28px;font-weight:600}
    .content{padding:40px;background:#fff}
    .brand{font-weight:bold;color:#27bb97;font-size:18px;margin-bottom:10px}
    .otp-container{text-align:center;margin:30px 0}
    .otp-code{background:#27bb97;color:white;padding:20px;font-size:32px;font-weight:bold;text-align:center;letter-spacing:8px;border-radius:8px;margin:20px auto;display:inline-block;min-width:200px;box-shadow:0 4px 15px rgba(39,187,151,.3)}
    .expiry{color:#666;font-style:italic;margin:10px 0}
    .security-note{background:#fff8e1;padding:20px;border-left:4px solid #ffc107;border-radius:4px;margin:30px 0;font-size:14px}
    .security-note h3{color:#d97706;margin-top:0}
    .footer{text-align:center;padding:20px;color:#666;font-size:12px;border-top:1px solid #eee;background:#f9f9f9}
  </style></head><body>
    <div class="container">
      <div class="header"><h1>Verify Your New Email</h1></div>
      <div class="content">
        <div class="brand">Listifys</div>
        <h2 style="color:#333;margin-bottom:20px">Hello ${username}!</h2>
        <p style="font-size:16px;color:#555;margin-bottom:25px">
          You requested to change your email address to <strong>${newEmail}</strong>.
          Enter the OTP below to confirm this change.
        </p>
        <div class="otp-container">
          <p style="margin-bottom:15px;color:#666">Your verification code:</p>
          <div class="otp-code">${otpCode}</div>
          <p class="expiry">⏰ Expires in 5 minutes</p>
        </div>
        <div class="security-note">
          <h3>🔒 Security Notice:</h3>
          <ul style="margin:10px 0;padding-left:20px">
            <li>Never share this code with anyone</li>
            <li>This code expires in 5 minutes and can only be used once</li>
            <li>If you did not request this change, please secure your account immediately</li>
          </ul>
        </div>
      </div>
      <div class="footer"><p>&copy; ${new Date().getFullYear()} Listifys. All rights reserved.</p></div>
    </div>
  </body></html>`;
}

// ── Email-change: security alert to OLD address ──────────────────────────────
function getEmailChangeAlertTemplate(username, oldEmail, newEmail, ipAddress, timestamp) {
  const time = new Date(timestamp).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
  return `<!DOCTYPE html><html><head><style>
    body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f5f5f5}
    .container{max-width:600px;margin:0 auto;background:white;border-radius:10px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.1)}
    .header{background:linear-gradient(135deg,#DC2626 0%,#B91C1C 100%);color:white;padding:40px 20px;text-align:center}
    .header h1{margin:0;font-size:28px;font-weight:600}
    .content{padding:40px;background:#fff}
    .brand{font-weight:bold;color:#27bb97;font-size:18px;margin-bottom:10px}
    .alert-box{background:#FEF2F2;padding:20px;border-left:4px solid #EF4444;border-radius:4px;margin:20px 0;font-size:14px}
    .detail-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:14px}
    .footer{text-align:center;padding:20px;color:#666;font-size:12px;border-top:1px solid #eee;background:#f9f9f9}
  </style></head><body>
    <div class="container">
      <div class="header"><h1>⚠️ Email Change Requested</h1></div>
      <div class="content">
        <div class="brand">Listifys</div>
        <h2 style="color:#333;margin-bottom:20px">Hello ${username},</h2>
        <p style="font-size:16px;color:#555;">
          A request was made to change the email address on your Listifys account.
        </p>
        <div class="alert-box">
          <strong>Change details:</strong><br>
          <div class="detail-row"><span>Old email:</span><span>${oldEmail}</span></div>
          <div class="detail-row"><span>New email:</span><span>${newEmail}</span></div>
          <div class="detail-row"><span>Requested at:</span><span>${time}</span></div>
          <div class="detail-row"><span>IP Address:</span><span>${ipAddress || 'Unknown'}</span></div>
        </div>
        <p style="font-size:15px;color:#374151;">
          <strong>If this was you</strong>, you may ignore this email — your new address must still be verified.<br><br>
          <strong>If you did NOT request this change</strong>, your account may be compromised.
          Please change your password immediately and contact support.
        </p>
      </div>
      <div class="footer"><p>&copy; ${new Date().getFullYear()} Listifys. All rights reserved.</p></div>
    </div>
  </body></html>`;
}

async function sendEmailChangeOTP(newEmail, username, otp) {
  await sendTransactionalEmail({
    to: newEmail,
    subject: 'Listifys — Verify your new email address',
    html: getEmailChangeOTPTemplate(username, otp, newEmail),
  });
  logger.info('Email-change OTP sent', { to: newEmail });
}

async function sendEmailChangeAlert(oldEmail, username, newEmail, ipAddress, timestamp) {
  try {
    await sendTransactionalEmail({
      to: oldEmail,
      subject: 'Listifys — Email change requested on your account',
      html: getEmailChangeAlertTemplate(username, oldEmail, newEmail, ipAddress, timestamp),
    });
    logger.info('Email-change alert sent to old address', { to: oldEmail });
  } catch (err) {
    // Non-fatal — old address may be undeliverable
    logger.warn('Email-change alert failed (non-fatal)', { error: err.message });
  }
}

module.exports = {
  sendOTPEmail,
  verifyEmailTransport,
  sendForgotPasswordOTPEmail,
  sendPasswordResetSuccessEmail,
  sendLoginNotificationEmail,
  sendOfferNotificationEmail,
  sendWelcomeEmail,
  sendAccountActionEmail,
  sendEmailChangeOTP,
  sendEmailChangeAlert,
};


