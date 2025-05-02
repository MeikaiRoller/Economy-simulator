const mongoose = require("mongoose");
const Item = require("./schema/Item"); // adjust if needed
require("dotenv").config();

const items = [
  {
    itemId: "leather-armor",
    name: "Leather Armor",
    description: "Simple armor offering minor defense.",
    rarity: "Common",
    price: 18000,
    buffs: {
      defense: 0.01,
    },
    emoji: "🥋",
  },
  {
    itemId: "iron-dagger",
    name: "Iron Dagger",
    description: "A quick blade that slightly boosts attack power.",
    rarity: "Common",
    price: 10000,
    buffs: {
      attack: 0.01,
    },
    emoji: "🗡️",
  },
  {
    itemId: "wooden-wand",
    name: "Wooden Wand",
    description: "A basic wand that boosts magic slightly.",
    rarity: "Common",
    price: 21000,
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
    price: 19000,
    buffs: {
      cooldownReduction: 0.005,
    },
    emoji: "🥾",
  },
  {
    itemId: "small-charm",
    name: "Small Charm",
    description: "A tiny lucky charm to slightly boost Luck.",
    rarity: "Common",
    price: 17000,
    buffs: {
      luck: 0.01,
    },
    emoji: "🧿",
  },
  {
    itemId: "steel-buckler",
    name: "Steel Buckler",
    description: "A sturdy buckler providing a small defense boost.",
    rarity: "Uncommon",
    price: 14510,
    buffs: {
      defense: 0.03,
    },
    emoji: "🛡️",
  },
  {
    itemId: "apprentice-robe",
    name: "Apprentice's Robe",
    description: "An early robe that boosts magic and XP a little.",
    rarity: "Uncommon",
    price: 10200,
    buffs: {
      magic: 0.02,
      xpBoost: 0.01,
    },
    emoji: "🧥",
  },
  {
    itemId: "swift-gloves",
    name: "Swift Gloves",
    description:
      "Gloves that slightly improve action speed (cooldown reduction).",
    rarity: "Uncommon",
    price: 39000,
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
    price: 43000,
    buffs: {
      luck: 0.1,
      findRateBoost: 0.01,
    },
    emoji: "📿",
  },
  {
    itemId: "novice-scroll",
    name: "Novice's Scroll",
    description: "Improves XP gain slightly for newer adventurers.",
    rarity: "Uncommon",
    price: 41030,
    buffs: {
      xpBoost: 0.1,
    },
    emoji: "📜",
  },
  {
    itemId: "hunter-hood",
    name: "Hunter's Hood",
    description: "Boosts Luck and Find Rate — perfect for rare loot hunters.",
    rarity: "Uncommon",
    price: 50200,
    buffs: {
      luck: 0.07,
      findRateBoost: 0.01,
    },
    emoji: "🏹",
  },
  {
    itemId: "guardian-shield",
    name: "Guardian's Shield",
    description: "Heavy shield that greatly boosts Defense.",
    rarity: "Rare",
    price: 198015,
    buffs: {
      defense: 0.4,
    },
    emoji: "🛡️",
  },
  {
    itemId: "sprint-boots",
    name: "Sprint Boots",
    description: "Slightly reduces cooldowns for faster actions.",
    rarity: "Uncommon",
    price: 60000,
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
    price: 10800,
    buffs: {
      xpBoost: 0.1,
    },
    emoji: "📖",
  },
  {
    itemId: "vitality-pendant",
    name: "Vitality Pendant",
    description: "Improves healing received during adventures.",
    rarity: "Rare",
    price: 95080,
    buffs: {
      healingBoost: 0.22,
    },
    emoji: "💠",
  },
  {
    itemId: "nightblade",
    name: "Nightblade",
    description: "Boosts Attack and Crit Chance — strike swiftly and fatally.",
    rarity: "Epic",
    price: 477035,
    buffs: {
      attack: 0.38,
      critChance: 0.05,
    },
    emoji: "🗡️",
  },
  {
    itemId: "ethereal-mantle",
    name: "Ethereal Mantle",
    description: "Increases Magic and reduces cooldowns slightly.",
    rarity: "Epic",
    price: 165000,
    buffs: {
      magic: 0.35,
      cooldownReduction: 0.05,
    },
    emoji: "🧥",
  },
  {
    itemId: "treasure-map",
    name: "Treasure Map",
    description: "Major boost to Loot Boost and Find Rate.",
    rarity: "Legendary",
    price: 7777777,
    buffs: {
      lootBoost: 7.77,
      findRateBoost: 0.15,
    },
    emoji: "🗺️",
  },
  {
    itemId: "bloodthirst-amulet",
    name: "Bloodthirst Amulet",
    description: "Massive Attack bonus, but no defensive stats!",
    rarity: "Epic",
    price: 583055,
    buffs: {
      attack: 0.55,
    },
    emoji: "🩸",
  },
  {
    itemId: "prism-ring",
    name: "Prism Ring",
    description: "Balanced boost across Attack, Magic, and XP.",
    rarity: "Legendary",
    price: 2603530,
    buffs: {
      attack: 2.0,
      magic: 2.0,
      xpBoost: 2.0,
    },
    emoji: "💍",
  },
  {
    itemId: "warrior-charm",
    name: "Warrior's Charm",
    description: "Boosts your Attack and Defense slightly.",
    rarity: "Uncommon",
    price: 25000,
    buffs: {
      attack: 0.03,
      defense: 0.02,
    },
    emoji: "🛡️",
  },
  {
    itemId: "mage-talisman",
    name: "Mage's Talisman",
    description: "Increases your Magic and Magic Defense.",
    rarity: "Uncommon",
    price: 9800,
    buffs: {
      magic: 0.02,
      magicDefense: 0.02,
    },
    emoji: "🔮",
  },
  {
    itemId: "lucky-coin",
    name: "Lucky Coin",
    description: "Boosts your Luck and Find Rate.",
    rarity: "Rare",
    price: 35000,
    buffs: {
      luck: 0.01,
      findRateBoost: 0.01,
    },
    emoji: "🍀",
  },
  {
    itemId: "blessed-scroll",
    name: "Blessed Scroll",
    description: "Improves XP gain and Healing received.",
    rarity: "Rare",
    price: 80000,
    buffs: {
      xpBoost: 0.05,
      healingBoost: 0.08,
    },
    emoji: "📜",
  },
  {
    itemId: "nether-armor",
    name: "Nether Armor",
    description: "Grants solid Defense and Magic Defense.",
    rarity: "Epic",
    price: 150000,
    buffs: {
      defense: 0.32,
      magicDefense: 0.26,
    },
    emoji: "🥋",
  },
  {
    itemId: "berserker-blade",
    name: "Berserker Blade",
    description: "Huge Attack bonus but no defense!",
    rarity: "Epic",
    price: 260435,
    buffs: {
      attack: 0.35,
    },
    emoji: "🗡️",
  },
  {
    itemId: "sorcerer-robe",
    name: "Sorcerer's Robe",
    description: "Massive Magic bonus, fragile armor!",
    rarity: "Epic",
    price: 270450,
    buffs: {
      magic: 0.42,
    },
    emoji: "🎭",
  },
  {
    itemId: "phoenix-ring",
    name: "Phoenix Ring",
    description: "Boosts Healing and Luck dramatically.",
    rarity: "Legendary",
    price: 720512,
    buffs: {
      healingBoost: 0.2,
      luck: 2.25,
    },
    emoji: "💍",
  },
  {
    itemId: "ancient-totem",
    name: "Ancient Totem",
    description: "Grants bonuses to many stats.",
    rarity: "Legendary",
    price: 2500000,
    buffs: {
      attack: 1.0,
      defense: 1.0,
      magic: 1.0,
      magicDefense: 1.0,
      lootBoost: 1.0,
      xpBoost: 1.0,
    },
    emoji: "🗿",
  },
  {
    itemId: "cosmic-scroll",
    name: "Cosmic Scroll",
    description: "Enhances XP, Magic, and Find Rate.",
    rarity: "Legendary",
    price: 1780000,
    buffs: {
      xpBoost: 1.35,
      magic: 5.25,
      findRateBoost: 0.1,
    },
    emoji: "🌌",
  },
  {
    itemId: "lucky-rabbit-foot",
    name: "Lucky Rabbit Foot",
    description: "A small charm that boosts your loot from adventures.",
    rarity: "Uncommon",
    price: 20500,
    buffs: {
      lootBoost: 0.02,
    },
    emoji: "🐇",
  },
  {
    itemId: "golden-horseshoe",
    name: "Golden Horseshoe",
    description: "Brings incredible fortune to its owner.",
    rarity: "Rare",
    price: 78000,
    buffs: {
      lootBoost: 0.07,
    },
    emoji: "🔱",
  },
  {
    itemId: "treasure-compass",
    name: "Treasure Compass",
    description: "Points the way to the richest rewards.",
    rarity: "Epic",
    price: 100000,
    buffs: {
      lootBoost: 0.5,
    },
    emoji: "🧭",
  },
  {
    itemId: "nether-crown",
    name: "Nether Crown",
    description: "A royal artifact that magnifies all loot gains.",
    rarity: "Legendary",
    price: 1800000,
    buffs: {
      lootBoost: 2.5,
    },
    emoji: "👑",
  },
  {
    itemId: "phoenix-feather",
    name: "Phoenix Feather",
    description: "Rare feather said to boost your fortunes.",
    rarity: "Legendary",
    price: 10792301,
    buffs: {
      lootBoost: 12.4,
    },
    emoji: "🪶",
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
