const { EmbedBuilder } = require("discord.js");
const Stock = require("../../schema/Stock");

module.exports = {
  data: {
    name: "stockview",
    description: "View all available stocks and their current prices",
  },

  deleted: true,

  run: async ({ interaction }) => {
    await interaction.deferReply();

    const stocks = await Stock.find().sort({ symbol: 1 });

    if (stocks.length === 0) {
      return interaction.editReply("📭 No stocks available in the market.");
    }

    // Group by sector
    const bySector = {};
    for (const stock of stocks) {
      if (!bySector[stock.sector]) {
        bySector[stock.sector] = [];
      }
      bySector[stock.sector].push(stock);
    }

    const formatStock = (s) => {
      const marketCap = (s.price * s.totalIssued / 1_000_000).toFixed(1);
      const ownership = ((s.volume / s.totalIssued) * 100).toFixed(1);
      
      let momentumEmoji = "➡️";
      if (s.momentum > 0.3) momentumEmoji = "📈📈";
      else if (s.momentum > 0) momentumEmoji = "📈";
      else if (s.momentum < -0.3) momentumEmoji = "📉📉";
      else if (s.momentum < 0) momentumEmoji = "📉";
      
      const volatilityBadge =
        s.volatility === "low"
          ? "🟢"
          : s.volatility === "medium"
          ? "🟡"
          : "🔴";

      return (
        `${volatilityBadge} **${s.symbol}** — ${s.name}\n` +
        `💰 $${s.price.toFixed(2)} | Market Cap: $${marketCap}M\n` +
        `📊 Owned: ${ownership}% | Traded: ${(s.totalVolumeTraded || 0).toLocaleString()} shares\n` +
        `${momentumEmoji} Momentum: ${(s.momentum * 100).toFixed(0)}%`
      );
    };

    const sectorEmojis = {
      tech: "💻",
      food: "🍔",
      mystical: "🔮",
      entertainment: "🎬",
    };

    const embed = new EmbedBuilder()
      .setTitle("📈 Stock Market Overview")
      .setColor(0x3498db)
      .setFooter({
        text: "Green = Stable | Yellow = Medium Risk | Red = High Risk",
      })
      .setTimestamp();

    for (const [sector, sectorStocks] of Object.entries(bySector)) {
      const emoji = sectorEmojis[sector] || "📊";
      const title = `${emoji} ${sector.charAt(0).toUpperCase() + sector.slice(1)}`;
      embed.addFields({
        name: title,
        value: sectorStocks.map(formatStock).join("\n\n"),
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
