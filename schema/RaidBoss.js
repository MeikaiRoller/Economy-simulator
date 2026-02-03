const mongoose = require("mongoose");

const RaidBossSchema = new mongoose.Schema({
  currentHp: { type: Number, required: true },
  maxHp: { type: Number, required: true },
  
  // Boss stats scaled by player strength
  attack: { type: Number, required: true },
  defense: { type: Number, required: true },
  level: { type: Number, default: 1 },
  
  // Cycle tracking - event based (when boss dies, not midnight)
  cycleStartTime: { type: Date, default: Date.now },
  bossDefeatedTime: { type: Date, default: null }, // When boss was defeated
  
  // Leaderboard for current cycle
  leaderboard: [{
    userId: String,
    username: String,
    damageDealt: { type: Number, default: 0 },
    _id: false
  }],
  
  // Track participants in current cycle
  participantsThisCycle: [String],
  
  // Boss name/info
  bossName: { type: String, default: "Le Gromp" },
  bossDescription: { type: String, default: "An ancient amphibian guardian that grows stronger with each challenger" }
});

module.exports = mongoose.model("RaidBoss", RaidBossSchema);
