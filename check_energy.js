require('dotenv').config();
const mongoose = require('mongoose');
const Item = require('./schema/Item');
const UserProfile = require('./schema/UserProfile');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const profiles = await UserProfile.find({});
  const energyTotals = [];

  for (const p of profiles) {
    if (!p.equipped) continue;
    const ids = Object.values(p.equipped).filter(Boolean);
    if (!ids.length) continue;
    const items = await Item.find({ itemId: { $in: ids } });

    let totalEnergy = 0;
    const sources = [];
    for (const item of items) {
      if (item.mainStat?.type === 'energy') {
        const lvl = item.level || 0;
        let bonus = 0;
        for (let i = 1; i <= lvl; i++) bonus += i <= 5 ? 2 : i <= 10 ? 3 : 4;
        const val = item.mainStat.value * (1 + bonus / 100);
        totalEnergy += val;
        sources.push(`  [main] ${item.slot} +${lvl} (${item.rarity}): ${val.toFixed(1)}`);
      }
      for (const sub of (item.subStats || [])) {
        if (sub.type === 'energy') {
          totalEnergy += sub.value;
          sources.push(`  [sub]  ${item.slot} +${item.level || 0} (${item.rarity}): ${sub.value}`);
        }
      }
    }
    if (totalEnergy > 0) energyTotals.push({ user: p.userId, energy: totalEnergy, sources });
  }

  energyTotals.sort((a, b) => b.energy - a.energy);
  console.log('=== Energy per equipped player ===\n');
  for (const e of energyTotals) {
    console.log(`User ${e.user}: total energy = ${e.energy.toFixed(1)}`);
    e.sources.forEach(s => console.log(s));
    console.log('');
  }

  // Global ceilings
  const allItems = await Item.find({ type: 'equippable' });
  let maxMain = 0, maxSub = 0, maxSubRarity = '';
  for (const item of allItems) {
    if (item.mainStat?.type === 'energy') {
      const lvl = item.level || 0;
      let bonus = 0;
      for (let i = 1; i <= lvl; i++) bonus += i <= 5 ? 2 : i <= 10 ? 3 : 4;
      const val = item.mainStat.value * (1 + bonus / 100);
      if (val > maxMain) maxMain = val;
    }
    for (const sub of (item.subStats || [])) {
      if (sub.type === 'energy' && sub.value > maxSub) {
        maxSub = sub.value;
        maxSubRarity = item.rarity;
      }
    }
  }

  // Theoretical max build: 1 accessory main + 5 energy subs
  const { SUB_STAT_RANGES } = require('./utils/generateItem');
  const legMainMax = 65;   // Legendary accessory main stat ceiling
  const legMainAt15 = legMainMax * 1.45;
  const legSubMax = SUB_STAT_RANGES.energy.Legendary[1]; // 35
  const transcSubMax = SUB_STAT_RANGES.energy.Transcendent[1]; // 50
  const theoreticalMax = legMainAt15 + (5 * legSubMax);
  const transcMax = legMainAt15 + (5 * transcSubMax);

  console.log('=== Global energy ceilings ===');
  console.log(`Max single main-stat energy in DB (boosted): ${maxMain.toFixed(1)}`);
  console.log(`Max single sub-stat energy in DB: ${maxSub} (${maxSubRarity})`);
  console.log('');
  console.log('=== Theoretical max builds ===');
  console.log(`Legendary  accessory main @+15 (${legMainMax} × 1.45): ${legMainAt15.toFixed(1)}`);
  console.log(`  + 5x Legendary  energy subs (max ${legSubMax} each):  ${(5 * legSubMax)}`);
  console.log(`  = Legendary  build max energy: ${theoreticalMax.toFixed(1)}`);
  console.log('');
  console.log(`  + 5x Transcendent energy subs (max ${transcSubMax} each): ${(5 * transcSubMax)}`);
  console.log(`  = Transcendent build max energy: ${transcMax.toFixed(1)}`);
  console.log('');
  // Set bonuses: Justins Clapping 6pc = +50 energy
  console.log('Justins Clapping 6pc set bonus: +50 energy');
  console.log(`Legendary build + 6pc Justins: ${(theoreticalMax + 50).toFixed(1)}`);

  await mongoose.disconnect();
});
