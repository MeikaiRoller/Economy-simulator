const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const UserProfile = require("../../schema/UserProfile");
const Item = require("../../schema/Item");
const calculateActiveBuffs = require("../../utils/calculateBuffs");

const RARITY_COLORS = {
  Common: 0x808080,
  Uncommon: 0x1eff00,
  Rare: 0x0070dd,
  Epic: 0xa335ee,
  Legendary: 0xff8000,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("inv")
    .setDescription("Inventory commands")
    .addSubcommand((sub) =>
      sub.setName("view").setDescription("View your inventory and equipment")
    )
    .addSubcommand((sub) =>
      sub
        .setName("loadout")
        .setDescription("View your equipped gear and combat stats")
    )
    .addSubcommand((sub) =>
      sub
        .setName("equip")
        .setDescription("Equip an item")
        .addStringOption((opt) =>
          opt
            .setName("item")
            .setDescription("Item position number from /inv view (e.g., 1, 2, 3)")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("unequip")
        .setDescription("Unequip an item from a slot")
        .addStringOption((opt) =>
          opt
            .setName("slot")
            .setDescription("Slot to unequip (weapon, head, chest, hands, feet, accessory)")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("sell")
        .setDescription("Sell an item or all items of a rarity")
        .addStringOption((opt) =>
          opt
            .setName("item")
            .setDescription("Item position number from /inv view")
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName("rarity")
            .setDescription("Sell all items of this rarity")
            .setRequired(false)
            .addChoices(
              { name: "Common", value: "Common" },
              { name: "Uncommon", value: "Uncommon" },
              { name: "Rare", value: "Rare" },
              { name: "Epic", value: "Epic" },
              { name: "Legendary", value: "Legendary" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("inspect")
        .setDescription("Inspect an item in your inventory")
        .addStringOption((opt) =>
          opt
            .setName("item")
            .setDescription("Item position number (or slot name: weapon/head/chest/hands/feet/accessory)")
            .setRequired(true)
        )
    ),

  run: async ({ interaction }) => {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "❌ You can only use inventory commands inside a server!",
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "view") {
      return handleView(interaction);
    }
    if (subcommand === "loadout") {
      return handleLoadout(interaction);
    }
    if (subcommand === "equip") {
      return handleEquip(interaction);
    }
    if (subcommand === "unequip") {
      return handleUnequip(interaction);
    }
    if (subcommand === "sell") {
      return handleSell(interaction);
    }
    if (subcommand === "inspect") {
      return handleInspect(interaction);
    }
  },
};

async function handleView(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.user.id;
  const user = await UserProfile.findOne({ userId });

  if (!user) {
    return interaction.editReply("❌ You need a profile first! Use `/createprofile` to get started.");
  }

  const allItems = await Item.find({});

  // Build equipped summary
  let equippedText = "";
  if (user.equipped && typeof user.equipped === 'object') {
    for (const [slot, itemId] of Object.entries(user.equipped)) {
      if (itemId) {
        const item = allItems.find((i) => i.itemId === itemId);
        equippedText += `**${slot.charAt(0).toUpperCase() + slot.slice(1)}:** ${
          item?.emoji || "📦"
        } ${item?.name || itemId}\n`;
      }
    }
  }

  // Prepare inventory items
  const inventoryItems = [];
  if (user.inventory && Array.isArray(user.inventory)) {
    user.inventory.forEach((invItem, index) => {
      const item = allItems.find((i) => i.itemId === invItem.itemId);
      if (item) {
        const rarity = item.rarity || "Common";
        inventoryItems.push({
          text: `**${index + 1}.** ${item.emoji} **${item.name}** (${rarity}) x${invItem.quantity} — ${item.itemId}`,
          item: item,
          position: index + 1
        });
      }
    });
  }

  // Pagination settings
  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(inventoryItems.length / ITEMS_PER_PAGE));
  let currentPage = 0;

  const generateEmbed = (page) => {
    const start = page * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageItems = inventoryItems.slice(start, end);
    
    const inventoryValue = pageItems.length > 0 
      ? pageItems.map(i => i.text).join('\n')
      : "No items";
    
    const equippedValue = (equippedText && equippedText.trim()) || "Nothing equipped";

    return new EmbedBuilder()
      .setTitle(`🎒 ${interaction.user.username}'s Inventory`)
      .addFields(
        {
          name: "⚙️ Equipped",
          value: equippedValue,
          inline: false,
        },
        {
          name: `📦 Items (Page ${page + 1}/${totalPages})`,
          value: inventoryValue,
          inline: false,
        }
      )
      .setColor(0x3498db)
      .setFooter({ text: `Total items: ${inventoryItems.length}` })
      .setTimestamp();
  };

  const generateButtons = (page) => {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('inv_prev')
        .setLabel('◀ Previous')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId('inv_next')
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page >= totalPages - 1)
    );
  };

  const message = await interaction.editReply({
    embeds: [generateEmbed(currentPage)],
    components: totalPages > 1 ? [generateButtons(currentPage)] : []
  });

  if (totalPages <= 1) return;

  // Button collector
  const collector = message.createMessageComponentCollector({
    filter: (i) => i.user.id === userId,
    time: 300000 // 5 minutes
  });

  collector.on('collect', async (i) => {
    if (i.customId === 'inv_prev') {
      currentPage = Math.max(0, currentPage - 1);
    } else if (i.customId === 'inv_next') {
      currentPage = Math.min(totalPages - 1, currentPage + 1);
    }

    await i.update({
      embeds: [generateEmbed(currentPage)],
      components: [generateButtons(currentPage)]
    });
  });

  collector.on('end', () => {
    interaction.editReply({ components: [] }).catch(() => {});
  });
}

async function handleEquip(interaction) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const itemInput = interaction.options.getString("item");
  const user = await UserProfile.findOne({ userId });

  if (!user) {
    return interaction.editReply("❌ You need a profile first!");
  }

  let itemId;
  let invItem;

  // Equip by position number
  const position = parseInt(itemInput, 10);
  if (Number.isNaN(position) || position <= 0) {
    return interaction.editReply("❌ Please provide a valid item position number from `/inv view`. ");
  }
  if (!user.inventory || position > user.inventory.length) {
    return interaction.editReply(`❌ Invalid position! You only have ${user.inventory?.length || 0} items in your inventory.`);
  }
  invItem = user.inventory[position - 1];
  itemId = invItem.itemId;

  const item = await Item.findOne({ itemId });
  if (!item || item.type !== "equippable") {
    return interaction.editReply("❌ That item cannot be equipped!");
  }

  const slot = item.slot;
  if (!slot) {
    return interaction.editReply("❌ That item has no slot assigned!");
  }

  // Equip the new item (old item in slot is simply replaced)
  user.equipped[slot] = itemId;

  await user.save();

  return interaction.editReply(
    `✅ Equipped **${item.name}** to your **${slot}** slot!`
  );
}

async function handleUnequip(interaction) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const slotInput = interaction.options.getString("slot").toLowerCase();
  const user = await UserProfile.findOne({ userId });

  if (!user) {
    return interaction.editReply("❌ You need a profile first!");
  }

  // Validate slot
  const validSlots = ["weapon", "head", "chest", "hands", "feet", "accessory"];
  if (!validSlots.includes(slotInput)) {
    return interaction.editReply(
      `❌ Invalid slot! Valid slots are: **${validSlots.join(", ")}**`
    );
  }

  const itemId = user.equipped[slotInput];
  if (!itemId) {
    return interaction.editReply(`❌ You don't have anything equipped in **${slotInput}**!`);
  }

  const item = await Item.findOne({ itemId });
  user.equipped[slotInput] = null;

  await user.save();

  return interaction.editReply(
    `✅ Unequipped **${item?.name || itemId}** from your **${slotInput}** slot.`
  );
}

async function handleSell(interaction) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const itemIdInput = interaction.options.getString("item");
  const rarityInput = interaction.options.getString("rarity");
  const user = await UserProfile.findOne({ userId });

  if (!user) {
    return interaction.editReply("❌ You need a profile first!");
  }

  // Check if user provided either item or rarity
  if (!itemIdInput && !rarityInput) {
    return interaction.editReply("❌ Please specify either an item ID or a rarity to sell!");
  }

  if (itemIdInput && rarityInput) {
    return interaction.editReply("❌ Please specify either an item ID OR a rarity, not both!");
  }

  // Handle mass sell by rarity
  if (rarityInput) {
    return handleMassSellByRarity(interaction, user, rarityInput);
  }

  // Handle single item sell (by position number)
  const position = parseInt(itemIdInput, 10);
  if (Number.isNaN(position) || position <= 0) {
    return interaction.editReply("❌ Please provide a valid item position number from `/inv view`.");
  }
  if (!user.inventory || position > user.inventory.length) {
    return interaction.editReply(`❌ Invalid position! You only have ${user.inventory?.length || 0} items in your inventory.`);
  }

  const invItem = user.inventory[position - 1];
  const itemId = invItem.itemId;
  if (!invItem) {
    return interaction.editReply("❌ You don't have that item!");
  }

  const item = await Item.findOne({ itemId });
  if (!item || !item.price) {
    return interaction.editReply("❌ That item cannot be sold!");
  }

  // Check if item is equipped
  const isEquipped = Object.values(user.equipped).includes(itemId);
  if (isEquipped) {
    return interaction.editReply(
      `❌ You cannot sell **${item.name}** while it's equipped! Use \`/inv unequip\` first.`
    );
  }

  const sellPrice = Math.floor(item.price * 0.5); // Sell for 50% of price
  user.balance += sellPrice;
  invItem.quantity -= 1;
  if (invItem.quantity <= 0) {
    user.inventory = user.inventory.filter((i) => i.quantity > 0);
  }

  await user.save();

  return interaction.editReply(
    `✅ Sold **${item.name}** for **$${sellPrice.toLocaleString()}**!`
  );
}

async function handleMassSellByRarity(interaction, user, rarity) {
  const allItems = await Item.find({});
  
  // Get all equipped item IDs
  const equippedItemIds = new Set(Object.values(user.equipped).filter(Boolean));
  
  // Find all items of the specified rarity that are not equipped
  const itemsToSell = [];
  let totalValue = 0;
  let totalCount = 0;
  
  for (const invItem of user.inventory) {
    const item = allItems.find((i) => i.itemId === invItem.itemId);
    if (item && item.rarity === rarity && item.price) {
      // Skip if item is equipped
      if (equippedItemIds.has(invItem.itemId)) {
        continue;
      }
      
      const sellPrice = Math.floor(item.price * 0.5) * invItem.quantity;
      totalValue += sellPrice;
      totalCount += invItem.quantity;
      itemsToSell.push(invItem.itemId);
    }
  }
  
  if (itemsToSell.length === 0) {
    return interaction.editReply(
      `❌ You don't have any sellable **${rarity}** items in your inventory!`
    );
  }
  
  // Remove sold items from inventory
  user.inventory = user.inventory.filter((i) => !itemsToSell.includes(i.itemId));
  user.balance += totalValue;
  
  await user.save();
  
  return interaction.editReply(
    `✅ Sold **${totalCount}** **${rarity}** item(s) for **$${totalValue.toLocaleString()}**!`
  );
}

function formatBuffValue(key, value) {
  const percentScalarKeys = new Set([
    "attack",
    "defense",
    "magic",
    "magicDefense",
    "healingBoost",
    "xpBoost",
    "findRateBoost",
    "luck",
  ]);
  const percentFlatKeys = new Set(["critChance", "cooldownReduction"]);

  if (percentScalarKeys.has(key) && typeof value === "number") {
    return `${Math.round(value * 100)}%`;
  }
  if (percentFlatKeys.has(key) && typeof value === "number") {
    return `${value}%`;
  }
  return String(value);
}

function formatBuffLabel(key) {
  const labels = {
    attack: "Attack",
    defense: "Defense",
    magic: "Magic",
    magicDefense: "Magic Defense",
    critChance: "Crit Chance",
    healingBoost: "Healing",
    xpBoost: "XP Boost",
    cooldownReduction: "Cooldown Reduction",
    findRateBoost: "Find Rate",
    luck: "Luck",
  };
  return labels[key] || key;
}

function getLevelBonusPercent(level) {
  let totalBonus = 0;
  for (let i = 1; i <= level; i++) {
    if (i <= 5) totalBonus += 2;
    else if (i <= 10) totalBonus += 3;
    else totalBonus += 4;
  }
  return totalBonus;
}

async function handleInspect(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.user.id;
  const itemInput = interaction.options.getString("item").toLowerCase();
  const user = await UserProfile.findOne({ userId });

  if (!user) {
    return interaction.editReply("❌ You need a profile first!");
  }

  const validSlots = ["weapon", "head", "chest", "hands", "feet", "accessory"];

  let itemId;
  let invItem;
  let isEquipped = false;

  if (validSlots.includes(itemInput)) {
    // Inspect equipped item by slot
    itemId = user.equipped?.[itemInput];
    if (!itemId) {
      return interaction.editReply(`❌ You don't have anything equipped in **${itemInput}**.`);
    }
    isEquipped = true;
    invItem = user.inventory.find((i) => i.itemId === itemId);
  } else {
    // Inspect by inventory position
    const position = parseInt(itemInput, 10);
    if (Number.isNaN(position) || position <= 0) {
      return interaction.editReply("❌ Please provide a valid item position number from `/inv view` or an equipment slot name.");
    }
    if (!user.inventory || position > user.inventory.length) {
      return interaction.editReply(`❌ Invalid position! You only have ${user.inventory?.length || 0} items in your inventory.`);
    }
    invItem = user.inventory[position - 1];
    itemId = invItem.itemId;
    isEquipped = Object.values(user.equipped).includes(itemId);
  }
  
  if (!invItem && !isEquipped) {
    return interaction.editReply("❌ You don't have that item!");
  }

  const item = await Item.findOne({ itemId });
  if (!item) {
    return interaction.editReply("❌ Item not found!");
  }

  const itemLevel = item.level || 0;
  const levelBonusPercent = getLevelBonusPercent(itemLevel);
  const levelMultiplier = 1 + (levelBonusPercent / 100);

  // Determine quantity and status
  let quantityText = "0";
  let statusText = "";
  
  if (isEquipped) {
    const equippedSlot = Object.keys(user.equipped).find(slot => user.equipped[slot] === itemId);
    statusText = `✅ Equipped (${equippedSlot})`;
    quantityText = invItem ? String(invItem.quantity) : "0 (equipped)";
  } else if (invItem) {
    quantityText = String(invItem.quantity);
    statusText = "📦 In Inventory";
  }

  const fields = [
    { name: "ID", value: item.itemId, inline: true },
    { name: "Rarity", value: item.rarity || "Common", inline: true },
    { name: "Type", value: item.type || "equippable", inline: true },
    { name: "Slot", value: item.slot || "N/A", inline: true },
    { name: "Price", value: item.price ? `$${item.price.toLocaleString()}` : "N/A", inline: true },
    { name: "Level", value: `+${itemLevel}`, inline: true },
    { name: "Upgrade Bonus", value: `+${levelBonusPercent}%`, inline: true },
    { name: "Quantity", value: quantityText, inline: true },
  ];

  if (statusText) {
    fields.push({ name: "Status", value: statusText, inline: false });
  }

  // Build stats display
  let statsText = "";
  
  // Show main stat if available
  if (item.mainStat && item.mainStat.type) {
    const statLabels = {
      attack: "Attack",
      defense: "Defense",
      hp: "HP",
      critRate: "Crit Rate",
      critDMG: "Crit DMG",
      energy: "Energy Recharge"
    };
    const label = statLabels[item.mainStat.type] || item.mainStat.type;
    const value = Math.floor(item.mainStat.value * levelMultiplier);
    const suffix = ["critRate", "critDMG"].includes(item.mainStat.type) ? "%" : "";
    statsText += `**Main Stat:** ${label} +${value}${suffix}\n\n`;
  }
  
  // Show sub stats if available
  if (item.subStats && item.subStats.length > 0) {
    statsText += "**Sub Stats:**\n";
    item.subStats.forEach(subStat => {
      const statLabels = {
        "attack": "Attack",
        "attack%": "Attack%",
        "defense": "Defense",
        "defense%": "Defense%",
        "hp": "HP",
        "hp%": "HP%",
        "critRate": "Crit Rate%",
        "critDMG": "Crit DMG%",
        "energy": "Energy Recharge%",
        "luck": "Luck"
      };
      const label = statLabels[subStat.type] || subStat.type;
      const boostedValue = subStat.value * levelMultiplier;
      const value = subStat.type === "luck" ? `${(boostedValue * 100).toFixed(1)}%` : boostedValue.toFixed(1);
      statsText += `• ${label}: +${value}\n`;
    });
  }
  
  // Fallback to legacy buffs if no main/sub stats
  if (!statsText) {
    const buffs = item.buffs || {};
    const buffEntries = Object.entries(buffs).filter(([key, value]) => value && value !== 0);
    if (buffEntries.length > 0) {
      statsText = buffEntries
        .map(([key, value]) => `• ${formatBuffLabel(key)}: ${formatBuffValue(key, value)}`)
        .join("\n");
    } else {
      statsText = "None";
    }
  }

  fields.push({ name: "Stats", value: statsText || "None", inline: false });

  const embed = new EmbedBuilder()
    .setTitle(`${item.emoji || "📦"} ${item.name}`)
    .setDescription(item.description || "No description.")
    .addFields(fields)
    .setColor(RARITY_COLORS[item.rarity] || 0x3498db)
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

async function handleLoadout(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.user.id;
  const user = await UserProfile.findOne({ userId });

  if (!user) {
    return interaction.editReply("❌ You need a profile first! Use `/createprofile` to get started.");
  }

  let buffs;
  try {
    buffs = await calculateActiveBuffs(user);
  } catch (error) {
    console.error("Loadout buff calculation error:", error);
    buffs = {
      attack: 0,
      defense: 0,
      hpPercent: 0,
      attackFlat: 0,
      defenseFlat: 0,
      hpFlat: 0,
      critChance: 0,
      critDMG: 0,
      energy: 0,
      dodge: 0,
      luck: 0,
      damageBonus: 0,
      counterChance: 0,
      counterDamage: 0,
      lifesteal: 0,
      lifestealChance: 0,
      setInfo: { activeSetBonuses: [], activeElements: [], elementalResonance: null, elementalReaction: null }
    };
  }

  const level = user.level || 1;

  // Base stats (no buffs)
  const baseAttack = 25 + (level * 2);
  const baseDefense = 12 + level;
  const baseHP = 250 + (level * 15);
  const baseCritRate = 5;
  const baseCritDMG = 50;

  // Calculate item-only buffs (without user-level buffs)
  let itemBufFs = {
    attack: 0,
    defense: 0,
    hpPercent: 0,
    attackFlat: 0,
    defenseFlat: 0,
    hpFlat: 0,
    critChance: 0,
    critDMG: 0,
    energy: 0,
    dodge: 0,
    luck: 0,
    damageBonus: 0,
    counterChance: 0,
    counterDamage: 0,
    lifesteal: 0,
    lifestealChance: 0,
  };

  if (user.equipped) {
    const equippedItemIds = Object.values(user.equipped).filter(Boolean);
    for (const itemId of equippedItemIds) {
      const itemData = await Item.findOne({ itemId });
      if (itemData) {
        const itemLevel = itemData.level || 0;
        let levelBonusPercent = 0;
        for (let i = 1; i <= itemLevel; i++) {
          if (i <= 5) levelBonusPercent += 2;
          else if (i <= 10) levelBonusPercent += 3;
          else levelBonusPercent += 4;
        }
        const levelMultiplier = 1 + (levelBonusPercent / 100);

        if (itemData.mainStat?.type && itemData.mainStat?.value) {
          const statType = itemData.mainStat.type;
          const boostedValue = itemData.mainStat.value * levelMultiplier;
          if (statType === 'attack') itemBufFs.attackFlat += boostedValue;
          else if (statType === 'defense') itemBufFs.defenseFlat += boostedValue;
          else if (statType === 'hp') itemBufFs.hpFlat += boostedValue;
          else if (statType === 'critRate') itemBufFs.critChance += boostedValue;
          else if (statType === 'critDMG') itemBufFs.critDMG += boostedValue;
          else if (statType === 'energy') itemBufFs.energy += boostedValue;
        }

        if (itemData.subStats?.length) {
          for (const subStat of itemData.subStats) {
            const statType = subStat.type;
            const boostedValue = subStat.value * levelMultiplier;
            if (statType === 'attack') itemBufFs.attackFlat += boostedValue;
            else if (statType === 'attack%') itemBufFs.attack += boostedValue / 100;
            else if (statType === 'defense') itemBufFs.defenseFlat += boostedValue;
            else if (statType === 'defense%') itemBufFs.defense += boostedValue / 100;
            else if (statType === 'hp') itemBufFs.hpFlat += boostedValue;
            else if (statType === 'hp%') itemBufFs.hpPercent += boostedValue / 100;
            else if (statType === 'critRate') itemBufFs.critChance += boostedValue;
            else if (statType === 'critDMG') itemBufFs.critDMG += boostedValue;
            else if (statType === 'energy') itemBufFs.energy += boostedValue;
            else if (statType === 'luck') itemBufFs.luck += boostedValue;
          }
        }
      }
    }
  }

  // Item stats (what gear contributes)
  const itemAttack = Math.round(baseAttack * (itemBufFs.attack || 0) + (itemBufFs.attackFlat || 0));
  const itemDefense = Math.round(baseDefense * (itemBufFs.defense || 0) + (itemBufFs.defenseFlat || 0));
  const itemHP = Math.round(baseHP * (itemBufFs.hpPercent || 0) + (itemBufFs.hpFlat || 0));
  const itemCritRate = Math.round(itemBufFs.critChance || 0);
  const itemCritDMG = Math.round(itemBufFs.critDMG || 0);
  const itemEnergy = Math.round(itemBufFs.energy || 0);
  const itemDodge = Math.round(itemBufFs.dodge || 0);

  // Final stats (combined) = Base + Item Stats + All percentage bonuses applied
  const finalAttack = Math.round((baseAttack + itemAttack) * (1 + (buffs.attack || 0)));
  const finalDefense = Math.round((baseDefense + itemDefense) * (1 + (buffs.defense || 0)));
  const finalHP = Math.round((baseHP + itemHP) * (1 + (buffs.hpPercent || 0)));
  const finalCritRate = Math.round(baseCritRate + itemCritRate + ((buffs.critChance || 0) - (itemBufFs.critChance || 0)));
  const finalCritDMG = Math.round(baseCritDMG + itemCritDMG + ((buffs.critDMG || 0) - (itemBufFs.critDMG || 0)));
  const finalEnergy = Math.round(itemEnergy + ((buffs.energy || 0) - (itemBufFs.energy || 0)));
  const finalDodge = Math.round((buffs.dodge || 0));
  const finalCounterChance = Math.round((buffs.counterChance || 0) * 100);
  const finalCounterDamage = Math.round((buffs.counterDamage || 0) * 100);
  const finalDamageBonus = Math.round((buffs.damageBonus || 0) * 100);
  const finalLifesteal = Math.round((buffs.lifesteal || 0) * 100);
  const finalLifestealChance = Math.round((buffs.lifestealChance || 0) * 100);

  // Equipped items list
  const slots = [
    { key: "weapon", emoji: "⚔️", label: "Weapon" },
    { key: "head", emoji: "👑", label: "Head" },
    { key: "chest", emoji: "🧥", label: "Chest" },
    { key: "hands", emoji: "🤚", label: "Hands" },
    { key: "feet", emoji: "🥾", label: "Feet" },
    { key: "accessory", emoji: "💎", label: "Accessory" },
  ];

  const rarityColors = {
    Common: "⚪",
    Uncommon: "🟢",
    Rare: "🔵",
    Epic: "🟣",
    Legendary: "🟠",
  };

  const equippedLines = [];
  for (const slot of slots) {
    const itemId = user.equipped?.[slot.key];
    if (!itemId) {
      equippedLines.push(`${slot.emoji} **${slot.label}:** _Empty_`);
      continue;
    }
    const item = await Item.findOne({ itemId });
    if (item) {
      const rarity = item.rarity || "Common";
      const colorIndicator = rarityColors[rarity] || "⚪";
      equippedLines.push(`${slot.emoji} **${slot.label}:** ${item.emoji || "📦"} ${item.name} ${colorIndicator}`);
    } else {
      equippedLines.push(`${slot.emoji} **${slot.label}:** ${itemId}`);
    }
  }

  const setInfo = buffs.setInfo || {};
  const setLines = [];
  
  // Build set bonus descriptions with effects
  if (user.equipped) {
    const equippedItemIds = Object.values(user.equipped).filter(Boolean);
    const setCounts = {};
    
    for (const itemId of equippedItemIds) {
      const item = await Item.findOne({ itemId });
      if (item?.setName) {
        setCounts[item.setName] = (setCounts[item.setName] || 0) + 1;
      }
    }
    
    // Get set definitions
    const SET_BONUSES = {
      "Ethans Prowess": { "2": "10% ATK", "3": "15% ATK, 8% DEF", "6": "25% ATK, 15% DEF, 5% Crit Rate" },
      "Olivias Fury": { "2": "10% ATK", "3": "15% ATK, 15% Proc Rate", "6": "25% ATK, 30% Proc Rate, 15% Damage Bonus" },
      "Justins Clapping": { "2": "15 Energy", "3": "25 Energy, 5% Crit Rate", "6": "50 Energy, 12% Crit Rate, 25% Burst Damage" },
      "Lilahs Cold Heart": { "2": "8% Crit Rate", "3": "12% Crit Rate, 15% Crit DMG", "6": "20% Crit Rate, 35% Crit DMG, 15% Freeze Chance" },
      "Hasagi": { "2": "8% Cooldown Reduction", "3": "15% Cooldown Reduction, 6% Dodge", "6": "25% Cooldown Reduction, 15% Dodge, 20% Swirl Damage" },
      "Maries Zhongli Bodypillow": { "2": "15% DEF", "3": "25% DEF, 10% HP", "6": "40% DEF, 20% HP, 10% Counter Chance" },
      "Andys Soraka": { "2": "15% HP", "3": "25% HP, 18% Healing", "6": "40% HP, 30% Healing, 15% Lifesteal Chance" }
    };
    
    Object.entries(setCounts).forEach(([setName, count]) => {
      const setBonusDesc = SET_BONUSES[setName];
      if (!setBonusDesc) return;
      
      if (count >= 2 && setBonusDesc["2"]) {
        setLines.push(`📦 **${setName} (2pc):** ${setBonusDesc["2"]}`);
      }
      if (count >= 3 && setBonusDesc["3"]) {
        setLines.push(`📦 **${setName} (3pc):** ${setBonusDesc["3"]}`);
      }
      if (count >= 6 && setBonusDesc["6"]) {
        setLines.push(`🌟 **${setName} (6pc - FULL SET):** ${setBonusDesc["6"]}`);
      }
    });
  }
  
  if (setInfo.dualMastery?.name) {
    setLines.push(`🔥⚡ **${setInfo.dualMastery.name}**`);
  }
  if (setInfo.adaptiveBonus?.triggers?.length) {
    setLines.push(`⚡ **Adaptive:** ${setInfo.adaptiveBonus.triggers.join(", ")}`);
  }

  const resonanceLines = [];
  if (setInfo.elementalResonance?.name) {
    resonanceLines.push(`✨ ${setInfo.elementalResonance.name}`);
  }
  if (setInfo.elementalReaction?.name) {
    const reactionEffect = setInfo.elementalReaction.effect || "";
    resonanceLines.push(`💥 ${setInfo.elementalReaction.name}${reactionEffect ? ` — ${reactionEffect}` : ""}`);
  }

  const embed = new EmbedBuilder()
    .setTitle(`🎒 Loadout — ${interaction.user.username}`)
    .setDescription("Breakdown of your base stats, gear bonuses, and final combat stats.")
    .addFields(
      { name: "🛡️ Equipped", value: equippedLines.join("\n"), inline: false },
      { name: "📦 Set Bonuses", value: setLines.length ? setLines.join("\n") : "None", inline: false },
      { name: "✨ Resonance / Reactions", value: resonanceLines.length ? resonanceLines.join("\n") : "None", inline: false },
      { name: "📊 Base Stats (Lvl " + level + ")", value: `HP: ${baseHP}\nATK: ${baseAttack}\nDEF: ${baseDefense}\nCrit Rate: ${baseCritRate}%\nCrit DMG: ${baseCritDMG}%`, inline: true },
      { name: "⚙️ Item Stats (Gear Only)", value: `HP: +${itemHP}\nATK: +${itemAttack}\nDEF: +${itemDefense}\nCrit Rate: +${itemCritRate}%\nCrit DMG: +${itemCritDMG}%\nEnergy: +${itemEnergy}`, inline: true },
      { name: "⚔️ Combat Ready Stats", value: `HP: ${finalHP}\nATK: ${finalAttack}\nDEF: ${finalDefense}\nCrit Rate: ${finalCritRate}%\nCrit DMG: ${finalCritDMG}%\nDamage Bonus: +${finalDamageBonus}%\nEnergy: ${finalEnergy}`, inline: true },
      { name: "🛡️ Defensive Abilities", value: `Dodge: ${finalDodge}%\nCounter Chance: ${finalCounterChance}%\nCounter Damage: +${finalCounterDamage}%\nLifesteal: +${finalLifesteal}%\nLifesteal Chance: ${finalLifestealChance}%`, inline: false }
    )
    .setColor(0x3498db)
    .setFooter({ text: "Combat Ready = Base + Item Stats" })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}
