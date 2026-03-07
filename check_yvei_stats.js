require('dotenv').config();
const mongoose = require('mongoose');
const UserProfile = require('./schema/UserProfile');
const calculateActiveBuffs = require('./utils/calculateBuffs');
const { getDamageReduction, getOffenseMultiplierFromDefense } = (() => {
  const ARMOR_CONSTANT = 200;
  return {
    getDamageReduction: (def) => def / (def + ARMOR_CONSTANT),
    getOffenseMultiplierFromDefense: (def) => {
      if (def < 450) return 1;
      const reduction = def / (def + ARMOR_CONSTANT);
      return 1 - Math.min(0.45, reduction * 0.85);
    }
  };
})();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const yvei = await UserProfile.findOne({ userId: '302496685873954817' });
  const buffs = await calculateActiveBuffs(yvei);
  const lv = yvei.level;
  const baseDefense = 12 + lv;
  const baseAttack = 25 + lv * 2;
  const baseHP = 250 + lv * 15;

  const playerDefense = Math.floor((baseDefense + (buffs.defenseFlat || 0)) * (1 + buffs.defense));
  const rawAttack = (baseAttack + (buffs.attackFlat || 0)) * (1 + buffs.attack);
  const playerAttack = Math.floor(rawAttack * getOffenseMultiplierFromDefense(playerDefense));
  const playerHP = Math.floor((baseHP + (buffs.hpFlat || 0)) * (1 + (buffs.hpPercent || 0)));
  const DR = getDamageReduction(playerDefense);

  console.log('=== YVEI COMBAT STATS (what rpg.js actually uses) ===');
  console.log(`Level: ${lv}`);
  console.log(`\n--- Defense breakdown ---`);
  console.log(`  Base: ${baseDefense}`);
  console.log(`  defenseFlat from gear: ${buffs.defenseFlat.toFixed(2)}`);
  console.log(`  defense% multiplier: ${(buffs.defense * 100).toFixed(1)}%`);
  console.log(`  => FINAL Defense: ${playerDefense}  (DR: ${(DR * 100).toFixed(1)}%)`);
  console.log(`\n--- Attack breakdown ---`);
  console.log(`  rawAttack (before offensePenalty): ${rawAttack.toFixed(0)}`);
  console.log(`  offenseMult: ${getOffenseMultiplierFromDefense(playerDefense).toFixed(3)}`);
  console.log(`  => FINAL Attack: ${playerAttack}`);
  console.log(`\n--- Other stats ---`);
  console.log(`  HP: ${playerHP}  (base ${baseHP} + flat ${(buffs.hpFlat||0).toFixed(0)} * ${(1+(buffs.hpPercent||0)).toFixed(3)})`);
  console.log(`  CritRate: ${buffs.critChance.toFixed(1)}`);
  console.log(`  CritDMG: ${(100 + buffs.critDMG).toFixed(1)}`);
  console.log(`  Energy: ${buffs.energy.toFixed(1)}`);
  console.log(`  procRate: ${(buffs.procRate * 100).toFixed(1)}%`);
  console.log(`\n--- Boss hit simulation (1080 ATK boss) ---`);
  const bossDmg = 1080 * (1 - DR);
  console.log(`  Avg boss hit: ${bossDmg.toFixed(0)}`);
  console.log(`  Hits to die: ${(playerHP / bossDmg).toFixed(1)} (10 turns max)`);
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
