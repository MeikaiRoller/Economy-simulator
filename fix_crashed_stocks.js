const mongoose = require("mongoose");
const Stock = require("./schema/Stock");
require("dotenv").config();

// Original stock prices to restore as fundamentals
const fundamentalPrices = {
  "SAUCE": 4.25,
  "STEVE": 8.5,
  "MEIKAI": 15.75,
  "JUSTIN": 3.4,
  "CHICKEN": 11.25,
  "ETHAN": 9.85,
  "MOON": 6.25,
  "FLOP": 4.60,
  "GOON": 3.75,
  "DRAKE": 1.95,
  "MARIE": 2.45,
};

async function fixCrashedStocks() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");
    console.log("\n🔧 Fixing crashed stocks and setting fundamentals...\n");

    const stocks = await Stock.find();

    for (const stock of stocks) {
      const fundamentalPrice = fundamentalPrices[stock.symbol];
      
      if (!fundamentalPrice) {
        console.log(`⚠️  No fundamental price for ${stock.symbol}, skipping...`);
        continue;
      }

      const oldPrice = stock.price;
      
      // Set fundamental price
      stock.fundamentalPrice = fundamentalPrice;
      
      // If stock has crashed below 50% of fundamental, restore to 75%
      if (stock.price < fundamentalPrice * 0.5) {
        stock.price = parseFloat((fundamentalPrice * 0.75).toFixed(2));
        console.log(`🔄 ${stock.symbol}: Restored from $${oldPrice.toFixed(2)} to $${stock.price.toFixed(2)} (fundamental: $${fundamentalPrice})`);
      } else {
        console.log(`✅ ${stock.symbol}: $${stock.price.toFixed(2)} (fundamental: $${fundamentalPrice}) - No restoration needed`);
      }
      
      // Reset negative momentum
      if (stock.momentum < -0.3) {
        stock.momentum = 0;
        console.log(`   ↗️  Reset momentum from ${stock.momentum} to 0`);
      }

      await stock.save();
    }

    console.log("\n✨ Stock recovery complete!\n");
    console.log("📋 Changes:");
    console.log("   - Set fundamental prices for mean reversion");
    console.log("   - Restored crashed stocks to 75% of fundamental");
    console.log("   - Reset negative momentum spirals");
    console.log("   - Market should now stabilize around fundamental values\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Recovery failed:", error);
    process.exit(1);
  }
}

fixCrashedStocks();
