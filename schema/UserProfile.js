const mongoose = require("mongoose");

const UserProfileSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  balance: { type: Number, default: 0 },
  bankBalance: { type: Number, default: 0 },
  lastDailyCollected: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },

  gamesPlayed: { type: Number, default: 0 },
  gamesWon: { type: Number, default: 0 },
  gamesLost: { type: Number, default: 0 },

  // ---PVP STATS---
  pvpStats: {
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    totalWagered: { type: Number, default: 0 },
    totalWon: { type: Number, default: 0 },
    totalLost: { type: Number, default: 0 },
  },

  // ---RPG STATS---
  hp: { type: Number, default: 100 }, // Current HP
  mana: { type: Number, default: 50 }, // Current Mana
  xp: { type: Number, default: 0 }, // Current XP
  level: { type: Number, default: 1 }, // Player level

  buffs: {
    lootBoost: { type: Number, default: 0 },
    findRateBoost: { type: Number, default: 0 },
    cooldownReduction: { type: Number, default: 0 },
    attackBoost: { type: Number, default: 0 },
    defenseBoost: { type: Number, default: 0 },
    magicBoost: { type: Number, default: 0 },
    magicDefenseBoost: { type: Number, default: 0 },
    criticalChance: { type: Number, default: 0 },
    xpBoost: { type: Number, default: 0 },
    healingBoost: { type: Number, default: 0 },
    luckBoost: { type: Number, default: 0 },
  },

  inventory: [
    {
      itemId: { type: String },
      quantity: { type: Number, default: 1 },
    },
  ],

  equipped: {
    weapon: { type: String, default: null },
    head: { type: String, default: null },
    chest: { type: String, default: null },
    hands: { type: String, default: null },
    feet: { type: String, default: null },
    accessory: { type: String, default: null }, // Only 1 accessory slot
  },

  lastRaidReward: {
    bossId: { type: String, default: null },
    bossName: { type: String, default: null },
    placement: { type: Number, default: null },
    money: { type: Number, default: 0 },
    xp: { type: Number, default: 0 },
    itemId: { type: String, default: null },
    itemName: { type: String, default: null },
    itemEmoji: { type: String, default: null },
    itemRarity: { type: String, default: null },
    awardedAt: { type: Date, default: null },
  },
});

module.exports = mongoose.model("UserProfile", UserProfileSchema);
