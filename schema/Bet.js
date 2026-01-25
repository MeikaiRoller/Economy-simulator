const mongoose = require("mongoose");

const BetSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  horse: { type: String, required: true },
  odds: { type: Number, required: true }, // Horse's odds at time of bet
  betAmount: { type: Number, required: true, default: 10_000 },
  raceHour: { type: Date, required: true }, // Which hour's race (start of hour)
});

// Unique constraint: one bet per user per race hour
BetSchema.index({ userId: 1, raceHour: 1 }, { unique: true });

module.exports = mongoose.model("Bet", BetSchema);
