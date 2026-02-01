const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const UserProfile = require("../../schema/UserProfile");
const Item = require("../../schema/Item");

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
        .setName("equip")
        .setDescription("Equip an item")
        .addStringOption((opt) =>
          opt
            .setName("item")
            .setDescription("Item ID to equip")
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
            .setDescription("Slot to unequip")
            .setRequired(true)
            .addChoices(
              { name: "Weapon", value: "weapon" },
              { name: "Head", value: "head" },
              { name: "Chest", value: "chest" },
              { name: "Hands", value: "hands" },
              { name: "Feet", value: "feet" },
              { name: "Accessory", value: "accessory" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("sell")
        .setDescription("Sell an item")
        .addStringOption((opt) =>
          opt
            .setName("item")
            .setDescription("Item ID to sell")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("inspect")
        .setDescription("Inspect an item in your inventory")
        .addStringOption((opt) =>
          opt
            .setName("item")
            .setDescription("Item ID to inspect")
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
    user.inventory.forEach((invItem) => {
      const item = allItems.find((i) => i.itemId === invItem.itemId);
      if (item) {
        const rarity = item.rarity || "Common";
        inventoryItems.push({
          text: `${item.emoji} **${item.name}** (${rarity}) x${invItem.quantity} — ${item.itemId}`,
          item: item
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
  const itemId = interaction.options.getString("item").toLowerCase();
  const user = await UserProfile.findOne({ userId });

  if (!user) {
    return interaction.editReply("❌ You need a profile first!");
  }

  const invItem = user.inventory.find((i) => i.itemId === itemId);
  if (!invItem) {
    return interaction.editReply("❌ You don't have that item!");
  }

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
  const slot = interaction.options.getString("slot");
  const user = await UserProfile.findOne({ userId });

  if (!user) {
    return interaction.editReply("❌ You need a profile first!");
  }

  const itemId = user.equipped[slot];
  if (!itemId) {
    return interaction.editReply(`❌ You don't have anything equipped in **${slot}**!`);
  }

  const item = await Item.findOne({ itemId });
  user.equipped[slot] = null;

  await user.save();

  return interaction.editReply(
    `✅ Unequipped **${item?.name || itemId}** from your **${slot}** slot.`
  );
}

async function handleSell(interaction) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const itemId = interaction.options.getString("item").toLowerCase();
  const user = await UserProfile.findOne({ userId });

  if (!user) {
    return interaction.editReply("❌ You need a profile first!");
  }

  const invItem = user.inventory.find((i) => i.itemId === itemId);
  if (!invItem) {
    return interaction.editReply("❌ You don't have that item!");
  }

  const item = await Item.findOne({ itemId });
  if (!item || !item.price) {
    return interaction.editReply("❌ That item cannot be sold!");
  }

  // Unequip if equipped
  for (const slot of Object.keys(user.equipped)) {
    if (user.equipped[slot] === itemId) {
      user.equipped[slot] = null;
    }
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

async function handleInspect(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.user.id;
  const itemId = interaction.options.getString("item").toLowerCase();
  const user = await UserProfile.findOne({ userId });

  if (!user) {
    return interaction.editReply("❌ You need a profile first!");
  }

  // Check if item is in inventory or equipped
  const invItem = user.inventory.find((i) => i.itemId === itemId);
  const isEquipped = Object.values(user.equipped).includes(itemId);
  
  if (!invItem && !isEquipped) {
    return interaction.editReply("❌ You don't have that item!");
  }

  const item = await Item.findOne({ itemId });
  if (!item) {
    return interaction.editReply("❌ Item not found!");
  }

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
    const value = item.mainStat.value;
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
      const value = subStat.type === "luck" ? `${(subStat.value * 100).toFixed(1)}%` : subStat.value;
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
