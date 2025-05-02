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

    const userId = interaction.user.id;
    const symbol = interaction.options.getString("symbol").toUpperCase();
    const quantity = interaction.options.getInteger("quantity");

    if (quantity <= 0) {
      return interaction.editReply("❌ Quantity must be greater than 0.");
    }

    // Lookup stock
    const stock = await Stock.findOne({ symbol });
    if (!stock) {
      return interaction.editReply(`❌ Stock "${symbol}" not found.`);
    }

    if (stock.availableShares < quantity) {
      return interaction.editReply(
        `❌ Only ${stock.availableShares} shares of ${symbol} are available to buy.`
      );
    }

    const cost = parseFloat((stock.price * quantity).toFixed(2));

    // Fetch user
    const user = await UserProfile.findOne({ userId });
    if (!user || user.balance < cost) {
      return interaction.editReply(
        "❌ You don't have enough balance to complete this purchase."
      );
    }

    // Deduct balance
    user.balance -= cost;
    await user.save();

    // Get or create portfolio
    let portfolio = await StockPortfolio.findOne({ userId });
    if (!portfolio) {
      portfolio = new StockPortfolio({ userId, holdings: [] });
    }

    let holding = portfolio.holdings.find((h) => h.symbol === symbol);
    if (holding) {
      const totalCost = holding.averagePrice * holding.quantity + cost;
      holding.quantity += quantity;
      holding.averagePrice = totalCost / holding.quantity;
    } else {
      portfolio.holdings.push({
        symbol,
        quantity,
        averagePrice: stock.price,
      });
    }

    await portfolio.save();

    // Update available shares
    stock.availableShares -= quantity;
    stock.volume += quantity;

    const totalShares = stock.availableShares + stock.volume;
    const relativeSize = quantity / totalShares;

    // Logarithmic price impact
    const impactFactor = Math.log10(relativeSize * 100000 + 1) * 0.01;
    let newPrice = stock.price * (1 + impactFactor);

    // Scarcity adjustment
    // Scarcity multiplier

    if (totalShares > 0) {
      const scarcityFactor = 0.2; // reduce this a bit
      const scarcityMultiplier =
        1 + (1 - stock.availableShares / totalShares) * scarcityFactor;
      newPrice *= scarcityMultiplier;
    }

    stock.price = parseFloat(Math.max(0.01, newPrice).toFixed(2));
    stock.lastUpdated = new Date();
    stock.history.push(stock.price);
    await stock.save();

    await interaction.editReply(
      `✅ You bought **${quantity}** shares of **${symbol}** for **$${cost}**.\n` +
        `🧪 Remaining Balance: $${user.balance.toFixed(2)}\n` +
        `📈 New ${symbol} price: **$${stock.price.toFixed(2)}**\n` +
        `📦 Shares left in market: ${stock.availableShares}`
    );
  },
};
