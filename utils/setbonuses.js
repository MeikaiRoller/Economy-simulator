// Set bonus definitions
// Last rebalance: 2026-03-06 — reduced Geo/Cryo dominance, normalized offensive reactions
const SET_BONUSES = {
  // Ethans Prowess (neutral attack) — slightly buffed to stay competitive
  "Ethans Prowess": {
    element: null,
    "2": { attack: 0.12 },
    "3": { attack: 0.18, defense: 0.06 },
    "6": { attack: 0.30, defense: 0.10, critRate: 6 }
  },
  // Olivias Fury (pyro) — slight buff on attack, proc trimmed
  "Olivias Fury": {
    element: "pyro",
    "2": { attack: 0.12 },
    "3": { attack: 0.18, procRate: 0.12 },
    "6": { attack: 0.28, procRate: 0.22, damageBonus: 0.12 }
  },
  // Justins Clapping (electro) — unchanged, energy builds are fair
  "Justins Clapping": {
    element: "electro",
    "2": { energy: 15 },
    "3": { energy: 25, critRate: 5 },
    "6": { energy: 50, critRate: 10, burstDamage: 0.25 }
  },
  // Lilahs Cold Heart (cryo) — NERFED: was giving too much crit for free on top of Geo defense
  "Lilahs Cold Heart": {
    element: "cryo",
    "2": { critRate: 6 },
    "3": { critRate: 10, critDMG: 12 },
    "6": { critRate: 16, critDMG: 26, freezeChance: 0.15 }
  },
  // Hasagi (anemo) — unchanged, utility build is fair
  "Hasagi": {
    element: "anemo",
    "2": { cooldownReduction: 8 },
    "3": { cooldownReduction: 15, dodge: 6 },
    "6": { cooldownReduction: 25, dodge: 15, swirlDamage: 0.20 }
  },
  // Maries Zhongli Bodypillow (geo) — NERFED: defense% values reduced, all tiers pulled back
  "Maries Zhongli Bodypillow": {
    element: "geo",
    "2": { defense: 0.10 },
    "3": { defense: 0.18, hp: 0.08 },
    "6": { defense: 0.30, hp: 0.15, counterChance: 0.08 }
  },
  // Andys Soraka (hydro) — slightly buffed, was underused
  "Andys Soraka": {
    element: "hydro",
    "2": { hp: 0.15 },
    "3": { hp: 0.25, healing: 0.20 },
    "6": { hp: 0.42, healing: 0.32, lifestealChance: 0.18 }
  },
  // Soulbound Ranked (null element) — DoT/stall set, trades burst for attrition via Decay stacks
  // Incremental tier deltas. At 6pc: total attackPenalty 0.30, decayProcChance 1.00, decayBaseDmg 5
  // DoT is armor-piercing (bypasses boss DR) and energy scales at 60%
  "Soulbound Ranked": {
    element: null,
    decayArmorPiercing: true,       // DoT ignores boss damage reduction
    decayEnergyScaleFactor: 0.6,    // energy * 0.6 added to dmg per stack
    decayLifestealPct: 0.15,        // 15% of each DoT tick heals the player
    "2": { attackPenalty: 0.20, decayProcChance: 0.50, decayBaseDmg: 3 },
    "3": { attackPenalty: 0.10, decayProcChance: 0.20, decayBaseDmg: 1 },
    "6": { attackPenalty: 0.00, decayProcChance: 0.30, decayBaseDmg: 1 }
    // decayEnergyScale (3pc+) and decayBothTurns (6pc only) are boolean flags
    // derived from piece count in calculateSetBonuses — not stored as tier values
  }
};

// Element resonance (when wearing 6 pieces of same set)
// Cryo/Geo resonances nerfed to match set bonus reductions
const ELEMENT_RESONANCE = {
  pyro: {
    name: "Pyro Resonance: Fervent Flames",
    damageBonus: 0.09,
    procRate: 0.12
  },
  electro: {
    name: "Electro Resonance: High Voltage",
    critDMG: 12,
    energyRegen: 18
  },
  cryo: {
    name: "Cryo Resonance: Shattering Ice",
    critRate: 5,   // Reduced from 6 — cryo 6pc total crit now 21% (was 26%)
    critDMG: 10    // Reduced from 12
  },
  anemo: {
    name: "Anemo Resonance: Impetuous Winds",
    dodge: 6,
    swirlDamage: 0.09
  },
  geo: {
    name: "Geo Resonance: Enduring Rock",
    defense: 0.07,       // Reduced from 0.09 — geo 6pc total defense now 37% (was 49%)
    counterDamage: 0.15  // Reduced from 0.18
  },
  hydro: {
    name: "Hydro Resonance: Soothing Water",
    hp: 0.09,
    lifesteal: 0.06
  }
};

// ====================================================================
// REACTION TOGGLE SYSTEM - Enable/Disable reactions for content updates
// ====================================================================
// Set to true to enable a reaction in combat
// Set to false to disable (will still show in UI but won't proc)

const REACTION_TOGGLES = {
  // ACTIVE REACTIONS (Currently enabled in game)
  "anemo-cryo": true,      // Cryo Swirl
  "anemo-hydro": true,     // Hydro Swirl
  "anemo-pyro": true,      // Pyro Swirl
  "cryo-electro": true,    // Superconduct
  "cryo-hydro": true,      // Freeze
  "cryo-pyro": true,       // Melt
  "electro-pyro": true,    // Overload
  "hydro-pyro": true,      // Vaporize
  
  // FUTURE REACTIONS (Planned for future patches)
  "anemo-electro": false,  // Electro Swirl - PATCH 1.1
  "anemo-geo": false,      // Geo Swirl - PATCH 1.2
  "cryo-geo": false,       // Crystallize (Cryo) - PATCH 1.2
  "electro-geo": false,    // Crystallize (Electro) - PATCH 1.2
  "electro-hydro": false,  // Electro-Charged - PATCH 1.1
  "hydro-geo": false,      // Crystallize (Hydro) - PATCH 1.2
  "pyro-geo": false        // Crystallize (Pyro) - PATCH 1.2
};

// Elemental reactions (when wearing 3+3 of different elements)
// Keys are alphabetically sorted for consistent lookup
const ELEMENTAL_REACTIONS = {
  "anemo-cryo": {
    name: "Cryo Swirl",
    effect: "Reflect 15% damage + reduce enemy dodge",
    reflectDamage: 0.15,
    procChance: 0.70
  },
  "anemo-hydro": {
    name: "Hydro Swirl",
    effect: "Reflect 15% damage + heal 8% of damage",
    reflectDamage: 0.15,
    healPercent: 0.08,
    procChance: 0.70
  },
  "anemo-pyro": {
    name: "Pyro Swirl",
    effect: "Reflect 15% damage to attacker",
    reflectDamage: 0.15,
    procChance: 0.70
  },
  "cryo-electro": {
    name: "Superconduct",
    effect: "Reduce enemy defense by 30% for 3 turns",
    defenseReduction: 0.30,   // Reduced from 0.40 — still impactful but not a 40% armor shred
    procChance: 0.75
  },
  "cryo-hydro": {
    name: "Freeze",
    effect: "40% chance to stun enemy for 1 turn",
    stunChance: 0.40,         // Reduced from 0.50
    procChance: 0.65
  },
  "cryo-pyro": {
    name: "Melt",
    effect: "Next attack deals 1.7x damage",
    damageMultiplier: 1.7,    // Reduced from 2.0 — was +40% avg damage, now +21%
    procChance: 0.65          // Reduced from 0.70
  },
  "electro-pyro": {
    name: "Overload",
    effect: "Add 65% of attack as bonus damage (ignores defense) + 35% stun chance",
    bonusDamage: 0.65,        // Reduced from 1.0 — was adding a full extra hit worth of damage
    stunChance: 0.35,         // Reduced from 0.50
    procChance: 0.75          // Reduced from 0.80
  },
  "hydro-pyro": {
    name: "Vaporize",
    effect: "Next attack deals 1.4x damage",
    damageMultiplier: 1.4,    // Reduced from 1.5 — was too consistent at 90% proc
    procChance: 0.80          // Reduced from 0.90
  },
  
  // ==========================================
  // UPDATE 1 REACTIONS (Disabled - Coming Soon)
  // ==========================================
  "anemo-electro": {
    name: "Electro Swirl",
    effect: "Reflect 15% damage + energy boost",
    reflectDamage: 0.15,
    energyBoost: 15,
    procChance: 0.70
  },
  "anemo-geo": {
    name: "Geo Swirl",
    effect: "Reflect 15% damage + 15% defense boost",
    reflectDamage: 0.15,
    statBuff: { type: 'defense', value: 0.15 },
    duration: 3,
    procChance: 0.70
  },
  "cryo-geo": {
    name: "Crystallize (Cryo)",
    effect: "Shield + 8% crit rate boost",
    shieldPercent: 0.20,
    statBuff: { type: 'critRate', value: 8 },
    duration: 3,
    procChance: 0.70
  },
  "electro-geo": {
    name: "Crystallize (Electro)",
    effect: "Shield + 15 energy boost",
    shieldPercent: 0.20,
    energyBoost: 15,
    duration: 3,
    procChance: 0.70
  },
  "electro-hydro": {
    name: "Electro-Charged",
    effect: "Continuous damage over time",
    dotDamage: 20,
    duration: 3,
    procChance: 0.80
  },
  "geo-hydro": {
    name: "Crystallize (Hydro)",
    effect: "Shield + 15% HP boost",
    shieldPercent: 0.20,
    statBuff: { type: 'hp', value: 0.15 },
    duration: 3,
    procChance: 0.70
  },
  "geo-pyro": {
    name: "Crystallize (Pyro)",
    effect: "Shield + 15% attack boost",
    shieldPercent: 0.20,
    statBuff: { type: 'attack', value: 0.15 },
    duration: 3,
    procChance: 0.70
  }
};

// Dual Element Mastery (when wearing exactly 3+3 of two different elements)
// Keys are alphabetically sorted for consistent lookup
// These bonuses compensate for the stat dilution of mixed sets
const DUAL_MASTERY = {
  "anemo-cryo": {
    name: "Cryo Swirl Mastery",
    critRate: 8,
    critDMG: 20,
    dodge: 8
  },
  "anemo-electro": {
    name: "Electro Swirl Mastery",
    energy: 30,
    dodge: 10,
    cooldownReduction: 12
  },
  "anemo-geo": {
    name: "Geo Swirl Mastery",
    defense: 0.15,
    dodge: 10,
    counterChance: 0.10
  },
  "anemo-hydro": {
    name: "Hydro Swirl Mastery",
    hp: 0.15,
    healing: 0.15,
    dodge: 8
  },
  "anemo-pyro": {
    name: "Pyro Swirl Mastery",
    attack: 0.12,
    dodge: 8,
    cooldownReduction: 10
  },
  "cryo-electro": {
    name: "Superconduct Mastery",
    attack: 0.10,
    critRate: 8,
    energy: 20
  },
  "cryo-geo": {
    name: "Cryo Crystallize Mastery",
    critRate: 5,        // Reduced from 8 — was giving free crit on top of Geo's defense wall
    defense: 0.08,      // Reduced from 0.15
    hp: 0.06            // Reduced from 0.10
  },
  "cryo-hydro": {
    name: "Freeze Mastery",
    critRate: 8,        // Reduced from 10
    critDMG: 20,        // Reduced from 25
    hp: 0.08            // Reduced from 0.10
  },
  "cryo-pyro": {
    name: "Melt Mastery",
    attack: 0.12,       // Reduced from 0.15 — reaction itself nerfed, mastery follows
    critDMG: 15,        // Reduced from 20
    damageBonus: 0.08   // Reduced from 0.10
  },
  "electro-geo": {
    name: "Electro Crystallize Mastery",
    defense: 0.15,
    energy: 20,
    counterChance: 0.08
  },
  "electro-hydro": {
    name: "Electro-Charged Mastery",
    hp: 0.15,
    energy: 25,
    healing: 0.12
  },
  "electro-pyro": {
    name: "Overload Mastery",
    attack: 0.12,
    critRate: 5,
    energy: 15
  },
  "geo-hydro": {
    name: "Hydro Crystallize Mastery",
    hp: 0.20,
    defense: 0.15,
    counterChance: 0.08
  },
  "geo-pyro": {
    name: "Pyro Crystallize Mastery",
    attack: 0.10,
    defense: 0.12,
    counterChance: 0.08
  },
  "hydro-pyro": {
    name: "Vaporize Mastery",
    attack: 0.15,
    hp: 0.10,
    damageBonus: 0.08
  }
};

/**
 * Get reaction key from two elements (order-independent)
 */
function getReactionKey(elem1, elem2) {
  if (!elem1 || !elem2 || elem1 === elem2) return null;
  // Always sort alphabetically for consistent key lookup
  return [elem1, elem2].sort().join('-');
}

/**
 * Calculate adaptive bonus for 3+3 builds based on combat style
 * Rewards builds that excel in specific stat categories
 */
function calculateAdaptiveBonus(rawStats) {
  const adaptiveBonuses = {
    name: "Adaptive Resonance",
    bonuses: {},
    triggers: []
  };
  
  // High Crit Build (50%+ crit rate) → Extra Crit Damage
  if (rawStats.critRate >= 50) {
    adaptiveBonuses.bonuses.critDMG = (adaptiveBonuses.bonuses.critDMG || 0) + 30;
    adaptiveBonuses.triggers.push("Critical Strike Master");
  }
  
  // High HP Build (1400+ HP, raised threshold) → Lifesteal & HP boost
  if (rawStats.hp >= 1400) {
    adaptiveBonuses.bonuses.lifesteal = (adaptiveBonuses.bonuses.lifesteal || 0) + 0.10;
    adaptiveBonuses.bonuses.hp = (adaptiveBonuses.bonuses.hp || 0) + 0.06;
    adaptiveBonuses.triggers.push("Fortified Vitality");
  }
  
  // High Dodge Build (10%+ dodge) → Counter damage & attack
  if (rawStats.dodge >= 10) {
    adaptiveBonuses.bonuses.counterDamage = (adaptiveBonuses.bonuses.counterDamage || 0) + 0.28;
    adaptiveBonuses.bonuses.attack = (adaptiveBonuses.bonuses.attack || 0) + 0.08;
    adaptiveBonuses.triggers.push("Evasive Striker");
  }
  
  // High Attack Build (350+ attack, raised threshold) → Damage bonus
  if (rawStats.attack >= 350) {
    adaptiveBonuses.bonuses.damageBonus = (adaptiveBonuses.bonuses.damageBonus || 0) + 0.10;
    adaptiveBonuses.bonuses.attack = (adaptiveBonuses.bonuses.attack || 0) + 0.07;
    adaptiveBonuses.triggers.push("Overwhelming Force");
  }
  
  // High Defense Build (240+ defense, raised threshold) → Defense & counter chance
  // Previously triggered at 180 which let Geo+Cryo compound their already-high defense
  if (rawStats.defense >= 240) {
    adaptiveBonuses.bonuses.defense = (adaptiveBonuses.bonuses.defense || 0) + 0.08;
    adaptiveBonuses.bonuses.counterChance = (adaptiveBonuses.bonuses.counterChance || 0) + 0.05;
    adaptiveBonuses.triggers.push("Impenetrable Wall");
  }
  
  // Balanced Build (3+ triggers) → All stats boost
  if (adaptiveBonuses.triggers.length >= 3) {
    adaptiveBonuses.bonuses.attack = (adaptiveBonuses.bonuses.attack || 0) + 0.05;
    adaptiveBonuses.bonuses.defense = (adaptiveBonuses.bonuses.defense || 0) + 0.05;
    adaptiveBonuses.bonuses.hp = (adaptiveBonuses.bonuses.hp || 0) + 0.05;
    adaptiveBonuses.triggers.push("⭐ VERSATILE BUILD");
  }
  
  return adaptiveBonuses.triggers.length > 0 ? adaptiveBonuses : null;
}

/**
 * Calculate set bonuses from equipped items
 * @param {Array} equippedItems - Array of equipped item documents
 * @returns {Object} Aggregated bonuses and active elements
 */
function calculateSetBonuses(equippedItems) {
  // Count pieces per set
  const setCounts = {};
  const elements = new Set();
  
  equippedItems.forEach(item => {
    if (item.setName) {
      setCounts[item.setName] = (setCounts[item.setName] || 0) + 1;
      if (item.element) {
        elements.add(item.element);
      }
    }
  });
  
  // Aggregate bonuses
  const bonuses = {
    attack: 0,
    defense: 0,
    hp: 0,
    critRate: 0,
    critDMG: 0,
    energy: 0,
    dodge: 0,
    cooldownReduction: 0,
    procRate: 0,
    damageBonus: 0,
    healing: 0,
    counterChance: 0,
    counterDamage: 0,
    lifesteal: 0,
    lifestealChance: 0,
    swirlDamage: 0,
    burstDamage: 0,
    freezeChance: 0,
    // Soulbound Ranked DoT properties (numeric, incremental across tiers)
    attackPenalty: 0,
    decayProcChance: 0,
    decayBaseDmg: 0
  };
  
  const activeSetBonuses = [];
  const activeElements = Array.from(elements);
  let elementalResonance = null;
  let elementalReaction = null;
  let dualMastery = null;
  let adaptiveBonus = null;
  
  // Calculate raw stats before bonuses for adaptive bonus calculation
  const rawStats = {
    attack: 0,
    defense: 0,
    hp: 0,
    critRate: 0,
    dodge: 0
  };
  
  equippedItems.forEach(item => {
    if (item.mainStat) {
      if (item.mainStat.type === 'attack') rawStats.attack += item.mainStat.value;
      else if (item.mainStat.type === 'defense') rawStats.defense += item.mainStat.value;
      else if (item.mainStat.type === 'hp') rawStats.hp += item.mainStat.value;
      else if (item.mainStat.type === 'critRate') rawStats.critRate += item.mainStat.value;
    }
    if (item.subStats) {
      item.subStats.forEach(sub => {
        if (sub.type === 'attack') rawStats.attack += sub.value;
        else if (sub.type === 'defense') rawStats.defense += sub.value;
        else if (sub.type === 'hp') rawStats.hp += sub.value;
        else if (sub.type === 'critRate') rawStats.critRate += sub.value;
      });
    }
  });
  
  // Apply set bonuses
  Object.entries(setCounts).forEach(([setName, count]) => {
    const setDef = SET_BONUSES[setName];
    if (!setDef) return;
    
    // Check for 2-piece
    if (count >= 2 && setDef["2"]) {
      Object.entries(setDef["2"]).forEach(([stat, value]) => {
        if (bonuses[stat] !== undefined) bonuses[stat] += value;
      });
      activeSetBonuses.push(`${setName} (2pc)`);
    }
    
    // Check for 3-piece (unlocks element)
    if (count >= 3 && setDef["3"]) {
      Object.entries(setDef["3"]).forEach(([stat, value]) => {
        if (bonuses[stat] !== undefined) bonuses[stat] += value;
      });
      activeSetBonuses.push(`${setName} (3pc)`);
    }
    
    // Check for 6-piece (pure set + resonance)
    if (count >= 6 && setDef["6"]) {
      Object.entries(setDef["6"]).forEach(([stat, value]) => {
        if (bonuses[stat] !== undefined) bonuses[stat] += value;
      });
      activeSetBonuses.push(`${setName} (6pc - FULL SET)`);
      
      // Apply element resonance
      if (setDef.element && ELEMENT_RESONANCE[setDef.element]) {
        const resonance = ELEMENT_RESONANCE[setDef.element];
        elementalResonance = resonance;
        
        // Apply resonance bonuses
        Object.entries(resonance).forEach(([key, value]) => {
          if (key !== 'name' && bonuses[key] !== undefined) {
            bonuses[key] += value;
          }
        });
      }
    }
  });
  
  // Build decay config for Soulbound Ranked (boolean flags derived from piece count)
  const soulboundCount = setCounts["Soulbound Ranked"] || 0;
  let decayConfig = null;
  if (soulboundCount >= 2) {
    const sbDef = SET_BONUSES["Soulbound Ranked"];
    decayConfig = {
      attackPenalty: bonuses.attackPenalty,
      decayProcChance: Math.min(1, bonuses.decayProcChance),
      decayBaseDmg: bonuses.decayBaseDmg,
      decayEnergyScale: soulboundCount >= 3,           // 3pc+: DoT scales with energy
      decayEnergyScaleFactor: sbDef.decayEnergyScaleFactor || 0.5,
      decayBothTurns: soulboundCount >= 6,             // 6pc only: DoT ticks on boss turn too
      decayArmorPiercing: sbDef.decayArmorPiercing || false,  // DoT ignores boss DR
      decayLifestealPct: sbDef.decayLifestealPct || 0         // fraction of DoT healed back
    };
  }

  // Check for elemental reaction (3+3 different elements)
  if (activeElements.length === 2) {
    const reactionKey = getReactionKey(activeElements[0], activeElements[1]);
    
    // Check if reaction exists AND is enabled
    if (reactionKey && ELEMENTAL_REACTIONS[reactionKey] && REACTION_TOGGLES[reactionKey]) {
      elementalReaction = ELEMENTAL_REACTIONS[reactionKey];
    }
    
    // Check if this is a 3+3 setup for dual mastery
    const setCounts3Plus = Object.entries(setCounts).filter(([_, count]) => count >= 3);
    if (setCounts3Plus.length === 2) {
      // Exactly 2 sets with 3+ pieces each = 3+3 dual element setup
      if (DUAL_MASTERY[reactionKey]) {
        dualMastery = DUAL_MASTERY[reactionKey];
        
        // Apply dual mastery bonuses
        Object.entries(dualMastery).forEach(([key, value]) => {
          if (key !== 'name' && bonuses[key] !== undefined) {
            bonuses[key] += value;
          }
        });
      }
      
      // Calculate and apply adaptive bonuses for 3+3 builds
      adaptiveBonus = calculateAdaptiveBonus(rawStats);
      if (adaptiveBonus) {
        Object.entries(adaptiveBonus.bonuses).forEach(([key, value]) => {
          if (bonuses[key] !== undefined) {
            bonuses[key] += value;
          }
        });
      }
    }
  }
  
  return {
    bonuses,
    activeSetBonuses,
    activeElements,
    elementalResonance,
    elementalReaction,
    dualMastery,
    adaptiveBonus,
    decayConfig
  };
}

module.exports = {
  SET_BONUSES,
  ELEMENT_RESONANCE,
  ELEMENTAL_REACTIONS,
  REACTION_TOGGLES,  // Export toggles for easy access
  DUAL_MASTERY,
  calculateSetBonuses,
  calculateAdaptiveBonus,
  getReactionKey
};
