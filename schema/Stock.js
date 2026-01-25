const mongoose = require("mongoose");

const StockSchema = new mongoose.Schema({
  symbol: { type: String, required: true, unique: true },
  name: String,
  price: Number,
  fundamentalPrice: { type: Number }, // Base price for mean reversion
  volume: Number, // shares in circulation (owned by players)
  totalIssued: Number, // total shares ever created (fixed at seed)
  totalVolumeTraded: { type: Number, default: 0 }, // cumulative shares traded
  volatility: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium"
  },
  sector: {
    type: String,
    enum: ["tech", "food", "mystical", "entertainment"],
    default: "mystical"
  },
  momentum: { type: Number, default: 0 }, // -1 to 1: trending down to up
  lastUpdated: Date,
  history: [Number],
});

module.exports = mongoose.model("Stock", StockSchema);
