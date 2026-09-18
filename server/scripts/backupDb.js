// Step 0 (multi-tenancy) - scripts/backupDb.js
// Full-database backup to JSON files. Used before the orgId migration.
//
// Run with:  node scripts/backupDb.js   (from /server)
//
// Writes one <collection>.jsonl file per collection into
// backups/backup-<timestamp>/, one document per line in canonical EJSON
// (preserves ObjectId/Date types so the dump is restorable).

require('dotenv').config()

const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const { EJSON } = require('bson')

const run = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Create server/.env first.')
    process.exit(1)
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
    family: 4
  })
  const db = mongoose.connection.db
  console.log(`Connected: ${mongoose.connection.host}/${mongoose.connection.name}`)

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outDir = path.join(__dirname, '..', 'backups', `backup-${stamp}`)
  fs.mkdirSync(outDir, { recursive: true })

  const collections = (await db.listCollections().toArray())
    .map((c) => c.name)
    .filter((n) => !n.startsWith('system.'))
    .sort()

  let totalDocs = 0
  for (const name of collections) {
    const file = path.join(outDir, `${name}.jsonl`)
    const out = fs.createWriteStream(file)
    let count = 0
    const cursor = db.collection(name).find({})
    for await (const doc of cursor) {
      out.write(EJSON.stringify(doc, { relaxed: false }) + '\n')
      count++
    }
    await new Promise((resolve, reject) => { out.end(); out.on('finish', resolve); out.on('error', reject) })
    totalDocs += count
    console.log(`  ${name}: ${count} documents`)
  }

  console.log('')
  console.log(`Backup complete: ${collections.length} collections, ${totalDocs} documents`)
  console.log(`Location: ${outDir}`)

  await mongoose.disconnect()
}

run().catch((err) => {
  console.error('Backup failed:', err)
  process.exit(1)
})
