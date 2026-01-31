const Item = require("../schema/Item");
const { calculateSetBonuses } = require("./setbonuses");

async function calculateActiveBuffs(userProfile) {
  const buffs = createEmptyBuffs();

  // 1. Add the user's level-based buffs first
  if (userProfile.buffs) {
    buffs.attack += userProfile.buffs.attackBoost || 0;
    buffs.defense += userProfile.buffs.defenseBoost || 0;
    buffs.magic += userProfile.buffs.magicBoost || 0;
    buffs.magicDefense += userProfile.buffs.magicDefenseBoost || 0;
    buffs.critChance += userProfile.buffs.criticalChance || 0;
    buffs.xpBoost += userProfile.buffs.xpBoost || 0;
    buffs.healingBoost += userProfile.buffs.healingBoost || 0;
    buffs.luck += userProfile.buffs.luckBoost || 0;
    buffs.lootBoost += userProfile.buffs.lootBoost || 0;
    buffs.findRateBoost += userProfile.buffs.findRateBoost || 0;
    buffs.cooldownReduction += userProfile.buffs.cooldownReduction || 0;
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
    adaptiveBonus: setBonusData.adaptiveBonus
  };

  // 4. Add buffs from individual items (main stat + sub-stats + legacy buffs)
  for (const itemData of equippedItems) {
    // New system: main stat
    if (itemData.mainStat?.type && itemData.mainStat?.value) {
      const statType = itemData.mainStat.type;
      if (statType === 'attack') buffs.attackFlat += itemData.mainStat.value;
      else if (statType === 'defense') buffs.defenseFlat += itemData.mainStat.value;
      else if (statType === 'hp') buffs.hpFlat += itemData.mainStat.value;
      else if (statType === 'critRate') buffs.critChance += itemData.mainStat.value;
      else if (statType === 'critDMG') buffs.critDMG += itemData.mainStat.value;
      else if (statType === 'energy') buffs.energy += itemData.mainStat.value;
    }
    
    // New system: sub-stats
    if (itemData.subStats?.length) {
      for (const subStat of itemData.subStats) {
        const statType = subStat.type;
        const value = subStat.value;
        
        if (statType === 'attack') buffs.attackFlat += value;
        else if (statType === 'attack%') buffs.attack += value / 100;
        else if (statType === 'defense') buffs.defenseFlat += value;
        else if (statType === 'defense%') buffs.defense += value / 100;
        else if (statType === 'hp') buffs.hpFlat += value;
        else if (statType === 'hp%') buffs.hpPercent += value / 100;
        else if (statType === 'critRate') buffs.critChance += value;
        else if (statType === 'critDMG') buffs.critDMG += value;
        else if (statType === 'energy') buffs.energy += value;
        else if (statType === 'luck') buffs.luck += value;
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
