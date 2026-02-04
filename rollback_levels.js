require('dotenv').config();
const mongoose = require('mongoose');
const UserProfile = require('./schema/UserProfile');

const MONGO_URI = process.env.MONGO_URI;

const rollbackData = [
  { userId: '302496685873954817', name: 'yvei' },
  { userId: '404517645480624130', name: 'shiimpy' },
  { userId: '1137555798009073704', name: 'Mekkii_' }
];

const targetLevel = 110;
const targetXp = 100000; // ~100k XP for level 110

async function rollbackLevels() {
  try {
    if (!MONGO_URI) {
      console.error('❌ MONGO_URI environment variable not set');
      process.exit(1);
    }

    await mongoose.connect(MONGO_URI, { maxPoolSize: 10 });
    console.log('✅ Connected to MongoDB');

    // Show current levels before rollback
    console.log('\n📊 Current levels:');
    for (const data of rollbackData) {
      const profile = await UserProfile.findOne({ userId: data.userId });
      if (profile) {
        console.log(`  ${data.name} (${data.userId}): Level ${profile.level} (XP: ${profile.xp})`);
      } else {
        console.log(`  ${data.name} (${data.userId}): Profile not found`);
      }
    }

    // Perform rollback
    const userIds = rollbackData.map(d => d.userId);
    const result = await UserProfile.updateMany(
      { userId: { $in: userIds } },
      { 
        $set: { 
          level: targetLevel,
          xp: targetXp
        }
      }
    );

    console.log(`\n✅ Rolled back ${result.modifiedCount} profiles to level ${targetLevel} with ${targetXp} XP`);

    // Show levels after rollback
    console.log('\n📊 After rollback:');
    for (const data of rollbackData) {
      const profile = await UserProfile.findOne({ userId: data.userId });
      if (profile) {
        console.log(`  ${data.name} (${data.userId}): Level ${profile.level} (XP: ${profile.xp})`);
      }
    }

    await mongoose.disconnect();
    console.log('\n✅ Rollback complete');
  } catch (error) {
    console.error('❌ Rollback error:', error);
    process.exit(1);
  }
}

rollbackLevels();
