const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: __dirname + '/.env' });

async function createYashAdmin() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  const adminRole = await mongoose.connection.db.collection('roles').findOne({ name: 'Admin' });
  const org = await mongoose.connection.db.collection('organizations').findOne({});

  const hash = await bcrypt.hash('Admin@12345', 10);

  const res = await mongoose.connection.db.collection('users').updateOne(
    { email: 'yash@gmail.com' },
    {
      $set: {
        name: 'Yash (Admin)',
        email: 'yash@gmail.com',
        password: hash,
        role: adminRole ? adminRole._id : null,
        orgId: org ? org._id : null,
        department: 'IT',
        isActive: true,
        status: 'Active',
        isEmailVerified: true,
        mustChangePassword: false,
        needsProductTour: false,
        canBuild: true,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
        tokenVersion: 0,
        activeSessions: [],
      }
    },
    { upsert: true }
  );

  console.log('Created / Updated yash@gmail.com successfully:', res);
  await mongoose.disconnect();
}

createYashAdmin().catch(console.error);
