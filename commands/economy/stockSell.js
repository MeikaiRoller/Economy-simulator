const { ApplicationCommandOptionType } = require("discord.js");
const Stock = require("../../schema/Stock");
const UserProfile = require("../../schema/UserProfile");
const StockPortfolio = require("../../schema/StockPortfolio");
const Bank = require("../../schema/Bank");


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

    const totalFloat = stock.availableShares + stock.volume;
    const slippageFactor = 0.5;

    let totalProceeds = 0;
    let basePrice = stock.price;

    for (let i = 1; i <= quantity; i++) {
      const tradeRatio = i / totalFloat;
      const pricePerUnit = basePrice * (1 - slippageFactor * tradeRatio);
      totalProceeds += Math.max(0.01, pricePerUnit); // Prevent going to 0
    }

    const grossProceeds = parseFloat(totalProceeds.toFixed(2));
    const avgBuyPrice = holding.averagePrice;
    const gainPerShare = Math.max(0, stock.price - avgBuyPrice);
    const totalGain = gainPerShare * quantity;

    const taxRate = 0.10;
    const tax = parseFloat((totalGain * taxRate).toFixed(2));
    const proceeds = parseFloat((grossProceeds - tax).toFixed(2));


    let bank = await Bank.findOne({ name: "central" }); //send money to bank
    if (!bank) {
      bank = new Bank({ name: "central", balance: 0 });
    }
    bank.balance += tax;
    await bank.save();


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

    // Market effects
    stock.availableShares += quantity;
    stock.volume -= quantity;

    // Final stock price adjusted based on last unit sold
    const finalTradeRatio = quantity / totalFloat;
    const priceImpact = slippageFactor * finalTradeRatio;
    let newPrice = basePrice * (1 - priceImpact);

    // Scarcity-based multiplier
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

    const avgSold = proceeds / quantity;

    await interaction.editReply(
      `✅ You sold **${quantity}** shares of **${symbol}** for **$${grossProceeds.toFixed(2)}**.\n` +
      `💸 Sell Tax (10%): -$${tax.toFixed(2)}\n` +
      `💵 You received: **$${proceeds.toFixed(2)}**\n` +
      `🧪 New Balance: $${user.balance.toFixed(2)}\n` +
      `📉 New ${symbol} price: **$${stock.price.toFixed(2)}**\n` +
      `📦 Shares back in market: ${stock.availableShares}`
    );    
  },
};
