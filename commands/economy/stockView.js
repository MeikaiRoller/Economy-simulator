const { EmbedBuilder } = require("discord.js");
const Stock = require("../../schema/Stock");

module.exports = {
  data: {
    name: "stockview",
    description: "View all available stocks and their current prices",
  },

  run: async ({ interaction }) => {
    await interaction.deferReply();

    const stocks = await Stock.find().sort({ symbol: 1 });

    if (stocks.length === 0) {
      return interaction.editReply("📭 No stocks available in the market.");
    }

    const embed = new EmbedBuilder()
      .setTitle("📈 Available Stocks")
      .setColor(0x3498db);

    const lines = stocks.map(
      (s) =>
        `**${s.symbol}** — ${s.name}\n🧪 $${s.price.toFixed(2)} | 📦 Volume: ${
          s.volume
        }`
    );

    embed.setDescription(lines.join("\n\n"));
    await interaction.editReply({ embeds: [embed] });
  },
};
