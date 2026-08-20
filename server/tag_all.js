const mongoose = require('mongoose')
require('dotenv').config()
const Workflow = require('./models/Workflow')
const { isConfigured: llmConfigured, generateJSON } = require('./utils/llm')

async function run() {
  await mongoose.connect(process.env.MONGODB_URI)
  const workflows = await Workflow.find({ status: 'published' })
  for (const w of workflows) {
    if (!w.tags || w.tags.length === 0) {
      console.log('Generating tags for', w.title)
      const prompt = `Analyze this workflow named "${w.title}" with description "${w.description || 'No description'}". Generate 2 to 4 very short, relevant category tags for it. Only return a JSON object with a single "tags" array property containing the strings.`
      const schema = { type: 'object', properties: { tags: { type: 'array', items: { type: 'string' } } }, required: ['tags'] }
      try {
        const result = await generateJSON(prompt, schema)
        const tagsArray = Array.isArray(result) ? result : Array.isArray(result?.tags) ? result.tags : []
        if (tagsArray.length > 0) {
          w.tags = tagsArray.map(t => typeof t === 'string' ? t.replace(/^#/, '').trim() : '').filter(Boolean)
          await w.save()
          console.log('Saved tags for', w.title, w.tags)
        }
      } catch (err) {
        console.error('Failed', err.message)
      }
    }
  }
  process.exit(0)
}
run()
