const mongoose = require("mongoose");

const MarketSnapshotSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  sentiment: String,
  driftMultiplier: Number,
  turnsRemaining: Number,
  stocks: [
    {
      symbol: String,
      price: Number,
      volatility: String,
      history: [Number]
    }
  ]
});

module.exports = mongoose.model("MarketSnapshot", MarketSnapshotSchema);
