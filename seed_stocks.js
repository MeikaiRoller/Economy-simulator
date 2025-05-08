const mongoose = require("mongoose");
const Stock = require("./schema/Stock");
require("dotenv").config();

const defaultStocks = [
  {
    symbol: "SAUCE",
    name: "Nether Sauce Inc.",
    price: 4.25,
    availableShares: 100_000_000,
    volatility: "low"
  },
  {
    symbol: "STEVE",
    name: "Steve's Chicken",
    price: 8.5,
    availableShares: 100_000_000,
    volatility: "low"
  },
  {
    symbol: "MEIKAI",
    name: "Meikai's Kindred Inc.",
    price: 15.75,
    availableShares: 100_000_000,
    volatility: "low"
  },
  {
    symbol: "JUSTIN",
    name: "Baddie Alert",
    price: 3.4,
    availableShares: 100_000_000,
    volatility: "low"
  },
  {
    symbol: "CHICKEN",
    name: "Chicken Jockey",
    price: 11.25,
    availableShares: 100_000_000,
    volatility: "low"
  },
  //-- Medium Volatility Stocks --//
  {
    symbol: "ETHAN",
    name: "Ethan Head Solutions",
    price: 9.85,
    availableShares: 850_000,
    volatility: "medium"
  },
  {
    symbol: "MOON",
    name: "Definitely not going to the moon",
    price: 6.25,
    availableShares: 700_000,
    volatility: "medium"
  },
  {
    symbol: "FLOP",
    name: "Flopper dude",
    price: 4.60,
    availableShares: 1_000_000,
    volatility: "medium"
  },
  //-- High Volatility Stocks --//
  {
    symbol: "GOON",
    name: "Gooners United",
    price: 3.75,
    availableShares: 400_000,
    volatility: "high"
  },
  {
    symbol: "DRAKE",
    name: "Nah bro is drakin it",
    price: 1.95,
    availableShares: 250_000,
    volatility: "high"
  },
  {
    symbol: "MARIE",
    name: "huh, how did that get there",
    price: 2.45,
    availableShares: 500_000,
    volatility: "high"
  },
  
  //-- Extremely Volatility Stocks --//
  
  
];

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI); // ✅ match the env name

    console.log("Connected to MongoDB");

    for (const stockData of defaultStocks) {
      const existing = await Stock.findOne({ symbol: stockData.symbol });
    
      if (!existing) {
        // New stock, create it fully
        const stock = new Stock({
          ...stockData,
          volume: 0,
          lastUpdated: new Date(),
          history: [stockData.price],
          volatility: stockData.volatility || "medium", // default if not specified
        });
        await stock.save();
        console.log(`✅ Added new stock ${stock.symbol}`);
      } else {
        // Existing stock, only add missing fields like 'volatility'
        const updates = {};
    
        if (!existing.volatility) {
          updates.volatility = stockData.volatility || "medium";
        }
    
        if (Object.keys(updates).length > 0) {
          await Stock.updateOne({ symbol: stockData.symbol }, { $set: updates });
          console.log(`✏️ Updated ${stockData.symbol} with missing fields`);
        } else {
          console.log(`🔒 Skipped ${stockData.symbol} — already up-to-date`);
        }
      }
    }
    

    console.log("Seeding complete.");
    process.exit();
  } catch (err) {
    console.error("❌ Seeding failed", err);
    process.exit(1);
  }
})();
