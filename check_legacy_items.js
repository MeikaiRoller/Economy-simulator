require('dotenv').config();
const mongoose = require('mongoose');
const Item = require('./schema/Item');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const all = await Item.find({});
  let total = 0, withDefense = 0, withHp = 0;
  const examples = [];

  for (const item of all) {
    const b = item.buffs;
    if (!b) continue;
    const hasAny = b.attack || b.defense || b.magic || b.magicDefense ||
      b.critChance || b.xpBoost || b.healingBoost || b.luck ||
      b.lootBoost || b.findRateBoost || b.cooldownReduction;
    if (!hasAny) continue;
    total++;
    if (b.defense) { withDefense++; if (examples.length < 5) examples.push(`  ${item.name} [${item.rarity}]: buffs.defense=${b.defense}`); }
    if (b.hp) withHp++;
  }

  console.log(`Total items with non-zero legacy buffs: ${total}`);
  console.log(`  with buffs.defense (acts as defense%): ${withDefense}`);
  console.log(`  with buffs.hp (acts as hp%): ${withHp}`);
  if (examples.length) { console.log('\nExamples:'); examples.forEach(e => console.log(e)); }
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
