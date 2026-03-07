/**
 * migrate_inscription_system.js
 * 
 * Backfills substats for existing items that are already at +5, +10, or +15
 * but were created under the old system (which gave substats at generation time).
 * 
 * Rules:
 *   - Items at +5 to +9:  should have ≥ 3 substats -> add 1 if under
 *   - Items at +10 to +15: should have ≥ 4 substats -> add up to 2 if under
 *   - Items already at or above threshold are left untouched (they got lucky old rolls)
 *   - Substat type is rolled at the item's own rarity tier
 * 
 * Run: node migrate_inscription_system.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Item = require('./schema/Item');
const { SUB_STAT_RANGES, SUB_STAT_POOL } = require('./utils/generateItem');

const MONGO_URI = process.env.MONGO_URI;

function rollSubStat(rarity, excludeTypes = []) {
  const available = SUB_STAT_POOL.filter(t => !excludeTypes.includes(t));
  if (available.length === 0) return null;
  const type = available[Math.floor(Math.random() * available.length)];
  const tierRanges = SUB_STAT_RANGES[type];
  const range = tierRanges[rarity] || tierRanges['Legendary'];
  let value = Math.random() * (range[1] - range[0]) + range[0];
  value = (type.includes('%') || type === 'luck')
    ? Math.round(value * 10) / 10
    : Math.floor(value);
  return { type, value };
}

async function migrate() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB\n');

  const items = await Item.find({ level: { $gte: 5 } });
  console.log(`Found ${items.length} items at +5 or higher.\n`);

  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const level = item.level || 0;
    const currentSubCount = item.subStats?.length || 0;

    // Target sub count based on current level
    const targetSubCount = level >= 10 ? 4 : 3;

    if (currentSubCount >= targetSubCount) {
      skipped++;
      continue;
    }

    const needed = targetSubCount - currentSubCount;
    const addedSubs = [];

    for (let i = 0; i < needed; i++) {
      const existingTypes = [item.mainStat?.type, ...item.subStats.map(s => s.type)].filter(Boolean);
      const newSub = rollSubStat(item.rarity, existingTypes);
      if (newSub) {
        item.subStats.push(newSub);
        addedSubs.push(newSub);
      }
    }

    if (addedSubs.length > 0) {
      item.markModified('subStats');
      await item.save();
      updated++;
      const addedStr = addedSubs.map(s => `${s.type}:${s.value}`).join(', ');
      console.log(`  [+${level}] ${item.name} (${item.rarity}) — added: ${addedStr}`);
    }
  }

  console.log(`\nDone. Updated ${updated} items, skipped ${skipped} (already had enough substats).`);
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
