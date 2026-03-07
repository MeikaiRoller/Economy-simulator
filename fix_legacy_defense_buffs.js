require('dotenv').config();
const mongoose = require('mongoose');
const Item = require('./schema/Item');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const items = await Item.find({});
  let fixed = 0;

  for (const item of items) {
    const b = item.buffs;
    if (!b || (!b.defense && !b.hp)) continue;
    const oldDef = b.defense;
    const oldHp = b.hp;
    b.defense = 0;
    b.hp = 0;
    item.markModified('buffs');
    await item.save();
    console.log(`Zeroed ${item.name} [${item.rarity}]: buffs.defense ${oldDef}→0, buffs.hp ${oldHp}→0`);
    fixed++;
  }

  console.log(`\nDone. Fixed ${fixed} legacy items.`);
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
