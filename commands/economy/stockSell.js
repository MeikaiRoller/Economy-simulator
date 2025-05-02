const { ApplicationCommandOptionType } = require("discord.js");
const Stock = require("../../schema/Stock");
const UserProfile = require("../../schema/UserProfile");
const StockPortfolio = require("../../schema/StockPortfolio");

module.exports = {
  data: {
    name: "stocksell",
    description: "Sell stocks you own!",
    options: [
      {
        name: "symbol",
        description: "The stock symbol (e.g., SAUCE)",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "quantity",
        description: "Number of shares to sell",
        type: ApplicationCommandOptionType.Integer,
        required: true,
      },
    ],
  },

  run: async ({ interaction }) => {
    await interaction.deferReply();

    const userId = interaction.user.id;
    const symbol = interaction.options.getString("symbol").toUpperCase();
    const quantity = interaction.options.getInteger("quantity");

    if (quantity <= 0) {
      return interaction.editReply("❌ Quantity must be greater than 0.");
    }

    const stock = await Stock.findOne({ symbol });
    if (!stock) {
      return interaction.editReply(`❌ Stock "${symbol}" not found.`);
    }

    const portfolio = await StockPortfolio.findOne({ userId });
    const holding = portfolio?.holdings?.find((h) => h.symbol === symbol);

    if (!holding || holding.quantity < quantity) {
      return interaction.editReply(
        `❌ You don't have enough ${symbol} shares to sell.`
      );
    }

    const proceeds = parseFloat((stock.price * quantity).toFixed(2));

    // Update user balance
    const user = await UserProfile.findOne({ userId });
    user.balance += proceeds;
    await user.save();

    // Update holdings
    holding.quantity -= quantity;
    if (holding.quantity === 0) {
      portfolio.holdings = portfolio.holdings.filter(
        (h) => h.symbol !== symbol
      );
    }
    await portfolio.save();

    // Increase available shares and reduce volume
    stock.availableShares += quantity;
    stock.volume -= quantity;

    // Volume-aware price drop
    const totalShares = stock.availableShares + stock.volume;
    const relativeSize = quantity / totalShares;
    const impactFactor = Math.log10(relativeSize * 100000 + 1) * 0.01;
    let newPrice = stock.price * (1 - impactFactor);

    // Scarcity-based multiplier (even after selling)
    if (totalShares > 0) {
      const scarcityFactor = 0.2;
      const scarcityMultiplier =
        1 + (1 - stock.availableShares / totalShares) * scarcityFactor;
      newPrice *= scarcityMultiplier;
    }

    stock.price = parseFloat(Math.max(0.01, newPrice).toFixed(2));
    stock.lastUpdated = new Date();
    stock.history.push(stock.price);
    await stock.save();

    await interaction.editReply(
      `✅ You sold **${quantity}** shares of **${symbol}** for **$${proceeds}**.\n` +
        `🧪 New Balance: $${user.balance.toFixed(2)}\n` +
        `📉 New ${symbol} price: **$${stock.price.toFixed(2)}**\n` +
        `📦 Shares back in market: ${stock.availableShares}`
    );
  },
};
