const { EmbedBuilder } = require("discord.js");
const Stock = require("../../schema/Stock");
const MarketMeta = require("../../schema/MarketMeta");
const MarketSnapshot = require("../../schema/MarketSnapshot");


async function simulateMarket(client) {
  let meta = await MarketMeta.findOne();
  if (!meta) {
    meta = await MarketMeta.create({
      sentiment: "neutral",
      driftMultiplier: 1,
      turnsRemaining: 0
    });
  }

  if (meta.turnsRemaining <= 0) {
    const newsRoll = Math.random();
    let sentiment;
    let multiplier;
    let duration = Math.floor(Math.random() * 3) + 1;

    if (newsRoll < 0.0001) {
      sentiment = "crash";
      multiplier = 1 - Math.random() * 0.15;
    } else if (newsRoll < 0.34) {
      sentiment = "bullish";
      multiplier = 1 + Math.random() * 0.05;
    } else if (newsRoll < 0.67) {
      sentiment = "bearish";
      multiplier = 1 - Math.random() * 0.05;
    } else {
      sentiment = "neutral";
      multiplier = 1 + (Math.random() * 0.02 - 0.01);
    }

    // Random sector event (20% chance)
    let sectorEvent = null;
    if (Math.random() < 0.2) {
      const sectors = ["tech", "food", "mystical", "entertainment"];
      const randomSector = sectors[Math.floor(Math.random() * sectors.length)];
      const isPositive = Math.random() < 0.6;
      sectorEvent = {
        sector: randomSector,
        positive: isPositive,
        multiplier: isPositive ? 1.08 : 0.92
      };
    }

    meta.sentiment = sentiment;
    meta.driftMultiplier = multiplier;
    meta.turnsRemaining = duration;
    meta.sectorEvent = sectorEvent;
  } else {
    meta.turnsRemaining -= 1;
  }
  await meta.save();

  const stocks = await Stock.find();

  const updates = {
    low: [],
    medium: [],
    high: []
  };

  for (const stock of stocks) {
    if (!stock.totalIssued || stock.totalIssued <= 0) continue;

    // Set fundamental price if not set (first time)
    if (!stock.fundamentalPrice) {
      stock.fundamentalPrice = stock.price;
    }

    const oldPrice = stock.price;
    let drift;
    let volatilityMultiplier;

    // Volatility affects price movement range
    if (stock.volatility === "high") {
      volatilityMultiplier = 0.04; // Reduced from 8% to 4%
    } else if (stock.volatility === "low") {
      volatilityMultiplier = 0.01; // Reduced from 1.5% to 1%
    } else {
      volatilityMultiplier = 0.02; // Reduced from 3% to 2%
    }

    // Mean reversion: pull price back toward fundamental value
    const priceDeviation = (stock.price - stock.fundamentalPrice) / stock.fundamentalPrice;
    const meanReversionForce = -priceDeviation * 0.05; // 5% pull toward fundamental

    // Random walk with sentiment drift
    const randomComponent = (Math.random() - 0.5) * 2 * volatilityMultiplier;
    const sentimentComponent = meta.driftMultiplier - 1;
    const momentumComponent = stock.momentum * 0.005; // Reduced from 2% to 0.5%
    drift = 1 + randomComponent + sentimentComponent * 0.3 + momentumComponent + meanReversionForce;

    // Apply sector event if applicable
    if (meta.sectorEvent && stock.sector === meta.sectorEvent.sector) {
      drift *= meta.sectorEvent.multiplier;
    }

    // Clamp drift to reasonable bounds
    drift = Math.min(Math.max(drift, 0.92), 1.08);

    let newPrice = stock.price * drift;
    
    // Enforce minimum price as % of fundamental (prevents death spirals)
    const minPrice = stock.fundamentalPrice * 0.25; // Can't drop below 25% of fundamental
    const maxPrice = stock.fundamentalPrice * 4.0; // Can't rise above 400% of fundamental
    newPrice = Math.max(minPrice, Math.min(maxPrice, newPrice));
    
    stock.price = parseFloat(Math.max(0.01, newPrice).toFixed(2));

    // Update momentum: trending up if price increased, down if decreased
    const priceChange = stock.price - oldPrice;
    if (priceChange > 0) {
      stock.momentum = Math.min(stock.momentum + 0.1, 1); // Reduced from 0.2 to 0.1
    } else if (priceChange < 0) {
      stock.momentum = Math.max(stock.momentum - 0.1, -1); // Reduced from 0.2 to 0.1
    } else {
      stock.momentum *= 0.9; // Slower decay
    }

    stock.lastUpdated = new Date();
    stock.history.push(stock.price);
    if (stock.history.length > 500) {
      stock.history = stock.history.slice(-500);
    }
    await stock.save();
    

    const change = stock.price - oldPrice;
    const changePercent = (change / oldPrice) * 100;
    const direction = change >= 0 ? "📈" : "📉";

    let severity = "";
    if (Math.abs(changePercent) >= 20) {
      severity = "💥";
    } else if (Math.abs(changePercent) >= 10) {
      severity = "🔥";
    } else if (Math.abs(changePercent) >= 5) {
      severity = "⚠️";
    }

    const formattedChangePercent =
      changePercent >= 0
        ? `🔺 +${changePercent.toFixed(2)}%`
        : `🔻 ${changePercent.toFixed(2)}%`;

    const line = `**${stock.symbol}** ${direction}${severity} $${oldPrice.toFixed(2)} → $${stock.price.toFixed(2)}  (${formattedChangePercent})`;

    updates[stock.volatility]?.push(line);
  }
  await MarketSnapshot.create({
    sentiment: meta.sentiment,
    driftMultiplier: meta.driftMultiplier,
    turnsRemaining: meta.turnsRemaining,
    stocks: stocks.map(stock => ({
      symbol: stock.symbol,
      price: stock.price,
      volatility: stock.volatility,
      history: stock.history.slice(-10) // save last 10 prices
    }))
  });

  const embed = new EmbedBuilder()
    .setTitle("📊 Market Update")
    .setColor(0x3498db)
    .setFooter({ text: "Prices updated based on market drift and scarcity" })
    .setTimestamp();

  if (updates.low.length > 0) {
    embed.addFields({ name: "🟢 Low Volatility", value: updates.low.join("\n") });
  }

  if (updates.medium.length > 0) {
    embed.addFields({ name: "🟡 Medium Volatility", value: updates.medium.join("\n") });
  }

  if (updates.high.length > 0) {
    embed.addFields({ name: "🔴 High Volatility", value: updates.high.join("\n") });
  }

  const channel = client.channels.cache.find(
    (ch) => ch.name === "stock-market-news" && ch.isTextBased()
  );

  if (channel) {
    channel.send({ embeds: [embed] }).catch(console.error);
  } else {
    console.warn("❌ stock-market-news channel not found.");
  }

  console.log("✅ Simulated market update complete.");

  
}

module.exports = simulateMarket;
