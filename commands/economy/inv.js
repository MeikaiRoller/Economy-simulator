const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
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
  },
};

async function handleView(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.user.id;
  const user = await UserProfile.findOne({ userId });

  if (!user || user.inventory.length === 0) {
    return interaction.editReply("❌ Your inventory is empty!");
  }

  const allItems = await Item.find({});

  // Build equipped summary
  let equippedText = "";
  for (const [slot, itemId] of Object.entries(user.equipped)) {
    if (itemId) {
      const item = allItems.find((i) => i.itemId === itemId);
      equippedText += `**${slot.charAt(0).toUpperCase() + slot.slice(1)}:** ${
        item?.emoji || "📦"
      } ${item?.name || itemId}\n`;
    }
  }

  // Build inventory list
  let inventoryText = "";
  user.inventory.forEach((invItem) => {
    const item = allItems.find((i) => i.itemId === invItem.itemId);
    if (item) {
      const rarity = item.rarity || "Common";
      inventoryText += `${item.emoji} **${item.name}** (${rarity}) x${invItem.quantity}\n`;
    }
  });

  const embed = new EmbedBuilder()
    .setTitle(`🎒 ${interaction.user.username}'s Inventory`)
    .addFields(
      {
        name: "⚙️ Equipped",
        value: equippedText || "Nothing equipped",
        inline: false,
      },
      {
        name: "📦 Items",
        value: inventoryText || "No items",
        inline: false,
      }
    )
    .setColor(0x3498db)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
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

  // If something is already equipped in that slot, unequip it first
  if (user.equipped[slot]) {
    const oldItemId = user.equipped[slot];
    const oldItem = user.inventory.find((i) => i.itemId === oldItemId);
    if (oldItem) {
      oldItem.quantity += 1;
    } else {
      user.inventory.push({ itemId: oldItemId, quantity: 1 });
    }
  }

  // Equip the new item
  user.equipped[slot] = itemId;
  invItem.quantity -= 1;
  if (invItem.quantity <= 0) {
    user.inventory = user.inventory.filter((i) => i.quantity > 0);
  }

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

  const invItem = user.inventory.find((i) => i.itemId === itemId);
  if (invItem) {
    invItem.quantity += 1;
  } else {
    user.inventory.push({ itemId, quantity: 1 });
  }

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
