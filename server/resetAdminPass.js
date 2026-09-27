const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: __dirname + '/.env' });

async function resetPass() {
  await mongoose.connect(process.env.MONGO_URI);
  const hash = await bcrypt.hash('Admin@12345', 10);
  const res = await mongoose.connection.db.collection('users').updateOne(
    { email: 'admin@netflow.app' },
    { $set: { password: hash, isEmailVerified: true, status: 'Active', mustChangePassword: false } }
  );
  console.log('Update result for admin@netflow.app:', res);
  await mongoose.disconnect();
}
resetPass().catch(console.error);
