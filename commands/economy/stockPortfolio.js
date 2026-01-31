const { EmbedBuilder } = require("discord.js");
const StockPortfolio = require("../../schema/StockPortfolio");
const Stock = require("../../schema/Stock");

module.exports = {
  data: {
    name: "stockportfolio",
    description: "View your stock portfolio and current value",
  },

  deleted: true,

  run: async ({ interaction }) => {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const portfolio = await StockPortfolio.findOne({ userId });

    if (!portfolio || portfolio.holdings.length === 0) {
      return interaction.editReply("📭 You don’t own any stocks yet.");
    }

    let totalValue = 0;
    const lines = await Promise.all(
      portfolio.holdings.map(async (holding) => {
        const stock = await Stock.findOne({ symbol: holding.symbol });
        if (!stock) return null;

        const currentValue = stock.price * holding.quantity;
        const costBasis = holding.averagePrice * holding.quantity;
        const gainLoss = currentValue - costBasis;
        const gainLossPercent = (gainLoss / costBasis) * 100;
        totalValue += currentValue;

        const changeEmoji = gainLoss > 0 ? "📈" : gainLoss < 0 ? "📉" : "➖";

        return (
          `**${holding.symbol}** — ${holding.quantity} shares\n` +
          `💰 Avg Buy: $${holding.averagePrice.toFixed(
            2
          )} | 📊 Current: $${stock.price.toFixed(2)}\n` +
          `🧪 Value: $${currentValue.toFixed(
            2
          )} | ${changeEmoji} Change: $${gainLoss.toFixed(
            2
          )} (${gainLossPercent.toFixed(2)}%)`
        );
      })
    );

    const filteredLines = lines.filter(Boolean);

    const embed = new EmbedBuilder()
      .setTitle(`${interaction.user.username}'s Stock Portfolio`)
      .setDescription(filteredLines.join("\n\n"))
      .setFooter({ text: `Total Portfolio Value: $${totalValue.toFixed(2)}` })
      .setColor(0x2ecc71);

    await interaction.editReply({ embeds: [embed] });
  },
};
