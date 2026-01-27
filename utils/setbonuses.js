// Set bonus definitions
const SET_BONUSES = {
  "Ethans Prowess": {
    element: null,
    "2": { attack: 0.15 },
    "3": { attack: 0.25, defense: 0.10 },
    "6": { attack: 0.50, defense: 0.25, critRate: 10 }
  },
  "Olivias Fury": {
    element: "pyro",
    "2": { attack: 0.15 },
    "3": { attack: 0.20, procRate: 0.30 },
    "6": { attack: 0.50, procRate: 0.60, damageBonus: 0.25 }
  },
  "Justins Clapping": {
    element: "electro",
    "2": { energy: 20 },
    "3": { energy: 40, critRate: 8 },
    "6": { energy: 80, critRate: 20, burstDamage: 0.40 }
  },
  "Lilahs Cold Heart": {
    element: "cryo",
    "2": { critRate: 10 },
    "3": { critRate: 20, critDMG: 20 },
    "6": { critRate: 40, critDMG: 60, freezeChance: 0.20 }
  },
  "Hasagi": {
    element: "anemo",
    "2": { cooldownReduction: 10 },
    "3": { cooldownReduction: 20, dodge: 10 },
    "6": { cooldownReduction: 40, dodge: 25, swirlDamage: 0.30 }
  },
  "Maries Zhongli Bodypillow": {
    element: "geo",
    "2": { defense: 0.20 },
    "3": { defense: 0.35, hp: 0.15 },
    "6": { defense: 0.60, hp: 0.30, counterChance: 0.15 }
  },
  "Andys Soraka": {
    element: "hydro",
    "2": { hp: 0.20 },
    "3": { hp: 0.35, healing: 0.25 },
    "6": { hp: 0.60, healing: 0.50, lifestealChance: 0.20 }
  }
};

// Element resonance (when wearing 6 pieces of same set)
const ELEMENT_RESONANCE = {
  pyro: {
    name: "Pyro Resonance: Fervent Flames",
    damageBonus: 0.25,
    procRate: 0.30
  },
  electro: {
    name: "Electro Resonance: High Voltage",
    critDMG: 30,
    energyRegen: 50
  },
  cryo: {
    name: "Cryo Resonance: Shattering Ice",
    critRate: 15,
    critDMG: 30
  },
  anemo: {
    name: "Anemo Resonance: Impetuous Winds",
    dodge: 15,
    swirlDamage: 0.25
  },
  geo: {
    name: "Geo Resonance: Enduring Rock",
    defense: 0.25,
    counterDamage: 0.50
  },
  hydro: {
    name: "Hydro Resonance: Soothing Water",
    hp: 0.25,
    lifesteal: 0.15
  }
};

// Elemental reactions (when wearing 3+3 of different elements)
const ELEMENTAL_REACTIONS = {
  "pyro-hydro": {
    name: "Vaporize",
    effect: "Next attack deals 1.5x damage",
    damageMultiplier: 1.5,
    procChance: 0.25
  },
  "pyro-electro": {
    name: "Overload",
    effect: "Bonus AoE damage + 15% stun chance",
    bonusDamage: 50,
    stunChance: 0.15,
    procChance: 0.20
  },
  "hydro-cryo": {
    name: "Freeze",
    effect: "20% chance to stun enemy for 1 turn",
    stunChance: 0.20,
    procChance: 0.15
  },
  "electro-cryo": {
    name: "Superconduct",
    effect: "Reduce enemy defense by 30% for 3 turns",
    defenseReduction: 0.30,
    duration: 3,
    procChance: 0.20
  },
  "anemo-pyro": {
    name: "Pyro Swirl",
    effect: "10% damage reflected to attacker",
    reflectDamage: 0.10,
    procChance: 0.15
  },
  "anemo-hydro": {
    name: "Hydro Swirl",
    effect: "10% damage reflected + heal 5% of damage",
    reflectDamage: 0.10,
    healPercent: 0.05,
    procChance: 0.15
  },
  "anemo-electro": {
    name: "Electro Swirl",
    effect: "10% damage reflected + energy boost",
    reflectDamage: 0.10,
    energyBonus: 10,
    procChance: 0.15
  },
  "anemo-cryo": {
    name: "Cryo Swirl",
    effect: "10% damage reflected + slow (reduced dodge)",
    reflectDamage: 0.10,
    dodgeReduction: 0.10,
    procChance: 0.15
  },
  "anemo-geo": {
    name: "Geo Swirl",
    effect: "10% damage reflected + shield (defense boost)",
    reflectDamage: 0.10,
    defenseBonus: 0.15,
    procChance: 0.15
  },
  "geo-pyro": {
    name: "Crystallize (Pyro)",
    effect: "Shield absorbs damage + attack boost",
    shieldPercent: 0.10,
    attackBonus: 0.10,
    procChance: 0.15
  },
  "geo-hydro": {
    name: "Crystallize (Hydro)",
    effect: "Shield absorbs damage + HP boost",
    shieldPercent: 0.10,
    hpBonus: 0.10,
    procChance: 0.15
  },
  "geo-electro": {
    name: "Crystallize (Electro)",
    effect: "Shield absorbs damage + energy boost",
    shieldPercent: 0.10,
    energyBonus: 15,
    procChance: 0.15
  },
  "geo-cryo": {
    name: "Crystallize (Cryo)",
    effect: "Shield absorbs damage + crit rate boost",
    shieldPercent: 0.10,
    critRateBonus: 5,
    procChance: 0.15
  },
  "hydro-electro": {
    name: "Electro-Charged",
    effect: "Continuous damage over time",
    dotDamage: 15,
    duration: 3,
    procChance: 0.20
  },
  "pyro-cryo": {
    name: "Melt",
    effect: "Next attack deals 2x damage",
    damageMultiplier: 2.0,
    procChance: 0.15
  }
};

/**
 * Get reaction key from two elements (order-independent)
 */
function getReactionKey(elem1, elem2) {
  if (!elem1 || !elem2 || elem1 === elem2) return null;
  return [elem1, elem2].sort().join('-');
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
    freezeChance: 0
  };
  
  const activeSetBonuses = [];
  const activeElements = Array.from(elements);
  let elementalResonance = null;
  let elementalReaction = null;
  
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
  
  // Check for elemental reaction (3+3 different elements)
  if (activeElements.length === 2) {
    const reactionKey = getReactionKey(activeElements[0], activeElements[1]);
    if (reactionKey && ELEMENTAL_REACTIONS[reactionKey]) {
      elementalReaction = ELEMENTAL_REACTIONS[reactionKey];
    }
  }
  
  return {
    bonuses,
    activeSetBonuses,
    activeElements,
    elementalResonance,
    elementalReaction
  };
}

module.exports = {
  SET_BONUSES,
  ELEMENT_RESONANCE,
  ELEMENTAL_REACTIONS,
  calculateSetBonuses,
  getReactionKey
};
