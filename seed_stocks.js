const mongoose = require("mongoose");
const Stock = require("./schema/Stock");
require("dotenv").config();

const defaultStocks = [
  {
    symbol: "SAUCE",
    name: "Nether Sauce Co.",
    price: 4.25,
    totalIssued: 100_000_000,
    volatility: "low",
    sector: "food"
  },
  {
    symbol: "STEVE",
    name: "Steve's Poultry Farm",
    price: 8.5,
    totalIssued: 100_000_000,
    volatility: "low",
    sector: "food"
  },
  {
    symbol: "MEIKAI",
    name: "Meikai Epic Corp",
    price: 15.75,
    totalIssued: 100_000_000,
    volatility: "low",
    sector: "mystical"
  },
  {
    symbol: "JUSTIN",
    name: "Justin's Entertainment Labs",
    price: 3.4,
    totalIssued: 100_000_000,
    volatility: "low",
    sector: "entertainment"
  },
  {
    symbol: "CHICKEN",
    name: "Chicken Jockey Racing",
    price: 11.25,
    totalIssued: 100_000_000,
    volatility: "low",
    sector: "food"
  },
  //-- Medium Volatility Stocks --//
  {
    symbol: "ETHAN",
    name: "Ethan's Tech Solutions",
    price: 9.85,
    totalIssued: 850_000,
    volatility: "medium",
    sector: "tech"
  },
  {
    symbol: "MOON",
    name: "Moon Labs (Not Going Up)",
    price: 6.25,
    totalIssued: 700_000,
    volatility: "medium",
    sector: "tech"
  },
  {
    symbol: "FLOP",
    name: "Flopper Entertainment",
    price: 4.60,
    totalIssued: 1_000_000,
    volatility: "medium",
    sector: "entertainment"
  },
  //-- High Volatility Stocks --//
  {
    symbol: "GOON",
    name: "Goon Squad Entertainment",
    price: 3.75,
    totalIssued: 400_000,
    volatility: "high",
    sector: "entertainment"
  },
  {
    symbol: "DRAKE",
    name: "Drake's Drakin' Records",
    price: 1.95,
    totalIssued: 250_000,
    volatility: "high",
    sector: "entertainment"
  },
  {
    symbol: "MARIE",
    name: "Marie's Short Vibes",
    price: 2.45,
    totalIssued: 500_000,
    volatility: "high",
    sector: "mystical"
  },
];

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

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
        });
        await stock.save();
        console.log(`✅ Added new stock ${stock.symbol}`);
      } else {
        // Existing stock, update to use new schema
        const updates = {
          totalIssued: stockData.totalIssued,
          volatility: stockData.volatility || "medium",
        };
        // Only update if not already set
        if (!existing.totalIssued) {
          await Stock.updateOne({ symbol: stockData.symbol }, { $set: updates });
          console.log(`✏️ Updated ${stockData.symbol} with new schema`);
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
