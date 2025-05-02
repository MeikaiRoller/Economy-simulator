const { EmbedBuilder } = require("discord.js");
const Stock = require("../../schema/Stock");

async function simulateMarket(client) {
  const stocks = await Stock.find();
  const updates = [];

  for (const stock of stocks) {
    if (!stock.availableShares || stock.availableShares <= 0) continue;

    const oldPrice = stock.price;

    // 📉 Random drift
    let drift;

    const roll = Math.random();
    const positiveBias = 0.55; // 55% chance to go up
    const magnitude = Math.random() * 0.02;
    if (roll < 0.1) {
      // 10% chance of a big surge (up to +20%)
      drift = 1 + Math.random() * 0.2;
    } else if (roll < 0.2) {
      // 10% chance of a big crash (down to -20%)
      drift = 1 - Math.random() * 0.2;
    } else {
      // Normal drift ±2%
      drift = 1 + (Math.random() < positiveBias ? magnitude : -magnitude);
    }

    let newPrice = stock.price * drift;

    // 📦 Scarcity-based adjustment

    const totalShares = stock.availableShares + stock.volume;
    if (totalShares > 0) {
      const scarcityFactor = 0.3;
      const scarcityMultiplier =
        1 + (1 - stock.availableShares / totalShares) * scarcityFactor;
      newPrice *= scarcityMultiplier;
    }

    stock.price = parseFloat(Math.max(0.01, newPrice).toFixed(2));
    stock.lastUpdated = new Date();
    stock.history.push(stock.price);
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

    updates.push(
      `**${stock.symbol}** ${direction}${severity} $${oldPrice.toFixed(
        2
      )} → $${stock.price.toFixed(2)}  (${formattedChangePercent})`
    );
  }

  if (updates.length > 0) {
    const embed = new EmbedBuilder()
      .setTitle("📊 Market Update")
      .setDescription(updates.join("\n"))
      .setColor(0x3498db)
      .setFooter({ text: "Prices updated based on market drift and scarcity" })
      .setTimestamp();

    const channel = client.channels.cache.find(
      (ch) => ch.name === "stock-market-news" && ch.isTextBased()
    );

    if (channel) {
      channel.send({ embeds: [embed] }).catch(console.error);
    } else {
      console.warn("❌ stock-market-news channel not found.");
    }
  }

  console.log("✅ Simulated market update complete.");
}

module.exports = simulateMarket;
