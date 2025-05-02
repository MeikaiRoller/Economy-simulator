const mongoose = require("mongoose");

const StockPortfolioSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  holdings: [
    {
      symbol: String,
      quantity: Number,
      averagePrice: Number,
    },
  ],
});

module.exports = mongoose.model("StockPortfolio", StockPortfolioSchema);
