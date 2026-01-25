const mongoose = require("mongoose");
const Item = require("./schema/Item"); // adjust if needed
require("dotenv").config();

const items = [
  // ⚔️ WEAPONS
  {
    itemId: "iron-dagger",
    name: "Iron Dagger",
    description: "A quick blade that slightly boosts attack power.",
    rarity: "Common",
    type: "equippable",
    slot: "weapon",
    price: 15000,
    buffs: { attack: 0.10 }, // 10% attack
    emoji: "🗡️",
  },
  {
    itemId: "wooden-wand",
    name: "Wooden Wand",
    description: "A basic wand that boosts magic slightly.",
    rarity: "Common",
    type: "equippable",
    slot: "weapon",
    price: 18000,
    buffs: { magic: 0.12 }, // 12% magic
    emoji: "🪄",
  },
  {
    itemId: "berserker-blade",
    name: "Berserker Blade",
    description: "Huge Attack bonus but no defense!",
    rarity: "Epic",
    type: "equippable",
    slot: "weapon",
    price: 350000,
    buffs: { attack: 0.90 }, // 90% attack
    emoji: "🗡️",
  },
  {
    itemId: "nightblade",
    name: "Nightblade",
    description: "Boosts Attack and Crit Chance — strike swiftly and fatally.",
    rarity: "Epic",
    type: "equippable",
    slot: "weapon",
    price: 450000,
    buffs: { attack: 0.80, critChance: 15 }, // 80% attack, 15% crit
    emoji: "🗡️",
  },

  // 🛡️ ARMOR (Head/Chest/Hands/Feet)
  {
    itemId: "leather-armor",
    name: "Leather Armor",
    description: "Simple armor offering minor defense.",
    rarity: "Common",
    type: "equippable",
    slot: "chest",
    price: 12000,
    buffs: { defense: 0.08 }, // 8% defense
    emoji: "🥋",
  },
  {
    itemId: "apprentice-robe",
    name: "Apprentice's Robe",
    description: "An early robe that boosts magic and XP a little.",
    rarity: "Uncommon",
    type: "equippable",
    slot: "chest",
    price: 45000,
    buffs: { magic: 0.15, xpBoost: 0.10 }, // 15% magic, 10% xp
    emoji: "🧥",
  },
  {
    itemId: "nether-armor",
    name: "Nether Armor",
    description: "Grants solid Defense and Magic Defense.",
    rarity: "Epic",
    type: "equippable",
    slot: "chest",
    price: 400000,
    buffs: { defense: 0.60, magicDefense: 0.50 }, // 60% def, 50% mdef
    emoji: "🥋",
  },
  {
    itemId: "ethereal-mantle",
    name: "Ethereal Mantle",
    description: "Increases Magic and reduces cooldowns slightly.",
    rarity: "Epic",
    type: "equippable",
    slot: "chest",
    price: 425000,
    buffs: { magic: 0.70, cooldownReduction: 10 }, // 70% magic, 10% CDR
    emoji: "🧥",
  },
  {
    itemId: "sorcerer-robe",
    name: "Sorcerer's Robe",
    description: "Massive Magic bonus, fragile armor!",
    rarity: "Epic",
    type: "equippable",
    slot: "chest",
    price: 500000,
    buffs: { magic: 1.00 }, // 100% magic
    emoji: "🎭",
  },
  {
    itemId: "adventurer-boots",
    name: "Adventurer's Boots",
    description: "Light boots that make traveling quicker (cooldown reduction).",
    rarity: "Common",
    type: "equippable",
    slot: "feet",
    price: 10000,
    buffs: { cooldownReduction: 5 }, // 5% CDR
    emoji: "🥾",
  },
  {
    itemId: "sprint-boots",
    name: "Sprint Boots",
    description: "Slightly reduces cooldowns for faster actions.",
    rarity: "Uncommon",
    type: "equippable",
    slot: "feet",
    price: 40000,
    buffs: { cooldownReduction: 12 }, // 12% CDR
    emoji: "👟",
  },
  {
    itemId: "swift-gloves",
    name: "Swift Gloves",
    description: "Gloves that slightly improve action speed (cooldown reduction).",
    rarity: "Uncommon",
    type: "equippable",
    slot: "hands",
    price: 35000,
    buffs: { cooldownReduction: 10 }, // 10% CDR
    emoji: "🧤",
  },
  {
    itemId: "hunter-hood",
    name: "Hunter's Hood",
    description: "Boosts Luck and Find Rate — perfect for rare loot hunters.",
    rarity: "Uncommon",
    type: "equippable",
    slot: "head",
    price: 50000,
    buffs: { luck: 0.20, findRateBoost: 0.10 }, // 20% luck, 10% find
    emoji: "🏹",
  },
  {
    itemId: "nether-crown",
    name: "Nether Crown",
    description: "A royal artifact that magnifies all loot gains.",
    rarity: "Legendary",
    type: "equippable",
    slot: "head",
    price: 2000000,
    buffs: { lootBoost: 1.50 }, // 150% loot
    emoji: "👑",
  },

  // 💍 ACCESSORIES (Only 1 can be equipped)
  {
    itemId: "small-charm",
    name: "Small Charm",
    description: "A tiny lucky charm to slightly boost Luck.",
    rarity: "Common",
    type: "equippable",
    slot: "accessory",
    price: 20000,
    buffs: { luck: 0.08 }, // 8% luck
    emoji: "🧿",
  },
  {
    itemId: "steel-buckler",
    name: "Steel Buckler",
    description: "A sturdy buckler providing a small defense boost.",
    rarity: "Uncommon",
    type: "equippable",
    slot: "accessory",
    price: 35000,
    buffs: { defense: 0.20 }, // 20% defense
    emoji: "🛡️",
  },
  {
    itemId: "warrior-charm",
    name: "Warrior's Charm",
    description: "Boosts your Attack and Defense slightly.",
    rarity: "Uncommon",
    type: "equippable",
    slot: "accessory",
    price: 45000,
    buffs: { attack: 0.15, defense: 0.15 }, // 15% attack & def
    emoji: "🛡️",
  },
  {
    itemId: "mage-talisman",
    name: "Mage's Talisman",
    description: "Increases your Magic and Magic Defense.",
    rarity: "Uncommon",
    type: "equippable",
    slot: "accessory",
    price: 40000,
    buffs: { magic: 0.18, magicDefense: 0.18 }, // 18% magic & mdef
    emoji: "🔮",
  },
  {
    itemId: "lucky-pendant",
    name: "Lucky Pendant",
    description: "Boosts luck and finding rare items modestly.",
    rarity: "Uncommon",
    type: "equippable",
    slot: "accessory",
    price: 50000,
    buffs: { luck: 0.25, findRateBoost: 0.12 }, // 25% luck, 12% find
    emoji: "📿",
  },
  {
    itemId: "novice-scroll",
    name: "Novice's Scroll",
    description: "Improves XP gain slightly for newer adventurers.",
    rarity: "Uncommon",
    type: "equippable",
    slot: "accessory",
    price: 38000,
    buffs: { xpBoost: 0.25 }, // 25% xp
    emoji: "📜",
  },
  {
    itemId: "scholar-scroll",
    name: "Scholar's Scroll",
    description: "Enhances XP gains slightly over time.",
    rarity: "Uncommon",
    type: "equippable",
    slot: "accessory",
    price: 36000,
    buffs: { xpBoost: 0.22 }, // 22% xp
    emoji: "📖",
  },
  {
    itemId: "lucky-rabbit-foot",
    name: "Lucky Rabbit Foot",
    description: "A small charm that boosts your loot from adventures.",
    rarity: "Uncommon",
    type: "equippable",
    slot: "accessory",
    price: 32000,
    buffs: { lootBoost: 0.18 }, // 18% loot
    emoji: "🐇",
  },
  {
    itemId: "guardian-shield",
    name: "Guardian's Shield",
    description: "Heavy shield that greatly boosts Defense.",
    rarity: "Rare",
    type: "equippable",
    slot: "accessory",
    price: 120000,
    buffs: { defense: 0.50 }, // 50% defense
    emoji: "🛡️",
  },
  {
    itemId: "lucky-coin",
    name: "Lucky Coin",
    description: "Boosts your Luck and Find Rate.",
    rarity: "Rare",
    type: "equippable",
    slot: "accessory",
    price: 90000,
    buffs: { luck: 0.35, findRateBoost: 0.18 }, // 35% luck, 18% find
    emoji: "🍀",
  },
  {
    itemId: "blessed-scroll",
    name: "Blessed Scroll",
    description: "Improves XP gain and Healing received.",
    rarity: "Rare",
    type: "equippable",
    slot: "accessory",
    price: 110000,
    buffs: { xpBoost: 0.40, healingBoost: 0.35 }, // 40% xp, 35% heal
    emoji: "📜",
  },
  {
    itemId: "vitality-pendant",
    name: "Vitality Pendant",
    description: "Improves healing received during adventures.",
    rarity: "Rare",
    type: "equippable",
    slot: "accessory",
    price: 100000,
    buffs: { healingBoost: 0.55 }, // 55% healing
    emoji: "💠",
  },
  {
    itemId: "golden-horseshoe",
    name: "Golden Horseshoe",
    description: "Brings incredible fortune to its owner.",
    rarity: "Rare",
    type: "equippable",
    slot: "accessory",
    price: 105000,
    buffs: { lootBoost: 0.50 }, // 50% loot
    emoji: "🔱",
  },
  {
    itemId: "bloodthirst-amulet",
    name: "Bloodthirst Amulet",
    description: "Massive Attack bonus, but no defensive stats!",
    rarity: "Epic",
    type: "equippable",
    slot: "accessory",
    price: 480000,
    buffs: { attack: 1.10 }, // 110% attack
    emoji: "🩸",
  },
  {
    itemId: "treasure-compass",
    name: "Treasure Compass",
    description: "Points the way to the richest rewards.",
    rarity: "Epic",
    type: "equippable",
    slot: "accessory",
    price: 380000,
    buffs: { lootBoost: 0.80 }, // 80% loot
    emoji: "🧭",
  },
  {
    itemId: "phoenix-ring",
    name: "Phoenix Ring",
    description: "Boosts Healing and Luck dramatically.",
    rarity: "Legendary",
    type: "equippable",
    slot: "accessory",
    price: 1500000,
    buffs: { healingBoost: 0.90, luck: 0.90 }, // 90% heal & luck
    emoji: "💍",
  },
  {
    itemId: "prism-ring",
    name: "Prism Ring",
    description: "Balanced boost across Attack, Magic, and XP.",
    rarity: "Legendary",
    type: "equippable",
    slot: "accessory",
    price: 1800000,
    buffs: { attack: 0.80, magic: 0.80, xpBoost: 0.80 }, // 80% each
    emoji: "💍",
  },
  {
    itemId: "treasure-map",
    name: "Treasure Map",
    description: "Major boost to Loot Boost and Find Rate.",
    rarity: "Legendary",
    type: "equippable",
    slot: "accessory",
    price: 3500000,
    buffs: { lootBoost: 1.80, findRateBoost: 0.40 }, // 180% loot, 40% find
    emoji: "🗺️",
  },
  {
    itemId: "cosmic-scroll",
    name: "Cosmic Scroll",
    description: "Enhances XP, Magic, and Find Rate.",
    rarity: "Legendary",
    type: "equippable",
    slot: "accessory",
    price: 2200000,
    buffs: { xpBoost: 1.20, magic: 1.00, findRateBoost: 0.30 }, // 120% xp, 100% magic, 30% find
    emoji: "🌌",
  },
  {
    itemId: "ancient-totem",
    name: "Ancient Totem",
    description: "Grants bonuses to many stats.",
    rarity: "Legendary",
    type: "equippable",
    slot: "accessory",
    price: 2800000,
    buffs: {
      attack: 0.60,
      defense: 0.60,
      magic: 0.60,
      magicDefense: 0.60,
      lootBoost: 0.60,
      xpBoost: 0.60,
      luck: 0.60,
    }, // 60% across 7 stats (balanced legendary)
    emoji: "🗿",
  },
  {
    itemId: "phoenix-feather",
    name: "Phoenix Feather",
    description: "Rare feather said to boost your fortunes.",
    rarity: "Legendary",
    type: "equippable",
    slot: "accessory",
    price: 5000000,
    buffs: { lootBoost: 2.50 }, // 250% loot (best-in-slot for farming)
    emoji: "🪶",
  },
];

async function seedItems() {
  await mongoose.connect(process.env.MONGO_URI);

  await Item.deleteMany({}); // optional: clear old items first
  await Item.insertMany(items);
  console.log("✅ Items seeded successfully!");

  await mongoose.disconnect();
}

seedItems().catch(console.error);
