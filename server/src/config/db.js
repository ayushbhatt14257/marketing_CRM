const mongoose = require('mongoose');

async function connectDB() {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);

    // Explicitly (re)build indexes for every registered model and surface any
    // failure loudly. Mongoose's automatic index build on first use fails silently
    // on conflicting/duplicate existing data — that silent failure is exactly what
    // let the daily-points duplicate-award bug through undetected before.
    for (const modelName of mongoose.modelNames()) {
      try {
        await mongoose.model(modelName).syncIndexes();
      } catch (err) {
        console.error(`⚠ INDEX BUILD FAILED for model "${modelName}": ${err.message}`);
        console.error('  This model is running WITHOUT its intended index/constraints. Fix the underlying data conflict and redeploy.');
      }
    }
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
