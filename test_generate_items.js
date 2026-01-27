const { generateItem, rollRarity } = require('./utils/generateItem');

console.log("=".repeat(60));
console.log("PROCEDURAL ITEM GENERATION TEST");
console.log("=".repeat(60));

// Generate one of each rarity
const rarities = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
const slots = ["weapon", "head", "chest", "hands", "feet", "accessory"];

console.log("\n📦 SAMPLE ITEMS (ONE OF EACH RARITY):\n");

rarities.forEach(rarity => {
  const slot = slots[Math.floor(Math.random() * slots.length)];
  const item = generateItem(slot, rarity);
  
  console.log(`\n${"=".repeat(50)}`);
  console.log(`${item.emoji} ${item.name}`);
  console.log(`Rarity: ${item.rarity} | Slot: ${item.slot} | Set: ${item.setName}`);
  console.log(`Element: ${item.element || "None"} | Value: $${item.price.toLocaleString()}`);
  console.log(`\nMain Stat: ${item.mainStat.type} +${item.mainStat.value}`);
  console.log(`\nSub-Stats:`);
  item.subStats.forEach(sub => {
    console.log(`  • ${sub.type}: +${sub.value}${sub.type.includes('%') ? '%' : ''}`);
  });
});

console.log("\n" + "=".repeat(60));
console.log("\n🎲 BOSS DROP SIMULATION (10 DROPS):\n");

for (let i = 1; i <= 10; i++) {
  const rarity = rollRarity(true); // Boss drop
  const slot = slots[Math.floor(Math.random() * slots.length)];
  const item = generateItem(slot, rarity);
  console.log(`${i}. ${item.emoji} ${item.rarity} ${item.name} (${item.mainStat.type} +${item.mainStat.value})`);
}

console.log("\n" + "=".repeat(60));
console.log("\n📊 SET BONUS VISUALIZATION:\n");

const setNames = [
  "Ethans Prowess",
  "Olivias Fury",
  "Justins Clapping",
  "Lilahs Cold Heart",
  "Hasagi",
  "Maries Zhongli Bodypillow",
  "Andys Soraka"
];

setNames.forEach(setName => {
  const weapon = generateItem("weapon", "Epic", setName);
  const head = generateItem("head", "Epic", setName);
  const chest = generateItem("chest", "Epic", setName);
  
  console.log(`\n${weapon.emoji} ${setName} ${weapon.element ? `(${weapon.element.toUpperCase()})` : "(NO ELEMENT)"}`);
  console.log(`  • Weapon: ${weapon.mainStat.type} +${weapon.mainStat.value}`);
  console.log(`  • Head: ${head.mainStat.type} +${head.mainStat.value}`);
  console.log(`  • Chest: ${chest.mainStat.type} +${chest.mainStat.value}`);
});

console.log("\n" + "=".repeat(60));
console.log("✅ Generation test complete!");
console.log("=".repeat(60));
