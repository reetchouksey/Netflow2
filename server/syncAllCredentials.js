const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: __dirname + '/.env' });

const seedUsers = [
  { email: 'superadmin@netflow.app', pass: 'Super@12345', roleName: 'SuperAdmin', name: 'Platform Super Admin' },
  { email: 'admin@netflow.app', pass: 'Admin@12345', roleName: 'Admin', name: 'Workspace Admin' },
  { email: 'yash@gmail.com', pass: 'Admin@12345', roleName: 'Admin', name: 'Yash (Admin)' },
  { email: 'ceo@netflow.app', pass: 'Ceo@12345', roleName: 'CEO', name: 'Chief Executive Officer' },
  { email: 'vp@netflow.app', pass: 'Vp@12345', roleName: 'VP', name: 'Vice President' },
  { email: 'manager@netflow.app', pass: 'Manager@12345', roleName: 'Manager', name: 'Operations Manager' },
  { email: 'hr@netflow.app', pass: 'Hr@12345', roleName: 'HR', name: 'HR Partner' },
  { email: 'finance@netflow.app', pass: 'Finance@12345', roleName: 'Finance', name: 'Finance Approver' },
  { email: 'employee@netflow.app', pass: 'Employee@12345', roleName: 'Employee', name: 'Alex Rivera (Employee)' }
];

async function syncAllCredentials() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  for (const u of seedUsers) {
    const hash = await bcrypt.hash(u.pass, 10);
    await mongoose.connection.db.collection('users').updateOne(
      { email: u.email },
      {
        $set: {
          password: hash,
          isActive: true,
          status: 'Active',
          isEmailVerified: true,
          mustChangePassword: false,
          needsProductTour: false,
          lockUntil: null,
          failedLoginAttempts: 0
        }
      }
    );
    console.log(`Updated credentials for: ${u.email} (Password: ${u.pass})`);
  }

  await mongoose.disconnect();
  console.log('\nAll users successfully updated!');
}

syncAllCredentials().catch(console.error);
