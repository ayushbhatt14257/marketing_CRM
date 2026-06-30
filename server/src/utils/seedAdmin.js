// Run with: node src/utils/seedAdmin.js
// Creates the first admin account so you can log in and create further users/admins from the UI.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);

  const email = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`Admin already exists: ${email}`);
    process.exit(0);
  }

  const passwordHash = await User.hashPassword(password);
  await User.create({ name: 'Admin', email, passwordHash, role: 'admin' });

  console.log(`Admin created: ${email} / ${password}`);
  console.log('Log in and change this password immediately.');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
