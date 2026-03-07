const Item = require("../schema/Item");
const { calculateSetBonuses } = require("./setbonuses");

async function calculateActiveBuffs(userProfile) {
  const buffs = createEmptyBuffs();

  const normalizePercent = (value) => {
    if (value === undefined || value === null) return 0;
    const num = Number(value) || 0;
    // Legacy data stored as whole-number percentages (e.g., 25 for 25%).
    // If value is > 1, assume it is a percent and convert to a decimal.
    return num > 1 ? num / 100 : num;
  };

  const clamp = (value, min, max) => {
    return Math.max(min, Math.min(max, value));
  };

  // 1. Add the user's level-based buffs first
  if (userProfile.buffs) {
    buffs.attack += clamp(normalizePercent(userProfile.buffs.attackBoost), 0, 5);
    buffs.defense += clamp(normalizePercent(userProfile.buffs.defenseBoost), 0, 5);
    buffs.magic += clamp(normalizePercent(userProfile.buffs.magicBoost), 0, 5);
    buffs.magicDefense += clamp(normalizePercent(userProfile.buffs.magicDefenseBoost), 0, 5);
    buffs.critChance += clamp(userProfile.buffs.criticalChance || 0, 0, 100);
    buffs.xpBoost += clamp(normalizePercent(userProfile.buffs.xpBoost), 0, 10);
    buffs.healingBoost += clamp(normalizePercent(userProfile.buffs.healingBoost), 0, 5);
    buffs.luck += clamp(normalizePercent(userProfile.buffs.luckBoost), 0, 5);
    buffs.lootBoost += clamp(normalizePercent(userProfile.buffs.lootBoost), 0, 10);
    buffs.findRateBoost += clamp(normalizePercent(userProfile.buffs.findRateBoost), 0, 10);
    buffs.cooldownReduction += clamp(normalizePercent(userProfile.buffs.cooldownReduction), 0, 1);
  }

  // 2. Get equipped items
  const equippedItems = [];
  if (userProfile.equipped) {
    const equippedItemIds = Object.values(userProfile.equipped).filter(Boolean);
    
    for (const itemId of equippedItemIds) {
      const itemData = await Item.findOne({ itemId });
      if (itemData) {
        equippedItems.push(itemData);
      }
    }
  }

  // 3. Calculate set bonuses and elemental reactions
  const setBonusData = calculateSetBonuses(equippedItems);
  
  // Store set bonus info for combat display
  buffs.setInfo = {
    activeSetBonuses: setBonusData.activeSetBonuses,
    activeElements: setBonusData.activeElements,
    elementalResonance: setBonusData.elementalResonance,
    elementalReaction: setBonusData.elementalReaction,
    dualMastery: setBonusData.dualMastery,
    adaptiveBonus: setBonusData.adaptiveBonus,
    decayConfig: setBonusData.decayConfig || null
  };

  // 4. Add buffs from individual items (main stat + sub-stats + legacy buffs)
  for (const itemData of equippedItems) {
    // Calculate level bonus multiplier
    const itemLevel = itemData.level || 0;
    let levelBonusPercent = 0;
    for (let i = 1; i <= itemLevel; i++) {
      if (i <= 5) levelBonusPercent += 2;
      else if (i <= 10) levelBonusPercent += 3;
      else levelBonusPercent += 4;
    }
    const levelMultiplier = 1 + (levelBonusPercent / 100);
    
    // Main stat scales with item level — this is the primary reward for upgrading
    if (itemData.mainStat?.type && itemData.mainStat?.value) {
      const statType = itemData.mainStat.type;
      const boostedValue = itemData.mainStat.value * levelMultiplier;
      if (statType === 'attack') buffs.attackFlat += boostedValue;
      else if (statType === 'defense') buffs.defenseFlat += boostedValue;
      else if (statType === 'hp') buffs.hpFlat += boostedValue;
      else if (statType === 'hp%') buffs.hpPercent += boostedValue / 100;
      else if (statType === 'critRate') buffs.critChance += boostedValue;
      else if (statType === 'critDMG') buffs.critDMG += boostedValue;
      else if (statType === 'energy') buffs.energy += boostedValue;
    }
    
    // Sub-stats are fixed at their rolled values — upgrading does NOT inflate them.
    // Their value comes entirely from roll quality (rarity + luck at unlock thresholds).
    if (itemData.subStats?.length) {
      for (const subStat of itemData.subStats) {
        const statType = subStat.type;
        const rawValue = subStat.value; // intentionally not multiplied by levelMultiplier
        
        if (statType === 'attack') buffs.attackFlat += rawValue;
        else if (statType === 'attack%') buffs.attack += rawValue / 100;
        else if (statType === 'defense') buffs.defenseFlat += rawValue;
        else if (statType === 'defense%') buffs.defense += rawValue / 100;
        else if (statType === 'hp') buffs.hpFlat += rawValue;
        else if (statType === 'hp%') buffs.hpPercent += rawValue / 100;
        else if (statType === 'critRate') buffs.critChance += rawValue;
        else if (statType === 'critDMG') buffs.critDMG += rawValue;
        else if (statType === 'energy') buffs.energy += rawValue;
        else if (statType === 'luck') buffs.luck += rawValue;
      }
    }
    
    // Legacy system: old buff format (for backwards compatibility)
    if (itemData.buffs) {
      for (const [buffName, value] of Object.entries(itemData.buffs)) {
        if (buffName === 'attack') buffs.attack += value;
        else if (buffName === 'defense') buffs.defense += value;
        else if (buffName === 'critChance') buffs.critChance += value;
        else if (buffs[buffName] !== undefined) {
          buffs[buffName] += value;
        }
      }
    }
  }

  // 5. Apply set bonuses
  const setBonuses = setBonusData.bonuses;
  buffs.attack += setBonuses.attack || 0;
  buffs.defense += setBonuses.defense || 0;
  buffs.hpPercent += setBonuses.hp || 0;
  buffs.critChance += setBonuses.critRate || 0;
  buffs.critDMG += setBonuses.critDMG || 0;
  buffs.energy += setBonuses.energy || 0;
  buffs.dodge += setBonuses.dodge || 0;
  buffs.cooldownReduction += setBonuses.cooldownReduction || 0;
  buffs.procRate += setBonuses.procRate || 0;
  buffs.damageBonus += setBonuses.damageBonus || 0;
  buffs.healingBoost += setBonuses.healing || 0;
  buffs.counterChance += setBonuses.counterChance || 0;
  buffs.counterDamage += setBonuses.counterDamage || 0;
  buffs.lifesteal += setBonuses.lifesteal || 0;
  buffs.lifestealChance += setBonuses.lifestealChance || 0;
  // 6. Final safeguard clamps to prevent extreme values
  buffs.attack = clamp(buffs.attack, 0, 10);
  buffs.defense = clamp(buffs.defense, 0, 20);
  buffs.hpPercent = clamp(buffs.hpPercent, 0, 20);
  // Crit caps: 85% rate (guaranteed crits above this add no value, creates runaway scaling),
  // 350% critDMG (base 100% + 250% from gear = still devastating but not infinite).
  buffs.critChance = clamp(buffs.critChance, 0, 85);
  buffs.critDMG = clamp(buffs.critDMG, 0, 350);
  buffs.dodge = clamp(buffs.dodge, 0, 50);
  buffs.lifesteal = clamp(buffs.lifesteal, 0, 100);
  buffs.attackFlat = clamp(buffs.attackFlat, 0, 8000);
  buffs.defenseFlat = clamp(buffs.defenseFlat, 0, 8000);
  buffs.hpFlat = clamp(buffs.hpFlat, 0, 50000);

  // Convert energy into proc rate bonus: every 10 energy = +1% proc chance, hard cap 25%.
  // Stored as a 0-1 decimal to match procChance in elementalReactions.js.
  buffs.procRate = clamp((buffs.procRate || 0) + (buffs.energy || 0) / 1000, 0, 0.25);

  return buffs;
}

function createEmptyBuffs() {
  return {
    // Percentage multipliers
    attack: 0,
    defense: 0,
    hpPercent: 0,
    
    // Flat bonuses
    attackFlat: 0,
    defenseFlat: 0,
    hpFlat: 0,
    
    // Crit system
    critChance: 0,
    critDMG: 0,
    
    // Other stats
    energy: 0,
    dodge: 0,
    magic: 0,
    magicDefense: 0,
    xpBoost: 0,
    healingBoost: 0,
    luck: 0,
    lootBoost: 0,
    findRateBoost: 0,
    cooldownReduction: 0,
    
    // Set bonus specific
    procRate: 0,
    damageBonus: 0,
    counterChance: 0,
    counterDamage: 0,
    lifesteal: 0,
    lifestealChance: 0,
    
    // Set info (for display and combat)
    setInfo: {
      activeSetBonuses: [],
      activeElements: [],
      elementalResonance: null,
      elementalReaction: null
    }
  };
}

module.exports = calculateActiveBuffs;
