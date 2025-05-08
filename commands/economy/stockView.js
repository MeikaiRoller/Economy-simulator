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

    const lowVol = stocks.filter((s) => s.volatility === "low");
    const medVol = stocks.filter((s) => s.volatility === "medium");
    const highVol = stocks.filter((s) => s.volatility === "high");

    const formatWithTotal = (s) => {
      const total = s.availableShares + s.volume;
      return `**${s.symbol}** — ${s.name}\n🧪 $${s.price.toFixed(2)} | 📦 Volume: ${s.volume.toLocaleString()} / ${total.toLocaleString()}`;
    };

    const formatBasic = (s) =>
      `**${s.symbol}** — ${s.name}\n🧪 $${s.price.toFixed(2)} | 📦 Volume: ${s.volume.toLocaleString()}`;

    const embed = new EmbedBuilder()
      .setTitle("📈 Available Stocks")
      .setColor(0x3498db);

    if (lowVol.length > 0) {
      embed.addFields({
        name: "🟢 Low Volatility",
        value: lowVol.map(formatBasic).join("\n\n"),
      });
    }

    if (medVol.length > 0) {
      embed.addFields({
        name: "🟡 Medium Volatility",
        value: medVol.map(formatWithTotal).join("\n\n"),
      });
    }

    if (highVol.length > 0) {
      embed.addFields({
        name: "🔴 High Volatility",
        value: highVol.map(formatWithTotal).join("\n\n"),
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
