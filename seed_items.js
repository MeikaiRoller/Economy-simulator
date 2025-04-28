const mongoose = require("mongoose");
const Item = require("./schema/Item"); // adjust if needed
require("dotenv").config();

const items = [
  {
    itemId: "leather-armor",
    name: "Leather Armor",
    description: "Simple armor offering minor defense.",
    rarity: "Common",
    price: 1800,
    buffs: {
      defense: 0.03,
    },
    emoji: "🥋",
  },
  {
    itemId: "iron-dagger",
    name: "Iron Dagger",
    description: "A quick blade that slightly boosts attack power.",
    rarity: "Common",
    price: 2000,
    buffs: {
      attack: 0.04,
    },
    emoji: "🗡️",
  },
  {
    itemId: "wooden-wand",
    name: "Wooden Wand",
    description: "A basic wand that boosts magic slightly.",
    rarity: "Common",
    price: 2100,
    buffs: {
      magic: 0.04,
    },
    emoji: "🪄",
  },
  {
    itemId: "adventurer-boots",
    name: "Adventurer's Boots",
    description:
      "Light boots that make traveling quicker (cooldown reduction).",
    rarity: "Common",
    price: 1900,
    buffs: {
      cooldownReduction: 0.02,
    },
    emoji: "🥾",
  },
  {
    itemId: "small-charm",
    name: "Small Charm",
    description: "A tiny lucky charm to slightly boost Luck.",
    rarity: "Common",
    price: 1700,
    buffs: {
      luck: 0.03,
    },
    emoji: "🧿",
  },
  {
    itemId: "steel-buckler",
    name: "Steel Buckler",
    description: "A sturdy buckler providing a small defense boost.",
    rarity: "Uncommon",
    price: 4000,
    buffs: {
      defense: 0.05,
    },
    emoji: "🛡️",
  },
  {
    itemId: "apprentice-robe",
    name: "Apprentice's Robe",
    description: "An early robe that boosts magic and XP a little.",
    rarity: "Uncommon",
    price: 4200,
    buffs: {
      magic: 0.04,
      xpBoost: 0.03,
    },
    emoji: "🧥",
  },
  {
    itemId: "swift-gloves",
    name: "Swift Gloves",
    description:
      "Gloves that slightly improve action speed (cooldown reduction).",
    rarity: "Uncommon",
    price: 3900,
    buffs: {
      cooldownReduction: 0.04,
    },
    emoji: "🧤",
  },
  {
    itemId: "lucky-pendant",
    name: "Lucky Pendant",
    description: "Boosts luck and finding rare items modestly.",
    rarity: "Uncommon",
    price: 4300,
    buffs: {
      luck: 0.05,
      findRateBoost: 0.03,
    },
    emoji: "📿",
  },
  {
    itemId: "novice-scroll",
    name: "Novice's Scroll",
    description: "Improves XP gain slightly for newer adventurers.",
    rarity: "Uncommon",
    price: 4100,
    buffs: {
      xpBoost: 0.05,
    },
    emoji: "📜",
  },
  {
    itemId: "hunter-hood",
    name: "Hunter's Hood",
    description: "Boosts Luck and Find Rate — perfect for rare loot hunters.",
    rarity: "Uncommon",
    price: 5200,
    buffs: {
      luck: 0.07,
      findRateBoost: 0.07,
    },
    emoji: "🏹",
  },
  {
    itemId: "guardian-shield",
    name: "Guardian's Shield",
    description: "Heavy shield that greatly boosts Defense.",
    rarity: "Rare",
    price: 9000,
    buffs: {
      defense: 0.15,
    },
    emoji: "🛡️",
  },
  {
    itemId: "sprint-boots",
    name: "Sprint Boots",
    description: "Slightly reduces cooldowns for faster actions.",
    rarity: "Uncommon",
    price: 6000,
    buffs: {
      cooldownReduction: 0.05,
    },
    emoji: "👟",
  },
  {
    itemId: "scholar-scroll",
    name: "Scholar's Scroll",
    description: "Enhances XP gains slightly over time.",
    rarity: "Uncommon",
    price: 5800,
    buffs: {
      xpBoost: 0.08,
    },
    emoji: "📖",
  },
  {
    itemId: "vitality-pendant",
    name: "Vitality Pendant",
    description: "Improves healing received during adventures.",
    rarity: "Rare",
    price: 9500,
    buffs: {
      healingBoost: 0.12,
    },
    emoji: "💠",
  },
  {
    itemId: "nightblade",
    name: "Nightblade",
    description: "Boosts Attack and Crit Chance — strike swiftly and fatally.",
    rarity: "Epic",
    price: 17000,
    buffs: {
      attack: 0.18,
      critChance: 0.05,
    },
    emoji: "🗡️",
  },
  {
    itemId: "ethereal-mantle",
    name: "Ethereal Mantle",
    description: "Increases Magic and reduces cooldowns slightly.",
    rarity: "Epic",
    price: 16500,
    buffs: {
      magic: 0.15,
      cooldownReduction: 0.05,
    },
    emoji: "🧥",
  },
  {
    itemId: "treasure-map",
    name: "Treasure Map",
    description: "Major boost to Loot Boost and Find Rate.",
    rarity: "Legendary",
    price: 24000,
    buffs: {
      lootBoost: 0.2,
      findRateBoost: 0.15,
    },
    emoji: "🗺️",
  },
  {
    itemId: "bloodthirst-amulet",
    name: "Bloodthirst Amulet",
    description: "Massive Attack bonus, but no defensive stats!",
    rarity: "Epic",
    price: 18000,
    buffs: {
      attack: 0.25,
    },
    emoji: "🩸",
  },
  {
    itemId: "prism-ring",
    name: "Prism Ring",
    description: "Balanced boost across Attack, Magic, and XP.",
    rarity: "Legendary",
    price: 26000,
    buffs: {
      attack: 0.1,
      magic: 0.1,
      xpBoost: 0.1,
    },
    emoji: "💍",
  },
  {
    itemId: "warrior-charm",
    name: "Warrior's Charm",
    description: "Boosts your Attack and Defense slightly.",
    rarity: "Uncommon",
    price: 4500,
    buffs: {
      attack: 0.05,
      defense: 0.05,
    },
    emoji: "🛡️",
  },
  {
    itemId: "mage-talisman",
    name: "Mage's Talisman",
    description: "Increases your Magic and Magic Defense.",
    rarity: "Uncommon",
    price: 4800,
    buffs: {
      magic: 0.06,
      magicDefense: 0.06,
    },
    emoji: "🔮",
  },
  {
    itemId: "lucky-coin",
    name: "Lucky Coin",
    description: "Boosts your Luck and Find Rate.",
    rarity: "Rare",
    price: 7500,
    buffs: {
      luck: 0.1,
      findRateBoost: 0.05,
    },
    emoji: "🍀",
  },
  {
    itemId: "blessed-scroll",
    name: "Blessed Scroll",
    description: "Improves XP gain and Healing received.",
    rarity: "Rare",
    price: 8000,
    buffs: {
      xpBoost: 0.1,
      healingBoost: 0.08,
    },
    emoji: "📜",
  },
  {
    itemId: "nether-armor",
    name: "Nether Armor",
    description: "Grants solid Defense and Magic Defense.",
    rarity: "Epic",
    price: 15000,
    buffs: {
      defense: 0.12,
      magicDefense: 0.12,
    },
    emoji: "🥋",
  },
  {
    itemId: "berserker-blade",
    name: "Berserker Blade",
    description: "Huge Attack bonus but no defense!",
    rarity: "Epic",
    price: 16000,
    buffs: {
      attack: 0.2,
    },
    emoji: "🗡️",
  },
  {
    itemId: "sorcerer-robe",
    name: "Sorcerer's Robe",
    description: "Massive Magic bonus, fragile armor!",
    rarity: "Epic",
    price: 17000,
    buffs: {
      magic: 0.22,
    },
    emoji: "🎭",
  },
  {
    itemId: "phoenix-ring",
    name: "Phoenix Ring",
    description: "Boosts Healing and Luck dramatically.",
    rarity: "Legendary",
    price: 22000,
    buffs: {
      healingBoost: 0.2,
      luck: 0.2,
    },
    emoji: "💍",
  },
  {
    itemId: "ancient-totem",
    name: "Ancient Totem",
    description: "Grants bonuses to many stats.",
    rarity: "Legendary",
    price: 25000,
    buffs: {
      attack: 0.1,
      defense: 0.1,
      magic: 0.1,
      magicDefense: 0.1,
      lootBoost: 0.1,
      xpBoost: 0.1,
    },
    emoji: "🗿",
  },
  {
    itemId: "cosmic-scroll",
    name: "Cosmic Scroll",
    description: "Enhances XP, Magic, and Find Rate.",
    rarity: "Legendary",
    price: 28000,
    buffs: {
      xpBoost: 0.15,
      magic: 0.15,
      findRateBoost: 0.1,
    },
    emoji: "🌌",
  },
];

async function seedItems() {
  await mongoose.connect(process.env.MONGODB_URI);

  await Item.deleteMany({}); // optional: clear old items first
  await Item.insertMany(items);
  console.log("✅ Items seeded successfully!");

  await mongoose.disconnect();
}

seedItems().catch(console.error);
