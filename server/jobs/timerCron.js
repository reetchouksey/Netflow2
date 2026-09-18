// Resumes workflow executions paused on a Timer node once timerResumeAt elapses.

const cron = require('node-cron')
const WorkflowExecution = require('../models/WorkflowExecution')
const Workflow = require('../models/Workflow')
const { runWithOrgId } = require('../tenancy/tenantContext')

let processNode

const resumeDueTimers = async () => {
  if (!processNode) {
    ;({ processNode } = require('../utils/workflowEngine'))
  }

  const due = await WorkflowExecution.find({
    status: 'paused',
    timerResumeAt: { $lte: new Date() },
    timerNextNodeId: { $ne: null }
  })
    .limit(50)
    .setOptions({ skipOrgScope: true })

  for (const execution of due) {
    try {
      await runWithOrgId(execution.orgId, async () => {
        const fresh = await WorkflowExecution.findById(execution._id)
        if (!fresh || fresh.status !== 'paused') return
        const nextId = fresh.timerNextNodeId
        fresh.status = 'running'
        fresh.timerResumeAt = undefined
        fresh.timerNextNodeId = undefined
        await fresh.save()

        const workflow = await Workflow.findById(fresh.workflowId)
        if (!workflow) {
          fresh.status = 'failed'
          fresh.failureReason = 'Workflow missing when timer resumed'
          await fresh.save()
          return
        }
        await processNode(fresh, nextId, workflow)
      })
    } catch (err) {
      console.error(`timerCron resume failed for ${execution._id}:`, err.message)
    }
  }
}

const startTimerCron = () => {
  // Every minute
  cron.schedule('*/1 * * * *', () => {
    resumeDueTimers().catch((err) => console.error('timerCron error:', err.message))
  })
}

module.exports = { startTimerCron, resumeDueTimers }
