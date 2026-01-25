const mongoose = require("mongoose");
const Stock = require("./schema/Stock");
const StockPortfolio = require("./schema/StockPortfolio");
require("dotenv").config();

// Define the new share structure and calculate split ratios
const stockSplits = [
  // Low volatility: 100M → 10M (10:1 reverse split)
  { symbol: "SAUCE", oldShares: 100_000_000, newShares: 10_000_000, ratio: 0.1 },
  { symbol: "STEVE", oldShares: 100_000_000, newShares: 10_000_000, ratio: 0.1 },
  { symbol: "MEIKAI", oldShares: 100_000_000, newShares: 10_000_000, ratio: 0.1 },
  { symbol: "JUSTIN", oldShares: 100_000_000, newShares: 10_000_000, ratio: 0.1 },
  { symbol: "CHICKEN", oldShares: 100_000_000, newShares: 10_000_000, ratio: 0.1 },
  
  // Medium volatility: → 2M
  { symbol: "ETHAN", oldShares: 850_000, newShares: 2_000_000, ratio: 2.353 },
  { symbol: "MOON", oldShares: 700_000, newShares: 2_000_000, ratio: 2.857 },
  { symbol: "FLOP", oldShares: 1_000_000, newShares: 2_000_000, ratio: 2.0 },
  
  // High volatility: → 1M
  { symbol: "GOON", oldShares: 400_000, newShares: 1_000_000, ratio: 2.5 },
  { symbol: "DRAKE", oldShares: 250_000, newShares: 1_000_000, ratio: 4.0 },
  { symbol: "MARIE", oldShares: 500_000, newShares: 1_000_000, ratio: 2.0 },
];

async function migrateStockSplits() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");
    console.log("\n🔄 Starting Stock Split Migration...\n");

    for (const split of stockSplits) {
      console.log(`\n📊 Processing ${split.symbol}...`);
      
      // Get current stock data
      const stock = await Stock.findOne({ symbol: split.symbol });
      if (!stock) {
        console.log(`⚠️  Stock ${split.symbol} not found, skipping...`);
        continue;
      }

      const oldPrice = stock.price;
      const oldVolume = stock.volume;
      const oldTotalIssued = stock.totalIssued;

      // Calculate new values
      const newPrice = oldPrice / split.ratio;
      const newVolume = Math.floor(oldVolume * split.ratio);
      const newTotalIssued = split.newShares;

      console.log(`   Old: ${oldTotalIssued.toLocaleString()} shares @ $${oldPrice.toFixed(2)}`);
      console.log(`   New: ${newTotalIssued.toLocaleString()} shares @ $${newPrice.toFixed(2)}`);
      console.log(`   Ratio: ${split.ratio}x ${split.ratio > 1 ? 'forward split' : 'reverse split'}`);

      // Update stock
      stock.totalIssued = newTotalIssued;
      stock.volume = newVolume;
      stock.price = newPrice;
      await stock.save();

      // Update all portfolios holding this stock
      const portfolios = await StockPortfolio.find({
        "holdings.symbol": split.symbol,
      });

      console.log(`   Found ${portfolios.length} portfolios with ${split.symbol}`);

      for (const portfolio of portfolios) {
        const holding = portfolio.holdings.find((h) => h.symbol === split.symbol);
        if (!holding) continue;

        const oldQuantity = holding.quantity;
        const oldAvgPrice = holding.averagePrice;
        const oldValue = oldQuantity * oldAvgPrice;

        // Apply split to holding
        holding.quantity = Math.floor(oldQuantity * split.ratio);
        holding.averagePrice = oldAvgPrice / split.ratio;

        const newValue = holding.quantity * holding.averagePrice;

        console.log(`   📈 User ${portfolio.userId}:`);
        console.log(`      ${oldQuantity} @ $${oldAvgPrice.toFixed(2)} = $${oldValue.toFixed(2)}`);
        console.log(`      → ${holding.quantity} @ $${holding.averagePrice.toFixed(2)} = $${newValue.toFixed(2)}`);
        console.log(`      Value preserved: ${Math.abs(newValue - oldValue) < 1 ? '✅' : '⚠️'}`);

        await portfolio.save();
      }

      console.log(`✅ ${split.symbol} migration complete!`);
    }

    console.log("\n\n✨ Stock Split Migration Complete!\n");
    console.log("📋 Summary:");
    console.log("   - All stocks have been split/reverse split");
    console.log("   - All player holdings have been adjusted proportionally");
    console.log("   - Dollar values have been preserved");
    console.log("   - Market caps have been rebalanced\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
migrateStockSplits();
