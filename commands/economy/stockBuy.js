const { ApplicationCommandOptionType } = require("discord.js");
const Stock = require("../../schema/Stock");
const UserProfile = require("../../schema/UserProfile");
const StockPortfolio = require("../../schema/StockPortfolio");

module.exports = {
  data: {
    name: "stockbuy",
    description: "Buy stocks from the market!",
    options: [
      {
        name: "symbol",
        description: "The stock symbol (e.g., SAUCE)",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "quantity",
        description: "Number of shares to buy",
        type: ApplicationCommandOptionType.Integer,
        required: true,
      },
    ],
  },

  run: async ({ interaction }) => {
    await interaction.deferReply();

    const volatilityLimits = {
      low: null,
      medium: 0.10,
      high: 0.10,
    };

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

    if (stock.availableShares < quantity) {
      return interaction.editReply(
        `❌ Only ${stock.availableShares} shares of ${symbol} are available to buy.`
      );
    }

    const totalFloat = stock.availableShares + stock.volume;
    const slippageFactor = 0.5;

    let totalCost = 0;
    let basePrice = stock.price;

    for (let i = 1; i <= quantity; i++) {
      const tradeRatio = i / totalFloat;
      const pricePerUnit = basePrice * (1 + slippageFactor * tradeRatio);
      totalCost += pricePerUnit;
    }

    const cost = parseFloat(totalCost.toFixed(2));

    const user = await UserProfile.findOne({ userId });
    if (!user || user.balance < cost) {
      return interaction.editReply("❌ You don't have enough balance to complete this purchase.");
    }

    let portfolio = await StockPortfolio.findOne({ userId });
    if (!portfolio) {
      portfolio = new StockPortfolio({ userId, holdings: [] });
    }

    let holding = portfolio.holdings.find((h) => h.symbol === symbol);

    // 🛡️ Ownership cap logic BEFORE charging
    const capPercent = volatilityLimits[stock.volatility];
    if (capPercent !== null) {
      const maxAllowed = Math.floor(totalFloat * capPercent);
      const currentOwned = holding ? holding.quantity : 0;
      const finalOwned = currentOwned + quantity;

      if (finalOwned > maxAllowed) {
        return interaction.editReply(
          `⛔ You can’t own more than ${(capPercent * 100).toFixed(0)}% of **${symbol}** shares.\n` +
          `🧾 You currently own **${currentOwned}**, and you're trying to buy **${quantity}**.\n` +
          `🔐 Max allowed: **${maxAllowed}** shares.`
        );
      }
    }

    // ✅ All checks passed — apply changes
    user.balance -= cost;
    await user.save();

    if (holding) {
      const totalHoldingCost = holding.averagePrice * holding.quantity + cost;
      holding.quantity += quantity;
      holding.averagePrice = totalHoldingCost / holding.quantity;
    } else {
      portfolio.holdings.push({
        symbol,
        quantity,
        averagePrice: basePrice,
      });
    }

    await portfolio.save();

    stock.availableShares -= quantity;
    stock.volume += quantity;

    const finalTradeRatio = quantity / totalFloat;
    const priceImpact = slippageFactor * finalTradeRatio;
    let newPrice = basePrice * (1 + priceImpact);

    if (totalFloat > 0) {
      const scarcityFactor = 0.2;
      const scarcityMultiplier =
        1 + (1 - stock.availableShares / totalFloat) * scarcityFactor;
      newPrice *= scarcityMultiplier;
    }

    stock.price = parseFloat(Math.max(0.01, newPrice).toFixed(2));
    stock.lastUpdated = new Date();
    stock.history.push(stock.price);
    await stock.save();

    const avgPaid = cost / quantity;

    await interaction.editReply(
      `✅ You bought **${quantity}** shares of **${symbol}** for **$${cost.toFixed(2)}**.\n` +
        `💵 Avg Price Per Share: **$${avgPaid.toFixed(2)}**\n` +
        `🧪 Remaining Balance: $${user.balance.toFixed(2)}\n` +
        `📈 New ${symbol} price: **$${stock.price.toFixed(2)}**\n` +
        `📦 Shares left in market: ${stock.availableShares}`
    );
  },
};
