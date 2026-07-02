const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter using Gmail SMTP (or any SMTP service)
// For production, set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || process.env.COMPANY_EMAIL || 'support@nexttracelogistics.com',
    pass: process.env.SMTP_PASS || '',
  },
});

const COMPANY_NAME = 'Next Trace Logistics';
const COMPANY_EMAIL = process.env.COMPANY_EMAIL || 'support@nexttracelogistics.com';
const COMPANY_PHONE = '+1 (412) 227-3484';
const COMPANY_ADDRESS = 'Wyoming';
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://nexttracelogistics.com')
  .replace(/\/$/, '')          // strip trailing slash
  .replace(/^(https?:\/\/)www\./, '$1'); // strip www. to avoid redirect that drops the hash

// Build a deep-link to the tracking page (HashRouter: /#/track/ID)
function trackingUrl(trackingId) {
  return `${FRONTEND_URL}/#/track/${trackingId}`;
}

/**
 * Send an email using the configured SMTP transport
 */
async function sendMail({ to, subject, html, text, attachments }) {
  try {
    const info = await transporter.sendMail({
      from: `"${COMPANY_NAME}" <${COMPANY_EMAIL}>`,
      to,
      subject,
      html,
      text: text || subject,
      attachments,
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
  const dashboardLink = `${FRONTEND_URL}/admin?page=messages`;
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
  const trackingLink = trackingUrl(trackingId);

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
  const trackingLink = trackingUrl(shipment.tracking_id);

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

const { getPauseCategoryContent } = require('./pauseEmailHelper');

/**
 * Build a shipment pause / resume notification email for the receiver.
 */
function buildShipmentPauseEmail({ shipment, isPaused, pauseCategory, pauseReason, location, pausedAt }) {
  const trackingLink = trackingUrl(shipment.tracking_id);
  const timeString = pausedAt
    ? new Date(pausedAt).toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
    : '';
  const cat = isPaused ? getPauseCategoryContent(pauseCategory, location) : null;

  const pauseBodyHtml = cat ? `
    <h2 style="color:#0a192f;font-size:20px;margin:0 0 6px 0;">⏸ Important Notice: Your Shipment is On Hold</h2>
    <p style="color:#4a5568;font-size:14px;line-height:1.7;margin:0 0 24px 0;">
      Dear ${shipment.receiver_name || 'Valued Customer'},<br><br>
      We are writing to provide you with an important update regarding your shipment with <strong>${COMPANY_NAME}</strong>.
      Please review the details below carefully.
    </p>

    <div style="background:#0a192f;border-radius:10px;padding:22px;text-align:center;margin-bottom:24px;">
      <p style="color:#8892b0;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 6px 0;">Tracking Reference</p>
      <p style="color:#64ffda;font-size:26px;font-weight:800;font-family:monospace;margin:0 0 14px 0;letter-spacing:3px;">${shipment.tracking_id}</p>
      <div style="display:inline-block;background:${cat.color}22;border:1px solid ${cat.color}55;border-radius:20px;padding:8px 22px;">
        <span style="color:${cat.color};font-size:13px;font-weight:700;">${cat.emoji} ${cat.label}</span>
      </div>
    </div>

    <div style="background:#f8f9fb;border-radius:8px;padding:16px;margin-bottom:20px;">
      <p style="margin:0 0 10px;font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:600;letter-spacing:0.5px;">📦 Shipment Route</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:45%;padding:4px 0;"><p style="margin:0;font-size:10px;color:#9ca3af;">FROM</p><p style="margin:2px 0 0;font-size:14px;font-weight:700;color:#0a192f;">${shipment.origin}</p></td>
          <td style="text-align:center;color:#3b82f6;font-size:20px;font-weight:300;">→</td>
          <td style="width:45%;text-align:right;padding:4px 0;"><p style="margin:0;font-size:10px;color:#9ca3af;">TO</p><p style="margin:2px 0 0;font-size:14px;font-weight:700;color:#0a192f;">${shipment.destination}</p></td>
        </tr>
      </table>
    </div>

    <div style="background:${cat.color}0d;border:1px solid ${cat.color}33;border-radius:10px;padding:20px;margin-bottom:20px;">
      <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:${cat.color};">${cat.emoji} ${cat.headline}</p>
      <p style="margin:0;font-size:13px;color:#374151;line-height:1.8;">${cat.body}</p>
    </div>

    <div class="info-box" style="border-left-color:#f59e0b;">
      <p style="margin:0 0 12px;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:600;letter-spacing:0.5px;">📋 Hold Details</p>
      <table style="width:100%;font-size:13px;border-collapse:collapse;">
        ${location ? `<tr><td style="padding:5px 0;color:#6b7280;width:38%;vertical-align:top;">Current Hold Location</td><td style="color:#1f2937;font-weight:600;padding:5px 0;">📍 ${location}</td></tr>` : ''}
        ${timeString ? `<tr><td style="padding:5px 0;color:#6b7280;vertical-align:top;">Hold Initiated</td><td style="color:#1f2937;font-weight:600;padding:5px 0;">${timeString}</td></tr>` : ''}
        <tr><td style="padding:5px 0;color:#6b7280;vertical-align:top;">Hold Category</td><td style="color:${cat.color};font-weight:700;padding:5px 0;">${pauseCategory || 'Operational Hold'}</td></tr>
        <tr><td style="padding:5px 0;color:#6b7280;vertical-align:top;">Route</td><td style="color:#1f2937;font-weight:600;padding:5px 0;">${shipment.origin} → ${shipment.destination}</td></tr>
      </table>
      ${pauseReason ? `
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid #fde68a;">
        <p style="margin:0 0 6px;font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:600;">Additional Details from Our Operations Team</p>
        <p style="margin:0;font-size:13px;color:#1f2937;line-height:1.7;font-style:italic;border-left:3px solid #f59e0b;padding-left:12px;">"${pauseReason}"</p>
      </div>` : ''}
    </div>

    <div class="info-box" style="border-left-color:#10b981;margin-top:16px;">
      <p style="margin:0 0 8px;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:600;">✅ What Happens Next</p>
      <p style="margin:0;font-size:13px;color:#1f2937;line-height:1.7;">${cat.action}</p>
      ${cat.urgency ? `<div style="margin-top:12px;padding:10px 14px;background:#fef2f2;border-radius:6px;border:1px solid #fecaca;"><p style="margin:0;font-size:12px;color:#dc2626;font-weight:600;">⚠️ ${cat.urgency}</p></div>` : ''}
    </div>
  ` : `
    <h2 style="color:#0a192f;font-size:20px;margin:0 0 8px 0;">▶️ Great News — Your Shipment is Moving Again!</h2>
    <p style="color:#4a5568;font-size:14px;line-height:1.7;margin:0 0 20px 0;">
      Dear ${shipment.receiver_name || 'Valued Customer'},<br><br>
      We are delighted to inform you that your shipment with <strong>${COMPANY_NAME}</strong> has been successfully released from its hold and has resumed active transit toward its final destination.
    </p>
    <div style="background:#0a192f;border-radius:10px;padding:22px;text-align:center;margin-bottom:24px;">
      <p style="color:#8892b0;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 6px 0;">Tracking Reference</p>
      <p style="color:#64ffda;font-size:26px;font-weight:800;font-family:monospace;margin:0 0 14px 0;letter-spacing:3px;">${shipment.tracking_id}</p>
      <div style="display:inline-block;background:#10b98122;border:1px solid #10b98155;border-radius:20px;padding:8px 22px;">
        <span style="color:#10b981;font-size:13px;font-weight:700;">▶️ Shipment Resumed — In Transit</span>
      </div>
    </div>
    <div style="background:#f8f9fb;border-radius:8px;padding:16px;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:45%;padding:4px 0;"><p style="margin:0;font-size:10px;color:#9ca3af;">FROM</p><p style="margin:2px 0 0;font-size:14px;font-weight:700;color:#0a192f;">${shipment.origin}</p></td>
          <td style="text-align:center;color:#3b82f6;font-size:20px;">→</td>
          <td style="width:45%;text-align:right;padding:4px 0;"><p style="margin:0;font-size:10px;color:#9ca3af;">TO</p><p style="margin:2px 0 0;font-size:14px;font-weight:700;color:#0a192f;">${shipment.destination}</p></td>
        </tr>
      </table>
    </div>
    <div class="info-box" style="border-left-color:#10b981;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#065f46;">✅ All hold conditions have been resolved</p>
      <p style="margin:0;font-size:13px;color:#1f2937;line-height:1.7;">Your shipment is now back in active transit and proceeding toward <strong>${shipment.destination}</strong>. Our team has cleared all previous hold conditions and your cargo is being handled with the highest priority to minimise any impact on your delivery timeline.</p>
      ${pauseReason ? `<p style="margin:10px 0 0;font-size:13px;color:#4a5568;line-height:1.7;font-style:italic;border-left:3px solid #10b981;padding-left:12px;">"${pauseReason}"</p>` : ''}
    </div>
  `;

  const html = emailTemplate({
    title: isPaused ? `Shipment On Hold — ${shipment.tracking_id}` : `Shipment Resumed — ${shipment.tracking_id}`,
    preheader: isPaused
      ? `Important update: Your shipment ${shipment.tracking_id} has been placed on hold. Please read for full details.`
      : `Good news — your shipment ${shipment.tracking_id} is moving again toward its destination!`,
    bodyHtml: `
      ${pauseBodyHtml}
      <hr style="border:0;height:1px;background:#e5e7eb;margin:28px 0;">
      <p style="color:#4a5568;font-size:13px;line-height:1.6;text-align:center;margin-bottom:16px;">Track the real-time status of your shipment 24/7 using our live tracking system:</p>
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${trackingLink}" style="display:inline-block;padding:14px 36px;background:#0a192f;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:700;font-size:14px;letter-spacing:0.5px;">Track My Shipment Live →</a>
      </div>
      <div style="text-align:center;padding:16px;background:#f8f9fb;border-radius:8px;">
        <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">Need immediate assistance?</p>
        <p style="margin:0;font-size:13px;color:#374151;">
          📧 <a href="mailto:${COMPANY_EMAIL}" style="color:#3b82f6;font-weight:600;">${COMPANY_EMAIL}</a>
          &nbsp;&nbsp;|&nbsp;&nbsp;
          📞 <strong>${COMPANY_PHONE}</strong>
        </p>
      </div>
    `,
  });

  return {
    subject: isPaused
      ? `⏸ Important: Shipment On Hold — ${shipment.tracking_id} | ${COMPANY_NAME}`
      : `▶️ Shipment Resumed & In Transit — ${shipment.tracking_id} | ${COMPANY_NAME}`,
    html,
    text: isPaused
      ? `IMPORTANT: Your shipment ${shipment.tracking_id} (${shipment.origin} → ${shipment.destination}) is on hold. Category: ${pauseCategory || 'Operational Hold'}. ${location ? 'Held at: ' + location + '.' : ''} ${pauseReason ? 'Details: ' + pauseReason : ''} Track at: ${trackingLink} | Contact: ${COMPANY_EMAIL}`
      : `Your shipment ${shipment.tracking_id} has resumed transit and is heading to ${shipment.destination}. Track at: ${trackingLink}`,
  };
}

/**
 * Build a shipment status change notification email for sender/receiver.
 */

/**
 * Build a shipment status change notification email for sender/receiver.
 */
function buildShipmentStatusChangeEmail({ shipment, newStatus, role, notes }) {
  const trackingLink = trackingUrl(shipment.tracking_id);
  const isSender = role === 'sender';

  const statusLabels = {
    'pending': 'Order Confirmed',
    'picked-up': 'Picked Up by Courier',
    'in-transit': 'In Transit',
    'out-for-delivery': 'Out for Delivery',
    'delivered': 'Delivered Successfully',
    'returned': 'Returned to Sender',
  };
  const statusEmojis = {
    'pending': '📋', 'picked-up': '📦', 'in-transit': '🚚',
    'out-for-delivery': '📍', 'delivered': '✅', 'returned': '↩️',
  };
  const statusColors = {
    'pending': '#6b7280', 'picked-up': '#8b5cf6', 'in-transit': '#3b82f6',
    'out-for-delivery': '#06b6d4', 'delivered': '#10b981', 'returned': '#ef4444',
  };

  const label = statusLabels[newStatus] || newStatus;
  const emoji = statusEmojis[newStatus] || '📦';
  const color = statusColors[newStatus] || '#3b82f6';
  const recipientName = isSender ? shipment.sender_name : shipment.receiver_name;

  const deliveredSection = newStatus === 'delivered' ? `
    <div class="info-box" style="border-left-color:#10b981;">
      <p style="margin:0;color:#1f2937;font-size:14px;">✅ Your shipment has been successfully delivered to <strong>${shipment.destination}</strong>. Thank you for choosing ${COMPANY_NAME}!</p>
    </div>` : '';

  const returnedSection = newStatus === 'returned' ? `
    <div class="info-box" style="border-left-color:#ef4444;">
      <p style="margin:0;color:#1f2937;font-size:14px;">↩️ This shipment has been returned to the sender. If you have questions, please contact our support team.</p>
    </div>` : '';

  const notesSection = notes ? `
    <div class="info-box" style="border-left-color:#8b5cf6;">
      <p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:600;">Admin Notes</p>
      <p style="margin:0;color:#1f2937;font-size:14px;">${notes}</p>
    </div>` : '';

  const html = emailTemplate({
    title: `Shipment Update — ${shipment.tracking_id}`,
    preheader: `${emoji} Your shipment ${shipment.tracking_id} is now: ${label}`,
    bodyHtml: `
      <h2 style="color:#0a192f;font-size:20px;margin:0 0 8px 0;">${emoji} Shipment Status Update</h2>
      <p style="color:#4a5568;font-size:14px;line-height:1.6;margin:0 0 20px 0;">
        Hello ${recipientName},<br>
        We have an update on your shipment. The current status has been changed to:
      </p>

      <div style="background:#f8f9fb;border-radius:8px;padding:20px;text-align:center;margin-bottom:20px;">
        <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Tracking Number</p>
        <p style="margin:0 0 16px;font-size:22px;font-weight:800;font-family:monospace;color:#0a192f;">${shipment.tracking_id}</p>
        <div style="display:inline-block;padding:10px 24px;border-radius:24px;background:${color}1a;border:2px solid ${color}40;">
          <span style="color:${color};font-size:15px;font-weight:700;">${emoji} ${label}</span>
        </div>
      </div>

      <div class="info-box">
        <p style="margin:0 0 8px 0;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:600;">📍 Route</p>
        <p style="margin:0;color:#1f2937;font-size:14px;">
          <strong>${shipment.origin}</strong> → <strong>${shipment.destination}</strong>
        </p>
      </div>

      ${deliveredSection}
      ${returnedSection}
      ${notesSection}

      <hr class="divider">
      <div style="text-align:center;">
        <a href="${trackingLink}" class="btn" style="color:#ffffff;">Track My Shipment →</a>
      </div>
      <p style="color:#9ca3af;font-size:12px;margin-top:20px;text-align:center;">
        Questions? Contact us at <a href="mailto:${COMPANY_EMAIL}" style="color:#3b82f6;">${COMPANY_EMAIL}</a>
      </p>
    `,
  });

  return {
    subject: `${emoji} Shipment ${label} — ${shipment.tracking_id} | ${COMPANY_NAME}`,
    html,
    text: `Shipment ${shipment.tracking_id} status update: ${label}. Route: ${shipment.origin} → ${shipment.destination}. Track at: ${trackingLink}`,
  };
}

module.exports = {
  sendMail,
  emailTemplate,
  buildSupportNotificationEmail,
  buildTrackingUpdateEmail,
  buildShipmentCreationEmail,
  buildShipmentPauseEmail,
  buildShipmentStatusChangeEmail,
  FRONTEND_URL,
  COMPANY_NAME,
  COMPANY_EMAIL,
};
