const mongoose = require("mongoose");
const RaidBoss = require("./schema/RaidBoss");
const UserProfile = require("./schema/UserProfile");
require("dotenv").config();

async function fixNegativeBossHP() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const raidBoss = await RaidBoss.findOne({});
    
    if (!raidBoss) {
      console.log("❌ No raid boss found in database");
      return;
    }

    console.log("\n📊 Current Boss State:");
    console.log(`   Name: ${raidBoss.bossName}`);
    console.log(`   Current HP: ${raidBoss.currentHp}`);
    console.log(`   Max HP: ${raidBoss.maxHp}`);
    console.log(`   Last Reset: ${raidBoss.lastResetTime}`);
    console.log(`   Participants: ${raidBoss.participantsToday.length}`);

    if (raidBoss.currentHp < 0) {
      console.log("\n🔧 Fixing negative HP...");
      
      // Calculate boss stats based on all players
      const allPlayers = await UserProfile.find({ level: { $exists: true } });
      
      const avgLevel = allPlayers.reduce((sum, p) => sum + p.level, 0) / allPlayers.length;
      const avgDamageAllPlayers = 25 + avgLevel * 2;
      
      const bossLevel = Math.ceil(avgLevel * 1.5);
      const bossAttack = Math.ceil(avgDamageAllPlayers * 1.8);
      const bossDefense = Math.ceil((avgLevel + 12) * 1.5);
      const bossMaxHp = Math.ceil(5000 + allPlayers.length * (avgDamageAllPlayers * 15));

      // Reset the boss
      raidBoss.currentHp = bossMaxHp;
      raidBoss.maxHp = bossMaxHp;
      raidBoss.level = bossLevel;
      raidBoss.attack = bossAttack;
      raidBoss.defense = bossDefense;
      raidBoss.leaderboard = [];
      raidBoss.participantsToday = [];
      raidBoss.lastResetTime = new Date();
      
      await raidBoss.save();
      
      console.log("\n✅ Boss has been reset!");
      console.log(`   New HP: ${raidBoss.currentHp} / ${raidBoss.maxHp}`);
      console.log(`   Level: ${raidBoss.level}`);
      console.log(`   Attack: ${raidBoss.attack}`);
      console.log(`   Defense: ${raidBoss.defense}`);
    } else {
      console.log("\n✅ Boss HP is not negative - no fix needed");
    }

    await mongoose.connection.close();
    console.log("\n🔌 Disconnected from MongoDB");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

fixNegativeBossHP();
