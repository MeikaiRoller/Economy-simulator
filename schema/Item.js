const mongoose = require("mongoose");

const ItemSchema = new mongoose.Schema({
  itemId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String },
  rarity: {
    type: String,
    enum: ["Common", "Uncommon", "Rare", "Epic", "Legendary"],
    default: "Common",
  },
  type: {
    type: String,
    enum: ["equippable", "consumable"],
    default: "equippable",
  },
  slot: {
    type: String,
    enum: ["weapon", "head", "chest", "hands", "feet", "accessory"],
  },
  
  // Set System
  setName: {
    type: String,
    enum: [
      "Ethans Prowess",
      "Olivias Fury",
      "Justins Clapping",
      "Lilahs Cold Heart",
      "Hasagi",
      "Maries Zhongli Bodypillow",
      "Andys Soraka",
      null
    ],
    default: null
  },
  
  // Element (only if part of elemental set)
  element: {
    type: String,
    enum: ["pyro", "electro", "cryo", "anemo", "geo", "hydro", null],
    default: null
  },
  
  // Main Stat
  mainStat: {
    type: { type: String, enum: ["attack", "defense", "hp", "critRate", "critDMG", "energy"] },
    value: { type: Number, default: 0 }
  },
  
  // Sub Stats (random rolls)
  subStats: [{
    type: { type: String, enum: ["attack", "attack%", "defense", "defense%", "hp", "hp%", "critRate", "critDMG", "energy", "luck"] },
    value: { type: Number }
  }],
  
  // Enhancement System
  level: { type: Number, default: 0, min: 0, max: 15 },
  
  // Legacy support for old items
  price: { type: Number, default: 0 },
  shopPrice: { type: Number, default: 0 },
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
