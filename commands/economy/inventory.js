const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const UserProfile = require("../../schema/UserProfile");
const Item = require("../../schema/Item");

module.exports = {
  run: async ({ interaction }) => {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "You can only run this command inside a server.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const userId = interaction.user.id;

    try {
      const userProfile = await UserProfile.findOne({ userId });

      if (!userProfile || userProfile.inventory.length === 0) {
        await interaction.editReply({
          content: "❌ Your inventory is empty!",
        });
        return;
      }

      const allItems = await Item.find({});

      // Helper to get item full info
      const getItemInfo = (itemId) =>
        allItems.find((item) => item.itemId === itemId);

      const ITEMS_PER_PAGE = 10;
      let currentPage = 0;
      const totalPages = Math.ceil(
        userProfile.inventory.length / ITEMS_PER_PAGE
      );

      const generateEmbed = (page) => {
        const start = page * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        const itemsToShow = userProfile.inventory.slice(start, end);

        const embed = new EmbedBuilder()
          .setTitle("🎒 Your Inventory")
          .setColor(0x2f3136)
          .setTimestamp();

        itemsToShow.forEach((invItem, idx) => {
          const itemInfo = getItemInfo(invItem.itemId);
          if (itemInfo) {
            embed.addFields({
              name: `${itemInfo.emoji || "📦"} ${itemInfo.name}`,
              value: `**Qty:** ${invItem.quantity}\n*${itemInfo.description}*`,
              inline: false,
            });
          } else {
            embed.addFields({
              name: `❓ Unknown Item (${invItem.itemId})`,
              value: `**Qty:** ${invItem.quantity}`,
              inline: false,
            });
          }
        });

        embed.setFooter({ text: `Page ${page + 1} of ${totalPages}` });

        return embed;
      };

      const generateButtons = (page) => {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("prev")
            .setLabel("⬅️ Previous")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
          new ButtonBuilder()
            .setCustomId("next")
            .setLabel("➡️ Next")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === totalPages - 1)
        );
      };

      await interaction.editReply({
        embeds: [generateEmbed(currentPage)],
        components: [generateButtons(currentPage)],
      });

      const collector = interaction.channel.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 60000, // 1 minute timeout
      });

      collector.on("collect", async (i) => {
        if (i.customId === "prev" && currentPage > 0) {
          currentPage--;
        } else if (i.customId === "next" && currentPage < totalPages - 1) {
          currentPage++;
        }

        await i.update({
          embeds: [generateEmbed(currentPage)],
          components: [generateButtons(currentPage)],
        });
      });

      collector.on("end", async () => {
        try {
          await interaction.editReply({ components: [] });
        } catch (err) {
          console.log("Failed to remove components after timeout.");
        }
      });
    } catch (error) {
      console.error(`Error handling /inventory: ${error}`);
      await interaction.editReply({
        content: "❌ Error loading your inventory. Please try again later!",
      });
    }
  },

  data: {
    name: "inventory",
    description: "View your inventory items.",
  },
};
