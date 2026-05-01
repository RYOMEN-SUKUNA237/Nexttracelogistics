const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter using Gmail SMTP (or any SMTP service)
// For production, set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || process.env.COMPANY_EMAIL || 'nexttrace.logistics@gmail.com',
    pass: process.env.SMTP_PASS || '',
  },
});

const COMPANY_NAME = 'Next Trace Logistics';
const COMPANY_EMAIL = process.env.COMPANY_EMAIL || 'nexttrace.logistics@gmail.com';
const COMPANY_PHONE = '+1 (307) 200-8344';
const COMPANY_ADDRESS = 'Atlanta, GA';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://nexttrace.logistics';

/**
 * Send an email using the configured SMTP transport
 */
async function sendMail({ to, subject, html, text }) {
  try {
    const info = await transporter.sendMail({
      from: `"${COMPANY_NAME}" <${COMPANY_EMAIL}>`,
      to,
      subject,
      html,
      text: text || subject,
    });
    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Email send failed to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Generate a professional HTML email template
 */
function emailTemplate({ title, preheader, bodyHtml }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #0a192f, #112d57); padding: 32px 40px; text-align: center; }
    .header h1 { color: #ffffff; font-size: 22px; margin: 0 0 4px 0; letter-spacing: -0.5px; }
    .header p { color: #8892b0; font-size: 13px; margin: 0; }
    .body-content { background: #ffffff; padding: 32px 40px; }
    .footer { background: #0a192f; padding: 24px 40px; text-align: center; }
    .footer p { color: #8892b0; font-size: 11px; margin: 4px 0; }
    .footer a { color: #64ffda; text-decoration: none; }
    .btn { display: inline-block; padding: 12px 28px; background: #0a192f; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 14px; margin-top: 16px; }
    .btn:hover { background: #112d57; }
    .info-box { background: #f8f9fb; border-left: 4px solid #3b82f6; padding: 16px 20px; margin: 16px 0; border-radius: 0 4px 4px 0; }
    .divider { border: 0; height: 1px; background: #e5e7eb; margin: 24px 0; }
    .preheader { display: none; max-height: 0; overflow: hidden; }
  </style>
</head>
<body>
  <span class="preheader">${preheader || ''}</span>
  <div class="container">
    <div class="header">
      <h1>✈️ ${COMPANY_NAME}</h1>
      <p>Global Logistics Solutions</p>
    </div>
    <div class="body-content">
      ${bodyHtml}
    </div>
    <div class="footer">
      <p>${COMPANY_NAME}</p>
      <p>${COMPANY_ADDRESS} · ${COMPANY_PHONE}</p>
      <p><a href="mailto:${COMPANY_EMAIL}">${COMPANY_EMAIL}</a></p>
      <p style="margin-top: 12px; color: #4a5568; font-size: 10px;">This is an automated message. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Build a professional support notification email for admins
 */
function buildSupportNotificationEmail({ visitorName, visitorEmail, messageContent, conversationId }) {
  const dashboardLink = `${FRONTEND_URL}/admin`;
  const previewText = messageContent.length > 100 ? messageContent.substring(0, 100) + '...' : messageContent;

  const html = emailTemplate({
    title: 'New Customer Support Request',
    preheader: `New support message from ${visitorName}: "${previewText}"`,
    bodyHtml: `
      <h2 style="color: #0a192f; font-size: 20px; margin: 0 0 8px 0;">🔔 New Support Request</h2>
      <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
        A customer has reached out through the live support system. Please review the message and respond promptly.
      </p>

      <div class="info-box">
        <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Customer Details</p>
        <p style="margin: 4px 0; color: #1f2937; font-size: 14px;"><strong>Name:</strong> ${visitorName}</p>
        ${visitorEmail ? `<p style="margin: 4px 0; color: #1f2937; font-size: 14px;"><strong>Email:</strong> ${visitorEmail}</p>` : ''}
      </div>

      <div class="info-box" style="border-left-color: #10b981;">
        <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Message Preview</p>
        <p style="margin: 0; color: #1f2937; font-size: 14px; font-style: italic; line-height: 1.6;">"${previewText}"</p>
      </div>

      <hr class="divider">

      <p style="color: #4a5568; font-size: 14px; line-height: 1.6;">
        To view the full conversation and respond, please access the Admin Dashboard:
      </p>

      <div style="text-align: center;">
        <a href="${dashboardLink}" class="btn" style="color: #ffffff;">Open Support Dashboard →</a>
      </div>

      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; text-align: center;">
        This notification was sent automatically when a customer initiated a support conversation.
      </p>
    `,
  });

  return {
    subject: `🔔 New Support Request from ${visitorName} — ${COMPANY_NAME}`,
    html,
    text: `New support message from ${visitorName} (${visitorEmail || 'No email'}): "${previewText}". View in dashboard: ${dashboardLink}`,
  };
}

/**
 * Build a shipment status update email for tracking subscribers
 */
function buildTrackingUpdateEmail({ trackingId, status, statusLabel, location, notes, recipientName, pauseCategory, pauseReason }) {
  const trackingLink = `${FRONTEND_URL}/track/${trackingId}`;

  const statusColors = {
    'pending': '#6b7280',
    'picked-up': '#8b5cf6',
    'in-transit': '#3b82f6',
    'out-for-delivery': '#06b6d4',
    'delivered': '#10b981',
    'returned': '#ef4444',
    'paused': '#f59e0b',
  };
  const statusColor = statusColors[status] || '#3b82f6';

  let statusDetails = '';
  if (status === 'paused' && pauseCategory) {
    statusDetails = `
      <div class="info-box" style="border-left-color: #f59e0b;">
        <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Hold Reason</p>
        <p style="margin: 0; color: #1f2937; font-size: 14px;"><strong>${pauseCategory}</strong></p>
        ${pauseReason ? `<p style="margin: 4px 0 0 0; color: #4a5568; font-size: 13px;">${pauseReason}</p>` : ''}
      </div>
    `;
  }

  const html = emailTemplate({
    title: `Shipment Update — ${trackingId}`,
    preheader: `Your shipment ${trackingId} status: ${statusLabel}`,
    bodyHtml: `
      <h2 style="color: #0a192f; font-size: 20px; margin: 0 0 8px 0;">📦 Shipment Status Update</h2>
      <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
        Hello${recipientName ? ` ${recipientName}` : ''},<br>
        There's an update on your shipment. Here are the latest details:
      </p>

      <div style="background: #f8f9fb; border-radius: 8px; padding: 20px; margin: 16px 0; text-align: center;">
        <p style="margin: 0 0 4px 0; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Tracking ID</p>
        <p style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0a192f; font-family: monospace;">${trackingId}</p>
        <div style="display: inline-block; padding: 8px 20px; border-radius: 20px; background: ${statusColor}1a; border: 1px solid ${statusColor}40;">
          <span style="color: ${statusColor}; font-size: 14px; font-weight: 600;">● ${statusLabel}</span>
        </div>
      </div>

      ${location ? `
      <div class="info-box">
        <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Current Location</p>
        <p style="margin: 0; color: #1f2937; font-size: 14px;">📍 ${location}</p>
      </div>
      ` : ''}

      ${notes ? `
      <div class="info-box" style="border-left-color: #8b5cf6;">
        <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Notes</p>
        <p style="margin: 0; color: #1f2937; font-size: 14px;">${notes}</p>
      </div>
      ` : ''}

      ${statusDetails}

      <hr class="divider">

      <p style="color: #4a5568; font-size: 14px; line-height: 1.6;">
        Track your shipment in real time with our live tracking system:
      </p>

      <div style="text-align: center;">
        <a href="${trackingLink}" class="btn" style="color: #ffffff;">Track My Shipment →</a>
      </div>

      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; text-align: center;">
        You're receiving this because you subscribed to tracking updates for shipment ${trackingId}.
      </p>
    `,
  });

  return {
    subject: `📦 Shipment ${trackingId} — ${statusLabel}`,
    html,
    text: `Shipment ${trackingId} update: ${statusLabel}. ${location ? 'Location: ' + location + '. ' : ''}${notes || ''} Track at: ${trackingLink}`,
  };
}

/**
 * Build a shipment creation confirmation email.
 * role = 'sender' | 'receiver'
 */
function buildShipmentCreationEmail({ shipment, role }) {
  const isSender = role === 'sender';
  const trackingLink = `${FRONTEND_URL}/track/${shipment.tracking_id}`;

  let formattedDate = 'To be confirmed';
  if (shipment.estimated_delivery) {
    const d = new Date(String(shipment.estimated_delivery).includes('T')
      ? shipment.estimated_delivery
      : shipment.estimated_delivery + 'T12:00:00Z');
    formattedDate = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  let transportChain = 'Standard Delivery';
  if (shipment.transport_modes) {
    let modes = shipment.transport_modes;
    if (typeof modes === 'string') { try { modes = JSON.parse(modes); } catch (e) {} }
    if (Array.isArray(modes) && modes.length > 0) transportChain = modes.join(' → ');
  }

  const title = isSender ? 'Shipment Confirmed' : 'Your Package is On Its Way';
  const headline = isSender ? '📦 Shipment Successfully Registered!' : '🎁 A Package is Headed Your Way!';
  const intro = isSender
    ? `Your shipment has been successfully registered with <strong>${COMPANY_NAME}</strong> and is being prepared for transit. Below is a full summary.`
    : `Great news! A shipment has been dispatched by <strong>${shipment.sender_name}</strong> and is on its way to you. Here are all the details.`;

  const html = emailTemplate({
    title,
    preheader: `Tracking ID: ${shipment.tracking_id} | ${shipment.origin} → ${shipment.destination}`,
    bodyHtml: `
      <h2 style="color:#0a192f;font-size:20px;margin:0 0 8px 0;">${headline}</h2>
      <p style="color:#4a5568;font-size:14px;line-height:1.6;margin:0 0 20px 0;">${intro}</p>

      <div style="background:#0a192f;border-radius:8px;padding:20px;text-align:center;margin-bottom:20px;">
        <p style="color:#8892b0;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 6px 0;">Tracking Number</p>
        <p style="color:#64ffda;font-size:26px;font-weight:800;font-family:monospace;margin:0 0 12px 0;letter-spacing:2px;">${shipment.tracking_id}</p>
        <a href="${trackingLink}" style="display:inline-block;padding:10px 24px;background:#64ffda;color:#0a192f;text-decoration:none;border-radius:4px;font-weight:700;font-size:13px;">Track Live →</a>
      </div>

      <div class="info-box">
        <p style="margin:0 0 10px 0;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:600;letter-spacing:0.5px;">📍 Route</p>
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="flex:1;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">FROM</p>
            <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#0a192f;">${shipment.origin}</p>
          </div>
          <div style="color:#3b82f6;font-size:18px;">→</div>
          <div style="flex:1;text-align:right;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">TO</p>
            <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#0a192f;">${shipment.destination}</p>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0;">
        <div class="info-box" style="margin:0;">
          <p style="margin:0 0 8px 0;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:600;">👤 Sender</p>
          <p style="margin:2px 0;color:#1f2937;font-size:14px;font-weight:600;">${shipment.sender_name}</p>
          ${shipment.sender_email ? `<p style="margin:2px 0;color:#4a5568;font-size:12px;">${shipment.sender_email}</p>` : ''}
          ${shipment.sender_phone ? `<p style="margin:2px 0;color:#4a5568;font-size:12px;">${shipment.sender_phone}</p>` : ''}
        </div>
        <div class="info-box" style="margin:0;border-left-color:#10b981;">
          <p style="margin:0 0 8px 0;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:600;">👤 Receiver</p>
          <p style="margin:2px 0;color:#1f2937;font-size:14px;font-weight:600;">${shipment.receiver_name}</p>
          ${shipment.receiver_email ? `<p style="margin:2px 0;color:#4a5568;font-size:12px;">${shipment.receiver_email}</p>` : ''}
          ${shipment.receiver_phone ? `<p style="margin:2px 0;color:#4a5568;font-size:12px;">${shipment.receiver_phone}</p>` : ''}
        </div>
      </div>

      <div class="info-box" style="border-left-color:#8b5cf6;">
        <p style="margin:0 0 10px 0;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:600;">📦 Parcel Details</p>
        <table style="width:100%;font-size:13px;border-collapse:collapse;">
          <tr><td style="padding:3px 0;color:#6b7280;width:40%;">Cargo Type</td><td style="color:#1f2937;font-weight:500;">${shipment.cargo_type || 'General'}</td></tr>
          ${shipment.weight ? `<tr><td style="padding:3px 0;color:#6b7280;">Weight</td><td style="color:#1f2937;font-weight:500;">${shipment.weight}</td></tr>` : ''}
          ${shipment.dimensions ? `<tr><td style="padding:3px 0;color:#6b7280;">Dimensions</td><td style="color:#1f2937;font-weight:500;">${shipment.dimensions}</td></tr>` : ''}
          ${shipment.description ? `<tr><td style="padding:3px 0;color:#6b7280;">Description</td><td style="color:#1f2937;font-weight:500;">${shipment.description}</td></tr>` : ''}
          ${shipment.declared_value ? `<tr><td style="padding:3px 0;color:#6b7280;">Declared Value</td><td style="color:#1f2937;font-weight:500;">$${shipment.declared_value}</td></tr>` : ''}
          <tr><td style="padding:3px 0;color:#6b7280;">Insurance</td><td style="color:#1f2937;font-weight:500;">${shipment.insurance ? '✅ Insured' : 'No insurance'}</td></tr>
        </table>
      </div>

      <div class="info-box" style="border-left-color:#06b6d4;">
        <p style="margin:0 0 8px 0;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:600;">🚚 Transport & Delivery</p>
        <p style="margin:2px 0;color:#4a5568;font-size:13px;">Method: <strong style="color:#1f2937;">${transportChain}</strong></p>
        <p style="margin:8px 0 0;color:#4a5568;font-size:13px;">Estimated Delivery: <strong style="color:#0a192f;font-size:15px;">${formattedDate}</strong></p>
      </div>

      ${shipment.special_instructions ? `
      <div class="info-box" style="border-left-color:#f59e0b;">
        <p style="margin:0 0 6px 0;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:600;">⚠️ Special Instructions</p>
        <p style="margin:0;color:#1f2937;font-size:13px;">${shipment.special_instructions}</p>
      </div>` : ''}

      <hr class="divider">
      <div style="text-align:center;">
        <a href="${trackingLink}" class="btn" style="color:#ffffff;">Track Your Shipment Live →</a>
      </div>
      <p style="color:#9ca3af;font-size:12px;margin-top:20px;text-align:center;">
        For questions, contact us at <a href="mailto:${COMPANY_EMAIL}" style="color:#3b82f6;">${COMPANY_EMAIL}</a>
      </p>
    `,
  });

  return {
    subject: isSender
      ? `📦 Shipment Confirmed — ${shipment.tracking_id} | ${COMPANY_NAME}`
      : `🎁 Your Package is On Its Way — ${shipment.tracking_id} | ${COMPANY_NAME}`,
    html,
    text: `Tracking ID: ${shipment.tracking_id}. ${shipment.origin} → ${shipment.destination}. Est. delivery: ${formattedDate}. Track at: ${trackingLink}`,
  };
}

/**
 * Build a shipment pause / resume notification email for the receiver.
 */
function buildShipmentPauseEmail({ shipment, isPaused, pauseCategory, pauseReason }) {
  const trackingLink = `${FRONTEND_URL}/track/${shipment.tracking_id}`;
  const title = isPaused ? 'Shipment On Hold' : 'Shipment Resumed';

  const html = emailTemplate({
    title,
    preheader: isPaused
      ? `Your shipment ${shipment.tracking_id} has been placed on hold.`
      : `Good news — your shipment ${shipment.tracking_id} is moving again!`,
    bodyHtml: `
      <h2 style="color:#0a192f;font-size:20px;margin:0 0 8px 0;">
        ${isPaused ? '⏸ Shipment Placed On Hold' : '▶️ Shipment Resumed'}
      </h2>
      <p style="color:#4a5568;font-size:14px;line-height:1.6;margin:0 0 20px 0;">
        ${isPaused
          ? `We need to inform you that your shipment has been temporarily paused. Our team is working to resolve the situation as quickly as possible.`
          : `Great news! Your shipment is back on track and moving again toward its destination.`}
      </p>

      <div style="background:#f8f9fb;border-radius:8px;padding:16px;text-align:center;margin-bottom:20px;">
        <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Tracking Number</p>
        <p style="margin:0;font-size:22px;font-weight:800;font-family:monospace;color:#0a192f;">${shipment.tracking_id}</p>
      </div>

      <div style="display:flex;align-items:center;gap:12px;background:#f8f9fb;border-radius:8px;padding:14px;margin-bottom:16px;">
        <span style="font-size:11px;color:#6b7280;">FROM</span>
        <strong style="color:#0a192f;font-size:13px;">${shipment.origin}</strong>
        <span style="color:#3b82f6;">→</span>
        <strong style="color:#0a192f;font-size:13px;">${shipment.destination}</strong>
      </div>

      ${isPaused && pauseCategory ? `
      <div class="info-box" style="border-left-color:#f59e0b;">
        <p style="margin:0 0 6px 0;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:600;">Reason for Hold</p>
        <p style="margin:0;color:#1f2937;font-size:14px;font-weight:600;">${pauseCategory}</p>
        ${pauseReason ? `<p style="margin:6px 0 0;color:#4a5568;font-size:13px;">${pauseReason}</p>` : ''}
      </div>` : ''}

      ${!isPaused ? `
      <div class="info-box" style="border-left-color:#10b981;">
        <p style="margin:0;color:#1f2937;font-size:14px;">✅ Your shipment is back in transit and will continue toward its destination on schedule.</p>
      </div>` : ''}

      <p style="color:#4a5568;font-size:13px;line-height:1.6;margin:16px 0;">
        You can track the real-time status of your shipment at any time:
      </p>
      <div style="text-align:center;">
        <a href="${trackingLink}" class="btn" style="color:#ffffff;">Track My Shipment →</a>
      </div>
      <p style="color:#9ca3af;font-size:12px;margin-top:20px;text-align:center;">
        Questions? Contact us at <a href="mailto:${COMPANY_EMAIL}" style="color:#3b82f6;">${COMPANY_EMAIL}</a>
      </p>
    `,
  });

  return {
    subject: isPaused
      ? `⏸ Shipment On Hold — ${shipment.tracking_id} | ${COMPANY_NAME}`
      : `▶️ Shipment Resumed — ${shipment.tracking_id} | ${COMPANY_NAME}`,
    html,
    text: isPaused
      ? `Your shipment ${shipment.tracking_id} has been placed on hold. Reason: ${pauseCategory || 'See tracking page'}. ${pauseReason || ''} Track at: ${trackingLink}`
      : `Your shipment ${shipment.tracking_id} has resumed and is back in transit. Track at: ${trackingLink}`,
  };
}

module.exports = {
  sendMail,
  emailTemplate,
  buildSupportNotificationEmail,
  buildTrackingUpdateEmail,
  buildShipmentCreationEmail,
  buildShipmentPauseEmail,
  FRONTEND_URL,
  COMPANY_NAME,
  COMPANY_EMAIL,
};
