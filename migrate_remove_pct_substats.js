/**
 * migrate_remove_pct_substats.js
 *
 * Finds all items with defense% or hp% sub-stats and rerolls them to a
 * different stat from the new restricted pool (no defense%, no hp%).
 * Rolls a fresh value using SUB_STAT_RANGES for the item's rarity.
 *
 * Safe to re-run — items with no removed stats are untouched.
 *
 * Usage: node migrate_remove_pct_substats.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Item = require('./schema/Item');

// New restricted pool (matches updated SUB_STAT_POOL in generateItem.js)
const NEW_POOL = ['attack', 'attack%', 'defense', 'hp', 'critRate', 'critDMG', 'energy', 'luck'];

const SUB_STAT_RANGES = {
  'attack':   { Common:[3,8],   Uncommon:[8,15],   Rare:[15,25],  Epic:[25,40],  Legendary:[40,60],  Transcendent:[60,85]  },
  'attack%':  { Common:[2,5],   Uncommon:[5,9],    Rare:[9,14],   Epic:[14,20],  Legendary:[20,30],  Transcendent:[30,42]  },
  'defense':  { Common:[2,6],   Uncommon:[6,12],   Rare:[12,20],  Epic:[20,32],  Legendary:[32,50],  Transcendent:[50,70]  },
  'hp':       { Common:[20,40], Uncommon:[40,70],  Rare:[70,110], Epic:[110,160],Legendary:[160,240],Transcendent:[240,330]},
  'critRate': { Common:[1,2],   Uncommon:[2,4],    Rare:[4,6],    Epic:[6,9],    Legendary:[9,13],   Transcendent:[13,18]  },
  'critDMG':  { Common:[3,7],   Uncommon:[7,12],   Rare:[12,18],  Epic:[18,26],  Legendary:[26,38],  Transcendent:[38,52]  },
  'energy':   { Common:[2,5],   Uncommon:[5,9],    Rare:[9,15],   Epic:[15,23],  Legendary:[23,35],  Transcendent:[35,50]  },
  'luck':     { Common:[0.02,0.05],Uncommon:[0.05,0.08],Rare:[0.08,0.12],Epic:[0.12,0.18],Legendary:[0.18,0.27],Transcendent:[0.27,0.38]},
};

function rollValue(type, rarity) {
  const range = SUB_STAT_RANGES[type]?.[rarity] || SUB_STAT_RANGES[type]?.['Legendary'];
  if (!range) return 0;
  const [min, max] = range;
  const value = min + Math.random() * (max - min);
  return type === 'luck' ? Math.round(value * 1000) / 1000 : Math.round(value);
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  const REMOVED = new Set(['defense%', 'hp%']);
  const items = await Item.find({ 'subStats.type': { $in: ['defense%', 'hp%'] } });

  console.log(`🔍 Found ${items.length} items with defense% or hp% sub-stats\n`);

  let totalRerolled = 0;
  let totalItems = 0;

  for (const item of items) {
    let changed = false;

    // Build set of current types on this item (excluding the ones we're replacing)
    const currentTypes = new Set(
      item.subStats.filter(s => !REMOVED.has(s.type)).map(s => s.type)
    );

    for (const sub of item.subStats) {
      if (!REMOVED.has(sub.type)) continue;

      const oldType = sub.type;
      const oldValue = sub.value;

      // Pick a new type not already used in this item
      const available = NEW_POOL.filter(t => !currentTypes.has(t));
      if (available.length === 0) {
        console.log(`  ⚠️  ${item.name} (${item.itemId}): no available slots to reroll ${oldType}, skipping`);
        continue;
      }

      const newType = available[Math.floor(Math.random() * available.length)];
      const newValue = rollValue(newType, item.rarity);

      sub.type = newType;
      sub.value = newValue;
      currentTypes.add(newType);

      console.log(`  🔁 ${item.name} [${item.rarity}] ${item.slot}: ${oldType}(${oldValue}) → ${newType}(${newValue})`);
      totalRerolled++;
      changed = true;
    }

    if (changed) {
      item.markModified('subStats');
      await item.save();
      totalItems++;
    }
  }

  console.log(`\n✅ Done!`);
  console.log(`   Items updated: ${totalItems}`);
  console.log(`   Sub-stats rerolled: ${totalRerolled}`);
  await mongoose.connection.close();
  process.exit(0);
}

run().catch(e => { console.error('❌', e); process.exit(1); });
