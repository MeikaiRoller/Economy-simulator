const mongoose = require("mongoose");
const Stock = require("./schema/Stock");
require("dotenv").config();

const defaultStocks = [
  {
    symbol: "SAUCE",
    name: "Nether Sauce Inc.",
    price: 4.25,
    availableShares: 100_000_000,
  },
  {
    symbol: "STEVE",
    name: "Steve's Chicken",
    price: 8.5,
    availableShares: 100_000_000,
  },
  {
    symbol: "MEIKAI",
    name: "Meikai's Kindred Inc.",
    price: 15.75,
    availableShares: 100_000_000,
  },
  {
    symbol: "JUSTIN",
    name: "Baddie Alert",
    price: 3.4,
    availableShares: 100_000_000,
  },
  {
    symbol: "CHICKEN",
    name: "Chicken Jockey",
    price: 11.25,
    availableShares: 100_000_000,
  },
];

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI); // ✅ match the env name

    console.log("Connected to MongoDB");

    for (const stockData of defaultStocks) {
      const exists = await Stock.findOne({ symbol: stockData.symbol });
      if (!exists) {
        const stock = new Stock({
          ...stockData,
          volume: 0,
          lastUpdated: new Date(),
          history: [stockData.price],
        });
        await stock.save();
        console.log(`✅ Added ${stock.symbol}`);
      }
    }

    console.log("Seeding complete.");
    process.exit();
  } catch (err) {
    console.error("❌ Seeding failed", err);
    process.exit(1);
  }
})();
