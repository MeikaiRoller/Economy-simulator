/**
 * test_soulbound.js
 * Simulates Soulbound Ranked performance vs raid boss.
 * Tests: Legendary 6pc, Epic 6pc, plus Legendary Ethans Prowess as a burst reference.
 * Runs 20 fights per build. NO database writes.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const UserProfile = require('./schema/UserProfile');
const RaidBoss = require('./schema/RaidBoss');

// ─── Combat constants (mirrors rpg.js) ────────────────────────────────────────
const ARMOR_CONSTANT = 200;
const getDR = (def) => def / (def + ARMOR_CONSTANT);
const getOffenseMult = (def) => {
  if (def < 450) return 1;
  const reduction = getDR(def);
  return 1 - Math.min(0.45, reduction * 0.85);
};

// ─── Synthetic player builder ──────────────────────────────────────────────────
/**
 * Builds synthetic level-50 stat block from a set of item averages.
 * All items are +0 (no upgrade inflation). Substat layout chosen for DoT synergy
 * (heavy energy + attack subs for Soulbound; same gear base for fair comparison).
 *
 * @param {string} rarity   - "Legendary" or "Epic"
 * @param {string} setName  - "Soulbound Ranked" | "Ethans Prowess"
 */
/**
 * Clone a player config with stat overrides applied and attack recalculated.
 * Use this to test buff variants without touching the base builder.
 * @param {object} base       - Output of buildPlayer()
 * @param {object} overrides  - Fields to override. If attackPenalty changes,
 *                              attack is automatically recalculated.
 */
function buildVariant(base, overrides) {
  const next = { ...base, ...overrides };
  // Recalculate attack if penalty changed
  if (overrides.attackPenalty !== undefined) {
    const rawAttack = base.rawAttack;
    const offenseMult = getOffenseMult(base.defense);
    next.attack = Math.floor(rawAttack * (1 - next.attackPenalty) * offenseMult);
  }
  return next;
}

function buildPlayer(rarity, setName) {
  const level = 50;

  // ── Main stat averages by rarity ──
  const mainAvg = {
    Legendary: { weapon: 102.5, head: 80, chest: 42.5, hands: 16, feet: 66.5, accessory: 53.5 },
    Epic:      { weapon: 72.5,  head: 55, chest: 30,   hands: 12, feet: 46.5, accessory: 35   }
  }[rarity];

  // ── Sub-stat averages by rarity ──
  const sA = {
    Legendary: { attack: 50,   attackPct: 25,  defense: 41,  hp: 200, critDMG: 32,  energy: 29,  hpPct: 25 },
    Epic:      { attack: 32.5, attackPct: 17,  defense: 26,  hp: 135, critDMG: 22,  energy: 19,  hpPct: 17 }
  }[rarity];

  // ── Item builds (2 subs each, DoT-optimised: energy + attack where sensible) ──
  // weapon : attack main    | subs: attack + energy
  // head   : defense main   | subs: defense + hp
  // chest  : hp% main       | subs: attack% + energy
  // hands  : critRate main  | subs: critDMG + energy
  // feet   : critDMG main   | subs: attack + hp%
  // accessory: energy main  | subs: attack + energy

  let attackFlat   = mainAvg.weapon + sA.attack + sA.attack + sA.attack;   // weapon main + feet sub + acc sub + weapon sub
  // Re-calculate clearly:
  attackFlat  = mainAvg.weapon   // weapon main
              + sA.attack        // weapon sub 1
              + sA.attack        // feet sub 1
              + sA.attack;       // accessory sub 1

  let attackPct    = sA.attackPct / 100;  // chest sub 1
  let defenseFlat  = mainAvg.head + sA.defense;       // head main + head sub 1
  let defensePct   = 0;
  let hpFlat       = sA.hp;                           // head sub 2
  let hpPct        = (mainAvg.chest / 100)            // chest main (hp%)
                   + (sA.hpPct / 100);                // feet sub 2

  let critChance   = mainAvg.hands;                   // hands main (critRate)
  let critDMG      = mainAvg.feet + sA.critDMG;       // feet main + hands sub 1

  // Energy subs: weapon sub2, chest sub2, hands sub2, accessory main, accessory sub2
  let energy = mainAvg.accessory    // accessory main
             + sA.energy            // weapon sub 2
             + sA.energy            // chest sub 2
             + sA.energy            // hands sub 2
             + sA.energy;           // accessory sub 2

  // ── Set bonuses ──
  let setAttackPct      = 0;
  let setDefensePct     = 0;
  let setHpPct          = 0;
  let setCritChance     = 0;
  let setCritDMG        = 0;
  let attackPenalty     = 0;
  let decayProcChance   = 0;
  let decayBaseDmg      = 0;
  let decayEnergyScale  = false;
  let decayBothTurns    = false;

  if (setName === 'Soulbound Ranked') {
    // 6pc total: penalty 0.30, proc 1.00, baseDmg 5, energyScale 60%, AP DoT, bothTurns
    attackPenalty    = 0.30;
    decayProcChance  = 1.00;
    decayBaseDmg     = 5;
    decayEnergyScale = true;
    decayBothTurns   = true;
  } else if (setName === 'Ethans Prowess') {
    // 6pc: +0.60 attack, +0.16 defense, +6 critRate (2pc+3pc+6pc stacked)
    setAttackPct  = 0.60;
    setDefensePct = 0.16;   // 0.06 (3pc) + 0.10 (6pc)
    setCritChance = 6;      // 6pc only
  }

  // ── Derived stats ──
  const rawAttack  = (25 + level * 2 + attackFlat) * (1 + attackPct + setAttackPct);
  const defense    = Math.floor((12 + level + defenseFlat) * (1 + defensePct + setDefensePct));
  const baseHp     = Math.floor((250 + level * 15 + hpFlat) * (1 + hpPct + setHpPct));

  // Apply attack penalty (Soulbound Ranked) then offense nerf for high DEF
  const offenseMult = getOffenseMult(defense);
  const attack      = Math.floor(rawAttack * (1 - attackPenalty) * offenseMult);

  const crit        = 5 + critChance + setCritChance;  // base 5% + gear + set
  const critMult    = 100 + critDMG;                   // as percent
  const procRate    = Math.min(0.25, energy / 1000);   // energy → proc bonus

  return {
    level, attack, defense, hp: baseHp, crit, critMult, energy, procRate,
    // DoT config
    decayProcChance, decayBaseDmg, decayEnergyScale, decayBothTurns, attackPenalty,
    // For logging
    rarity, setName, rawAttack: Math.floor(rawAttack), defenseFlat, attackFlat, hpPct
  };
}

// ─── Hybrid 3+3 player builder ─────────────────────────────────────────────────
/**
 * Builds a 3pc Soulbound Ranked + 3pc secondary-set level-50 player.
 * Gear split: weapon/hands/feet = Soulbound pieces (DoT setup).
 *             head/chest/accessory = secondary set pieces (tank/support).
 * All items +0, average rolls for given rarity.
 *
 * @param {string} rarity        - "Legendary" or "Epic"
 * @param {string} secondarySet  - "Andys Soraka" | "Maries Zhongli Bodypillow"
 */
function buildHybridPlayer(rarity, secondarySet) {
  const level = 50;

  const mainAvg = {
    Legendary: { weapon: 102.5, head: 80, chest: 42.5, hands: 16, feet: 66.5, accessory: 53.5 },
    Epic:      { weapon: 72.5,  head: 55, chest: 30,   hands: 12, feet: 46.5, accessory: 35   }
  }[rarity];

  const sA = {
    Legendary: { attack: 50,   attackPct: 25, defense: 41, hp: 200, critDMG: 32, energy: 29, hpPct: 25 },
    Epic:      { attack: 32.5, attackPct: 17, defense: 26, hp: 135, critDMG: 22, energy: 19, hpPct: 17 }
  }[rarity];

  // ── Soulbound pieces: weapon (atk main, attack+energy subs)
  //                      hands (critRate main, critDMG+energy subs)
  //                      feet  (critDMG main, attack+hpPct subs)
  // ── Secondary pieces: head  (def main, defense+hp subs)
  //                      chest (hp% main, attack%+energy subs)
  //                      accessory (energy main, attack+energy subs)
  const attackFlat  = mainAvg.weapon + sA.attack + sA.attack + sA.attack; // wpn main + 3 atk subs
  const attackPct   = sA.attackPct / 100;  // chest sub 1
  const defenseFlat = mainAvg.head + sA.defense;  // head main + head sub 1
  const hpFlat      = sA.hp;               // head sub 2
  const hpPct       = (mainAvg.chest / 100) + (sA.hpPct / 100);
  const critChance  = mainAvg.hands;
  const critDMG     = mainAvg.feet + sA.critDMG;
  const energy      = mainAvg.accessory + sA.energy * 4;  // acc main + 4 energy subs

  // ── 3pc Soulbound (cumulative 2pc + 3pc) ──
  const attackPenalty   = 0.30;   // 0.20 + 0.10
  const decayProcChance = 0.70;   // 0.50 + 0.20
  const decayBaseDmg    = 4;      // 3 + 1
  const decayEnergyScale = true;  // 3pc+
  const decayBothTurns   = false; // 6pc only
  // ── 3pc secondary set bonuses ──
  let setDefensePct = 0;
  let setHpPct      = 0;
  let setAttackPct  = 0;
  let setCritChance = 0;
  let setLabel      = '';

  if (secondarySet === 'Andys Soraka') {
    // 2pc: hp 0.15  |  3pc: hp 0.25  →  cumulative hp 0.40
    setHpPct  = 0.40;
    setLabel  = 'Andy (hydro)';
  } else if (secondarySet === 'Maries Zhongli Bodypillow') {
    // 2pc: def 0.10  |  3pc: def 0.18, hp 0.08  →  def 0.28, hp 0.08
    setDefensePct = 0.28;
    setHpPct      = 0.08;
    setLabel      = 'Geo (zhongli)';
  }

  const rawAttack   = (25 + level * 2 + attackFlat) * (1 + attackPct + setAttackPct);
  const defense     = Math.floor((12 + level + defenseFlat) * (1 + setDefensePct));
  const baseHp      = Math.floor((250 + level * 15 + hpFlat) * (1 + hpPct + setHpPct));
  const offenseMult = getOffenseMult(defense);
  const attack      = Math.floor(rawAttack * (1 - attackPenalty) * offenseMult);
  const crit        = 5 + critChance + setCritChance;
  const critMult    = 100 + critDMG;
  const procRate    = Math.min(0.25, energy / 1000);

  return {
    level, attack, defense, hp: baseHp, crit, critMult, energy, procRate,
    decayProcChance, decayBaseDmg, decayEnergyScale, decayEnergyScaleFactor: 0.6,
    decayBothTurns, attackPenalty,
    rarity, setName: `Soulbound 3pc + ${setLabel}`,
    rawAttack: Math.floor(rawAttack), defenseFlat, attackFlat, hpPct: hpPct + setHpPct
  };
}

// ─── Single fight simulation ───────────────────────────────────────────────────
/**
 * @param {object} config
 *   dotArmorPiercing {boolean} - DoT ignores boss DR (thematic: decay bypasses armor)
 *   dotLifestealPct  {number}  - Fraction of each DoT tick healed back (e.g. 0.15 = 15%)
 */
function simulateFight(player, boss, maxTurns = 10, config = {}) {
  const { dotArmorPiercing = false, dotLifestealPct = 0 } = config;
  const maxPlayerHp = player.hp;
  let playerHp   = player.hp;
  let bossHp     = boss.maxHp;
  let decayStacks = 0;

  let totalDamage = 0;
  let dotDamage   = 0;
  let directDamage = 0;
  let turnsPlayed  = 0;

  const bossDefense  = boss.defense;
  const bossDR       = getDR(bossDefense);
  const playerDR     = getDR(player.defense);

  for (let turn = 1; turn <= maxTurns; turn++) {
    if (playerHp <= 0 || bossHp <= 0) break;
    turnsPlayed = turn;

    // ── PLAYER ATTACK ──
    const variance   = 0.8 + Math.random() * 0.4;
    let hit          = Math.floor(player.attack * (1 - bossDR) * variance);
    if (hit < 1) hit = 1;

    const isCrit = Math.random() * 100 < player.crit;
    if (isCrit) hit = Math.floor(hit * (1 + player.critMult / 100));

    directDamage += hit;
    totalDamage  += hit;
    bossHp       -= hit;

    // ── DECAY PROC (player turn) ──
    if (Math.random() < player.decayProcChance) {
      decayStacks++;
    }

    // ── DOT TICK: end of player turn ──
    if (decayStacks > 0) {
      const scaleFactor = player.decayEnergyScaleFactor || 0.5;
      const dmgPerStack = player.decayBaseDmg
        + (player.decayEnergyScale ? player.energy * scaleFactor : 0);
      const drFactor = dotArmorPiercing ? 1 : (1 - bossDR);
      const dot = Math.floor(decayStacks * dmgPerStack * drFactor);
      dotDamage   += dot;
      totalDamage += dot;
      bossHp      -= dot;
      // Lifesteal from DoT
      if (dotLifestealPct > 0) {
        playerHp = Math.min(maxPlayerHp, playerHp + Math.floor(dot * dotLifestealPct));
      }
    }

    if (bossHp <= 0) break;

    // ── BOSS ATTACK ──
    const bossVariance = 0.8 + Math.random() * 0.4;
    let bossDamage = Math.floor(boss.attack * (1 - playerDR) * bossVariance);
    if (bossDamage < 1) bossDamage = 1;
    playerHp -= bossDamage;

    // ── DOT TICK: end of boss turn (6pc only) ──
    if (player.decayBothTurns && decayStacks > 0 && playerHp > 0) {
      const scaleFactor = player.decayEnergyScaleFactor || 0.5;
      const dmgPerStack = player.decayBaseDmg
        + (player.decayEnergyScale ? player.energy * scaleFactor : 0);
      const drFactor = dotArmorPiercing ? 1 : (1 - bossDR);
      const dot = Math.floor(decayStacks * dmgPerStack * drFactor);
      dotDamage   += dot;
      totalDamage += dot;
      bossHp      -= dot;
      // Lifesteal from DoT
      if (dotLifestealPct > 0) {
        playerHp = Math.min(maxPlayerHp, playerHp + Math.floor(dot * dotLifestealPct));
      }
    }
  }

  return {
    totalDamage,
    directDamage,
    dotDamage,
    decayStacks,
    turnsPlayed,
    survived: playerHp > 0
  };
}

// ─── Run N fights for a player config ─────────────────────────────────────────
function runSuite(player, boss, n = 20, config = {}) {
  const results = [];
  for (let i = 0; i < n; i++) {
    results.push(simulateFight(player, boss, 10, config));
  }
  const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const pct = (a, b) => b > 0 ? `${(a / b * 100).toFixed(1)}%` : 'N/A';

  const totalDmgs   = results.map(r => r.totalDamage);
  const dotDmgs     = results.map(r => r.dotDamage);
  const directDmgs  = results.map(r => r.directDamage);
  const turns       = results.map(r => r.turnsPlayed);
  const stacks      = results.map(r => r.decayStacks);
  const survivals   = results.filter(r => r.survived).length;

  const avgTotal   = Math.round(avg(totalDmgs));
  const avgDot     = Math.round(avg(dotDmgs));
  const avgDirect  = Math.round(avg(directDmgs));

  return {
    avgTotal, avgDot, avgDirect,
    avgTurns:    avg(turns).toFixed(1),
    avgStacks:   avg(stacks).toFixed(1),
    survivalRate: `${survivals}/${n}`,
    dotShare:    pct(avgDot, avgTotal),
    directShare: pct(avgDirect, avgTotal)
  };
}

// ─── Print helpers ─────────────────────────────────────────────────────────────
function printPlayerInfo(p) {
  console.log(`  Attack  : ${p.attack.toLocaleString()} (raw ${p.rawAttack.toLocaleString()}, penalty ${(p.attackPenalty*100).toFixed(0)}%)`);
  console.log(`  Defense : ${p.defense}  (flat ${p.defenseFlat}, DR ${(getDR(p.defense)*100).toFixed(1)}%)`);
  console.log(`  HP      : ${p.hp.toLocaleString()} (hp% ${(p.hpPct*100).toFixed(1)}%)`);
  console.log(`  Crit    : ${p.crit.toFixed(1)}% CR  /  ${p.critMult.toFixed(1)}% CD`);
  console.log(`  Energy  : ${p.energy.toFixed(1)}  →  procRate ${(p.procRate*100).toFixed(1)}%`);
  if (p.decayProcChance > 0) {
    const sf = p.decayEnergyScaleFactor || 0.5;
    const dmgPerStack = p.decayBaseDmg + (p.decayEnergyScale ? p.energy * sf : 0);
    console.log(`  Decay   : ${(p.decayProcChance*100).toFixed(0)}% proc / ${dmgPerStack.toFixed(1)} dmg/stack/tick (energy×${sf})`);
    console.log(`  DoT ticks: player turn${p.decayBothTurns ? ' + boss turn' : ' only'}`);
  }
}

function printSuite(label, p, boss, s) {
  const bossHitsToKill = Math.floor(p.hp / Math.max(1, boss.attack * (1 - getDR(p.defense))));
  console.log(`\n  ┌─ ${label} ─────────────────────────`);
  console.log(`  │ Avg Damage / fight : ${s.avgTotal.toLocaleString()} total`);
  console.log(`  │   Direct           : ${s.avgDirect.toLocaleString()} (${s.directShare})`);
  console.log(`  │   DoT (Decay)      : ${s.avgDot.toLocaleString()} (${s.dotShare})`);
  console.log(`  │ Avg Turns Survived : ${s.avgTurns} / 10`);
  console.log(`  │ Avg Decay Stacks   : ${s.avgStacks}`);
  console.log(`  │ Survival (boss KO) : ${s.survivalRate}`);
  console.log(`  │ Est. boss HP hits  : ~${bossHitsToKill} hits to die (no variance)`);
  console.log(`  └─────────────────────────────────────`);
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + '═'.repeat(70));
  console.log(' SOULBOUND RANKED — BUFF VARIANT TEST');
  console.log(' Level 50 | +0 Items | Legendary 6pc | 20 fights each');
  console.log(' Comparing: baseline, 4 individual buffs, all-in combo, Ethans ref');
  console.log('═'.repeat(70));

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  // ── Fetch raid boss ──
  const boss = await RaidBoss.findOne({ active: true });
  let bossStats = { attack: 1080, defense: 90, maxHp: 158385 };
  if (boss && boss.maxHp > 0) {
    bossStats = { attack: boss.attack || 1080, defense: boss.defense || 90, maxHp: boss.maxHp };
    console.log(`🐉 Using live boss: ${boss.bossName || 'Le Gromp'}`);
  } else {
    console.log(`🐉 No active boss — using last known stats (158k HP / 1080 ATK)`);
  }
  console.log(`   HP: ${bossStats.maxHp.toLocaleString()} | ATK: ${bossStats.attack} | DEF: ${bossStats.defense}`);
  console.log(`   Boss DR: ${(getDR(bossStats.defense)*100).toFixed(1)}%\n`);

  // ── Build base Legendary 6pc and all variants ──
  const base    = buildPlayer('Legendary', 'Soulbound Ranked');   // Committed build
  const refBuild = buildPlayer('Legendary', 'Ethans Prowess');

  // All SB builds use armor-piercing DoT + lifesteal (now baked into the set)
  const sbConfig = { dotArmorPiercing: true, dotLifestealPct: 0.25 };

  // V1 kept for reference: what if we go back to -40% penalty
  const vOld = buildVariant(base, { attackPenalty: 0.40 });
  vOld.setName = 'Old baseline (-40% pen)';

  // V2: Buff DoT base damage from 5 → 8 per stack
  const v2 = buildVariant(base, { decayBaseDmg: 8 });
  v2.setName = 'V2: base dmg ×8';

  // V4: Lifesteal from DoT ticks — 15% of each tick heals the player
  const v4 = { ...base, setName: 'V4: DoT lifesteal 15% (ref)' };
  const v4Config = { dotArmorPiercing: true, dotLifestealPct: 0.25 }; // same as committed now

  // ── Print player stat summary ──
  console.log('─'.repeat(70));
  console.log(' KEY STATS (Legendary 6pc — committed build: -30% pen + AP DoT + 60% energy scale)');
  console.log('─'.repeat(70));
  const dmgPerStack6 = base.decayBaseDmg + base.energy * (base.decayEnergyScaleFactor || 0.6);
  const apDot6 = Math.floor(6 * dmgPerStack6);  // armor-piercing, no DR
  const apDot6Old = Math.floor(6 * (base.decayBaseDmg + base.energy * 0.5) * (1 - getDR(bossStats.defense)));
  console.log(`\n  Committed  ATK ${base.attack}  (raw ${base.rawAttack}, -30% penalty)  decayBase: 5  energyScale: 60%  AP DoT`);
  console.log(`  Old        ATK ${vOld.attack}  (raw ${vOld.rawAttack}, -40% penalty)  decayBase: 5  energyScale: 50%  normal DR`);
  console.log(`  Ethans ref ATK ${refBuild.attack}  (no penalty)  no DoT`);
  console.log(`\n  At 6 stacks per tick: old = ${apDot6Old} | committed (AP+60%) = ${apDot6}  (${(apDot6/apDot6Old).toFixed(2)}×)`);

  // ── Run simulations ──
  console.log('\n' + '─'.repeat(70));
  console.log(' SIMULATION RESULTS (20 fights each)');
  console.log('─'.repeat(70));

  const n = 20;
  const sBase  = runSuite(base,    bossStats, n, sbConfig);
  const sOld   = runSuite(vOld,    bossStats, n);           // old: no AP, 50% scale
  const sV2    = runSuite(v2,      bossStats, n, sbConfig);
  const sV4    = runSuite(v4,      bossStats, n, v4Config);
  const sRef   = runSuite(refBuild,bossStats, n);

  const allBuilds = [
    { label: 'Committed (-30%+AP+60%)',  s: sBase, p: base,     note: 'live balance' },
    { label: 'Old baseline (-40%, 50%)', s: sOld,  p: vOld,     note: 'pre-buff' },
    { label: 'V2 base dmg 8/stack',      s: sV2,   p: v2,       note: '+AP, bigger ticks' },
    { label: 'V4 +lifesteal 15%',        s: sV4,   p: v4,       note: '+AP, sustain' },
    { label: 'Ethans Prowess (ref)',      s: sRef,  p: refBuild, note: 'burst reference' },
  ];

  // Compact results table
  console.log(`\n  ${'Build'.padEnd(26)} ${'AvgDmg'.padStart(7)} ${'vs Old'.padStart(8)} ${'Turns'.padStart(6)} ${'Stacks'.padStart(7)} ${'DoT%'.padStart(6)} ${'ATK'.padStart(5)}`);
  console.log('  ' + '─'.repeat(68));
  for (const b of allBuilds) {
    const vsOld = b.s.avgTotal - sOld.avgTotal;
    const vsStr = vsOld === 0 ? '  base' : (vsOld > 0 ? `+${vsOld}` : `${vsOld}`);
    console.log(
      `  ${b.label.padEnd(26)}` +
      ` ${b.s.avgTotal.toLocaleString().padStart(7)}` +
      ` ${vsStr.padStart(8)}` +
      ` ${b.s.avgTurns.padStart(6)}` +
      ` ${b.s.avgStacks.padStart(7)}` +
      ` ${b.s.dotShare.padStart(6)}` +
      ` ${b.p.attack.toString().padStart(5)}`
    );
  }

  // ── Verdict ──
  console.log('\n' + '═'.repeat(70));
  console.log(' VERDICT');
  console.log('═'.repeat(70));

  const ethansDmg  = sRef.avgTotal;
  const committed  = sBase.avgTotal;
  const oldDmg     = sOld.avgTotal;
  const gapToRef   = ethansDmg - committed;
  const gainVsOld  = committed - oldDmg;

  console.log(`\n  Committed vs old baseline : +${gainVsOld} damage  (${oldDmg.toLocaleString()} → ${committed.toLocaleString()})`);
  console.log(`  Committed vs Ethans       : ${gapToRef <= 0 ? '✅ beats reference' : `❌ ${gapToRef} behind (${(committed/ethansDmg*100).toFixed(1)}% of Ethans)`}`);
  console.log(`  DoT share (committed)     : ${sBase.dotShare}`);
  console.log(`  Avg survival turns        : ${sBase.avgTurns}/10  (old: ${sOld.avgTurns})`);

  if (gapToRef > 0 && gapToRef <= 300) {
    console.log(`\n  Close enough — within ${gapToRef} dmg of Ethans. AP DoT + energy scale looks balanced.`);
  } else if (gapToRef > 300) {
    console.log(`\n  Still ${gapToRef} behind Ethans. Consider also applying V4 lifesteal or raising 6pc decayBaseDmg.`);
  } else {
    console.log(`\n  SB now beats the burst reference — watch for over-tuning in real fights.`);
  }
  console.log('\n');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
