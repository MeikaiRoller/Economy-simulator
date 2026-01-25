const { EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");
const Shop = require("../../schema/Shop");
const UserProfile = require("../../schema/UserProfile");
const Item = require("../../schema/Item");

const SHOP_SIZE = 8; // items to show
const REFRESH_HOURS = 24; // daily refresh

async function getShopItems() {
  let shop = await Shop.findOne({});
  const now = new Date();

  if (!shop || shop.expiresAt <= now) {
    // Refresh shop
    const allItems = await Item.find();
    const shuffled = allItems.sort(() => Math.random() - 0.5);
    const selection = shuffled.slice(0, SHOP_SIZE).map((i) => ({
      itemId: i.itemId,
    }));

    const expiresAt = new Date(now.getTime() + REFRESH_HOURS * 60 * 60 * 1000);
    shop = await Shop.findOneAndUpdate(
      {},
      { items: selection, expiresAt },
      { upsert: true, new: true }
    );
  }

  // Fetch full item docs
  const itemIds = shop.items.map((item) => item.itemId);
  const itemDocs = [];
  for (const id of itemIds) {
    const item = await Item.findOne({ itemId: id });
    if (item) itemDocs.push(item);
  }

  return { itemDocs, expiresAt: shop.expiresAt };
}

async function handleList(interaction) {
  const { itemDocs, expiresAt } = await getShopItems();

  const embed = new EmbedBuilder()
    .setTitle("🏪 Item Shop")
    .setDescription(
      `**Available Items** | Refreshes <t:${Math.floor(expiresAt.getTime() / 1000)}:R>\n\nUse \`/shop buy <number>\` to purchase`
    )
    .setColor(0x00ff41);

  itemDocs.forEach((item, idx) => {
    const rarityEmoji = {
      Common: "⚪",
      Uncommon: "🟢",
      Rare: "🔵",
      Epic: "🟣",
      Legendary: "🟠",
    }[item.rarity] || "⚪";

    embed.addFields({
      name: `${idx + 1}. ${rarityEmoji} ${item.emoji} ${item.name}`,
      value: `${item.description}\n💰 **$${item.price.toLocaleString()}** | Rarity: ${item.rarity}`,
      inline: false,
    });
  });

  await interaction.editReply({ embeds: [embed] });
}

async function handleBuy(interaction) {
  const itemNumber = interaction.options.getInteger("item");
  const userId = interaction.user.id;

  const { itemDocs } = await getShopItems();
  if (itemNumber < 1 || itemNumber > itemDocs.length) {
    await interaction.editReply("❌ Invalid item number!");
    return;
  }

  const selectedItem = itemDocs[itemNumber - 1];
  const userProfile = await UserProfile.findOne({ userId });

  if (!userProfile) {
    await interaction.editReply(
      "❌ You don't have a profile! Use `/create-profile` first."
    );
    return;
  }

  if (userProfile.balance < selectedItem.price) {
    await interaction.editReply(
      `❌ You need $${(selectedItem.price - userProfile.balance).toLocaleString()} more!`
    );
    return;
  }

  // Deduct balance and add to inventory
  userProfile.balance -= selectedItem.price;

  const existingItem = userProfile.inventory.find(
    (inv) => inv.itemId === selectedItem.itemId
  );
  if (existingItem) {
    existingItem.quantity++;
  } else {
    userProfile.inventory.push({ itemId: selectedItem.itemId, quantity: 1 });
  }

  await userProfile.save();

  await interaction.editReply(
    `✅ Purchased **${selectedItem.name}** for $${selectedItem.price.toLocaleString()}!\nNew Balance: $${userProfile.balance.toLocaleString()}`
  );
}

async function handleSell(interaction) {
  const itemNumber = interaction.options.getInteger("item");
  const userId = interaction.user.id;

  const userProfile = await UserProfile.findOne({ userId });

  if (!userProfile) {
    await interaction.editReply(
      "❌ You don't have a profile! Use `/create-profile` first."
    );
    return;
  }

  if (!userProfile.inventory.length) {
    await interaction.editReply("❌ Your inventory is empty!");
    return;
  }

  if (itemNumber < 1 || itemNumber > userProfile.inventory.length) {
    await interaction.editReply("❌ Invalid item number!");
    return;
  }

  const invItem = userProfile.inventory[itemNumber - 1];
  const item = await Item.findOne({ itemId: invItem.itemId });

  if (!item) {
    await interaction.editReply("❌ Item not found!");
    return;
  }

  const sellPrice = Math.floor(item.price * 0.5); // 50% of purchase price
  userProfile.balance += sellPrice;
  invItem.quantity--;

  if (invItem.quantity <= 0) {
    userProfile.inventory = userProfile.inventory.filter(
      (_, i) => i !== itemNumber - 1
    );
  }

  await userProfile.save();

  await interaction.editReply(
    `✅ Sold **${item.name}** for $${sellPrice.toLocaleString()}!\nNew Balance: $${userProfile.balance.toLocaleString()}`
  );
}

module.exports = {
  data: {
    name: "shop",
    description: "Browse and trade items in the shop",
    options: [
      {
        name: "list",
        description: "View available items in the shop",
        type: ApplicationCommandOptionType.Subcommand,
      },
      {
        name: "buy",
        description: "Purchase an item from the shop",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "item",
            description: "Item number to buy (1-8)",
            type: ApplicationCommandOptionType.Integer,
            required: true,
            minValue: 1,
            maxValue: 8,
          },
        ],
      },
      {
        name: "sell",
        description: "Sell an item from your inventory",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "item",
            description: "Item number from your inventory",
            type: ApplicationCommandOptionType.Integer,
            required: true,
          },
        ],
      },
    ],
  },
  run: async ({ interaction }) => {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "You can only use this command inside a server!",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === "list") {
        await handleList(interaction);
      } else if (subcommand === "buy") {
        await handleBuy(interaction);
      } else if (subcommand === "sell") {
        await handleSell(interaction);
      }
    } catch (error) {
      console.error(`Error in /shop: ${error}`);
      await interaction.editReply(
        "❌ An error occurred. Please try again later."
      );
    }
  },
};
