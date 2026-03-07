/**
 * test_raid_builds.js
 *
 * Fetches all player profiles from MongoDB, calculates their live stats
 * using the real calculateActiveBuffs utility, and simulates a 10-turn
 * raid battle for each player against a dynamically generated boss.
 *
 * Run with: node test_raid_builds.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const UserProfile = require("./schema/UserProfile");
const Item = require("./schema/Item");
const RaidBoss = require("./schema/RaidBoss");
const calculateActiveBuffs = require("./utils/calculateBuffs");
const { applyElementalReaction } = require("./utils/elementalReactions");

// ── Mirror combat constants from rpg.js ──────────────────────────────────────
const ARMOR_CONSTANT = 200;
const getDamageReduction = (def) => def / (def + ARMOR_CONSTANT);
const getOffenseMultiplierFromDefense = (def) => {
  if (def < 450) return 1;
  const reduction = getDamageReduction(def);
  const penalty = Math.min(0.45, reduction * 0.85);
  return 1 - penalty;
};

// ── Simulate boss stats (mirrors calculateBossStats in rpg.js) ───────────────
async function getBossStats(allPlayers) {
  if (allPlayers.length === 0) return { level: 1, attack: 50, defense: 30, maxHp: 5000 };

  let totalAvgDamage = 0, totalAvgHp = 0, totalAvgDefense = 0;

  for (const player of allPlayers) {
    const buffs = await calculateActiveBuffs(player);
    const atk = Math.floor((25 + player.level * 2 + (buffs.attackFlat || 0)) * (1 + buffs.attack));
    const def = Math.floor((12 + player.level + (buffs.defenseFlat || 0)) * (1 + buffs.defense));
    const hp  = Math.floor((250 + player.level * 15 + (buffs.hpFlat || 0)) * (1 + (buffs.hpPercent || 0)));
    totalAvgHp      += hp;
    totalAvgDefense += def;

    let totalDmg = 0;
    for (let i = 0; i < 10; i++) {
      const dr = getDamageReduction(50);
      let dmg = atk * (1 - dr) * (0.8 + Math.random() * 0.4);
      const critChance = 5 + (buffs.critChance || 0);
      if (Math.random() * 100 < critChance) {
        dmg *= (1 + (100 + (buffs.critDMG || 0)) / 100);
      }
      totalDmg += dmg;
    }
    totalAvgDamage += totalDmg / 10;
  }

  const avgDmg    = totalAvgDamage / allPlayers.length;
  const avgHp     = totalAvgHp     / allPlayers.length;
  const avgDef    = totalAvgDefense / allPlayers.length;
  const avgLevel  = allPlayers.reduce((s, p) => s + p.level, 0) / allPlayers.length || 1;
  const bossLevel = Math.ceil(avgLevel * 1.5);
  const maxHp     = Math.ceil(10000 + allPlayers.length * (avgDmg * 15));
  const dr        = getDamageReduction(avgDef);
  let bossAtk     = Math.ceil((avgHp / 8) / (1 - 0.05)); // 8 turns to kill, 5% avg dodge
  bossAtk         = Math.max(bossAtk, Math.ceil(avgDmg * 1.2)); // floor: 1.2x avg damage
  const bossDef   = Math.ceil((avgLevel + 12) * 1.5);

  return { level: bossLevel, attack: bossAtk, defense: bossDef, maxHp };
}

// ── Simulate a single player's 10-turn raid (deterministic avg over N runs) ──
async function simulatePlayer(profile, boss, runs = 20) {
  const buffs = await calculateActiveBuffs(profile);

  const rawAtk     = (25 + profile.level * 2 + (buffs.attackFlat || 0)) * (1 + buffs.attack);
  const playerDef  = Math.floor((12 + profile.level + (buffs.defenseFlat || 0)) * (1 + buffs.defense));
  const playerAtk  = Math.floor(rawAtk * getOffenseMultiplierFromDefense(playerDef));
  const playerCrit = 5 + (buffs.critChance || 0);
  const playerCritDMG = 100 + (buffs.critDMG || 0);
  const maxHp      = Math.floor((250 + profile.level * 15 + (buffs.hpFlat || 0)) * (1 + (buffs.hpPercent || 0)));
  const dodgePct   = Math.min((buffs.dodge || 0) > 1 ? (buffs.dodge || 0) : (buffs.dodge || 0) * 100, 50);
  const playerReaction = buffs.setInfo?.elementalReaction;

  let totalDamage   = 0;
  let totalTurns    = 0;
  let totalSurvived = 0;
  let totalStuns    = 0;
  let totalCrits    = 0;
  let totalLifesteal = 0;

  for (let run = 0; run < runs; run++) {
    let phHp    = maxHp;
    let bossHp  = boss.maxHp;
    let bossDefDebuff = { active: false, multiplier: 1, turns: 0 };
    let bossStunned   = false;
    let runDmg  = 0;
    let turn    = 0;

    while (phHp > 0 && bossHp > 0 && turn < 10) {
      turn++;

      // === Player turn ===
      const variance = 0.8 + Math.random() * 0.4;
      const defMult  = bossDefDebuff.active ? bossDefDebuff.multiplier : 1;
      const dr       = getDamageReduction(boss.defense * defMult);
      let dmg        = Math.floor(playerAtk * (1 - dr) * variance);
      if (dmg < 1) dmg = 1;

      const isCrit = Math.random() * 100 < playerCrit;
      if (isCrit) {
        dmg = Math.floor(dmg * (1 + playerCritDMG / 100));
        totalCrits++;
      }

      const reaction = applyElementalReaction(dmg, playerReaction, { attack: playerAtk });
      dmg = reaction.damage;
      if (reaction.effects.stun)             bossStunned = true;
      if (reaction.effects.defenseReduction && !bossDefDebuff.active) {
        bossDefDebuff = { active: true, multiplier: 1 - reaction.effects.defenseReduction.percent, turns: reaction.effects.defenseReduction.duration || 3 };
      }
      if (reaction.effects.heal) {
        phHp = Math.min(phHp + Math.floor(dmg * reaction.effects.heal.percent), maxHp);
      }

      // Lifesteal
      const lsChance = (buffs.lifestealChance || 0) > 1 ? (buffs.lifestealChance || 0) : (buffs.lifestealChance || 0) * 100;
      const lsPct    = (buffs.lifesteal || 0) > 1 ? (buffs.lifesteal || 0) : (buffs.lifesteal || 0) * 100;
      if (lsChance > 0 && Math.random() * 100 < lsChance) {
        const heal = Math.floor(dmg * lsPct / 100);
        phHp = Math.min(phHp + heal, maxHp);
        totalLifesteal += heal;
      }

      bossHp  -= dmg;
      runDmg  += dmg;

      if (bossHp <= 0) break;

      // === Boss turn ===
      if (bossStunned) {
        bossStunned = false;
        totalStuns++;
      } else {
        if (Math.random() * 100 >= dodgePct) {
          const bDr     = getDamageReduction(playerDef);
          let bossDmg   = Math.floor(boss.attack * (1 - bDr) * (0.8 + Math.random() * 0.4));
          if (bossDmg < 1) bossDmg = 1;
          phHp -= bossDmg;
        }
      }

      // Decrement debuff
      if (bossDefDebuff.active) {
        bossDefDebuff.turns--;
        if (bossDefDebuff.turns <= 0) bossDefDebuff = { active: false, multiplier: 1, turns: 0 };
      }
    }

    totalDamage   += runDmg;
    totalTurns    += turn;
    if (phHp > 0) totalSurvived++;
  }

  return {
    avgDamage:   Math.round(totalDamage   / runs),
    avgTurns:    (totalTurns    / runs).toFixed(1),
    surviveRate: Math.round(totalSurvived / runs * 100),
    avgCrits:    (totalCrits    / runs).toFixed(1),
    avgStuns:    (totalStuns    / runs).toFixed(1),
    avgLifesteal:(totalLifesteal/ runs).toFixed(0),
    playerAtk,
    playerDef,
    maxHp,
    playerCrit,
    playerCritDMG,
    dodge: dodgePct,
    reaction: playerReaction?.name || "None",
    sets: buffs.setInfo?.activeSetBonuses?.join(", ") || "None",
    elements: buffs.setInfo?.activeElements?.join(", ") || "None",
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function bar(val, max, len = 20) {
  const filled = Math.round((val / max) * len);
  return "█".repeat(Math.min(filled, len)) + "░".repeat(Math.max(0, len - filled));
}
function pad(str, n) { return String(str).padEnd(n).slice(0, n); }
function lpad(str, n) { return String(str).padStart(n).slice(0, n); }

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected.\n");

  const profiles = await UserProfile.find({});
  console.log(`👥 Found ${profiles.length} player profiles.\n`);

  // Calculate boss stats based on the real player pool
  console.log("🐉 Calculating boss stats from player pool...");
  const boss = await getBossStats(profiles);

  console.log(`\n${"=".repeat(80)}`);
  console.log(`  RAID BOSS: Le Gromp`);
  console.log(`  HP: ${boss.maxHp.toLocaleString()}  |  ATK: ${boss.attack}  |  DEF: ${boss.defense}  |  Level: ${boss.level}`);
  console.log(`${"=".repeat(80)}\n`);

  // Run simulations
  const results = [];
  for (const profile of profiles) {
    process.stdout.write(`  Simulating ${profile.userId}...`);
    const stats = await simulatePlayer(profile, boss);
    results.push({ profile, stats });
    process.stdout.write(` Avg DMG: ${stats.avgDamage.toLocaleString()}\n`);
  }

  // Sort by avg damage descending
  results.sort((a, b) => b.stats.avgDamage - a.stats.avgDamage);

  const maxDmg = results[0]?.stats.avgDamage || 1;

  console.log(`\n${"=".repeat(80)}`);
  console.log(`  RAID BATTLE SIMULATION RESULTS  (avg over 20 runs, 10 turns each)`);
  console.log(`${"=".repeat(80)}`);
  console.log(
    `  ${pad("Rank", 5)}` +
    `${pad("UserID", 22)}` +
    `${pad("Lvl", 5)}` +
    `${pad("Avg DMG", 10)}` +
    `${pad("DPS Bar", 22)}` +
    `${pad("Survive%", 9)}` +
    `${pad("ATK", 6)}` +
    `${pad("DEF", 6)}` +
    `${pad("HP", 7)}` +
    `${pad("Crit%", 6)}` +
    `${pad("Dodge%", 7)}` +
    `${pad("Reaction", 18)}` +
    `Sets`
  );
  console.log(`  ${"-".repeat(155)}`);

  for (let i = 0; i < results.length; i++) {
    const { profile, stats } = results[i];
    const dpsBar = bar(stats.avgDamage, maxDmg, 20);
    console.log(
      `  ${lpad(i + 1, 4)}. ` +
      `${pad(profile.userId, 22)}` +
      `${lpad(profile.level, 4)} ` +
      `${lpad(stats.avgDamage.toLocaleString(), 9)} ` +
      `${dpsBar}  ` +
      `${lpad(stats.surviveRate + "%", 8)} ` +
      `${lpad(stats.playerAtk, 5)} ` +
      `${lpad(stats.playerDef, 5)} ` +
      `${lpad(stats.maxHp, 6)} ` +
      `${lpad(stats.playerCrit.toFixed(0) + "%", 5)} ` +
      `${lpad(stats.dodge.toFixed(0) + "%", 6)} ` +
      `${pad(stats.reaction, 18)}` +
      `${stats.sets}`
    );
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log(`  DETAILED STATS`);
  console.log(`${"=".repeat(80)}`);

  for (let i = 0; i < results.length; i++) {
    const { profile, stats } = results[i];
    console.log(`\n  #${i + 1} — User ${profile.userId} (Level ${profile.level})`);
    console.log(`  ┌─ Combat Stats`);
    console.log(`  │   ATK: ${stats.playerAtk}  DEF: ${stats.playerDef}  HP: ${stats.maxHp}`);
    console.log(`  │   Crit Rate: ${stats.playerCrit.toFixed(1)}%  Crit DMG: ${stats.playerCritDMG}%  Dodge: ${stats.dodge.toFixed(1)}%`);
    console.log(`  ├─ Simulation Results (20 runs × 10 turns)`);
    console.log(`  │   Avg Damage:   ${stats.avgDamage.toLocaleString()}`);
    console.log(`  │   Avg Turns:    ${stats.avgTurns} / 10`);
    console.log(`  │   Survive Rate: ${stats.surviveRate}%`);
    console.log(`  │   Avg Crits:    ${stats.avgCrits} / 10 turns`);
    console.log(`  │   Avg Stuns:    ${stats.avgStuns}`);
    console.log(`  │   Avg Lifesteal:${stats.avgLifesteal} HP healed`);
    console.log(`  ├─ Build`);
    console.log(`  │   Reaction: ${stats.reaction}`);
    console.log(`  │   Elements: ${stats.elements}`);
    console.log(`  └─ Active Sets: ${stats.sets || "None"}`);
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log(`  BALANCE NOTES`);
  console.log(`${"=".repeat(80)}`);
  const avgDamage = results.reduce((s, r) => s + r.stats.avgDamage, 0) / results.length;
  const topDamage = results[0].stats.avgDamage;
  const bottomDamage = results[results.length - 1].stats.avgDamage;
  const ratio = (topDamage / Math.max(1, bottomDamage)).toFixed(2);
  console.log(`\n  Avg damage across all players : ${Math.round(avgDamage).toLocaleString()}`);
  console.log(`  Top player damage             : ${topDamage.toLocaleString()}`);
  console.log(`  Bottom player damage          : ${bottomDamage.toLocaleString()}`);
  console.log(`  Top/Bottom ratio              : ${ratio}x`);
  console.log(`  (Ideal ratio for fair raids is ~2-4x. >6x suggests strong outliers)\n`);

  const lowSurvive = results.filter(r => r.stats.surviveRate < 30);
  if (lowSurvive.length > 0) {
    console.log(`  ⚠️  Players with <30% survive rate (may need attention):`);
    lowSurvive.forEach(r => console.log(`     - ${r.profile.userId} (Level ${r.profile.level}): ${r.stats.surviveRate}% survive`));
  } else {
    console.log(`  ✅ All players have ≥30% survive rate.`);
  }

  console.log("");
  await mongoose.disconnect();
  console.log("🔌 Disconnected.");
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
