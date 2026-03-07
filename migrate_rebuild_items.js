/**
 * migrate_rebuild_items.js
 * 
 * Fully rebuilds every item in the database through the new inscription system:
 *  - Main stat is preserved (already tuned, scales with level via upgrade multiplier)
 *  - Substats are stripped to the 2 best-typed ones from the original item,
 *    with values clamped to the new range ceilings for that rarity
 *  - Items at +5/+10 get a freshly rolled 3rd/4th sub (new ranges)
 *  - Items at +15 auto-inscribe the lowest substat once (interactive moment passed)
 * 
 * Run: node migrate_rebuild_items.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Item = require('./schema/Item');
const { SUB_STAT_RANGES, SUB_STAT_POOL } = require('./utils/generateItem');

const MONGO_URI = process.env.MONGO_URI;

// Preference order: crit stats are priority, then damage, then utility
// This determines which 2 substats are kept when stripping back to 2
const SUBSTAT_PRIORITY = [
  'critRate', 'critDMG', 'attack%', 'attack', 'hp%', 'defense%',
  'hp', 'defense', 'energy', 'luck'
];

function clampToRange(value, rarity, type) {
  const ranges = SUB_STAT_RANGES[type];
  if (!ranges) return value;
  const range = ranges[rarity] || ranges['Legendary'];
  return Math.min(value, range[1]);
}

function rollSubStat(rarity, excludeTypes = []) {
  const available = SUB_STAT_POOL.filter(t => !excludeTypes.includes(t));
  if (available.length === 0) return null;
  const type = available[Math.floor(Math.random() * available.length)];
  const range = (SUB_STAT_RANGES[type]?.[rarity]) || (SUB_STAT_RANGES[type]?.['Legendary']);
  let value = Math.random() * (range[1] - range[0]) + range[0];
  value = (type.includes('%') || type === 'luck')
    ? Math.round(value * 10) / 10
    : Math.floor(value);
  return { type, value };
}

async function migrate() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB\n');

  const items = await Item.find({ type: 'equippable' });
  console.log(`Found ${items.length} equippable items to rebuild.\n`);

  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    // Skip legacy-format items (no mainStat / subStats = old buff-only system)
    if (!item.mainStat?.type || !item.mainStat?.value) {
      console.log(`  [SKIP] ${item.name} — legacy format, no mainStat`);
      skipped++;
      continue;
    }

    const level = item.level || 0;
    const rarity = item.rarity;

    // ── Step 1: Select the 2 best substats from current item ──
    // Sort existing substats by our priority list, keep the top 2
    const existing = (item.subStats || []).filter(s => s.type && s.value != null);
    const sorted = [...existing].sort((a, b) => {
      const pa = SUBSTAT_PRIORITY.indexOf(a.type);
      const pb = SUBSTAT_PRIORITY.indexOf(b.type);
      const rankA = pa === -1 ? 99 : pa;
      const rankB = pb === -1 ? 99 : pb;
      return rankA - rankB;
    });

    // Keep top 2, clamp values to new range ceilings
    const baseSubs = sorted.slice(0, 2).map(sub => ({
      type: sub.type,
      value: clampToRange(sub.value, rarity, sub.type)
    }));

    // If fewer than 2 substats existed, fill up with fresh rolls
    const usedTypes = new Set([item.mainStat.type, ...baseSubs.map(s => s.type)]);
    while (baseSubs.length < 2) {
      const rolled = rollSubStat(rarity, [...usedTypes]);
      if (!rolled) break;
      baseSubs.push(rolled);
      usedTypes.add(rolled.type);
    }

    // ── Step 2: Simulate +5 unlock ──
    const newSubs = [...baseSubs];
    if (level >= 5) {
      const excludeTypes = [item.mainStat.type, ...newSubs.map(s => s.type)];
      const sub3 = rollSubStat(rarity, excludeTypes);
      if (sub3) newSubs.push(sub3);
    }

    // ── Step 3: Simulate +10 unlock ──
    if (level >= 10) {
      const excludeTypes = [item.mainStat.type, ...newSubs.map(s => s.type)];
      const sub4 = rollSubStat(rarity, excludeTypes);
      if (sub4) newSubs.push(sub4);
    }

    // ── Step 4: Auto-inscribe at +15 (re-roll lowest, keep higher) ──
    if (level >= 15 && newSubs.length > 0) {
      let lowestIdx = 0;
      // Find lowest by normalized value (compare % and flat on same scale roughly)
      newSubs.forEach((s, i) => {
        if (s.value < newSubs[lowestIdx].value) lowestIdx = i;
      });
      const chosenSub = newSubs[lowestIdx];
      const range = (SUB_STAT_RANGES[chosenSub.type]?.[rarity]) || (SUB_STAT_RANGES[chosenSub.type]?.['Legendary']);
      let newRoll = Math.random() * (range[1] - range[0]) + range[0];
      newRoll = (chosenSub.type.includes('%') || chosenSub.type === 'luck')
        ? Math.round(newRoll * 10) / 10
        : Math.floor(newRoll);
      const oldVal = chosenSub.value;
      newSubs[lowestIdx].value = Math.max(oldVal, newRoll);
      console.log(`  [+15 INSCRIBE] ${item.name} (${rarity}): ${chosenSub.type} ${oldVal} → ${newSubs[lowestIdx].value} (rolled ${newRoll})`);
    }

    // ── Step 5: Log changes and save ──
    const oldSubStr = (item.subStats || []).map(s => `${s.type}:${s.value}`).join(', ') || 'none';
    const newSubStr = newSubs.map(s => `${s.type}:${s.value}`).join(', ');

    if (oldSubStr !== newSubStr) {
      item.subStats = newSubs;
      item.markModified('subStats');
      await item.save();
      updated++;
      console.log(`  [+${level}] ${item.name} (${rarity})`);
      console.log(`    Before: ${oldSubStr}`);
      console.log(`    After:  ${newSubStr}\n`);
    } else {
      skipped++;
    }
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Done. Rebuilt ${updated} items, ${skipped} unchanged or skipped.`);
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
