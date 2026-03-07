/**
 * Elemental Reaction System - Modular Processor
 * 
 * This module handles ALL elemental reaction logic across all combat modes.
 * To add new reactions, simply update setbonuses.js - no need to modify combat code!
 * 
 * Usage:
 *   const result = applyElementalReaction(baseDamage, reactionData);
 *   damage = result.damage;
 *   procMessages = result.procs;
 *   if (result.effects.stun) enemyStunned = true;
 */

/**
 * Apply elemental reaction effects to damage
 * @param {number} baseDamage - The base damage before reaction
 * @param {object} reactionData - Reaction config from setbonuses.js (from buffs.setInfo.elementalReaction)
 * @param {object} attacker - Attacker stats (optional, for future use)
 * @param {object} defender - Defender stats (optional, for future use)
 * @returns {object} { damage: number, procs: string[], effects: object }
 */
function applyElementalReaction(baseDamage, reactionData, attacker = null, defender = null, procBonus = 0) {
  // No reaction data = no reaction
  if (!reactionData) {
    return { 
      damage: baseDamage, 
      procs: [], 
      effects: {} 
    };
  }

  // Roll for proc chance — energy stat adds a bonus on top of the base reaction proc chance
  const procChance = Math.min(1, (reactionData.procChance || 0.15) + procBonus);
  if (Math.random() >= procChance) {
    return { 
      damage: baseDamage, 
      procs: [], 
      effects: {} 
    };
  }

  let finalDamage = baseDamage;
  let procs = [];
  let effects = {};

  // ====================================
  // DAMAGE MULTIPLIERS (Melt, Vaporize)
  // ====================================
  if (reactionData.damageMultiplier) {
    finalDamage = Math.floor(finalDamage * reactionData.damageMultiplier);
    procs.push(`🌟 ${reactionData.name}`);
  }

  // ====================================
  // BONUS SCALED DAMAGE (Overload)
  // Scales with attacker's attack stat, ignores defense
  // ====================================
  if (reactionData.bonusDamage && attacker) {
    const bonusDmg = Math.floor(attacker.attack * reactionData.bonusDamage);
    finalDamage += bonusDmg;
    procs.push(`⚡ ${reactionData.name}`);
  }

  // ====================================
  // STUN EFFECTS (Overload, Freeze)
  // ====================================
  if (reactionData.stunChance) {
    if (Math.random() < reactionData.stunChance) {
      effects.stun = true;
      procs.push(`💫 ${reactionData.name} STUN`);
    }
  }

  // ====================================
  // REFLECT DAMAGE (Swirl Reactions) - Update 1
  // ====================================
  if (reactionData.reflectDamage) {
    effects.reflect = {
      percent: reactionData.reflectDamage,
      name: reactionData.name
    };
    procs.push(`🔄 ${reactionData.name}`);
  }

  // ====================================
  // HEALING (Hydro Swirl) - Update 1
  // ====================================
  if (reactionData.healPercent) {
    effects.heal = {
      percent: reactionData.healPercent,
      name: reactionData.name
    };
  }

  // ====================================
  // DEFENSE REDUCTION (Superconduct) - Update 1
  // ====================================
  if (reactionData.defenseReduction) {
    effects.defenseReduction = {
      percent: reactionData.defenseReduction,
      duration: reactionData.duration || 3,
      name: reactionData.name
    };
    procs.push(`🔻 ${reactionData.name} DEF-`);
  }

  // ====================================
  // DAMAGE OVER TIME (Electro-Charged) - Update 1
  // ====================================
  if (reactionData.dotDamage) {
    effects.dot = {
      damage: reactionData.dotDamage,
      duration: reactionData.duration || 3,
      name: reactionData.name
    };
    procs.push(`⚡ ${reactionData.name} DoT`);
  }

  // ====================================
  // SHIELDS (Crystallize) - Update 1
  // ====================================
  if (reactionData.shieldPercent) {
    effects.shield = {
      percent: reactionData.shieldPercent,
      duration: reactionData.duration || 3,
      name: reactionData.name
    };
    procs.push(`🛡️ ${reactionData.name} SHIELD`);
  }

  // ====================================
  // STAT BUFFS (Crystallize) - Update 1
  // ====================================
  if (reactionData.statBuff) {
    effects.buff = {
      type: reactionData.statBuff.type, // 'attack', 'hp', 'energy', 'critRate'
      value: reactionData.statBuff.value,
      duration: reactionData.duration || 3,
      name: reactionData.name
    };
    procs.push(`📈 ${reactionData.name} BUFF`);
  }

  // ====================================
  // ENERGY BOOST (Electro reactions) - Update 1
  // ====================================
  if (reactionData.energyBoost) {
    effects.energy = {
      amount: reactionData.energyBoost,
      name: reactionData.name
    };
  }

  return {
    damage: finalDamage,
    procs,
    effects
  };
}

module.exports = {
  applyElementalReaction
};
