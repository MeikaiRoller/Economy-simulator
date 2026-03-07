require('dotenv').config();
const mongoose = require('mongoose');
const Item = require('./schema/Item');
const UserProfile = require('./schema/UserProfile');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const all = await Item.find({});
  const legacyDefenseIds = new Set();

  for (const item of all) {
    const b = item.buffs;
    if (b && b.defense) legacyDefenseIds.add(item.itemId);
  }

  console.log(`Legacy defense items: ${[...legacyDefenseIds].join(', ')}\n`);

  const players = await UserProfile.find({});
  let equippedCount = 0;

  for (const p of players) {
    if (!p.equipped) continue;
    for (const [slot, itemId] of Object.entries(p.equipped)) {
      if (legacyDefenseIds.has(itemId)) {
        const item = await Item.findOne({ itemId });
        console.log(`Player ${p.userId} has ${item?.name} (buffs.defense=${item?.buffs?.defense}) equipped in ${slot}`);
        equippedCount++;
      }
    }
  }

  if (equippedCount === 0) console.log('No players have legacy defense items equipped.');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
