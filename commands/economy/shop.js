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

    const guildId = interaction.guild.id;
    let shop = await Shop.findOne({ guildId });

    const now = new Date();
    if (!shop || shop.expiresAt <= now) {
      // time to refresh
      const allItems = await Item.find();
      // pick SHOP_SIZE random unique items
      const shuffled = allItems.sort(() => Math.random() - 0.5);
      const selection = shuffled.slice(0, SHOP_SIZE).map((i) => ({
        itemId: i.itemId,
      }));
      console.log(shuffled); // Make sure this is showing items

      const expiresAt = new Date(
        now.getTime() + REFRESH_HOURS * 60 * 60 * 1000
      );

      shop = await Shop.findOneAndUpdate(
        { guildId },
        { items: selection, expiresAt },
        { upsert: true, new: true }
      );
      console.log(shop);
    }

    // fetch full item docs
    const itemDocs = await Item.find({ itemId: { $in: shop.items } });
    console.log(shop.items); // Verify the items are being saved properly

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
    itemDocs.forEach((it) => {
      embed.addFields({
        name: `${it.emoji} ${it.name} — ${it.price.toLocaleString()} 🧪`,
        value: it.description,
        inline: false,
      });
    });

    await interaction.editReply({ embeds: [embed] });
  },
};
