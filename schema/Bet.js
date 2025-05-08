const mongoose = require("mongoose");

const BetSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  horse: { type: String, required: true },
  date: { type: Date, required: true }, // date of race
});

module.exports = mongoose.model("Bet", BetSchema);
