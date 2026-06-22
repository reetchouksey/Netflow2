// M3 - Phase 2 - jobs/escalationCron.js
// Hourly tick that escalates overdue pending tasks. Uses an atomic
// findOneAndUpdate guard (matched on isEscalated:false) so concurrent cron
// runs can never double-escalate the same task.

const cron = require('node-cron')

const Task = require('../models/Task')
const User = require('../models/User')
const Role = require('../models/Role')
const { createNotification } = require('../utils/createNotification')
const { writeAuditLog } = require('../utils/writeAuditLog')
const { sendEscalationEmail } = require('../utils/emailService')

const findRoleIdByName = async (name) => {
  const role = await Role.findOne({ name }).select('_id').lean()
  return role?._id || null
}

// Resolve the escalation target.
//   Level 0 → Manager in the same department as the assignee
//   Otherwise (or if no manager exists) → any active Admin
//   Last resort → null (we log a warning and skip)
const findEscalationTarget = async (task) => {
  const managerRoleId = await findRoleIdByName('Manager')

  if (managerRoleId && task.escalationLevel === 0 && task.assignedTo?.department) {
    const manager = await User.findOne({
      role: managerRoleId,
      department: task.assignedTo.department,
      isActive: true,
      _id: { $ne: task.assignedTo._id }
    }).lean()
    if (manager) return manager
  }

  const adminRoleId = await findRoleIdByName('Admin')
  if (adminRoleId) {
    const admin = await User.findOne({ role: adminRoleId, isActive: true }).lean()
    if (admin) return admin
  }

  return null
}

const runEscalation = async () => {
  const startedAt = new Date()
  try {
    const overdueTasks = await Task.find({
      status: 'pending',
      dueDate: { $lt: startedAt },
      isEscalated: false
    }).populate('assignedTo submittedBy')

    let escalatedCount = 0

    for (const task of overdueTasks) {
      // Atomic: only one cron loop wins the right to escalate this task
      const updated = await Task.findOneAndUpdate(
        { _id: task._id, isEscalated: false },
        {
          $set: { status: 'escalated', isEscalated: true },
          $inc: { escalationLevel: 1 },
          $push: {
            approvalHistory: {
              action: 'escalated',
              performedAt: startedAt,
              comment: 'Auto-escalated by system due to SLA breach'
            }
          }
        },
        { new: true }
      )

      if (!updated) continue // Another loop already escalated this one

      const target = await findEscalationTarget(task)
      if (!target) {
        console.warn(`escalationCron: no target for task ${task._id}`)
        continue
      }

      const hoursOverdue = Math.max(
        1,
        Math.floor((startedAt - task.dueDate) / 3600000)
      )

      createNotification({
        userId: target._id,
        title: 'Task escalated to you',
        message: `Task "${task.title}" is ${hoursOverdue}hrs overdue and has been escalated to you.`,
        type: 'escalation',
        taskId: task._id,
        triggeredBy: task.submittedBy?._id
      })

      if (target.email) {
        sendEscalationEmail({
          to: target.email,
          managerName: target.name,
          taskTitle: task.title,
          originalAssignee: task.assignedTo?.name || 'Unknown',
          hoursOverdue
        })
      }

      writeAuditLog({
        action: 'task_escalated',
        performedBy: task.submittedBy?._id || target._id,
        targetEntity: `Task: ${task.title}`,
        department: task.assignedTo?.department,
        detail: `Auto-escalated after ${hoursOverdue} hours overdue`,
        metadata: {
          taskId: task._id,
          escalationLevel: updated.escalationLevel,
          hoursOverdue,
          escalatedTo: target._id,
          escalatedToName: target.name
        }
      })

      escalatedCount++
    }

    console.log(
      `escalationCron @ ${startedAt.toISOString()} — escalated ${escalatedCount} task(s)`
    )
    return { escalatedCount }
  } catch (err) {
    console.error('escalationCron error:', err.message)
    return { error: err.message }
  }
}

const startEscalationCron = () => {
  cron.schedule('0 * * * *', runEscalation, { timezone: 'UTC' })
  console.log('Escalation cron scheduled — runs hourly (UTC)')
}

module.exports = { startEscalationCron, runEscalation }
