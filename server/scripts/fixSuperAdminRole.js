const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });

async function fixSuperAdmin() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const superAdminRole = await mongoose.connection.db.collection('roles').findOne({ name: 'SuperAdmin' });
  if (!superAdminRole) {
    console.error('SuperAdmin role not found in database!');
    process.exit(1);
  }
  console.log('SuperAdmin Role ID:', superAdminRole._id.toString());

  // Fix superadmin@netflow.app
  const res1 = await mongoose.connection.db.collection('users').updateOne(
    { email: 'superadmin@netflow.app' },
    {
      $set: {
        role: superAdminRole._id,
        isSuperAdmin: true,
        roleName: 'SuperAdmin',
        tokenVersion: Date.now()
      }
    }
  );
  console.log('Updated superadmin@netflow.app:', res1.modifiedCount);

  // Fix patilabhay717@gmail.com
  const res2 = await mongoose.connection.db.collection('users').updateOne(
    { email: 'patilabhay717@gmail.com' },
    {
      $set: {
        role: superAdminRole._id,
        isSuperAdmin: true,
        roleName: 'SuperAdmin',
        tokenVersion: Date.now()
      }
    }
  );
  console.log('Updated patilabhay717@gmail.com:', res2.modifiedCount);

  // Verification
  const user = await mongoose.connection.db.collection('users').findOne({ email: 'superadmin@netflow.app' });
  console.log('Verified superadmin user:', {
    email: user.email,
    name: user.name,
    role: user.role.toString(),
    isSuperAdmin: user.isSuperAdmin
  });

  await mongoose.disconnect();
  console.log('SuperAdmin role fix completed successfully.');
}

fixSuperAdmin().catch(console.error);
