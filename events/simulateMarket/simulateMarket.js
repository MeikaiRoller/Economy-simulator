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

    meta.sentiment = sentiment;
    meta.driftMultiplier = multiplier;
    meta.turnsRemaining = duration;
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
    if (!stock.availableShares || stock.availableShares <= 0) continue;

    const oldPrice = stock.price;

    let drift;
    const roll = Math.random();
    let positiveBias = 0.55;
    let magnitude;

    if (stock.volatility === "high") {
      magnitude = Math.random() * 0.15;
      positiveBias = 0.5;
    } else if (stock.volatility === "low") {
      magnitude = Math.random() * 0.02;
      positiveBias = 0.6;
    } else {
      magnitude = Math.random() * 0.04;
      positiveBias = 0.55;
    }

    if (roll < 0.05) {
      drift = 1 + Math.random() * 0.2;
    } else if (roll < 0.1) {
      drift = 1 - Math.random() * 0.2;
    } else {
      drift = 1 + (Math.random() < positiveBias ? magnitude : -magnitude);
    }

    drift *= meta.driftMultiplier;
    drift = Math.min(Math.max(drift, 0.85), 1.15);

    let newPrice = stock.price * drift;

    stock.price = parseFloat(Math.max(0.30, newPrice).toFixed(2));
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
