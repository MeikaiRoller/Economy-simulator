const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const Stock = require("../../schema/Stock");
const StockPortfolio = require("../../schema/StockPortfolio");
const UserProfile = require("../../schema/UserProfile");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stock")
    .setDescription("Stock trading commands")
    .addSubcommand((sub) =>
      sub
        .setName("buy")
        .setDescription("Buy shares of a stock")
        .addStringOption((opt) =>
          opt
            .setName("symbol")
            .setDescription("Stock symbol (e.g., SAUCE)")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("quantity")
            .setDescription("Number of shares to buy (or 'max' to buy maximum)")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("sell")
        .setDescription("Sell shares of a stock")
        .addStringOption((opt) =>
          opt
            .setName("symbol")
            .setDescription("Stock symbol (e.g., SAUCE)")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("quantity")
            .setDescription("Number of shares to sell (or 'max' to sell all)")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("portfolio")
        .setDescription("View your stock portfolio")
    )
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("View all available stocks")
    ),

  run: async ({ interaction }) => {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "❌ You can only use stock commands inside a server!",
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "buy") {
      return handleBuy(interaction);
    }
    if (subcommand === "sell") {
      return handleSell(interaction);
    }
    if (subcommand === "portfolio") {
      return handlePortfolio(interaction);
    }
    if (subcommand === "view") {
      return handleView(interaction);
    }
  },
};

async function handleBuy(interaction) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const symbol = interaction.options.getString("symbol").toUpperCase();
  const quantityInput = interaction.options.getString("quantity");

  // Find the stock
  const stock = await Stock.findOne({ symbol });
  if (!stock) {
    return interaction.editReply(`❌ Stock **${symbol}** not found!`);
  }

  // Check user balance
  const userProfile = await UserProfile.findOne({ userId });
  if (!userProfile) {
    return interaction.editReply(
      `❌ You need to create a profile first using \`/create-profile\`!`
    );
  }

  // Calculate quantity (handle "max" or numeric input)
  let quantity;
  if (quantityInput.toLowerCase() === "max") {
    const availableShares = stock.totalIssued - stock.volume;
    const affordableShares = Math.floor(userProfile.balance / stock.price);
    
    // Get current ownership for cap calculation
    const tempPortfolio = await StockPortfolio.findOne({ userId });
    const tempHolding = tempPortfolio?.holdings.find((h) => h.symbol === symbol);
    const currentOwnership = tempHolding ? tempHolding.quantity : 0;
    const maxOwnership = Math.floor(stock.totalIssued * 0.10); // 10% cap
    const ownershipRoom = maxOwnership - currentOwnership;
    
    quantity = Math.min(availableShares, affordableShares, ownershipRoom);
    
    if (quantity <= 0) {
      if (ownershipRoom <= 0) {
        return interaction.editReply(
          `❌ You've hit the 10% ownership cap for **${symbol}**! You own **${currentOwnership.toLocaleString()}** shares.`
        );
      }
      return interaction.editReply(
        `❌ Cannot buy any shares! You have **$${userProfile.balance.toLocaleString()}** but shares cost **$${stock.price.toFixed(2)}** each.`
      );
    }
  } else {
    quantity = parseInt(quantityInput);
    if (isNaN(quantity) || quantity <= 0) {
      return interaction.editReply(`❌ Invalid quantity! Use a number or 'max'.`);
    }
  }

  const totalCost = stock.price * quantity;

  if (userProfile.balance < totalCost) {
    return interaction.editReply(
      `❌ You need **$${totalCost.toLocaleString()}** but only have **$${userProfile.balance.toLocaleString()}**!`
    );
  }

  // Check if enough shares are available
  const availableShares = stock.totalIssued - stock.volume;
  if (quantity > availableShares) {
    return interaction.editReply(
      `❌ Only **${availableShares.toLocaleString()}** shares available! (Total issued: ${stock.totalIssued.toLocaleString()}, Owned: ${stock.volume.toLocaleString()})`
    );
  }

  // Check ownership cap (10% of total issued shares per player)
  const MAX_OWNERSHIP_PERCENT = 0.10; // 10%
  const maxOwnership = Math.floor(stock.totalIssued * MAX_OWNERSHIP_PERCENT);
  
  let portfolio = await StockPortfolio.findOne({ userId });
  if (!portfolio) {
    portfolio = new StockPortfolio({ userId, holdings: [] });
  }

  const existingHolding = portfolio.holdings.find((h) => h.symbol === symbol);
  const currentOwnership = existingHolding ? existingHolding.quantity : 0;
  const newTotalOwnership = currentOwnership + quantity;

  if (newTotalOwnership > maxOwnership) {
    const canStillBuy = maxOwnership - currentOwnership;
    const ownershipPercent = ((currentOwnership / stock.totalIssued) * 100).toFixed(2);
    
    return interaction.editReply(
      `❌ Ownership limit reached!\n` +
      `You own: **${currentOwnership.toLocaleString()}** shares (${ownershipPercent}%)\n` +
      `Maximum: **${maxOwnership.toLocaleString()}** shares (${MAX_OWNERSHIP_PERCENT * 100}%)\n` +
      `You can buy: **${canStillBuy.toLocaleString()}** more shares`
    );
  }

  // Deduct balance
  userProfile.balance -= totalCost;
  await userProfile.save();

  // Update stock
  stock.volume += quantity;
  stock.totalVolumeTraded = (stock.totalVolumeTraded || 0) + quantity;
  await stock.save();
  if (existingHolding) {
    // Update average price
    const totalShares = existingHolding.quantity + quantity;
    const totalValue =
      existingHolding.quantity * existingHolding.averagePrice +
      quantity * stock.price;
    existingHolding.averagePrice = totalValue / totalShares;
    existingHolding.quantity = totalShares;
  } else {
    portfolio.holdings.push({
      symbol,
      quantity,
      averagePrice: stock.price,
    });
  }

  await portfolio.save();

  const embed = new EmbedBuilder()
    .setTitle("📈 Stock Purchase Complete")
    .setDescription(
      `Successfully bought **${quantity.toLocaleString()}** shares of **${symbol}**`
    )
    .addFields(
      {
        name: "💰 Price per Share",
        value: `$${stock.price.toFixed(2)}`,
        inline: true,
      },
      {
        name: "💵 Total Cost",
        value: `$${totalCost.toLocaleString()}`,
        inline: true,
      },
      {
        name: "🧪 New Balance",
        value: `$${userProfile.balance.toLocaleString()}`,
        inline: true,
      }
    )
    .setColor(0x00ff00)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleSell(interaction) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const symbol = interaction.options.getString("symbol").toUpperCase();
  const quantityInput = interaction.options.getString("quantity");

  // Find the stock
  const stock = await Stock.findOne({ symbol });
  if (!stock) {
    return interaction.editReply(`❌ Stock **${symbol}** not found!`);
  }

  // Find user's portfolio
  const portfolio = await StockPortfolio.findOne({ userId });
  if (!portfolio) {
    return interaction.editReply(`❌ You don't own any stocks!`);
  }

  const holding = portfolio.holdings.find((h) => h.symbol === symbol);
  if (!holding || holding.quantity <= 0) {
    return interaction.editReply(`❌ You don't own any **${symbol}** shares!`);
  }

  // Calculate quantity (handle "max" or numeric input)
  let quantity;
  if (quantityInput.toLowerCase() === "max") {
    quantity = holding.quantity;
  } else {
    quantity = parseInt(quantityInput);
    if (isNaN(quantity) || quantity <= 0) {
      return interaction.editReply(`❌ Invalid quantity! Use a number or 'max'.`);
    }
  }

  if (quantity > holding.quantity) {
    return interaction.editReply(
      `❌ You only own **${holding.quantity.toLocaleString()}** shares of **${symbol}**!`
    );
  }

  const totalValue = stock.price * quantity;

  // Update user balance
  const userProfile = await UserProfile.findOne({ userId });
  if (!userProfile) {
    return interaction.editReply(`❌ Profile not found!`);
  }

  userProfile.balance += totalValue;
  await userProfile.save();

  // Update stock volume
  stock.volume -= quantity;
  stock.totalVolumeTraded = (stock.totalVolumeTraded || 0) + quantity;
  await stock.save();

  // Calculate gain/loss before updating portfolio
  const costBasis = holding.averagePrice * quantity;
  const gainLoss = totalValue - costBasis;
  const gainLossPercent = ((gainLoss / costBasis) * 100).toFixed(2);
  const gainLossEmoji = gainLoss >= 0 ? "📈" : "📉";

  // Update portfolio
  holding.quantity -= quantity;
  if (holding.quantity <= 0) {
    portfolio.holdings = portfolio.holdings.filter((h) => h.symbol !== symbol);
  }
  await portfolio.save();

  const embed = new EmbedBuilder()
    .setTitle("📉 Stock Sale Complete")
    .setDescription(
      `Successfully sold **${quantity.toLocaleString()}** shares of **${symbol}**`
    )
    .addFields(
      {
        name: "💰 Price per Share",
        value: `$${stock.price.toFixed(2)}`,
        inline: true,
      },
      {
        name: "💵 Total Value",
        value: `$${totalValue.toLocaleString()}`,
        inline: true,
      },
      {
        name: `${gainLossEmoji} Gain/Loss`,
        value: `$${gainLoss.toFixed(2)} (${gainLossPercent}%)`,
        inline: true,
      },
      {
        name: "🧪 New Balance",
        value: `$${userProfile.balance.toLocaleString()}`,
        inline: false,
      }
    )
    .setColor(gainLoss >= 0 ? 0x00ff00 : 0xff0000)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handlePortfolio(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.user.id;
  const portfolio = await StockPortfolio.findOne({ userId });

  if (!portfolio || portfolio.holdings.length === 0) {
    return interaction.editReply("📭 You don't own any stocks yet.");
  }

  let totalValue = 0;
  const lines = await Promise.all(
    portfolio.holdings.map(async (holding) => {
      const stock = await Stock.findOne({ symbol: holding.symbol });
      if (!stock) return null;

      const currentValue = stock.price * holding.quantity;
      const costBasis = holding.averagePrice * holding.quantity;
      const gainLoss = currentValue - costBasis;
      const gainLossPercent = ((gainLoss / costBasis) * 100).toFixed(2);
      totalValue += currentValue;

      const changeEmoji = gainLoss > 0 ? "📈" : gainLoss < 0 ? "📉" : "➖";

      return (
        `**${holding.symbol}** — ${holding.quantity.toLocaleString()} shares\n` +
        `💰 Avg Buy: $${holding.averagePrice.toFixed(2)} | 📊 Current: $${stock.price.toFixed(2)}\n` +
        `🧪 Value: $${currentValue.toFixed(2)} | ${changeEmoji} Change: $${gainLoss.toFixed(2)} (${gainLossPercent}%)`
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
}

async function handleView(interaction) {
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
    const marketCap = ((s.price * s.totalIssued) / 1_000_000).toFixed(1);
    const ownership = ((s.volume / s.totalIssued) * 100).toFixed(1);

    let momentumEmoji = "➡️";
    if (s.momentum > 0.3) momentumEmoji = "📈📈";
    else if (s.momentum > 0) momentumEmoji = "📈";
    else if (s.momentum < -0.3) momentumEmoji = "📉📉";
    else if (s.momentum < 0) momentumEmoji = "📉";

    const volatilityBadge =
      s.volatility === "low" ? "🟢" : s.volatility === "medium" ? "🟡" : "🔴";

    return (
      `${volatilityBadge} **${s.symbol}** — ${s.name}\n` +
      `💰 $${s.price.toFixed(2)} | Market Cap: $${marketCap}M\n` +
      `📊 Owned: ${ownership}% | Traded: ${(s.totalVolumeTraded || 0).toLocaleString()} shares\n` +
      `${momentumEmoji} Momentum: ${((s.momentum || 0) * 100).toFixed(0)}%`
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
}
