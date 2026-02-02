const { v4: uuidv4 } = require('uuid');

// Set definitions
const SETS = {
  "Ethans Prowess": { element: null, emoji: "⚔️" },
  "Olivias Fury": { element: "pyro", emoji: "🔥" },
  "Justins Clapping": { element: "electro", emoji: "⚡" },
  "Lilahs Cold Heart": { element: "cryo", emoji: "❄️" },
  "Hasagi": { element: "anemo", emoji: "💨" },
  "Maries Zhongli Bodypillow": { element: "geo", emoji: "🪨" },
  "Andys Soraka": { element: "hydro", emoji: "💧" }
};

const SLOT_EMOJIS = {
  weapon: "⚔️",
  head: "👑",
  chest: "🧥",
  hands: "🤚",
  feet: "🥾",
  accessory: "💎"
};

const RARITY_COLORS = {
  Common: 0x808080,
  Uncommon: 0x1eff00,
  Rare: 0x0070dd,
  Epic: 0xa335ee,
  Legendary: 0xff8000,
};

// Main stat ranges by rarity and slot
const MAIN_STAT_RANGES = {
  weapon: { type: "attack", ranges: { Common: [15, 25], Uncommon: [25, 40], Rare: [40, 60], Epic: [60, 85], Legendary: [85, 120] }},
  head: { type: "defense", ranges: { Common: [10, 18], Uncommon: [18, 30], Rare: [30, 45], Epic: [45, 65], Legendary: [65, 95] }},
  chest: { type: "hp%", ranges: { Common: [8, 12], Uncommon: [12, 18], Rare: [18, 25], Epic: [25, 35], Legendary: [35, 50] }},
  hands: { type: "critRate", ranges: { Common: [2, 4], Uncommon: [4, 7], Rare: [7, 11], Epic: [11, 16], Legendary: [16, 23] }},
  feet: { type: "critDMG", ranges: { Common: [8, 15], Uncommon: [15, 25], Rare: [25, 40], Epic: [40, 60], Legendary: [60, 90] }},
  accessory: { type: "energy", ranges: { Common: [5, 10], Uncommon: [10, 18], Rare: [18, 28], Epic: [28, 42], Legendary: [42, 65] }}
};

// Sub-stat roll ranges
const SUB_STAT_RANGES = {
  "attack": { Common: [3, 8], Uncommon: [8, 15], Rare: [15, 25], Epic: [25, 40], Legendary: [40, 60] },
  "attack%": { Common: [2, 5], Uncommon: [5, 9], Rare: [9, 14], Epic: [14, 20], Legendary: [20, 30] },
  "defense": { Common: [2, 6], Uncommon: [6, 12], Rare: [12, 20], Epic: [20, 32], Legendary: [32, 50] },
  "defense%": { Common: [2, 5], Uncommon: [5, 9], Rare: [9, 14], Epic: [14, 20], Legendary: [20, 30] },
  "hp": { Common: [20, 40], Uncommon: [40, 70], Rare: [70, 110], Epic: [110, 160], Legendary: [160, 240] },
  "hp%": { Common: [2, 5], Uncommon: [5, 9], Rare: [9, 14], Epic: [14, 20], Legendary: [20, 30] },
  "critRate": { Common: [1, 3], Uncommon: [3, 5], Rare: [5, 8], Epic: [8, 12], Legendary: [12, 18] },
  "critDMG": { Common: [3, 8], Uncommon: [8, 14], Rare: [14, 22], Epic: [22, 33], Legendary: [33, 50] },
  "energy": { Common: [2, 5], Uncommon: [5, 9], Rare: [9, 15], Epic: [15, 23], Legendary: [23, 35] },
  "luck": { Common: [0.02, 0.05], Uncommon: [0.05, 0.08], Rare: [0.08, 0.12], Epic: [0.12, 0.18], Legendary: [0.18, 0.27] }
};

const SUB_STAT_POOL = ["attack", "attack%", "defense", "defense%", "hp", "hp%", "critRate", "critDMG", "energy", "luck"];

// Number of sub-stats by rarity
const SUB_STAT_COUNT = {
  Common: 2,
  Uncommon: 2,
  Rare: 3,
  Epic: 3,
  Legendary: 4
};

/**
 * Generate a procedural item
 * @param {string} slot - Equipment slot
 * @param {string} rarity - Item rarity
 * @param {string} setName - Set name (optional)
 * @returns {object} Generated item data
 */
function generateItem(slot, rarity = "Common", setName = null) {
  // If no set specified, randomly choose one
  if (!setName) {
    const setNames = Object.keys(SETS);
    setName = setNames[Math.floor(Math.random() * setNames.length)];
  }
  
  const setData = SETS[setName];
  const itemId = `${setName.replace(/\s+/g, '_').toLowerCase()}_${slot}_${uuidv4().slice(0, 8)}`;
  
  // Generate main stat
  const mainStatConfig = MAIN_STAT_RANGES[slot];
  const mainStatRange = mainStatConfig.ranges[rarity];
  const mainStatValue = Math.floor(Math.random() * (mainStatRange[1] - mainStatRange[0] + 1)) + mainStatRange[0];
  
  // Generate sub-stats
  const numSubStats = SUB_STAT_COUNT[rarity];
  const subStats = [];
  const usedTypes = new Set([mainStatConfig.type]); // Don't duplicate main stat
  
  for (let i = 0; i < numSubStats; i++) {
    // Get available sub-stat types
    const availableTypes = SUB_STAT_POOL.filter(type => !usedTypes.has(type));
    if (availableTypes.length === 0) break;
    
    // Pick random type
    const subStatType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
    usedTypes.add(subStatType);
    
    // Roll value
    const subStatRange = SUB_STAT_RANGES[subStatType][rarity];
    let subStatValue = Math.random() * (subStatRange[1] - subStatRange[0]) + subStatRange[0];
    
    // Round appropriately
    if (subStatType.includes('%') || subStatType === 'luck') {
      subStatValue = Math.round(subStatValue * 10) / 10; // 1 decimal
    } else {
      subStatValue = Math.floor(subStatValue);
    }
    
    subStats.push({
      type: subStatType,
      value: subStatValue
    });
  }
  
  // Generate name
  const slotName = slot.charAt(0).toUpperCase() + slot.slice(1);
  const elementPrefix = setData.element ? ` of ${setData.element.charAt(0).toUpperCase() + setData.element.slice(1)}` : "";
  const name = `${setName} ${slotName}${elementPrefix}`;
  
  // Calculate approximate value based on stats
  const baseValue = {
    Common: 5000,
    Uncommon: 15000,
    Rare: 40000,
    Epic: 100000,
    Legendary: 250000
  }[rarity];
  
  const price = Math.floor(baseValue * (0.8 + Math.random() * 0.4)); // ±20% variance
  
  return {
    itemId,
    name,
    description: `A ${rarity.toLowerCase()} piece from the ${setName} set.`,
    rarity,
    type: "equippable",
    slot,
    setName,
    element: setData.element,
    mainStat: {
      type: mainStatConfig.type,
      value: mainStatValue
    },
    subStats,
    level: 0, // New items start at level 0
    price,
    shopPrice: price,
    emoji: setData.emoji || SLOT_EMOJIS[slot]
  };
}

/**
 * Generate multiple items
 * @param {number} count - Number of items to generate
 * @param {string} minRarity - Minimum rarity
 * @returns {Array} Array of generated items
 */
function generateMultipleItems(count, minRarity = "Common") {
  const items = [];
  const slots = ["weapon", "head", "chest", "hands", "feet", "accessory"];
  const rarities = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
  
  // Get valid rarities
  const minRarityIndex = rarities.indexOf(minRarity);
  const validRarities = rarities.slice(minRarityIndex);
  
  for (let i = 0; i < count; i++) {
    const slot = slots[Math.floor(Math.random() * slots.length)];
    const rarity = validRarities[Math.floor(Math.random() * validRarities.length)];
    items.push(generateItem(slot, rarity));
  }
  
  return items;
}

/**
 * Roll rarity based on weighted chances
 * @param {boolean} isBoss - Whether this is a boss drop
 * @returns {string} Rolled rarity
 */
function rollRarity(isBoss = false) {
  const roll = Math.random() * 100;
  
  if (isBoss) {
    // Boss drop rates
    if (roll < 2) return "Legendary";
    if (roll < 10) return "Epic";
    if (roll < 30) return "Rare";
    if (roll < 60) return "Uncommon";
    return "Common";
  } else {
    // Normal drop rates
    if (roll < 0.5) return "Legendary";
    if (roll < 3) return "Epic";
    if (roll < 12) return "Rare";
    if (roll < 35) return "Uncommon";
    return "Common";
  }
}

module.exports = {
  generateItem,
  generateMultipleItems,
  rollRarity,
  SETS,
  RARITY_COLORS
};
