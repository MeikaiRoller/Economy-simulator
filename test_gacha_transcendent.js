/**
 * test_gacha_transcendent.js
 * Simulates gacha pulls until a Transcendent drops, then saves it to the DB
 * to confirm the full pipeline works end-to-end.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Item = require('./schema/Item');
const { generateItem, RARITY_COLORS } = require('./utils/generateItem');

function rollGachaRarity(pityCounter) {
  const transcendentRate = 0.05;
  const roll = Math.random() * 100;
  if (roll < transcendentRate) return 'Transcendent';
  if (roll < transcendentRate + 5.4) return 'Legendary';
  if (roll < transcendentRate + 5.4 + 12) return 'Epic';
  if (roll < transcendentRate + 5.4 + 12 + 27) return 'Rare';
  if (roll < transcendentRate + 5.4 + 12 + 27 + 30) return 'Uncommon';
  return 'Common';
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.\n');

  const slots = ['weapon', 'head', 'chest', 'hands', 'feet', 'accessory'];
  const counts = { Common: 0, Uncommon: 0, Rare: 0, Epic: 0, Legendary: 0, Transcendent: 0 };
  let pulls = 0;
  let transcendentItem = null;

  // Simulate up to 10,000 pulls to force a Transcendent
  while (pulls < 10000) {
    pulls++;
    const rarity = rollGachaRarity(pulls);
    counts[rarity]++;

    if (rarity === 'Transcendent') {
      const slot = slots[Math.floor(Math.random() * slots.length)];
      const itemData = generateItem(slot, 'Transcendent');
      console.log(`🌟 TRANSCENDENT dropped on pull #${pulls}!`);
      console.log(`   Name:     ${itemData.name}`);
      console.log(`   Slot:     ${itemData.slot}`);
      console.log(`   Main:     ${itemData.mainStat.type} = ${itemData.mainStat.value}`);
      console.log(`   Substats: ${itemData.subStats.map(s => `${s.type}:${s.value}`).join(', ')}`);
      console.log(`   Saving to DB...`);

      // Tag as test item so it can be cleaned up
      itemData.itemId = 'test_transcendent_' + itemData.itemId;
      itemData.name = '[TEST] ' + itemData.name;

      const newItem = new Item(itemData);
      await newItem.save();
      transcendentItem = newItem;

      console.log(`   ✅ Saved successfully! _id: ${newItem._id}`);
      break;
    }
  }

  if (!transcendentItem) {
    console.log(`❌ No Transcendent dropped in ${pulls} pulls. Rate may be too low to test quickly — try again.`);
  }

  // Pull distribution summary
  console.log(`\n=== Pull distribution over ${pulls} pulls ===`);
  for (const [rarity, count] of Object.entries(counts)) {
    const pct = ((count / pulls) * 100).toFixed(2);
    console.log(`  ${rarity}: ${count} (${pct}%)`);
  }

  // Clean up test item from DB
  if (transcendentItem) {
    await Item.deleteOne({ _id: transcendentItem._id });
    console.log(`\n🧹 Test item cleaned up from DB.`);
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
