const mongoose = require("mongoose");

const HorseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  rarity: {
    type: String,
    enum: ["Common", "Uncommon", "Rare", "Epic", "Legendary"],
    default: "Common",
  },
  price: { type: Number, default: 0 },
  emoji: { type: String },
  buffs: {
    attack: { type: Number, default: 0 },
    defense: { type: Number, default: 0 },
    magic: { type: Number, default: 0 },
    magicDefense: { type: Number, default: 0 },
    critChance: { type: Number, default: 0 },
    xpBoost: { type: Number, default: 0 },
    healingBoost: { type: Number, default: 0 },
    luck: { type: Number, default: 0 },
    lootBoost: { type: Number, default: 0 },
    findRateBoost: { type: Number, default: 0 },
    cooldownReduction: { type: Number, default: 0 },
  },
});

module.exports = mongoose.model("Item", ItemSchema);
