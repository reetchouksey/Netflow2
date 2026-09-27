const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env' });

async function fixName() {
  await mongoose.connect(process.env.MONGO_URI);
  const res = await mongoose.connection.db.collection('users').updateOne(
    { email: 'yash@gmail.com' },
    { $set: { name: 'Yash' } }
  );
  console.log('Update result for Yash:', res);
  await mongoose.disconnect();
}
fixName().catch(console.error);
