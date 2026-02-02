const mongoose = require("mongoose");

const RaidBossSchema = new mongoose.Schema({
  currentHp: { type: Number, required: true },
  maxHp: { type: Number, required: true },
  
  // Boss stats scaled by player strength
  attack: { type: Number, required: true },
  defense: { type: Number, required: true },
  level: { type: Number, default: 1 },
  
  // Reset tracking
  lastResetTime: { type: Date, default: Date.now },
  
  // Leaderboard for current cycle
  leaderboard: [{
    userId: String,
    username: String,
    damageDealt: { type: Number, default: 0 },
    _id: false
  }],
  
  // Track participants today for base reward eligibility
  participantsToday: [String],
  
  // Boss name/info
  bossName: { type: String, default: "Le Gromp" },
  bossDescription: { type: String, default: "An ancient amphibian guardian that grows stronger with each challenger" }
});

module.exports = mongoose.model("RaidBoss", RaidBossSchema);
