const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env' });

async function fixAllUserRoles() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  const roles = await mongoose.connection.db.collection('roles').find({}).toArray();
  const getRoleId = (name) => roles.find(r => r.name.toLowerCase() === name.toLowerCase())?._id;

  const superAdminRoleId = getRoleId('SuperAdmin');
  const adminRoleId = getRoleId('Admin');
  const ceoRoleId = getRoleId('CEO');
  const vpRoleId = getRoleId('VP');
  const managerRoleId = getRoleId('Manager');
  const hrRoleId = getRoleId('HR');
  const financeRoleId = getRoleId('Finance Approver') || getRoleId('Finance');
  const employeeRoleId = getRoleId('Employee');

  const updates = [
    { email: 'superadmin@netflow.app', roleId: superAdminRoleId, name: 'Platform Super Admin' },
    { email: 'patilabhay717@gmail.com', roleId: superAdminRoleId, name: 'Abhay Patil' },
    { email: 'admin@netflow.app', roleId: adminRoleId, name: 'Workspace Admin' },
    { email: 'yash@gmail.com', roleId: adminRoleId, name: 'Yash' },
    { email: 'ceo@netflow.app', roleId: ceoRoleId, name: 'Chief Executive Officer' },
    { email: 'vp@netflow.app', roleId: vpRoleId, name: 'Vice President' },
    { email: 'manager@netflow.app', roleId: managerRoleId, name: 'Operations Manager' },
    { email: 'hr@netflow.app', roleId: hrRoleId, name: 'HR Partner' },
    { email: 'finance@netflow.app', roleId: financeRoleId, name: 'Finance Approver' },
    { email: 'employee@netflow.app', roleId: employeeRoleId, name: 'Alex Rivera' },
  ];

  for (const u of updates) {
    if (!u.roleId) {
      console.warn(`Could not find role for ${u.email}`);
      continue;
    }
    const res = await mongoose.connection.db.collection('users').updateOne(
      { email: u.email },
      { $set: { role: u.roleId, name: u.name } }
    );
    console.log(`Updated ${u.email} => Name: "${u.name}", RoleId: ${u.roleId} (matched: ${res.matchedCount})`);
  }

  // Print final state
  const allUsers = await mongoose.connection.db.collection('users').find({}).toArray();
  console.log('\n--- Final Users State in DB ---');
  allUsers.forEach(u => {
    const r = roles.find(role => role._id.toString() === u.role?.toString());
    console.log(`${u.email} -> Name: "${u.name}" | Role: "${r ? r.name : 'Unknown'}"`);
  });

  await mongoose.disconnect();
}

fixAllUserRoles().catch(console.error);
