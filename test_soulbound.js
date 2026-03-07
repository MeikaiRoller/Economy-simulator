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
  let setCritDMG      = 0;
  let setEnergy       = 0;
  // Set-specific mechanic fields
  let attackPenalty   = 0;
  let decayProcChance = 0;
  let decayBaseDmg    = 0;
  let decayEnergyScale  = false;
  let decayBothTurns    = false;
  let setProcRate     = 0;   // on-hit proc chance for damage bonus (Olivias)
  let damageBonus     = 0;   // damage multiplier on proc (Olivias)
  let burstDamage     = 0;   // on-crit bonus damage fraction (Justins)
  let dodge           = 0;   // dodge % chance vs boss attacks (Hasagi)
  let swirlDamage     = 0;   // counter hit on dodge (Hasagi)
  let freezeChance    = 0;   // chance to skip boss turn (Lilahs)
  let lifestealChance = 0;   // on-hit lifesteal proc chance (Andys)
  let lifestealPct    = 0;   // fraction of hit healed on proc (Andys)
  let counterChance   = 0;   // counter attack chance after being hit (Maries)
  let counterDmgPct   = 0;   // counter damage as fraction of attack (Maries)

  if (setName === 'Soulbound Ranked') {
    // 6pc total: -30% pen, 100% proc, base 5, AP DoT, 60% energy scale, bothTurns
    attackPenalty    = 0.30;
    decayProcChance  = 1.00;
    decayBaseDmg     = 5;
    decayEnergyScale = true;
    decayBothTurns   = true;
  } else if (setName === 'Ethans Prowess') {
    // 6pc cumulative: atk +0.60, def +0.16, crit +6
    setAttackPct  = 0.60;
    setDefensePct = 0.16;
    setCritChance = 6;
  } else if (setName === 'Olivias Fury') {
    // 6pc + resonance: atk +0.58, proc 0.46, dmgBonus 0.21
    setAttackPct  = 0.58;
    setProcRate   = 0.46;   // 0.34 set + 0.12 resonance
    damageBonus   = 0.21;   // 0.12 (6pc) + 0.09 (resonance)
  } else if (setName === 'Justins Clapping') {
    // 6pc + resonance: energy +108, crit +15, critDMG +12, burst +25% on-crit
    setEnergy     = 108;    // 15+25+50 = 90 set + 18 resonance
    setCritChance = 15;     // 5 (3pc) + 10 (6pc)
    setCritDMG    = 12;     // resonance bonus
    burstDamage   = 0.25;   // 6pc: on-crit extra hit = 25% of direct hit
  } else if (setName === 'Lilahs Cold Heart') {
    // 6pc + resonance: crit +37, critDMG +48, freeze boss 15%
    setCritChance = 37;     // 6+10+16 = 32 + 5 resonance
    setCritDMG    = 48;     // 12+26 = 38 + 10 resonance
    freezeChance  = 0.15;   // 6pc: skip boss attack turn
  } else if (setName === 'Hasagi') {
    // 6pc + resonance: dodge 27%, swirl counter on dodge (swirlDamage 0.29×atk)
    dodge         = 27;     // 6+15 = 21 + 6 resonance
    swirlDamage   = 0.29;   // 0.20 (6pc) + 0.09 resonance — counter hit on dodge
  } else if (setName === 'Maries Zhongli Bodypillow') {
    // 6pc + resonance: def +0.65, hp +0.23, 8% counter at 15% of atk
    setDefensePct = 0.65;   // 0.10+0.18+0.30 = 0.58 + 0.07 resonance
    setHpPct      = 0.23;   // 0.08+0.15
    counterChance = 0.08;
    counterDmgPct = 0.15;   // resonance counter damage multiplier
  } else if (setName === 'Andys Soraka') {
    // 6pc + resonance: hp +0.91, 18% lifesteal proc heals 10% of hit
    setHpPct       = 0.91;
    lifestealChance= 0.18;
    lifestealPct   = 0.10;
  }

  energy += setEnergy;

  // ── Derived stats ──
  const rawAttack   = (25 + level * 2 + attackFlat) * (1 + attackPct + setAttackPct);
  const defense     = Math.floor((12 + level + defenseFlat) * (1 + defensePct + setDefensePct));
  const baseHp      = Math.floor((250 + level * 15 + hpFlat) * (1 + hpPct + setHpPct));
  const offenseMult = getOffenseMult(defense);
  const attack      = Math.floor(rawAttack * (1 - attackPenalty) * offenseMult);
  const crit        = 5 + critChance + setCritChance;
  const critMult    = 100 + critDMG + setCritDMG;
  const procRate    = Math.min(0.25, energy / 1000);

  return {
    level, attack, defense, hp: baseHp, crit, critMult, energy, procRate,
    // Soulbound DoT
    decayProcChance, decayBaseDmg, decayEnergyScale, decayEnergyScaleFactor: 0.6,
    decayBothTurns, attackPenalty,
    // Set mechanics
    setProcRate, damageBonus, burstDamage, dodge, swirlDamage,
    freezeChance, lifestealChance, lifestealPct, counterChance, counterDmgPct,
    // Logging
    rarity, setName, rawAttack: Math.floor(rawAttack), defenseFlat, attackFlat,
    hpPct: hpPct + setHpPct
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
  // ── 3pc secondary set bonuses (cumulative 2pc+3pc, no resonance for hybrid) ──
  let setDefensePct = 0;
  let setHpPct      = 0;
  let setAttackPct  = 0;
  let setCritChance = 0;
  let setCritDMG    = 0;
  let setProcRate   = 0;
  let lifestealChance = 0;
  let lifestealPct    = 0;
  let setLabel      = '';
  let extraEnergy   = 0;

  if (secondarySet === 'Andys Soraka') {
    setHpPct        = 0.40;   // 0.15+0.25
    setLabel        = 'Andy';
    // lifestealChance needs 6pc — no unlock at 3pc
  } else if (secondarySet === 'Maries Zhongli Bodypillow') {
    setDefensePct   = 0.28;   // 0.10+0.18
    setHpPct        = 0.08;   // 3pc
    setLabel        = 'Geo';
  } else if (secondarySet === 'Ethans Prowess') {
    setAttackPct    = 0.30;   // 0.12+0.18
    setDefensePct   = 0.06;   // 3pc bonus
    setLabel        = 'Ethans';
  } else if (secondarySet === 'Olivias Fury') {
    setAttackPct    = 0.30;   // 0.12+0.18
    setProcRate     = 0.12;   // 3pc procRate (no damageBonus until 6pc)
    setLabel        = 'Olivias';
  } else if (secondarySet === 'Justins Clapping') {
    extraEnergy     = 40;     // 15+25
    setCritChance   = 5;      // 3pc
    setLabel        = 'Justins';
  } else if (secondarySet === 'Lilahs Cold Heart') {
    setCritChance   = 16;     // 6+10
    setCritDMG      = 12;     // 3pc
    setLabel        = 'Lilahs';
  }

  const totalEnergy = energy + extraEnergy;
  const rawAttack   = (25 + level * 2 + attackFlat) * (1 + attackPct + setAttackPct);
  const defense     = Math.floor((12 + level + defenseFlat) * (1 + setDefensePct));
  const baseHp      = Math.floor((250 + level * 15 + hpFlat) * (1 + hpPct + setHpPct));
  const offenseMult = getOffenseMult(defense);
  const attack      = Math.floor(rawAttack * (1 - attackPenalty) * offenseMult);
  const crit        = 5 + critChance + setCritChance;
  const critMult    = 100 + critDMG + setCritDMG;
  const procRate    = Math.min(0.25, totalEnergy / 1000);

  return {
    level, attack, defense, hp: baseHp, crit, critMult, energy: totalEnergy, procRate,
    decayProcChance, decayBaseDmg, decayEnergyScale, decayEnergyScaleFactor: 0.6,
    decayBothTurns, attackPenalty,
    setProcRate, damageBonus: 0, burstDamage: 0, dodge: 0, swirlDamage: 0,
    freezeChance: 0, lifestealChance, lifestealPct, counterChance: 0, counterDmgPct: 0,
    rarity, setName: `SB3+${setLabel}`,
    rawAttack: Math.floor(rawAttack), defenseFlat, attackFlat,
    hpPct: hpPct + setHpPct
  };
}

// ─── 3pc bonus lookup (cumulative 2pc + 3pc, no resonance, no 6pc-only mechanics) ──
const THREE_PC = {
  'Soulbound Ranked':          { attackPenalty: 0.30, decayProcChance: 0.70, decayBaseDmg: 4, decayEnergyScale: true,  decayBothTurns: false },
  'Ethans Prowess':            { setAttackPct: 0.30, setDefensePct: 0.06 },
  'Olivias Fury':              { setAttackPct: 0.30, setProcRate: 0.12 },
  'Justins Clapping':          { setEnergy: 40, setCritChance: 5 },
  'Lilahs Cold Heart':         { setCritChance: 16, setCritDMG: 12 },
  'Hasagi':                    { dodge: 6 },          // CDR not modelled in sim
  'Maries Zhongli Bodypillow': { setDefensePct: 0.28, setHpPct: 0.08 },
  'Andys Soraka':              { setHpPct: 0.40 },    // lifesteal needs 6pc
};

/**
 * Builds a level-50 player wearing 3pc of set1 + 3pc of set2.
 * Gear stats are identical to buildPlayer() so comparisons are fair.
 * Soulbound Ranked 3pc activates Decay (player-turn ticks only, 6pc bothTurns locked).
 */
function buildMixedPlayer(rarity, set1, set2) {
  const level = 50;
  const mainAvg = {
    Legendary: { weapon: 102.5, head: 80, chest: 42.5, hands: 16, feet: 66.5, accessory: 53.5 },
    Epic:      { weapon: 72.5,  head: 55, chest: 30,   hands: 12, feet: 46.5, accessory: 35   }
  }[rarity];
  const sA = {
    Legendary: { attack: 50,   attackPct: 25, defense: 41, hp: 200, critDMG: 32, energy: 29, hpPct: 25 },
    Epic:      { attack: 32.5, attackPct: 17, defense: 26, hp: 135, critDMG: 22, energy: 19, hpPct: 17 }
  }[rarity];

  // Same gear layout as buildPlayer / buildHybridPlayer
  const attackFlat  = mainAvg.weapon + sA.attack * 3;
  const attackPct   = sA.attackPct / 100;
  const defenseFlat = mainAvg.head + sA.defense;
  const hpFlat      = sA.hp;
  const hpPct       = (mainAvg.chest / 100) + (sA.hpPct / 100);
  const critChance  = mainAvg.hands;
  const critDMG     = mainAvg.feet + sA.critDMG;
  let   energy      = mainAvg.accessory + sA.energy * 4;

  // Merge 3pc bonuses from both sets
  let setAttackPct  = 0, setDefensePct = 0, setHpPct    = 0;
  let setCritChance = 0, setCritDMG    = 0, setEnergy   = 0;
  let setProcRate   = 0, damageBonus   = 0;
  let dodge         = 0;
  let attackPenalty    = 0, decayProcChance = 0, decayBaseDmg = 0;
  let decayEnergyScale = false, decayBothTurns = false;

  for (const setName of [set1, set2]) {
    const b = THREE_PC[setName] || {};
    setAttackPct   += b.setAttackPct   || 0;
    setDefensePct  += b.setDefensePct  || 0;
    setHpPct       += b.setHpPct       || 0;
    setCritChance  += b.setCritChance  || 0;
    setCritDMG     += b.setCritDMG     || 0;
    setEnergy      += b.setEnergy      || 0;
    setProcRate    += b.setProcRate     || 0;
    dodge          += b.dodge          || 0;
    attackPenalty  += b.attackPenalty  || 0;
    decayProcChance+= b.decayProcChance|| 0;
    decayBaseDmg   += b.decayBaseDmg   || 0;
    if (b.decayEnergyScale) decayEnergyScale = true;
    if (b.decayBothTurns)   decayBothTurns   = true;
  }
  energy += setEnergy;

  const rawAttack  = (25 + level * 2 + attackFlat) * (1 + attackPct + setAttackPct);
  const defense    = Math.floor((12 + level + defenseFlat) * (1 + setDefensePct));
  const baseHp     = Math.floor((250 + level * 15 + hpFlat) * (1 + hpPct + setHpPct));
  const offMult    = getOffenseMult(defense);
  const attack     = Math.floor(rawAttack * (1 - attackPenalty) * offMult);
  const crit       = 5 + critChance + setCritChance;
  const critMult   = 100 + critDMG + setCritDMG;
  const procRate   = Math.min(0.25, energy / 1000);

  // Short label: abbreviated set names
  const abbrev = n => ({
    'Soulbound Ranked': 'SB', 'Ethans Prowess': 'Eth', 'Olivias Fury': 'Oli',
    'Justins Clapping': 'Jus', 'Lilahs Cold Heart': 'Lil', 'Hasagi': 'Has',
    'Maries Zhongli Bodypillow': 'Geo', 'Andys Soraka': 'And'
  })[n] || n.slice(0, 4);

  return {
    level, attack, defense, hp: baseHp, crit, critMult, energy, procRate,
    decayProcChance, decayBaseDmg, decayEnergyScale, decayEnergyScaleFactor: 0.6,
    decayBothTurns, attackPenalty,
    setProcRate, damageBonus, burstDamage: 0, dodge, swirlDamage: 0,
    freezeChance: 0, lifestealChance: 0, lifestealPct: 0, counterChance: 0, counterDmgPct: 0,
    rarity, setName: `${abbrev(set1)}+${abbrev(set2)}`,
    set1, set2,
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

    // ── Set mechanics: on-hit effects ──
    // Olivias Fury: proc damage bonus
    if (player.setProcRate > 0 && Math.random() < player.setProcRate) {
      const procBonus = Math.floor(hit * (player.damageBonus || 0));
      bossHp      -= procBonus;
      totalDamage += procBonus;
      directDamage += procBonus;
    }
    // Justins Clapping: burst damage on crit
    if (isCrit && player.burstDamage > 0) {
      const burst = Math.floor(hit * player.burstDamage);
      bossHp      -= burst;
      totalDamage += burst;
      directDamage += burst;
    }
    // Andys Soraka: lifesteal on hit
    if (player.lifestealChance > 0 && Math.random() < player.lifestealChance) {
      const heal = Math.floor(hit * (player.lifestealPct || 0.10));
      playerHp = Math.min(maxPlayerHp, playerHp + heal);
    }

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
    // Lilahs Cold Heart: freeze (skip boss turn)
    const frozen = player.freezeChance > 0 && Math.random() < player.freezeChance;
    // Hasagi: dodge
    const didDodge = !frozen && player.dodge > 0 && Math.random() * 100 < player.dodge;

    if (frozen) {
      // Boss turn skipped — DoT tick still fires below
    } else if (didDodge) {
      // Hasagi: swirl counter on dodge
      if (player.swirlDamage > 0) {
        const swirlHit = Math.floor(player.attack * (1 - bossDR) * 0.35 * player.swirlDamage);
        bossHp      -= swirlHit;
        totalDamage += swirlHit;
        directDamage += swirlHit;
      }
    } else {
      const bossVariance = 0.8 + Math.random() * 0.4;
      let bossDamage = Math.floor(boss.attack * (1 - playerDR) * bossVariance);
      if (bossDamage < 1) bossDamage = 1;
      playerHp -= bossDamage;
      // Maries Zhongli: counter attack
      if (player.counterChance > 0 && Math.random() < player.counterChance) {
        const counterHit = Math.floor(player.attack * (1 - bossDR) * (player.counterDmgPct || 0.15));
        bossHp      -= counterHit;
        totalDamage  += counterHit;
        directDamage += counterHit;
      }
    }

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
    totalDamage, directDamage, dotDamage, decayStacks, turnsPlayed,
    survived: playerHp > 0,
    finalHp:    Math.max(0, playerHp),
    finalHpPct: maxPlayerHp > 0 ? Math.max(0, playerHp) / maxPlayerHp : 0
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

  const finalHpPcts = results.map(r => r.finalHpPct);

  const avgTotal   = Math.round(avg(totalDmgs));
  const avgDot     = Math.round(avg(dotDmgs));
  const avgDirect  = Math.round(avg(directDmgs));

  return {
    avgTotal, avgDot, avgDirect,
    avgTurns:     avg(turns).toFixed(1),
    avgStacks:    avg(stacks).toFixed(1),
    survivalRate: `${survivals}/${n}`,
    dotShare:     pct(avgDot, avgTotal),
    directShare:  pct(avgDirect, avgTotal),
    avgHpPct:     (avg(finalHpPcts) * 100).toFixed(0) + '%'
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
  console.log('\n' + '═'.repeat(72));
  console.log(' SOULBOUND RANKED — COMPREHENSIVE SET COMPARISON');
  console.log(' Level 50 | +0 Items | 20 fights each');
  console.log(' Sections: 1) All 6pc  2) Mixed 3pc+3pc  3) Rarity (Leg vs Epic)');
  console.log('═'.repeat(72));

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  const boss = await RaidBoss.findOne({ active: true });
  let bossStats = { attack: 1080, defense: 90, maxHp: 158385 };
  if (boss && boss.maxHp > 0) {
    bossStats = { attack: boss.attack || 1080, defense: boss.defense || 90, maxHp: boss.maxHp };
    console.log(`🐉 Live boss: ${boss.bossName || 'Le Gromp'}`);
  } else {
    console.log(`🐉 No active boss — using fallback stats`);
  }
  console.log(`   HP: ${bossStats.maxHp.toLocaleString()} | ATK: ${bossStats.attack} | DEF: ${bossStats.defense}  (DR ${(getDR(bossStats.defense)*100).toFixed(1)}%)\n`);

  const n         = 20;
  const sbConfig  = { dotArmorPiercing: true, dotLifestealPct: 0.15 };

  // ═══════════════════════════════════════════════════════════════════════
  //  SECTION 1 — ALL 6pc BUILDS (Legendary)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('═'.repeat(72));
  console.log(' SECTION 1 — ALL 6pc BUILDS (Legendary)');
  console.log('═'.repeat(72));

  const BUILD_KEYS = [
    'Soulbound Ranked',
    'Ethans Prowess',
    'Olivias Fury',
    'Justins Clapping',
    'Lilahs Cold Heart',
    'Hasagi',
    'Maries Zhongli Bodypillow',
    'Andys Soraka',
  ];

  const results6pc = BUILD_KEYS.map(key => {
    const p = buildPlayer('Legendary', key);
    const cfg = key === 'Soulbound Ranked' ? sbConfig : {};
    return { key, player: p, suite: runSuite(p, bossStats, n, cfg) };
  });

  // Print mini stat block per build
  results6pc.forEach(b => {
    const p = b.player;
    const mechanics = [];
    if (p.setProcRate   > 0) mechanics.push(`proc ${(p.setProcRate*100).toFixed(0)}% ×${(1+p.damageBonus).toFixed(2)}`);
    if (p.burstDamage   > 0) mechanics.push(`burst+${(p.burstDamage*100).toFixed(0)}% on-crit`);
    if (p.dodge         > 0) mechanics.push(`dodge ${p.dodge}%${p.swirlDamage > 0 ? ` swirl×${p.swirlDamage}` : ''}`);
    if (p.freezeChance  > 0) mechanics.push(`freeze ${(p.freezeChance*100).toFixed(0)}%`);
    if (p.counterChance > 0) mechanics.push(`counter ${(p.counterChance*100).toFixed(0)}%×${p.counterDmgPct}`);
    if (p.lifestealChance>0) mechanics.push(`lifesteal ${(p.lifestealChance*100).toFixed(0)}%`);
    if (p.decayProcChance>0) {
      const sf = p.decayEnergyScaleFactor || 0.6;
      const dps = p.decayBaseDmg + p.energy * sf;
      mechanics.push(`decay ${(p.decayProcChance*100).toFixed(0)}% proc / ${dps.toFixed(0)} dmg/stk (AP, ${p.decayBothTurns?'both turns':'player turn'})`);
    }
    console.log(`\n  [${b.key}]`);
    console.log(`    ATK ${p.attack} (raw ${p.rawAttack}, -${(p.attackPenalty*100).toFixed(0)}% pen) | DEF ${p.defense} DR${(getDR(p.defense)*100).toFixed(1)}% | HP ${p.hp.toLocaleString()} | Crit ${p.crit.toFixed(0)}%/${p.critMult.toFixed(0)}%`);
    if (mechanics.length) console.log(`    ${mechanics.join('  |  ')}`);
  });

  const ethRef = results6pc.find(b => b.key === 'Ethans Prowess').suite.avgTotal;
  const sbRef  = results6pc.find(b => b.key === 'Soulbound Ranked').suite.avgTotal;

  console.log('\n' + '─'.repeat(72));
  console.log(` ${'Build'.padEnd(30)} ${'AvgDmg'.padStart(7)} ${'vs Eth'.padStart(8)} ${'Turns'.padStart(6)} ${'Surv'.padStart(6)} ${'DoT%'.padStart(5)} ${'HP%'.padStart(5)}`);
  console.log('  ' + '─'.repeat(67));
  for (const b of results6pc) {
    const s   = b.suite;
    const vs  = s.avgTotal - ethRef;
    const vsS = vs === 0 ? '   base' : (vs > 0 ? `+${vs}` : `${vs}`);
    const tag = b.key === 'Soulbound Ranked' ? ' ◄' : '';
    const label = b.key.length > 29 ? b.key.slice(0, 27) + '..' : b.key;
    console.log(
      ` ${label.padEnd(30)}` +
      ` ${s.avgTotal.toLocaleString().padStart(7)}` +
      ` ${vsS.padStart(8)}` +
      ` ${s.avgTurns.padStart(6)}` +
      ` ${s.survivalRate.padStart(6)}` +
      ` ${s.dotShare.padStart(5)}` +
      ` ${s.avgHpPct.padStart(5)}` +
      tag
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  SECTION 2 — ALL 3+3 MIXED BUILDS vs SB 6pc
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(72));
  console.log(' SECTION 2 — ALL 3+3 MIXED BUILDS vs SB 6pc (Legendary)');
  console.log(' Every unique pair from the 8 sets = 28 combinations, sorted by damage');
  console.log('═'.repeat(72));

  const ALL_SETS = Object.keys(THREE_PC);
  const mixedBuilds = [];
  for (let i = 0; i < ALL_SETS.length; i++) {
    for (let j = i + 1; j < ALL_SETS.length; j++) {
      const p = buildMixedPlayer('Legendary', ALL_SETS[i], ALL_SETS[j]);
      const hasSB = ALL_SETS[i] === 'Soulbound Ranked' || ALL_SETS[j] === 'Soulbound Ranked';
      const cfg = hasSB ? sbConfig : {};
      mixedBuilds.push({ player: p, suite: runSuite(p, bossStats, n, cfg), hasSB });
    }
  }
  // Sort descending by avg damage
  mixedBuilds.sort((a, b) => b.suite.avgTotal - a.suite.avgTotal);

  // ── SB 6pc reference row ──
  const sb6 = results6pc.find(b => b.key === 'Soulbound Ranked');
  console.log(`\n  ${'Combo'.padEnd(12)} ${'AvgDmg'.padStart(7)} ${'vs SB6'.padStart(8)} ${'Turns'.padStart(6)} ${'DoT%'.padStart(5)} ${'ATK'.padStart(5)} ${'DEF'.padStart(5)} ${'Mechanics'} `);
  console.log('  ' + '─'.repeat(74));
  console.log(
    `  ${'SB 6pc [ref]'.padEnd(12)}` +
    ` ${sbRef.toLocaleString().padStart(7)}` +
    `     ───` +
    ` ${sb6.suite.avgTurns.padStart(6)}` +
    ` ${sb6.suite.dotShare.padStart(5)}` +
    ` ${buildPlayer('Legendary','Soulbound Ranked').attack.toString().padStart(5)}` +
    ` ${buildPlayer('Legendary','Soulbound Ranked').defense.toString().padStart(5)}` +
    `  AP-DoT both-turns 100%proc`
  );
  console.log('  ' + '─'.repeat(74));

  mixedBuilds.forEach((r, idx) => {
    const s   = r.suite;
    const vs  = s.avgTotal - sbRef;
    const vsS = vs === 0 ? '    ─' : (vs > 0 ? `+${vs}` : `${vs}`);
    const mechs = [];
    const p = r.player;
    if (p.decayProcChance > 0)  mechs.push(`DoT${p.decayBothTurns ? '×2' : ''}`);
    if (p.setProcRate     > 0)  mechs.push(`proc${(p.setProcRate*100).toFixed(0)}%`);
    if (p.dodge           > 0)  mechs.push(`dodge${p.dodge}%`);
    const sbTag = r.hasSB ? ' *' : '';
    console.log(
      `  ${(String(idx+1)+'.').padEnd(4)}${p.setName.padEnd(10)}` +
      ` ${s.avgTotal.toLocaleString().padStart(7)}` +
      ` ${vsS.padStart(8)}` +
      ` ${s.avgTurns.padStart(6)}` +
      ` ${s.dotShare.padStart(5)}` +
      ` ${p.attack.toString().padStart(5)}` +
      ` ${p.defense.toString().padStart(5)}` +
      `  ${mechs.join(' ')}${sbTag}`
    );
  });

  const sbMixed = mixedBuilds.filter(r => r.hasSB);
  const nonSbMixed = mixedBuilds.filter(r => !r.hasSB);
  const bestSbMix  = sbMixed[0];
  const bestNonSb  = nonSbMixed[0];
  const gapBest    = bestSbMix.suite.avgTotal - sbRef;
  console.log(`\n  * = includes SB 3pc`);
  console.log(`  Best SB-mixed: ${bestSbMix.player.setName}  →  ${bestSbMix.suite.avgTotal.toLocaleString()}  (${gapBest >= 0 ? '+' : ''}${gapBest} vs SB 6pc)`);
  console.log(`  Best non-SB:   ${bestNonSb.player.setName}  →  ${bestNonSb.suite.avgTotal.toLocaleString()}`);
  console.log(`  Top 5 vs SB 6pc gap: ${mixedBuilds.slice(0,5).map(r => `${r.player.setName} ${r.suite.avgTotal - sbRef >= 0 ? '+' : ''}${r.suite.avgTotal - sbRef}`).join('  |  ')}`);

  // reassign resultsHybrid so VERDICT section still works
  const resultsHybrid = sbMixed;

  // ═══════════════════════════════════════════════════════════════════════
  //  SECTION 3 — RARITY: Legendary vs Epic (SB 6pc)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(72));
  console.log(' SECTION 3 — RARITY: SB 6pc Legendary vs Epic');
  console.log('═'.repeat(72));

  const sbLeg  = buildPlayer('Legendary', 'Soulbound Ranked');
  const sbEpic = buildPlayer('Epic',      'Soulbound Ranked');
  const sLeg   = runSuite(sbLeg,  bossStats, n, sbConfig);
  const sEpic  = runSuite(sbEpic, bossStats, n, sbConfig);

  console.log(`\n  ${'Rarity'.padEnd(14)} ${'ATK'.padStart(5)} ${'DEF'.padStart(5)} ${'HP'.padStart(7)} ${'Energy'.padStart(7)} ${'Dmg/Stk'.padStart(9)} ${'AvgDmg'.padStart(7)} ${'DoT%'.padStart(6)} ${'HP%'.padStart(5)}`);
  console.log('  ' + '─'.repeat(68));
  for (const [label, p, s] of [['Legendary 6pc', sbLeg, sLeg], ['Epic 6pc', sbEpic, sEpic]]) {
    const dps = p.decayBaseDmg + p.energy * (p.decayEnergyScaleFactor || 0.6);
    console.log(
      `  ${label.padEnd(14)}` +
      ` ${p.attack.toString().padStart(5)}` +
      ` ${p.defense.toString().padStart(5)}` +
      ` ${p.hp.toLocaleString().padStart(7)}` +
      ` ${p.energy.toFixed(0).padStart(7)}` +
      ` ${dps.toFixed(1).padStart(9)}` +
      ` ${s.avgTotal.toLocaleString().padStart(7)}` +
      ` ${s.dotShare.padStart(6)}` +
      ` ${s.avgHpPct.padStart(5)}`
    );
  }
  const rarityGap = sLeg.avgTotal - sEpic.avgTotal;
  console.log(`\n  Legendary advantage: +${rarityGap.toLocaleString()} damage (+${(rarityGap/sEpic.avgTotal*100).toFixed(1)}% over Epic)`);

  // ═══════════════════════════════════════════════════════════════════════
  //  VERDICT
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(72));
  console.log(' VERDICT');
  console.log('═'.repeat(72));

  const sorted6  = [...results6pc].sort((a, b) => b.suite.avgTotal - a.suite.avgTotal);
  const sbRank   = sorted6.findIndex(b => b.key === 'Soulbound Ranked') + 1;
  const topBuild = sorted6[0];
  console.log(`\n  6pc rankings by avg damage:`);
  sorted6.forEach((b, i) => {
    const tag = b.key === 'Soulbound Ranked' ? ' ◄ SB' : '';
    console.log(`    #${i+1}  ${b.suite.avgTotal.toLocaleString().padStart(7)}  ${b.key}${tag}`);
  });

  const bestHybrid = resultsHybrid.reduce((best, r) => r.suite.avgTotal > best.suite.avgTotal ? r : best);
  const tankiest  = resultsHybrid.reduce((best, r) => parseFloat(r.suite.avgTurns) > parseFloat(best.suite.avgTurns) ? r : best);
  console.log(`\n  Best hybrid (damage):         ${bestHybrid.player.setName}  →  ${bestHybrid.suite.avgTotal.toLocaleString()} (${bestHybrid.suite.avgTotal >= sbRef ? '+' : ''}${bestHybrid.suite.avgTotal - sbRef} vs SB 6pc)`);
  console.log(`  Longest-lived hybrid:         ${tankiest.player.setName}  →  ${tankiest.suite.avgTurns} turns avg (vs SB6 ${results6pc.find(b=>b.key==='Soulbound Ranked').suite.avgTurns}t)`);
  console.log(`\n  SB vs Ethans (burst ref): ${sbRef >= ethRef ? '✅ SB beats Ethans' : `${sbRef - ethRef} behind Ethans (${(sbRef/ethRef*100).toFixed(1)}%)`}`);
  console.log('\n');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
