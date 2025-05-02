const mongoose = require("mongoose");

const UserProfileSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  balance: { type: Number, default: 0 },
  lastDailyCollected: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },

  gamesPlayed: { type: Number, default: 0 },
  gamesWon: { type: Number, default: 0 },
  gamesLost: { type: Number, default: 0 },

  // ---RPG STATS---
  hp: { type: Number, default: 100 }, // Current HP
  mana: { type: Number, default: 50 }, // Current Mana
  xp: { type: Number, default: 0 }, // Current XP
  level: { type: Number, default: 1 }, // Player level

  buffs: {
    lootBoost: { type: Number, default: 1 }, // % bonus to loot earned
    findRateBoost: { type: Number, default: 1 }, // % chance to find rare items
    cooldownReduction: { type: Number, default: 1 }, // % reduction on cooldowns
    attackBoost: { type: Number, default: 1 }, // % bonus to attack power
    defenseBoost: { type: Number, default: 1 }, // % bonus to defense power
    magicBoost: { type: Number, default: 1 }, // % bonus to magic power
    magicDefenseBoost: { type: Number, default: 1 }, // % bonus to magic defense
    criticalChance: { type: Number, default: 1 }, // % bonus to critical hit chance
    xpBoost: { type: Number, default: 1 }, // % bonus to XP gained
    healingBoost: { type: Number, default: 1 }, // % bonus to healing done
    luckBoost: { type: Number, default: 1 }, // % bonus to luck events
  },

  inventory: [
    {
      itemId: { type: String },
      quantity: { type: Number, default: 1 },
    },
  ],
});

module.exports = mongoose.model("UserProfile", UserProfileSchema);
