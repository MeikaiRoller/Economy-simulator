require("dotenv").config();
const mongoose = require("mongoose");
const UserProfile = require("./schema/UserProfile");
const Item = require("./schema/Item");
const calculateActiveBuffs = require("./utils/calculateBuffs");

async function testCombatBalance() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to Database\n");

    // Find two players with equipment
    const players = await UserProfile.find()
      .where('equipped.weapon').exists(true)
      .limit(2);

    if (players.length < 2) {
      console.log("❌ Need at least 2 players with equipped items!");
      process.exit(1);
    }

    const player1 = players[0];
    const player2 = players[1];

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("⚔️ COMBAT BALANCE TEST");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Get buffs
    const buffs1 = await calculateActiveBuffs(player1);
    const buffs2 = await calculateActiveBuffs(player2);

    // Calculate stats
    const stats1 = calculatePlayerStats(player1, buffs1);
    const stats2 = calculatePlayerStats(player2, buffs2);

    console.log(`🎮 PLAYER 1 (Level ${player1.level}):`);
    console.log(`   Attack: ${stats1.attack}`);
    console.log(`   Defense: ${stats1.defense}`);
    console.log(`   HP: ${stats1.maxHp}`);
    console.log(`   Crit: ${stats1.critRate}% (${stats1.critDMG}%)`);
    console.log(`   Dodge: ${stats1.dodge}%`);
    console.log(`\n`);

    console.log(`🎮 PLAYER 2 (Level ${player2.level}):`);
    console.log(`   Attack: ${stats2.attack}`);
    console.log(`   Defense: ${stats2.defense}`);
    console.log(`   HP: ${stats2.maxHp}`);
    console.log(`   Crit: ${stats2.critRate}% (${stats2.critDMG}%)`);
    console.log(`   Dodge: ${stats2.dodge}%`);
    console.log(`\n`);

    // Calculate damage scenarios
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("💥 DAMAGE SCENARIOS (LoL Armor Formula):");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const reduction1 = stats2.defense / (stats2.defense + 100);
    const minDamage1 = Math.max(1, Math.floor(stats1.attack * (1 - reduction1) * 0.8));
    const maxDamage1 = Math.max(1, Math.floor(stats1.attack * (1 - reduction1) * 1.2));
    const avgDamage1 = Math.max(1, Math.floor(stats1.attack * (1 - reduction1) * 1.0));
    const critDamage1 = Math.max(1, Math.floor(stats1.attack * (1 - reduction1) * 1.2 * (1 + stats1.critDMG / 100)));

    console.log(`Player 1 → Player 2:`);
    console.log(`   Defense: ${stats2.defense} (${(reduction1 * 100).toFixed(1)}% reduction)`);
    console.log(`   Min Damage: ${minDamage1}`);
    console.log(`   Avg Damage: ${avgDamage1}`);
    console.log(`   Max Damage: ${maxDamage1}`);
    console.log(`   Crit Damage (${stats1.critRate}%): ${critDamage1}`);
    console.log(`   Turns to Kill: ${Math.ceil(stats2.maxHp / avgDamage1)}`);
    console.log(`   One-Shot Possible: ${minDamage1 >= stats2.maxHp ? "YES ⚠️" : "No"}`);
    console.log(`\n`);

    const reduction2 = stats1.defense / (stats1.defense + 100);
    const minDamage2 = Math.max(1, Math.floor(stats2.attack * (1 - reduction2) * 0.8));
    const maxDamage2 = Math.max(1, Math.floor(stats2.attack * (1 - reduction2) * 1.2));
    const avgDamage2 = Math.max(1, Math.floor(stats2.attack * (1 - reduction2) * 1.0));
    const critDamage2 = Math.max(1, Math.floor(stats2.attack * (1 - reduction2) * 1.2 * (1 + stats2.critDMG / 100)));

    console.log(`Player 2 → Player 1:`);
    console.log(`   Defense: ${stats1.defense} (${(reduction2 * 100).toFixed(1)}% reduction)`);
    console.log(`   Min Damage: ${minDamage2}`);
    console.log(`   Avg Damage: ${avgDamage2}`);
    console.log(`   Max Damage: ${maxDamage2}`);
    console.log(`   Crit Damage (${stats2.critRate}%): ${critDamage2}`);
    console.log(`   Turns to Kill: ${Math.ceil(stats1.maxHp / avgDamage2)}`);
    console.log(`   One-Shot Possible: ${minDamage2 >= stats1.maxHp ? "YES ⚠️" : "No"}`);
    console.log(`\n`);

    // Equipment breakdown
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎖️ EQUIPMENT BREAKDOWN:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    console.log(`Player 1 Equipment:`);
    for (const [slot, itemId] of Object.entries(player1.equipped)) {
      if (itemId) {
        const item = await Item.findOne({ itemId });
        if (item) {
          console.log(`   ${slot}: ${item.name} [${item.rarity}]`);
          if (item.mainStat) console.log(`      Main: ${item.mainStat.type} +${item.mainStat.value}`);
          if (item.subStats?.length) {
            console.log(`      Subs: ${item.subStats.map(s => `${s.type} +${s.value}`).join(", ")}`);
          }
        }
      }
    }
    console.log(`\n`);

    console.log(`Player 2 Equipment:`);
    for (const [slot, itemId] of Object.entries(player2.equipped)) {
      if (itemId) {
        const item = await Item.findOne({ itemId });
        if (item) {
          console.log(`   ${slot}: ${item.name} [${item.rarity}]`);
          if (item.mainStat) console.log(`      Main: ${item.mainStat.type} +${item.mainStat.value}`);
          if (item.subStats?.length) {
            console.log(`      Subs: ${item.subStats.map(s => `${s.type} +${s.value}`).join(", ")}`);
          }
        }
      }
    }

    console.log(`\n`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    if (minDamage1 >= stats2.maxHp || minDamage2 >= stats1.maxHp) {
      console.log("⚠️ ONE-SHOT PROBLEM DETECTED!");
      console.log("   Recommendation: Increase defense scaling or reduce attack bonuses");
    } else {
      console.log("✅ Combat appears balanced");
    }
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

function calculatePlayerStats(profile, buffs) {
  const level = profile.level || 1;
  const attack = Math.floor((25 + level * 2 + (buffs.attackFlat || 0)) * (1 + buffs.attack));
  const defense = Math.floor((12 + level + (buffs.defenseFlat || 0)) * (1 + buffs.defense));
  const maxHp = Math.floor((250 + level * 15 + (buffs.hpFlat || 0)) * (1 + (buffs.hpPercent || 0)));
  const critRate = Math.min(5 + buffs.critChance, 80);
  const critDMG = 100 + (buffs.critDMG || 0);
  const dodge = Math.min(5 + ((buffs.luck || 0) * 2), 35);

  return { attack, defense, maxHp, critRate, critDMG, dodge };
}

testCombatBalance();
