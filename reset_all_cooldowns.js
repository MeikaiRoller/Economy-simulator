const mongoose = require('mongoose');
const Cooldown = require('./schema/Cooldown');
require('dotenv').config();

async function resetAllCooldowns() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected\n');

    const result = await Cooldown.deleteMany({});
    console.log(`🗑️ Deleted ${result.deletedCount} cooldown(s)`);
    console.log('✅ All cooldowns reset!\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetAllCooldowns();
