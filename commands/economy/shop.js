const { EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");
const mongoose = require("mongoose");
const Shop = require("../../schema/Shop");
const Item = require("../../schema/Item");

const SHOP_SIZE = 6; // how many items to show
const REFRESH_HOURS = 1; // refresh interval

module.exports = {
  data: {
    name: "shop",
    description: "Browse the Nether Casino item shop (refreshes hourly).",
  },
  run: async ({ interaction }) => {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "You can only use this command inside a server!",
        ephemeral: true,
      });
    }
    await interaction.deferReply();

    let shop = await Shop.findOne({});

    const now = new Date();
    if (!shop || shop.expiresAt <= now) {
      // time to refresh
      const allItems = await Item.find();
      console.log("3Items:", allItems);
      // pick SHOP_SIZE random unique items
      const shuffled = allItems.sort(() => Math.random() - 0.5);
      const selection = shuffled.slice(0, SHOP_SIZE).map((i) => ({
        itemId: i.itemId,
      }));
      console.log("Selected Items:", selection);

      const expiresAt = new Date(
        now.getTime() + REFRESH_HOURS * 60 * 60 * 1000
      );

      // Update the global shop
      shop = await Shop.findOneAndUpdate(
        {},
        { items: selection, expiresAt },
        { upsert: true, new: true }
      );
    }

    // fetch full item docs
    const itemIds = shop.items.map((item) => item.itemId);

    // Fetch items in the correct order manually
    const itemDocs = [];
    for (const id of itemIds) {
      const item = await Item.findOne({ itemId: id });
      if (item) {
        itemDocs.push(item);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle("🎪 Nether Casino Shop")
      .setDescription(
        `Browse our limited selection! Shop refreshes <t:${Math.floor(
          shop.expiresAt.getTime() / 1000
        )}:R>.`
      )
      .setColor(0x2f3136)
      .setTimestamp();

    // Add each item as a field
    itemDocs.forEach((it, index) => {
      // Determine rarity color emoji
      let rarityColor = "";

      switch (it.rarity) {
        case "Common":
          rarityColor = "⚪"; // White circle
          break;
        case "Uncommon":
          rarityColor = "🟢"; // Green circle
          break;
        case "Rare":
          rarityColor = "🔵"; // Blue circle
          break;
        case "Epic":
          rarityColor = "🟣"; // Purple circle
          break;
        case "Legendary":
          rarityColor = "🟠"; // Orange circle
          break;
        default:
          rarityColor = "⚪"; // fallback
      }

      // Add the numbered item field
      embed.addFields({
        name: `${index + 1}. ${rarityColor} ${it.emoji} ${
          it.name
        } — ${it.price.toLocaleString()} 🧪`,
        value: it.description,
        inline: false,
      });
    });

    await interaction.editReply({ embeds: [embed] });
  },
};
