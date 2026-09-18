// Shared - Phase 2 - config/db.js
// Single MongoDB connection used by every route, model, and job.

const mongoose = require('mongoose')
const dns = require('dns')

// Force public DNS resolvers so mongodb+srv:// SRV lookups work even when the
// local OS resolver refuses SRV queries (common on Windows / behind corporate DNS).
dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4'])

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      family: 4
    })
    console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`)
    return conn
  } catch (err) {
    console.error('MongoDB connection error:', err.message)
    process.exit(1)
  }
}

module.exports = connectDB
