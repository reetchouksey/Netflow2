// M1 - Phase 2 - models/Role.js
// Fixed catalogue of system roles. Seeded once via /seeds/seed.js.

const mongoose = require('mongoose')

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    
  },
  description: { type: String },
  permissions: [{ type: String }]
}, { timestamps: true })

module.exports = mongoose.model('Role', roleSchema)
