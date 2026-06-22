// M3 - Phase 2 - utils/emailService.js
// Mailtrap transport in dev. Every public helper is non-blocking
// (returns a promise) and swallows its own errors via .catch().

const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  host: process.env.MAILTRAP_HOST,
  port: Number(process.env.MAILTRAP_PORT) || 2525,
  auth: {
    user: process.env.MAILTRAP_USER,
    pass: process.env.MAILTRAP_PASS
  }
})

const sendMail = async ({ to, subject, text }) => {
  await transporter.sendMail({
    from: `"${process.env.SENDER_NAME}" <${process.env.SENDER_EMAIL}>`,
    to,
    subject,
    text
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

const sendTaskAssignedEmail = ({ to, assigneeName, taskTitle, submittedBy, dueDate }) => {
  return sendMail({
    to,
    subject: 'New task assigned to you — NetFlow',
    text:
      `Hi ${assigneeName},\n\n` +
      `A new task has been assigned to you.\n\n` +
      `Task: ${taskTitle}\n` +
      `Submitted by: ${submittedBy || 'System'}\n` +
      `Due by: ${new Date(dueDate).toDateString()}\n\n` +
      `Log in to NetFlow to review and take action.\n\n` +
      `NetFlow Team`
  }).catch(err => console.error('sendTaskAssignedEmail error:', err.message))
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
  sendApprovalEmail,
  sendRejectionEmail,
  sendEscalationEmail,
  sendTaskAssignedEmail,
  sendWelcomeEmail
}
