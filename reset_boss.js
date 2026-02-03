const mongoose = require('mongoose');
const RaidBoss = require('./schema/RaidBoss');
require('dotenv').config();

async function resetBoss() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected\n');

    const result = await RaidBoss.deleteMany({});
    console.log(`🗑️ Deleted ${result.deletedCount} boss(es)`);
    console.log('✅ Boss reset! A new boss will be generated on the next /rpg raid command.\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetBoss();
