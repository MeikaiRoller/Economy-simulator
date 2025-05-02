const Item = require("../schema/Item");

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

  // 2. Then add the buffs from inventory items
  if (userProfile.inventory?.length) {
    for (const invItem of userProfile.inventory) {
      const itemData = await Item.findOne({ itemId: invItem.itemId });
      if (!itemData?.buffs) continue;

      for (const [buffName, value] of Object.entries(itemData.buffs)) {
        if (buffs[buffName] !== undefined) {
          buffs[buffName] += value * invItem.quantity;
        }
      }
    }
  }

  return buffs;
}

function createEmptyBuffs() {
  return {
    attack: 0,
    defense: 0,
    magic: 0,
    magicDefense: 0,
    critChance: 0,
    xpBoost: 0,
    healingBoost: 0,
    luck: 0,
    lootBoost: 0,
    findRateBoost: 0,
    cooldownReduction: 0,
  };
}

module.exports = calculateActiveBuffs;
