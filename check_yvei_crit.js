require("dotenv").config();
const mongoose = require("mongoose");
const UserProfile = require("./schema/UserProfile");

async function checkYvei() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const yvei = await UserProfile.findOne({ userId: "302496685873954817" });
    if (!yvei) {
      console.log("❌ Yvei not found");
    } else {
      console.log("📊 Yvei's Buffs:");
      console.log(`  Level: ${yvei.level}`);
      console.log(`  criticalChance: ${yvei.buffs.criticalChance}`);
      console.log(`  attackBoost: ${yvei.buffs.attackBoost}`);
      console.log(`  defenseBoost: ${yvei.buffs.defenseBoost}`);
    }

    await mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

checkYvei();
