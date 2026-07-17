// M3 - Phase 2 - utils/emailService.js
// SMTP transport (Brevo in dev/prod). Every public helper is non-blocking
// (returns a promise) and swallows its own errors via .catch(), except
// sendMail itself which rethrows so critical flows (password reset) can react.

const nodemailer = require('nodemailer')

const SMTP_PORT = Number(process.env.SMTP_PORT) || 587

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: SMTP_PORT,
  // 465 = implicit TLS; 587/2525 = STARTTLS (secure:false + upgrade).
  secure: SMTP_PORT === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

const sendMail = async ({ to, subject, text, html }) => {
  await transporter.sendMail({
    from: `"${process.env.SENDER_NAME}" <${process.env.SENDER_EMAIL}>`,
    to,
    subject,
    text,
    ...(html ? { html } : {})
  })
  console.log(`Email sent to: ${to}`)
}

const sendApprovalEmail = ({ to, submitterName, taskTitle, approverName, comment }) => {
  return sendMail({
    to,
    subject: 'Your request has been approved — NetFlow',
    text:
      `Hi ${submitterName},\n\n` +
      `Your request "${taskTitle}" has been approved by ${approverName}.\n\n` +
      `${comment ? `Comment: ${comment}\n\n` : ''}` +
      `Log in to NetFlow to view details.\n\n` +
      `NetFlow Team`
  }).catch(err => console.error('sendApprovalEmail error:', err.message))
}

const sendRejectionEmail = ({ to, submitterName, taskTitle, approverName, comment }) => {
  return sendMail({
    to,
    subject: 'Your request needs attention — NetFlow',
    text:
      `Hi ${submitterName},\n\n` +
      `Your request "${taskTitle}" has been rejected by ${approverName}.\n\n` +
      `Reason: ${comment || 'No reason provided'}\n\n` +
      `Log in to NetFlow for details.\n\n` +
      `NetFlow Team`
  }).catch(err => console.error('sendRejectionEmail error:', err.message))
}

const sendEscalationEmail = ({ to, managerName, taskTitle, originalAssignee, hoursOverdue }) => {
  return sendMail({
    to,
    subject: 'Approval overdue — action required — NetFlow',
    text:
      `Hi ${managerName},\n\n` +
      `The task "${taskTitle}" assigned to ${originalAssignee} is ${hoursOverdue} hours overdue and has been escalated to you.\n\n` +
      `Please log in to NetFlow to take action.\n\n` +
      `NetFlow Team`
  }).catch(err => console.error('sendEscalationEmail error:', err.message))
}

const sendTaskAssignedEmail = ({ to, assigneeName, taskTitle, submittedBy, dueDate, taskId }) => {
  const base = (process.env.CLIENT_URL || 'https://net-flow-sw.vercel.app').split(',')[0].trim().replace(/\/$/, '')
  const taskUrl = `${base}/tasks/${taskId}`
  return sendMail({
    to,
    subject: 'New task assigned to you — NetFlow',
    text:
      `Hi ${assigneeName},\n\n` +
      `A new task has been assigned to you.\n\n` +
      `Task: ${taskTitle}\n` +
      `Submitted by: ${submittedBy || 'System'}\n` +
      `Due by: ${new Date(dueDate).toDateString()}\n\n` +
      `Approve: ${taskUrl}?action=approve\n` +
      `Reject:  ${taskUrl}?action=reject\n\n` +
      `Or open NetFlow to review: ${taskUrl}\n\n` +
      `NetFlow Team`,
     html:
      `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111827;line-height:1.6">` +
        `<p>Hi ${assigneeName},</p>` +
        `<p>A new task has been assigned to you.</p>` +
        `<table style="border-collapse:collapse;margin:12px 0">` +
          `<tr><td style="padding:2px 8px;color:#6b7280">Task</td><td style="padding:2px 8px;font-weight:bold">${taskTitle}</td></tr>` +
          `<tr><td style="padding:2px 8px;color:#6b7280">Submitted by</td><td style="padding:2px 8px;font-weight:bold">${submittedBy || 'System'}</td></tr>` +
          `<tr><td style="padding:2px 8px;color:#6b7280">Due by</td><td style="padding:2px 8px">${new Date(dueDate).toDateString()}</td></tr>` +
        `</table>` +
        `<p style="margin:20px 0">` +
          `<a href="${taskUrl}?action=approve" style="background:#059669;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;display:inline-block;margin-right:10px">Approve</a>` +
          `<a href="${taskUrl}?action=reject" style="background:#e11d48;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;display:inline-block">Reject</a>` +
        `</p>` +
        `<p style="font-size:12px;color:#6b7280">The buttons open NetFlow, where you sign in and confirm the action.</p>` +
        `<p>NetFlow Team</p>` +
      `</div>`
  }).catch(err => console.error('sendTaskAssignedEmail error:', err.message))
}

// Password reset. Unlike the notification helpers above, this one does NOT
// swallow errors - the caller awaits it so it can log delivery failures while
// still returning a generic response to the client (to avoid email enumeration).
const sendPasswordResetEmail = ({ to, name, resetUrl, expiresMinutes = 30 }) => {
  const safeName = name || 'there'
  return sendMail({
    to,
    subject: 'Reset your NetFlow password',
    text:
      `Hi ${safeName},\n\n` +
      `We received a request to reset your NetFlow password.\n\n` +
      `Reset it using this link (valid for ${expiresMinutes} minutes):\n${resetUrl}\n\n` +
      `If you did not request this, you can safely ignore this email - your password will not change.\n\n` +
      `NetFlow Team`,
    html:
      `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#111827">` +
      `<h2 style="color:#4f46e5;margin-bottom:4px">NetFlow</h2>` +
      `<p>Hi ${safeName},</p>` +
      `<p>We received a request to reset your NetFlow password.</p>` +
      `<p style="margin:24px 0">` +
      `<a href="${resetUrl}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;display:inline-block">Reset password</a>` +
      `</p>` +
      `<p style="color:#6b7280;font-size:13px">This link is valid for ${expiresMinutes} minutes. If the button does not work, paste this URL into your browser:</p>` +
      `<p style="word-break:break-all;font-size:12px;color:#4f46e5">${resetUrl}</p>` +
      `<p style="color:#6b7280;font-size:13px">If you did not request this, you can safely ignore this email - your password will not change.</p>` +
      `<p style="margin-top:24px">NetFlow Team</p>` +
      `</div>`
  })
}

const sendWelcomeEmail = ({ to, name, tempPassword }) => {
  return sendMail({
    to,
    subject: 'Welcome to NetFlow',
    text:
      `Hi ${name},\n\n` +
      `Your NetFlow account has been created.\n\n` +
      `Login email: ${to}\n` +
      `${tempPassword ? `Temporary password: ${tempPassword}\n\n` : ''}` +
      `Sign in at ${process.env.CLIENT_URL || 'the NetFlow app'} to get started.\n\n` +
      `NetFlow Team`
  }).catch(err => console.error('sendWelcomeEmail error:', err.message))
}

module.exports = {
  sendMail,
  sendApprovalEmail,
  sendRejectionEmail,
  sendEscalationEmail,
  sendTaskAssignedEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail
}
