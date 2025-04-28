const Item = require("../schema/Item");

async function calculateActiveBuffs(userProfile) {
  if (!userProfile?.inventory?.length) {
    return createEmptyBuffs();
  }

  const buffs = createEmptyBuffs();

  for (const invItem of userProfile.inventory) {
    const itemData = await Item.findOne({ itemId: invItem.itemId });
    if (!itemData?.buffs) continue;

    for (const [buffName, value] of Object.entries(itemData.buffs)) {
      if (buffs[buffName] !== undefined) {
        buffs[buffName] += value * invItem.quantity;
      }
    }
  }

  return buffs;
}

function createEmptyBuffs() {
  return {
    attack: 1,
    defense: 1,
    magic: 1,
    magicDefense: 1,
    critChance: 1,
    xpBoost: 1,
    healingBoost: 1,
    luck: 1,
    lootBoost: 1,
    findRateBoost: 1,
    cooldownReduction: 1,
  };
}

module.exports = calculateActiveBuffs;
