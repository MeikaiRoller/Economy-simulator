const { EmbedBuilder } = require("discord.js");
const UserProfile = require("../../schema/UserProfile");
const StockPortfolio = require("../../schema/StockPortfolio");
const Stock = require("../../schema/Stock");
const Item = require("../../schema/Item");

module.exports = {
  data: {
    name: "top",
    description: "View the top players ranked by total net worth",
  },

  run: async ({ interaction }) => {
    await interaction.deferReply();

    const users = await UserProfile.find();
    const portfolios = await StockPortfolio.find();
    const stocks = await Stock.find();
    const items = await Item.find();

    const stockMap = Object.fromEntries(stocks.map((s) => [s.symbol, s.price]));
    const itemMap = Object.fromEntries(items.map((i) => [i.itemId, i.price]));

    const leaderboard = users.map((user) => {
      const portfolio = portfolios.find((p) => p.userId === user.userId);
      let stockValue = 0;
      let itemValue = 0;

      // Calculate stock holdings value
      if (portfolio) {
        for (const holding of portfolio.holdings) {
          const price = stockMap[holding.symbol] || 0;
          stockValue += holding.quantity * price;
        }
      }

      // Calculate inventory value
      if (user.inventory && Array.isArray(user.inventory)) {
        for (const item of user.inventory) {
          const price = itemMap[item.itemId] || 0;
          itemValue += price * (item.quantity || 0);
        }
      }

      const netWorth = user.balance + stockValue + itemValue;

      return {
        userId: user.userId,
        netWorth,
        balance: user.balance,
        stockValue,
        itemValue,
      };
    });

    leaderboard.sort((a, b) => b.netWorth - a.netWorth);
    const top = leaderboard.slice(0, 10);

    const lines = await Promise.all(
      top.map(async (entry, i) => {
        const user = await interaction.client.users
          .fetch(entry.userId)
          .catch(() => null);
        const username = user?.username || `Unknown User (${entry.userId})`;

        return (
          `**${i + 1}. ${username}**\n🧪 $${entry.netWorth.toLocaleString(
            undefined,
            { minimumFractionDigits: 2, maximumFractionDigits: 2 }
          )}\n` +
          `• Wallet: $${entry.balance.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}\n` +
          `• Stocks: $${entry.stockValue.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}\n` +
          `• Inventory: $${entry.itemValue.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
        );
      })
    );

    const embed = new EmbedBuilder()
      .setTitle("🏆 Net Worth Leaderboard")
      .setColor(0xf1c40f)
      .setDescription(lines.join("\n\n"))
      .setFooter({ text: "Net worth = wallet + stock + item value" });

    await interaction.editReply({ embeds: [embed] });
  },
};
