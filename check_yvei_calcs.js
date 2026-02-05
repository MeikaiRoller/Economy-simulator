require("dotenv").config();
const mongoose = require("mongoose");
const UserProfile = require("./schema/UserProfile");
const calculateActiveBuffs = require("./utils/calculateBuffs");

async function checkYveiBuffs() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const yvei = await UserProfile.findOne({ userId: "302496685873954817" });
    if (!yvei) {
      console.log("❌ Yvei not found");
    } else {
      const buffs = await calculateActiveBuffs(yvei);
      console.log("📊 Yvei's calculateActiveBuffs result:");
      console.log(`  critChance: ${buffs.critChance}`);
      console.log(`  attack: ${buffs.attack}`);
      console.log(`  defense: ${buffs.defense}`);
    }

    await mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

checkYveiBuffs();
