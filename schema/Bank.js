const mongoose = require("mongoose");

const bankSchema = new mongoose.Schema({
  name: { type: String, default: "central" },
  balance: { type: Number, default: 0 },
});

module.exports = mongoose.model("Bank", bankSchema);
