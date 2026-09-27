const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const uri = 'mongodb+srv://reet:reet123@cluster0.2p8jeli.mongodb.net/netflow';

async function main() {
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    let superAdminRole = await mongoose.connection.db.collection('roles').findOne({ name: 'SuperAdmin' });
    if (!superAdminRole) {
      superAdminRole = await mongoose.connection.db.collection('roles').findOne({ name: { $regex: /superadmin/i } });
    }
    console.log('SuperAdmin role ID:', superAdminRole?._id);

    const hashedPassword = await bcrypt.hash('Super@12345', 10);

    const res = await mongoose.connection.db.collection('users').updateOne(
      { email: 'patilabhay717@gmail.com' },
      {
        $set: {
          name: 'Abhay Patil (Super Admin)',
          email: 'patilabhay717@gmail.com',
          password: hashedPassword,
          role: superAdminRole._id,
          department: 'Executive',
          isActive: true,
          canBuild: true,
          isProtected: true,
          mustChangePassword: false,
          needsProductTour: false,
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date(),
          tokenVersion: 0,
          activeSessions: []
        }
      },
      { upsert: true }
    );

    console.log('Upsert result:', res);
    console.log('SUCCESS: patilabhay717@gmail.com is now configured with password Super@12345');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
