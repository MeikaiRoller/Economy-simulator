const mongoose = require("mongoose");

const MarketMetaSchema = new mongoose.Schema({
  sentiment: {
    type: String,
    enum: ["bullish", "bearish", "neutral", "crash"],
    default: "neutral"
  },
  driftMultiplier: {
    type: Number,
    default: 1
  },
  turnsRemaining: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("MarketMeta", MarketMetaSchema);
