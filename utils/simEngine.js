/**
 * simEngine.js
 * Shared simulation core — used by test_soulbound.js and sim_server.js.
 * Mirrors the combat constants from rpg.js exactly.
 */

const { SET_BONUSES, ELEMENTAL_REACTIONS, REACTION_TOGGLES, getReactionKey } = require('./setbonuses');
const { applyElementalReaction } = require('./elementalReactions');

// ─── Constants ────────────────────────────────────────────────────────────────
const ARMOR_CONSTANT = 200;
const getDR          = (def) => def / (def + ARMOR_CONSTANT);

// Mirrors the item level multiplier from calculateBuffs.js
function getItemLevelMultiplier(itemLevel) {
  let pct = 0;
  for (let i = 1; i <= itemLevel; i++) {
    if (i <= 5) pct += 2;
    else if (i <= 10) pct += 3;
    else pct += 4;
  }
  return 1 + pct / 100;
}

const getOffenseMult = (def) => {
  if (def < 450) return 1;
  const reduction = getDR(def);
  return 1 - Math.min(0.45, reduction * 0.85);
};

// ─── All set names ─────────────────────────────────────────────────────────────
const ALL_SETS = [
  'Soulbound Ranked',
  'Ethans Prowess',
  'Olivias Fury',
  'Justins Clapping',
  'Lilahs Cold Heart',
  'Hasagi',
  'Maries Zhongli Bodypillow',
  'Andys Soraka',
];

// ─── 3pc bonus lookup (cumulative 2pc+3pc, no resonance, no 6pc-only mechanics) ─
const THREE_PC = {
  'Soulbound Ranked':          { attackPenalty: 0.30, decayProcChance: 0.70, decayBaseDmg: 4, decayEnergyScale: true,  decayBothTurns: false },
  'Ethans Prowess':            { setAttackPct: 0.30, setDefensePct: 0.06 },
  'Olivias Fury':              { setAttackPct: 0.30, setProcRate: 0.12 },
  'Justins Clapping':          { setEnergy: 40, setCritChance: 5 },
  'Lilahs Cold Heart':         { setCritChance: 16, setCritDMG: 12 },
  'Hasagi':                    { dodge: 6 },
  'Maries Zhongli Bodypillow': { setDefensePct: 0.28, setHpPct: 0.08 },
  'Andys Soraka':              { setHpPct: 0.40 },
};

// ─── Gear averages by rarity ──────────────────────────────────────────────────
const MAIN_AVG = {
  // Weapon and head main stats are fixed — averages of their rarity ranges
  Legendary: { weapon: 102.5, head: 80 },
  Epic:      { weapon: 72.5,  head: 55 },
};

// Average main stat values for flexible slots (chest/hands/feet/accessory) per stat type
// Midpoints of FLEXIBLE_MAIN_RANGES in generateItem.js
const FLEX_MAIN_AVG = {
  Legendary: { attack: 137.5, attackPct: 42.5, defense: 100, defensePct: 42.5, hp: 555, hpPct: 42.5, critRate: 16, critDMG: 66.5, energy: 53.5 },
  Epic:      { attack: 97.5,  attackPct: 30,   defense: 67.5,defensePct: 30,   hp: 385, hpPct: 30,   critRate: 12, critDMG: 46.5, energy: 35   },
};

const FLEX_MAIN_POOL = ['attack','attackPct','defense','defensePct','hp','hpPct','critRate','critDMG','energy'];

const DEFAULT_MAINS = { chest: 'hpPct', hands: 'critRate', feet: 'critDMG', accessory: 'energy' };
const SUB_AVG = {
  Legendary: { attack: 50, attackPct: 25, defense: 41, hp: 200, critRate: 10, critDMG: 32, energy: 29 },
  Epic:      { attack: 32.5, attackPct: 17, defense: 26, hp: 135, critRate: 7,  critDMG: 22, energy: 19 },
};

// ─── Substat system ────────────────────────────────────────────────────────────
const SUBSTAT_KEYS = ['attack', 'attackPct', 'defense', 'hp', 'critRate', 'critDMG', 'energy']; // defensePct and hpPct removed — main stat only

const DEFAULT_SUBPROFILE = {
  weapon:    ['energy',    'attack',    'attackPct', 'hp'],
  head:      ['hp',        'energy',    'attackPct', 'defense'],
  chest:     ['attackPct', 'energy',    'attack',    'hp'],
  hands:     ['critDMG',   'energy',    'attack',    'attackPct'],
  feet:      ['attack',    'hp',        'energy',    'attackPct'],
  accessory: ['attack',    'attackPct', 'hp',        'energy'],
};

const SUBSTAT_PROFILES = {
  // Each slot has 4 unique subs — no duplicates within a slot
  'DoT Meta':     {
    weapon:    ['energy',    'attack',    'attackPct', 'hp'],
    head:      ['hp',        'energy',    'attackPct', 'defense'],
    chest:     ['attackPct', 'energy',    'attack',    'hp'],
    hands:     ['critDMG',   'energy',    'attack',    'attackPct'],
    feet:      ['attack',    'hp',        'energy',    'attackPct'],
    accessory: ['attack',    'attackPct', 'hp',        'energy'],
  },
  'Crit Focus':   {
    weapon:    ['attack',    'critRate',  'critDMG',   'attackPct'],
    head:      ['defense',   'hp',        'critRate',  'critDMG'],
    chest:     ['attackPct', 'critRate',  'critDMG',   'attack'],
    hands:     ['critDMG',   'attack',    'critRate',  'attackPct'],
    feet:      ['critRate',  'attack',    'attackPct', 'hp'],
    accessory: ['attack',    'critDMG',   'critRate',  'attackPct'],
  },
  'HP Scaling':   {
    weapon:    ['attack',    'hp',        'energy',    'attackPct'],
    head:      ['hp',        'defense',   'energy',    'attackPct'],
    chest:     ['hp',        'attack',    'energy',    'defense'],
    hands:     ['critDMG',   'hp',        'attack',    'energy'],
    feet:      ['hp',        'attack',    'energy',    'attackPct'],
    accessory: ['hp',        'attack',    'energy',    'attackPct'],
  },
  'Attack Flat':  {
    weapon:    ['attack',    'attackPct', 'energy',    'critDMG'],
    head:      ['attack',    'attackPct', 'hp',        'defense'],
    chest:     ['attackPct', 'attack',    'energy',    'critDMG'],
    hands:     ['attack',    'attackPct', 'critDMG',   'energy'],
    feet:      ['attack',    'attackPct', 'energy',    'hp'],
    accessory: ['attack',    'attackPct', 'hp',        'critDMG'],
  },
  'Defense Tank': {
    weapon:    ['defense',   'hp',        'energy',    'attack'],
    head:      ['defense',   'hp',        'energy',    'attack'],
    chest:     ['energy',    'defense',   'hp',        'attack'],
    hands:     ['defense',   'hp',        'energy',    'attack'],
    feet:      ['defense',   'energy',    'hp',        'attack'],
    accessory: ['defense',   'hp',        'energy',    'attack'],
  },
  'Energy Burst': {
    weapon:    ['energy',    'attack',    'attackPct', 'critDMG'],
    head:      ['defense',   'hp',        'energy',    'attack'],
    chest:     ['energy',    'attackPct', 'attack',    'critDMG'],
    hands:     ['energy',    'critDMG',   'attack',    'attackPct'],
    feet:      ['attack',    'energy',    'hp',        'attackPct'],
    accessory: ['energy',    'attack',    'attackPct', 'critDMG'],
  },
};

// itemLevel 0 = 2 subs, 5 = 3 subs, 10 = 4 subs
function calcSubStats(rarity, profile, itemLevel = 10) {
  const subsPerSlot = itemLevel >= 10 ? 4 : itemLevel >= 5 ? 3 : 2;
  const sA = SUB_AVG[rarity];
  const slots = ['weapon', 'head', 'chest', 'hands', 'feet', 'accessory'];
  const r = { attackFlat: 0, attackPct: 0, defenseFlat: 0, defensePct: 0, hpFlat: 0, hpPct: 0, critRate: 0, critDMG: 0, energy: 0 };
  for (const slot of slots) {
    for (const sub of (profile[slot] || []).slice(0, subsPerSlot)) {
      const v = sA[sub] || 0;
      if (sub === 'attack')     r.attackFlat  += v;
      if (sub === 'attackPct')  r.attackPct   += v / 100;
      if (sub === 'defense')    r.defenseFlat += v;
      if (sub === 'defensePct') r.defensePct  += v / 100;
      if (sub === 'hp')         r.hpFlat      += v;
      if (sub === 'hpPct')      r.hpPct       += v / 100;
      if (sub === 'critRate')   r.critRate    += v;
      if (sub === 'critDMG')    r.critDMG     += v;
      if (sub === 'energy')     r.energy      += v;
    }
  }
  return r;
}

// ─── Build a full 6pc player ───────────────────────────────────────────────────
function buildPlayer(rarity, setName, subProfile = DEFAULT_SUBPROFILE, itemLevel = 10, mains = DEFAULT_MAINS, level = 85) {
  const levelMult    = getItemLevelMultiplier(itemLevel);                // e.g. +45% at +15
  const levelBuffPct = Math.min(20, level * 0.1) / 100;                 // level-based atk/def buff %
  const ma    = MAIN_AVG[rarity];
  const fma   = FLEX_MAIN_AVG[rarity];
  const subs  = calcSubStats(rarity, subProfile, itemLevel);
  const m     = { ...DEFAULT_MAINS, ...mains };

  // Fixed mains scaled by item level multiplier (mirrors calculateBuffs.js)
  let attackFlat  = ma.weapon * levelMult + subs.attackFlat;
  let defenseFlat = ma.head   * levelMult + subs.defenseFlat;
  let attackPct   = subs.attackPct  + levelBuffPct;   // level-based attackBoost
  let defensePct  = subs.defensePct + levelBuffPct;   // level-based defenseBoost
  let hpFlat      = subs.hpFlat;
  let hpPct       = subs.hpPct;
  let critChance  = subs.critRate;
  let critDMG     = subs.critDMG;
  let energy      = subs.energy;

  // Flexible slot mains scaled by item level multiplier
  for (const slot of ['chest', 'hands', 'feet', 'accessory']) {
    const t = m[slot];
    const v = (fma[t] || 0) * levelMult;
    if (t === 'attack')          attackFlat  += v;
    else if (t === 'attackPct')  attackPct   += v / 100;
    else if (t === 'defense')    defenseFlat += v;
    else if (t === 'defensePct') defensePct  += v / 100;
    else if (t === 'hp')         hpFlat      += v;
    else if (t === 'hpPct')      hpPct       += v / 100;
    else if (t === 'critRate')   critChance  += v;
    else if (t === 'critDMG')    critDMG     += v;
    else if (t === 'energy')     energy      += v;
  }

  let setAttackPct = 0, setDefensePct = 0, setHpPct = 0;
  let setCritChance = 0, setCritDMG = 0, setEnergy = 0;
  let attackPenalty = 0, decayProcChance = 0, decayBaseDmg = 0;
  let decayEnergyScale = false, decayBothTurns = false;
  let setProcRate = 0, damageBonus = 0, burstDamage = 0;
  let dodge = 0, swirlDamage = 0, freezeChance = 0;
  let lifestealChance = 0, lifestealPct = 0;
  let counterChance = 0, counterDmgPct = 0;

  if (setName === 'Soulbound Ranked') {
    attackPenalty    = 0.30;
    decayProcChance  = 1.00;
    decayBaseDmg     = 5;
    decayEnergyScale = true;
    decayBothTurns   = true;
  } else if (setName === 'Ethans Prowess') {
    setAttackPct  = 0.60;
    setDefensePct = 0.16;
    setCritChance = 6;
  } else if (setName === 'Olivias Fury') {
    setAttackPct  = 0.58;
    setProcRate   = 0.46;
    damageBonus   = 0.21;
  } else if (setName === 'Justins Clapping') {
    setEnergy     = 108;
    setCritChance = 15;
    setCritDMG    = 12;
    burstDamage   = 0.25;
  } else if (setName === 'Lilahs Cold Heart') {
    setCritChance = 37;
    setCritDMG    = 48;
    freezeChance  = 0.15;
  } else if (setName === 'Hasagi') {
    dodge         = 27;
    swirlDamage   = 0.29;
  } else if (setName === 'Maries Zhongli Bodypillow') {
    setDefensePct = 0.65;
    setHpPct      = 0.23;
    counterChance = 0.08;
    counterDmgPct = 0.15;
  } else if (setName === 'Andys Soraka') {
    setHpPct       = 0.91;
    lifestealChance= 0.18;
    lifestealPct   = 0.10;
  }

  energy += setEnergy;

  const rawAttack = (25 + level * 2 + attackFlat) * (1 + attackPct + setAttackPct);
  const defense   = Math.floor((12 + level + defenseFlat) * (1 + defensePct + setDefensePct));
  const baseHp    = Math.floor((250 + level * 15 + hpFlat) * (1 + hpPct + setHpPct));
  const offMult   = getOffenseMult(defense);
  const attack    = Math.floor(rawAttack * (1 - attackPenalty) * offMult);
  const crit      = 5 + critChance + setCritChance;
  const critMult  = 100 + critDMG + setCritDMG;
  const procRate  = Math.min(0.25, energy / 1000);

  return {
    level, attack, defense, hp: baseHp, crit, critMult, energy, procRate,
    decayProcChance, decayBaseDmg, decayEnergyScale, decayEnergyScaleFactor: 0.6,
    decayBothTurns, attackPenalty,
    setProcRate, damageBonus, burstDamage, dodge, swirlDamage,
    freezeChance, lifestealChance, lifestealPct, counterChance, counterDmgPct,
    elementalReaction: null, reactionName: null,
    rarity, setName, mode: '6pc',
    rawAttack: Math.floor(rawAttack), defenseFlat, attackFlat,
    hpPct: hpPct + setHpPct
  };
}

// ─── Build a 3+3 mixed player ─────────────────────────────────────────────────
function buildMixedPlayer(rarity, set1, set2, subProfile = DEFAULT_SUBPROFILE, itemLevel = 10, mains = DEFAULT_MAINS, level = 85) {
  const levelMult    = getItemLevelMultiplier(itemLevel);
  const levelBuffPct = Math.min(20, level * 0.1) / 100;
  const ma    = MAIN_AVG[rarity];
  const fma   = FLEX_MAIN_AVG[rarity];
  const subs  = calcSubStats(rarity, subProfile, itemLevel);
  const m     = { ...DEFAULT_MAINS, ...mains };

  let attackFlat  = ma.weapon * levelMult + subs.attackFlat;
  let defenseFlat = ma.head   * levelMult + subs.defenseFlat;
  let attackPct   = subs.attackPct  + levelBuffPct;
  let defensePct  = subs.defensePct + levelBuffPct;
  let hpFlat      = subs.hpFlat;
  let hpPct       = subs.hpPct;
  let critChance  = subs.critRate;
  let critDMG     = subs.critDMG;
  let energy      = subs.energy;

  for (const slot of ['chest', 'hands', 'feet', 'accessory']) {
    const t = m[slot];
    const v = (fma[t] || 0) * levelMult;
    if (t === 'attack')          attackFlat  += v;
    else if (t === 'attackPct')  attackPct   += v / 100;
    else if (t === 'defense')    defenseFlat += v;
    else if (t === 'defensePct') defensePct  += v / 100;
    else if (t === 'hp')         hpFlat      += v;
    else if (t === 'hpPct')      hpPct       += v / 100;
    else if (t === 'critRate')   critChance  += v;
    else if (t === 'critDMG')    critDMG     += v;
    else if (t === 'energy')     energy      += v;
  }

  let setAttackPct = 0, setDefensePct = 0, setHpPct = 0;
  let setCritChance = 0, setCritDMG = 0, setEnergy = 0;
  let setProcRate = 0, damageBonus = 0;
  let dodge = 0;
  let attackPenalty = 0, decayProcChance = 0, decayBaseDmg = 0;
  let decayEnergyScale = false, decayBothTurns = false;

  for (const sn of [set1, set2]) {
    const b = THREE_PC[sn] || {};
    setAttackPct    += b.setAttackPct    || 0;
    setDefensePct   += b.setDefensePct   || 0;
    setHpPct        += b.setHpPct        || 0;
    setCritChance   += b.setCritChance   || 0;
    setCritDMG      += b.setCritDMG      || 0;
    setEnergy       += b.setEnergy       || 0;
    setProcRate     += b.setProcRate     || 0;
    dodge           += b.dodge           || 0;
    attackPenalty   += b.attackPenalty   || 0;
    decayProcChance += b.decayProcChance || 0;
    decayBaseDmg    += b.decayBaseDmg    || 0;
    if (b.decayEnergyScale) decayEnergyScale = true;
    if (b.decayBothTurns)   decayBothTurns   = true;
  }
  energy += setEnergy;

  const rawAttack = (25 + level * 2 + attackFlat) * (1 + attackPct + setAttackPct);
  const defense   = Math.floor((12 + level + defenseFlat) * (1 + defensePct + setDefensePct));
  const baseHp    = Math.floor((250 + level * 15 + hpFlat) * (1 + hpPct + setHpPct));
  const offMult   = getOffenseMult(defense);
  const attack    = Math.floor(rawAttack * (1 - attackPenalty) * offMult);
  const crit      = 5 + critChance + setCritChance;
  const critMult  = 100 + critDMG + setCritDMG;
  const procRate  = Math.min(0.25, energy / 1000);

  const abbrev = n => ({ 'Soulbound Ranked':'SB','Ethans Prowess':'Eth','Olivias Fury':'Oli',
    'Justins Clapping':'Jus','Lilahs Cold Heart':'Lil','Hasagi':'Has',
    'Maries Zhongli Bodypillow':'Geo','Andys Soraka':'And' })[n] || n.slice(0,4);

  // Elemental reaction from the two set elements
  const elem1 = SET_BONUSES[set1]?.element;
  const elem2 = SET_BONUSES[set2]?.element;
  const reactionKey = getReactionKey(elem1, elem2);
  const elementalReaction = (reactionKey && REACTION_TOGGLES[reactionKey])
    ? (ELEMENTAL_REACTIONS[reactionKey] || null)
    : null;

  return {
    level, attack, defense, hp: baseHp, crit, critMult, energy, procRate,
    decayProcChance, decayBaseDmg, decayEnergyScale, decayEnergyScaleFactor: 0.6,
    decayBothTurns, attackPenalty,
    setProcRate, damageBonus, burstDamage: 0, dodge, swirlDamage: 0,
    freezeChance: 0, lifestealChance: 0, lifestealPct: 0, counterChance: 0, counterDmgPct: 0,
    elementalReaction,
    reactionName: elementalReaction?.name || null,
    rarity, setName: `${abbrev(set1)}+${abbrev(set2)}`, mode: '3+3', set1, set2,
    rawAttack: Math.floor(rawAttack), defenseFlat, attackFlat,
    hpPct: hpPct + setHpPct
  };
}

// ─── Single fight simulation ──────────────────────────────────────────────────
function simulateFight(player, boss, maxTurns = 10, config = {}) {
  const { dotArmorPiercing = false, dotLifestealPct = 0 } = config;
  const maxPlayerHp = player.hp;
  let playerHp     = player.hp;
  let bossHp       = boss.maxHp;
  let decayStacks  = 0;
  let totalDamage  = 0, turnsPlayed = 0;
  let normalDamage = 0; // non-crit base hits
  let critDamage   = 0; // crit base hits (full value, not just bonus)
  let procDamage   = 0; // set ability procs (Olivia/Justin/Swirl/Counter)
  let dotDamage    = 0; // decay ticks
  let hitCount     = 0; // total main-attack hits
  let critCount    = 0; // how many were crits

  const bossDR   = getDR(boss.defense);
  const playerDR = getDR(player.defense);

  for (let turn = 1; turn <= maxTurns; turn++) {
    if (playerHp <= 0 || bossHp <= 0) break;
    turnsPlayed = turn;

    // Player attack
    const variance = 0.8 + Math.random() * 0.4;
    let baseHit = Math.floor(player.attack * (1 - bossDR) * variance);
    if (baseHit < 1) baseHit = 1;
    const isCrit = Math.random() * 100 < player.crit;
    let hit = baseHit;
    let critBonus = 0;
    if (isCrit) {
      hit = Math.floor(baseHit * (1 + player.critMult / 100));
      critBonus = hit - baseHit;
      critCount++;
    }
    hitCount++;
    normalDamage += baseHit;   // base damage (always)
    critDamage   += critBonus; // extra damage from crit only

    // Elemental reaction (3+3 mixed builds) — bonus goes to proc bucket
    let reactionBonus = 0;
    if (player.elementalReaction) {
      const rr = applyElementalReaction(hit, player.elementalReaction, { attack: player.attack }, null, player.setProcRate || 0);
      reactionBonus = rr.damage - hit;
      if (reactionBonus > 0) hit = rr.damage;
    }
    procDamage  += reactionBonus;
    totalDamage += hit;
    bossHp      -= hit;

    // Olivias proc
    if (player.setProcRate > 0 && Math.random() < player.setProcRate) {
      const bonus = Math.floor(hit * (player.damageBonus || 0));
      bossHp      -= bonus;
      totalDamage += bonus;
      procDamage  += bonus;
    }
    // Justins burst on crit
    if (isCrit && player.burstDamage > 0) {
      const burst = Math.floor(hit * player.burstDamage);
      bossHp      -= burst;
      totalDamage += burst;
      procDamage  += burst;
    }
    // Andys lifesteal on hit
    if (player.lifestealChance > 0 && Math.random() < player.lifestealChance) {
      playerHp = Math.min(maxPlayerHp, playerHp + Math.floor(hit * (player.lifestealPct || 0.10)));
    }

    // Decay proc
    if (Math.random() < player.decayProcChance) decayStacks++;

    // DoT tick: player turn
    if (decayStacks > 0) {
      const sf  = player.decayEnergyScaleFactor || 0.5;
      const dps = player.decayBaseDmg + (player.decayEnergyScale ? player.energy * sf : 0);
      const dr  = dotArmorPiercing ? 1 : (1 - bossDR);
      const dot = Math.floor(decayStacks * dps * dr);
      dotDamage   += dot;
      totalDamage += dot;
      bossHp      -= dot;
      if (dotLifestealPct > 0) playerHp = Math.min(maxPlayerHp, playerHp + Math.floor(dot * dotLifestealPct));
    }

    if (bossHp <= 0) break;

    // Boss turn
    const frozen   = player.freezeChance > 0 && Math.random() < player.freezeChance;
    const didDodge = !frozen && player.dodge > 0 && Math.random() * 100 < player.dodge;

    if (frozen) {
      // Skip — DoT still ticks below
    } else if (didDodge) {
      if (player.swirlDamage > 0) {
        const swirl = Math.floor(player.attack * (1 - bossDR) * 0.35 * player.swirlDamage);
        bossHp      -= swirl;
        totalDamage += swirl;
        procDamage  += swirl;
      }
    } else {
      const bv  = 0.8 + Math.random() * 0.4;
      let bd    = Math.floor(boss.attack * (1 - playerDR) * bv);
      if (bd < 1) bd = 1;
      playerHp -= bd;
      if (player.counterChance > 0 && Math.random() < player.counterChance) {
        const ct = Math.floor(player.attack * (1 - bossDR) * (player.counterDmgPct || 0.15));
        bossHp      -= ct;
        totalDamage += ct;
        procDamage  += ct;
      }
    }

    // DoT tick: boss turn (6pc SB only)
    if (player.decayBothTurns && decayStacks > 0 && playerHp > 0) {
      const sf  = player.decayEnergyScaleFactor || 0.5;
      const dps = player.decayBaseDmg + (player.decayEnergyScale ? player.energy * sf : 0);
      const dr  = dotArmorPiercing ? 1 : (1 - bossDR);
      const dot = Math.floor(decayStacks * dps * dr);
      dotDamage   += dot;
      totalDamage += dot;
      bossHp      -= dot;
      if (dotLifestealPct > 0) playerHp = Math.min(maxPlayerHp, playerHp + Math.floor(dot * dotLifestealPct));
    }
  }

  const directDamage = normalDamage + critDamage + procDamage;
  return {
    totalDamage, directDamage, dotDamage,
    normalDamage, critDamage, procDamage,
    hitCount, critCount,
    decayStacks, turnsPlayed,
    survived: playerHp > 0,
    finalHp: Math.max(0, playerHp),
    finalHpPct: maxPlayerHp > 0 ? Math.max(0, playerHp) / maxPlayerHp : 0
  };
}

// ─── Run N fights ─────────────────────────────────────────────────────────────
function runSuite(player, boss, n = 20, config = {}) {
  const results = [];
  for (let i = 0; i < n; i++) results.push(simulateFight(player, boss, 10, config));
  const avg = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
  const pct = (a, b) => b > 0 ? `${(a / b * 100).toFixed(1)}%` : 'N/A';

  const avgTotal  = Math.round(avg(results.map(r => r.totalDamage)));
  const avgNormal = Math.round(avg(results.map(r => r.normalDamage)));
  const avgCrit   = Math.round(avg(results.map(r => r.critDamage)));
  const avgProc   = Math.round(avg(results.map(r => r.procDamage)));
  const avgDot    = Math.round(avg(results.map(r => r.dotDamage)));
  const avgDirect = avgNormal + avgCrit + avgProc; // backward compat
  const avgTurns  = avg(results.map(r => r.turnsPlayed));

  const totalHits    = results.reduce((s, r) => s + r.hitCount, 0);
  const totalCrits   = results.reduce((s, r) => s + r.critCount, 0);
  const actualCritPct = totalHits > 0 ? `${(totalCrits / totalHits * 100).toFixed(1)}%` : '0%';

  return {
    avgTotal, avgNormal, avgCrit, avgProc, avgDot,
    avgDirect,
    normalPct:  pct(avgNormal, avgTotal),
    critPct:    pct(avgCrit,   avgTotal),
    procPct:    pct(avgProc,   avgTotal),
    dotPct:     pct(avgDot,    avgTotal),
    // legacy keys kept for comparison table compatibility
    dotShare:    pct(avgDot,    avgTotal),
    directShare: pct(avgDirect, avgTotal),
    avgTurns:     avgTurns.toFixed(1),
    avgDpt:       avgTurns > 0 ? Math.round(avgTotal / avgTurns) : 0,
    avgStacks:    avg(results.map(r => r.decayStacks)).toFixed(1),
    survivalRate: `${results.filter(r => r.survived).length}/${n}`,
    avgHpPct:     (avg(results.map(r => r.finalHpPct)) * 100).toFixed(0) + '%',
    actualCritPct,
  };
}

// ─── Config helper ────────────────────────────────────────────────────────────
function sbConfig(player) {
  return player.decayProcChance > 0
    ? { dotArmorPiercing: true, dotLifestealPct: 0.15 }
    : {};
}

module.exports = { ALL_SETS, THREE_PC, SUBSTAT_KEYS, SUBSTAT_PROFILES, DEFAULT_SUBPROFILE, FLEX_MAIN_POOL, DEFAULT_MAINS, getDR, getOffenseMult, getItemLevelMultiplier, calcSubStats, buildPlayer, buildMixedPlayer, simulateFight, runSuite, sbConfig };
